import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  UtensilsCrossed,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calculator,
  FileSpreadsheet,
  Download,
  Copy,
  Plus,
  ArrowRight,
  ShieldCheck,
  Search,
  ChevronRight,
  Info,
  Calendar,
  Sparkles,
  RefreshCw,
  X,
  FileText,
  BadgeCheck,
  Scale,
  Apple,
  Milk,
  Wheat,
  Drumstick,
  Carrot,
  Fish,
  Eye,
  Check,
  Building2,
  Layers,
  Trash2,
  Loader2,
} from 'lucide-react'

import {
  NATIONAL_MENU_PACKAGES,
  AKG_COHORTS,
  INITIAL_SUBSTITUTIONS,
  BATCH_TRACEABILITY_LOGS,
} from '../../data/sppgRecipesData'
import { useAuth } from '../../context/AuthContext'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import {
  fetchSppgRecipeBundle,
  toggleSppgMenuLock,
  updateSppgDailyRecipeState,
  submitSppgSubstitution,
  createSppgMenuPackage,
} from '../../lib/api'

// Daftar ruang dapur SPPG binaan nasional untuk simulasi multi-tenant / inspeksi Superadmin
const SPPG_SPACES = [
  { id: 'SPPG-01', name: 'SPPG Sentral Menteng 01', city: 'Jakarta Pusat' },
  { id: 'SPPG-02', name: 'SPPG Kebayoran Baru Mandiri', city: 'Jakarta Selatan' },
  { id: 'SPPG-03', name: 'SPPG Tebet Timur Raya', city: 'Jakarta Selatan' },
  { id: 'SPPG-04', name: 'SPPG Cakung Industri Prima', city: 'Jakarta Timur' },
]

export function SppgRecipesPanel() {
  const { user } = useAuth()
  const isSuperadmin = user?.role === 'superadmin'

  // Multi-Tenant Isolation: SPPG staff terikat mutlak ke sppgId miliknya, Superadmin dapat memilih dapur
  const [activeSppgId, setActiveSppgId] = useState(() => {
    if (user?.role === 'sppg' && user?.sppgId) return user.sppgId
    return 'SPPG-01'
  })
  const [kitchenName, setKitchenName] = useState('SPPG Sentral Menteng 01')

  // Loading & Async Statuses
  const [isLoadingBundle, setIsLoadingBundle] = useState(true)
  const [isLocking, setIsLocking] = useState(false)
  const [isSavingPortions, setIsSavingPortions] = useState(false)
  const [isSubmittingSub, setIsSubmittingSub] = useState(false)
  const [isCreatingMenu, setIsCreatingMenu] = useState(false)

  // Menu Packages State (supports adding new custom / cycle recipes)
  const [packages, setPackages] = useState(NATIONAL_MENU_PACKAGES)
  // Active Menu Package Selection (Paket A-D or custom added)
  const [selectedPackageId, setSelectedPackageId] = useState('paket-a')
  // Active Age Cohort (sd_bawah, sd_atas, smp)
  const [activeCohortKey, setActiveCohortKey] = useState('sd_atas')
  // Interactive Portion Count for Mass Procurement Calculator
  const [portionCount, setPortionCount] = useState(2500)
  // Active Tab View: 'recipe' | 'procurement' | 'traceability' | 'substitutions'
  const [activeTab, setActiveTab] = useState('recipe')
  // Lock Menu State for Today's Recipe
  const [isLocked, setIsLocked] = useState(true)
  const [lockTimestamp, setLockTimestamp] = useState('Hari ini, 04:09 WIB')
  const [dailyState, setDailyState] = useState(null)
  // Search query inside ingredients or batch logs
  const [searchQuery, setSearchQuery] = useState('')

  // Toast feedback
  const [toastMessage, setToastMessage] = useState(null)
  const [formError, setFormError] = useState('')
  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3200)
  }

  // Substitutions & Traceability Logs State
  const [substitutions, setSubstitutions] = useState(INITIAL_SUBSTITUTIONS)
  const [traceabilityLogs, setTraceabilityLogs] = useState(BATCH_TRACEABILITY_LOGS)
  const [isSubModalOpen, setIsSubModalOpen] = useState(false)
  const [isDetailBatchOpen, setIsDetailBatchOpen] = useState(null)
  const [isRunsheetModalOpen, setIsRunsheetModalOpen] = useState(false)
  const [isAddMenuModalOpen, setIsAddMenuModalOpen] = useState(false)
  const [isUnlockConfirmOpen, setIsUnlockConfirmOpen] = useState(false)

  // Memuat data bundle lengkap untuk ruang dapur aktif dari backend
  const loadBundle = useCallback(async (sppgIdToFetch) => {
    setIsLoadingBundle(true)
    try {
      const data = await fetchSppgRecipeBundle(sppgIdToFetch)
      if (data) {
        if (data.kitchenName) setKitchenName(data.kitchenName)
        if (data.packages && data.packages.length > 0) {
          setPackages(data.packages)
        }
        if (data.dailyState) {
          setDailyState(data.dailyState)
          if (data.dailyState.selectedPackageId) {
            setSelectedPackageId(data.dailyState.selectedPackageId)
          }
          if (data.dailyState.activeCohort) {
            setActiveCohortKey(data.dailyState.activeCohort)
          }
          if (data.dailyState.portionCount) {
            setPortionCount(data.dailyState.portionCount)
          }
          setIsLocked(Boolean(data.dailyState.isLocked))
          if (data.dailyState.lockedAt) {
            const dt = new Date(data.dailyState.lockedAt)
            setLockTimestamp(dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB')
          }
        }
        if (data.substitutions) {
          setSubstitutions(data.substitutions)
        }
        if (data.traceabilityLogs) {
          setTraceabilityLogs(data.traceabilityLogs)
        }
      }
    } catch (err) {
      console.error('Gagal memuat bundle resep dapur:', err)
    } finally {
      setIsLoadingBundle(false)
    }
  }, [])

  useEffect(() => {
    loadBundle(activeSppgId)
  }, [activeSppgId, loadBundle])

  // Substitution Form State
  const [subForm, setSubForm] = useState({
    originalItem: 'Daging Ayam Fillet Dada Segar',
    substituteItem: 'Ikan Kembung Segar Laut Jawa',
    supplier: 'Koperasi Nelayan Muara Angke (SKP-KKP No. 2891)',
    reason: 'Pasokan ayam potong lokal tertunda pengiriman akibat kendala rantai dingin supplier.',
    proteinVal: '23.5',
    calorieVal: '175',
    evidenceFileName: 'Dokumen_Berita_Acara_Pasar_29Sept.pdf',
  })

  // New Menu Form State
  const [newMenuForm, setNewMenuForm] = useState({
    code: 'PAKET-E-05',
    name: '',
    dayName: 'Jumat, 03 Oktober 2026',
    cycle: 'Siklus Menu Nasional Minggu I',
    description: '',
    allergens: 'Kedelai (Tahu/Tempe), Laktosa (Susu Sapi)',
    haccpPoint: 'CCP-1: Suhu inti masak lauk hewani wajib ≥ 75°C selama 2 menit.',
    servingStandardTemp: 'Penyajian hangat wadah termal ≥ 60°C, susu dingin 4°–8°C',
    ingredients: [
      {
        id: 'ing-new-1',
        name: 'Nasi Putih / Beras Organik Lokal',
        category: 'Karbohidrat Pokok',
        tkpiCode: 'TKPI-A-01',
        perPortionGram: 150,
        unit: 'gram',
        procurementUnit: 'kg',
        multiplierPerPortion: 0.15,
        calories: 195,
        protein: 4.2,
        carbs: 43.5,
        fat: 0.5,
        fiber: 0.8,
        supplier: 'Gapoktan Subur Menteng Mandiri',
        nkvOrCert: 'SNI 6729:2016 · KEMTAN RI PD 31.71',
        currentBatch: 'LOT-BRS-2609-041',
        batchExpiry: '28 Des 2026',
        qcStatus: 'PASS',
        qcNote: 'Standar beras pulen premium BGN',
      },
      {
        id: 'ing-new-2',
        name: 'Daging Ayam Fillet / Ikan Laut Segar',
        category: 'Protein Hewani',
        tkpiCode: 'TKPI-B-12',
        perPortionGram: 80,
        unit: 'gram',
        procurementUnit: 'kg',
        multiplierPerPortion: 0.08,
        calories: 180,
        protein: 23.8,
        carbs: 0.0,
        fat: 8.4,
        fiber: 0.0,
        supplier: 'PT Sumber Unggas Prima',
        nkvOrCert: 'NKV RPHU-3171-004 · Halal MUI',
        currentBatch: 'LOT-HEW-2026-09',
        batchExpiry: '30 Sept 2026 (Chilled 2°C)',
        qcStatus: 'PASS',
        qcNote: 'Uji strip formalin negatif, pH normal',
      },
      {
        id: 'ing-new-3',
        name: 'Tahu / Tempe Kedelai Segar Non-GMO',
        category: 'Protein Nabati',
        tkpiCode: 'TKPI-C-05',
        perPortionGram: 50,
        unit: 'gram',
        procurementUnit: 'kg',
        multiplierPerPortion: 0.05,
        calories: 42,
        protein: 4.9,
        carbs: 1.5,
        fat: 2.1,
        fiber: 0.8,
        supplier: 'Koperasi Tempe Tahu Menteng Mandiri',
        nkvOrCert: 'SPP-IRT 2153171010023',
        currentBatch: 'LOT-NAB-2026-04',
        batchExpiry: '30 Sept 2026',
        qcStatus: 'PASS',
        qcNote: 'Kenyal alami, bebas formalin',
      },
      {
        id: 'ing-new-4',
        name: 'Sayur Segar Pilihan (Bayam / Brokoli / Labu)',
        category: 'Serat & Vitamin',
        tkpiCode: 'TKPI-D-18',
        perPortionGram: 75,
        unit: 'gram',
        procurementUnit: 'kg',
        multiplierPerPortion: 0.075,
        calories: 35,
        protein: 1.8,
        carbs: 6.8,
        fat: 0.4,
        fiber: 3.8,
        supplier: 'Petani Mitra Sayur Cianjur',
        nkvOrCert: 'GAP Prima-3 No. P3-3203-019',
        currentBatch: 'LOT-VEG-2026-11',
        batchExpiry: '01 Okt 2026',
        qcStatus: 'PASS',
        qcNote: 'Ozone rinse, bebas pestisida',
      },
      {
        id: 'ing-new-5',
        name: 'Buah Segar Musiman (Pisang / Jeruk / Pepaya)',
        category: 'Buah Segar',
        tkpiCode: 'TKPI-E-02',
        perPortionGram: 100,
        unit: 'buah (100g)',
        procurementUnit: 'buah',
        multiplierPerPortion: 1,
        calories: 85,
        protein: 1.0,
        carbs: 21.5,
        fat: 0.2,
        fiber: 2.4,
        supplier: 'Koperasi Buah Nusantara Sejahtera',
        nkvOrCert: 'KEMTAN Prima-2 Mutu Segar',
        currentBatch: 'LOT-FRT-2026-08',
        batchExpiry: '03 Okt 2026',
        qcStatus: 'PASS',
        qcNote: 'Matang pohon siap santap',
      },
      {
        id: 'ing-new-6',
        name: 'Susu Pasteurisasi UHT Segar 125ml',
        category: 'Minuman Gizi Tambahan',
        tkpiCode: 'TKPI-F-01',
        perPortionGram: 125,
        unit: 'kotak (125ml)',
        procurementUnit: 'kotak',
        multiplierPerPortion: 1,
        calories: 80,
        protein: 4.2,
        carbs: 6.2,
        fat: 4.0,
        fiber: 0.0,
        supplier: 'PT Greenfields Dairy Indonesia',
        nkvOrCert: 'NKV UHT-3507-009',
        currentBatch: 'MILK-UHT-2609A-11',
        batchExpiry: '15 Maret 2027',
        qcStatus: 'PASS',
        qcNote: 'Kemasan steril utuh, pH 6.7',
      },
    ],
  })

  // Calculated Nutrition for the New Menu Form
  const newMenuCalculatedNutrition = useMemo(() => {
    let calories = 0
    let protein = 0
    let carbs = 0
    let fat = 0
    let fiber = 0
    newMenuForm.ingredients.forEach((ing) => {
      calories += Number(ing.calories) || 0
      protein += Number(ing.protein) || 0
      carbs += Number(ing.carbs) || 0
      fat += Number(ing.fat) || 0
      fiber += Number(ing.fiber) || 0
    })
    return {
      calories: Math.round(calories),
      protein: Number(protein.toFixed(1)),
      carbs: Number(carbs.toFixed(1)),
      fat: Number(fat.toFixed(1)),
      fiber: Number(fiber.toFixed(1)),
      calcium: 280,
      iron: 2.8,
    }
  }, [newMenuForm.ingredients])

  // Currently selected package object
  const currentPackage = useMemo(() => {
    return (
      packages.find((p) => p.id === selectedPackageId) ||
      packages[0]
    )
  }, [packages, selectedPackageId])

  // Active Cohort object
  const activeCohort = AKG_COHORTS[activeCohortKey] || AKG_COHORTS.sd_atas

  // Scaled nutritional calculation based on selected cohort factor
  const scaledNutrition = useMemo(() => {
    const factor = activeCohort.portionFactor
    const base = currentPackage.nutrition
    return {
      calories: Math.round(base.calories * factor),
      protein: (base.protein * factor).toFixed(1),
      carbs: (base.carbs * factor).toFixed(1),
      fat: (base.fat * factor).toFixed(1),
      fiber: (base.fiber * factor).toFixed(1),
      calcium: Math.round(base.calcium * factor),
      iron: (base.iron * factor).toFixed(1),
    }
  }, [currentPackage, activeCohort])

  // Kepatuhan kelima zat terhadap rentang AKG.
  // Sebelumnya hanya energi dan protein yang dicek;badge。原本 Karbohidrat,
  // Lemak, dan Serat menampilkan kata dekoratif ("Energi", "Terkontrol",
  // "Pencernaan") yang terlihat seperti hasil evaluasi padahal tidak.
  const akgCompliance = useMemo(() => {
    const check = (value, target) => {
      const v = parseFloat(value)
      if (Number.isNaN(v)) return 'TIDAK ADA DATA'
      if (v < target.min) return 'KURANG'
      if (v > target.max) return 'LEBIH'
      return 'SESUAI'
    }
    const calStatus = check(scaledNutrition.calories, activeCohort.targetCalories)
    const protStatus = check(scaledNutrition.protein, activeCohort.targetProtein)
    const carbStatus = check(scaledNutrition.carbs, activeCohort.targetCarbs)
    const fatStatus = check(scaledNutrition.fat, activeCohort.targetFat)
    const fiberStatus = check(scaledNutrition.fiber, activeCohort.targetFiber)

    const all = [calStatus, protStatus, carbStatus, fatStatus, fiberStatus]
    return {
      calStatus,
      protStatus,
      carbStatus,
      fatStatus,
      fiberStatus,
      compliant: all.filter((s) => s === 'SESUAI').length,
      total: all.length,
    }
  }, [scaledNutrition, activeCohort])

  // Posisi nilai di dalam rentang AKG, 0..100.
  // Bathtub lama memakai `nilai / ideal` yang mentok di 100%, sehingga kelebihan
  // 20% tetap terlihat "penuh". Sekarang batang menunjukkan jarak ke batas.
  const rangePosition = (value, target) => {
    const v = parseFloat(value)
    if (Number.isNaN(v) || target.max === target.min) return 0
    const ratio = (v - target.min) / (target.max - target.min)
    return Math.max(0, Math.min(100, ratio * 100))
  }

  // Procurement calculation (Porsi x Gramatur)
  const procurementItems = useMemo(() => {
    const safePortions = Number(portionCount) > 0 ? Number(portionCount) : 0
    return currentPackage.ingredients.map((ing) => {
      let totalNeededQty = 0
      let totalFormatted = ''

      if (ing.procurementUnit === 'kg') {
        const kgNeeded = (safePortions * ing.perPortionGram) / 1000
        totalNeededQty = kgNeeded
        totalFormatted = `${kgNeeded.toLocaleString('id-ID', {
          maximumFractionDigits: 1,
        })} kg`
      } else {
        totalNeededQty = safePortions
        totalFormatted = `${safePortions.toLocaleString('id-ID')} ${ing.procurementUnit}`
      }

      return {
        ...ing,
        totalNeededQty,
        totalFormatted,
      }
    })
  }, [currentPackage, portionCount])

  // Total weight of raw ingredients for kitchen storage
  const totalKitchenKg = useMemo(() => {
    const safePortions = Number(portionCount) > 0 ? Number(portionCount) : 0
    const sumKg = currentPackage.ingredients.reduce((acc, ing) => {
      if (ing.procurementUnit === 'kg') {
        return acc + (safePortions * ing.perPortionGram) / 1000
      }
      if (ing.procurementUnit === 'buah') {
        return acc + (safePortions * 0.1) // 100g per fruit
      }
      if (ing.procurementUnit === 'kotak') {
        return acc + (safePortions * 0.13) // ~130g per milk box
      }
      return acc
    }, 0)
    return sumKg.toFixed(1)
  }, [currentPackage, portionCount])

  // Filtered ingredients by search
  const filteredIngredients = useMemo(() => {
    if (!searchQuery.trim()) return currentPackage.ingredients
    const q = searchQuery.toLowerCase()
    return currentPackage.ingredients.filter(
      (ing) =>
        ing.name.toLowerCase().includes(q) ||
        ing.category.toLowerCase().includes(q) ||
        ing.tkpiCode.toLowerCase().includes(q) ||
        ing.supplier.toLowerCase().includes(q)
    )
  }, [currentPackage, searchQuery])

  // Filtered batch logs by search (menggunakan data realtime dari backend sesuai SPPG aktif)
  const filteredBatches = useMemo(() => {
    if (!searchQuery.trim()) return traceabilityLogs
    const q = searchQuery.toLowerCase()
    return traceabilityLogs.filter(
      (b) =>
        b.commodity.toLowerCase().includes(q) ||
        b.batchNo.toLowerCase().includes(q) ||
        (b.nkvNumber && b.nkvNumber.toLowerCase().includes(q)) ||
        b.supplier.toLowerCase().includes(q)
    )
  }, [traceabilityLogs, searchQuery])

  // Handle lock/unlock dengan proteksi audit BGN di backend
  const toggleMenuLock = async () => {
    const nextLocked = !isLocked

    setIsLocking(true)
    try {
      const res = await toggleSppgMenuLock(
        {
          sppgId: activeSppgId,
          isLocked: nextLocked,
          packageId: selectedPackageId,
        },
        activeSppgId
      )

      setIsLocked(nextLocked)
      if (res?.lockedAt) {
        const dt = new Date(res.lockedAt)
        setLockTimestamp(
          dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) +
            ', ' +
            dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) +
            ' WIB'
        )
      } else if (nextLocked) {
        const now = new Date()
        const timeStr = `${now.getDate()} ${
          ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sept', 'Okt', 'Nov', 'Des'][
            now.getMonth()
          ]
        } ${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}:${String(
          now.getMinutes()
        ).padStart(2, '0')} WIB`
        setLockTimestamp(timeStr)
      }

      showToast(
        nextLocked
          ? 'Menu resmi berhasil dikunci & terverifikasi Satgas MBG!'
          : 'Kunci menu dibuka. Anda dapat mengedit takaran atau mengajukan dispensasi substitusi.'
      )
    } catch (err) {
      showToast('Gagal mengubah status kunci menu: ' + (err.message || 'Kesalahan server'))
    } finally {
      setIsLocking(false)
      setIsUnlockConfirmOpen(false)
    }
  }

  // Membuka kunci resep resmi wajib dikonfirmasi karena tercatat pada audit revisi
  const handleToggleLock = () => {
    if (isLocked) {
      setIsUnlockConfirmOpen(true)
      return
    }
    toggleMenuLock()
  }

  // Handle simpan kuota porsi harian ke database dapur SPPG
  const handleSaveDailyPortions = async (customPortion = portionCount, customCohort = activeCohortKey) => {
    setIsSavingPortions(true)
    try {
      await updateSppgDailyRecipeState(
        {
          sppgId: activeSppgId,
          selectedPackageId,
          activeCohort: customCohort,
          portionCount: Number(customPortion) || 2500,
        },
        activeSppgId
      )
      showToast(
        `Alokasi ${Number(customPortion).toLocaleString('id-ID')} porsi tersimpan di ruang ${activeSppgId}!`
      )
    } catch (err) {
      showToast('Gagal menyimpan alokasi porsi: ' + (err.message || 'Kesalahan server'))
    } finally {
      setIsSavingPortions(false)
    }
  }

  // Handle submit substitution ke backend endpoint /api/sppg/recipes/substitutions
  const handleCreateSubstitution = async (e) => {
    e.preventDefault()
    if (!subForm.substituteItem.trim() || !subForm.reason.trim()) {
      setFormError('Isi bahan pengganti dan alasan kelangkaan komoditas.')
      return
    }
    setFormError('')
    setIsSubmittingSub(true)

    try {
      const payload = {
        sppgId: activeSppgId,
        menuCode: currentPackage.code,
        originalItem: subForm.originalItem,
        substituteItem: subForm.substituteItem,
        supplier: subForm.supplier,
        reason: subForm.reason,
        proteinVal: parseFloat(subForm.proteinVal) || 23.5,
        calorieVal: parseInt(subForm.calorieVal) || 175,
        evidenceFileName: subForm.evidenceFileName,
      }

      const res = await submitSppgSubstitution(payload, activeSppgId)

      const newTicket = res || {
        id: `SUB-${Date.now()}`,
        ticketNo: `DSP/MBG-JKP/2026/${Math.floor(100 + Math.random() * 900)}`,
        submittedAt: 'Baru saja',
        status: 'PENDING',
        statusLabel: 'Menunggu Verifikasi Satgas',
        menuCode: currentPackage.code,
        originalItem: {
          name: subForm.originalItem,
          category: 'Komoditas Terpilih',
          gramatur: 'Sesuai Standar TKPI',
          protein: 23.8,
          calories: 180,
        },
        substituteItem: {
          name: subForm.substituteItem,
          category: 'Komoditas Pengganti',
          gramatur: 'Sesuai Takaran Setara',
          protein: parseFloat(subForm.proteinVal) || 23.5,
          calories: parseInt(subForm.calorieVal) || 175,
          supplier: subForm.supplier,
        },
        nutritionalDelta: {
          proteinDiff: '-0.3g (setara)',
          caloriesDiff: '-5 kkal (dalam batas toleransi aman)',
          calorieDiff: '-5 kkal (dalam batas toleransi aman)',
          isCompliant: true,
        },
        reason: subForm.reason,
        evidenceFileName: subForm.evidenceFileName,
      }

      setSubstitutions((prev) => [newTicket, ...prev])
      setIsSubModalOpen(false)
      showToast('Dispensasi substitusi berhasil diajukan ke Satgas MBG!')
      setSubForm((prev) => ({
        ...prev,
        substituteItem: '',
        reason: '',
      }))
    } catch (err) {
      setFormError('Gagal mengajukan dispensasi: ' + (err.message || 'Kesalahan server'))
    } finally {
      setIsSubmittingSub(false)
    }
  }

  // Handle adding new ingredient row in new menu form
  const handleAddIngredientRow = () => {
    const newId = `ing-custom-${Date.now()}`
    setNewMenuForm({
      ...newMenuForm,
      ingredients: [
        ...newMenuForm.ingredients,
        {
          id: newId,
          name: 'Bahan Tambahan Baru',
          category: 'Pelengkap Gizi',
          tkpiCode: 'TKPI-CUSTOM',
          perPortionGram: 30,
          unit: 'gram',
          procurementUnit: 'kg',
          multiplierPerPortion: 0.03,
          calories: 25,
          protein: 1.5,
          carbs: 2.0,
          fat: 0.5,
          fiber: 0.5,
          supplier: 'Mitra Lokal SPPG',
          nkvOrCert: 'Standar Mutu Pangan',
          currentBatch: `LOT-CUS-${Date.now().toString().slice(-4)}`,
          batchExpiry: '03 Okt 2026',
          qcStatus: 'PASS',
          qcNote: 'QC lolos',
        },
      ],
    })
  }

  // Handle updating an ingredient in new menu form
  const handleUpdateIngredient = (index, field, value) => {
    const updated = [...newMenuForm.ingredients]
    updated[index] = {
      ...updated[index],
      [field]: value,
    }
    // Auto sync multiplier if gramatur changed
    if (field === 'perPortionGram' && updated[index].procurementUnit === 'kg') {
      updated[index].multiplierPerPortion = Number(value) / 1000
    }
    setNewMenuForm({ ...newMenuForm, ingredients: updated })
  }

  // Handle removing ingredient row
  const handleRemoveIngredient = (index) => {
    if (newMenuForm.ingredients.length <= 1) {
      setFormError('Resep minimal harus memiliki satu bahan baku.')
      return
    }
    setFormError('')
    const updated = newMenuForm.ingredients.filter((_, i) => i !== index)
    setNewMenuForm({ ...newMenuForm, ingredients: updated })
  }

  // Handle submit new menu ke backend
  const handleCreateNewMenu = async (e) => {
    e.preventDefault()
    if (!newMenuForm.name.trim()) {
      setFormError('Masukkan nama menu hidangan.')
      return
    }
    setFormError('')
    setIsCreatingMenu(true)

    try {
      const allergenList = newMenuForm.allergens
        ? newMenuForm.allergens.split(',').map((s) => s.trim()).filter(Boolean)
        : ['Kedelai']

      const payload = {
        sppgId: activeSppgId,
        code: newMenuForm.code.trim() || `PAKET-${packages.length + 1}`,
        name: newMenuForm.name.trim(),
        tagline: 'Menu Baru Dapur · Terdaftar Ahli Gizi SPPG',
        dayName: newMenuForm.dayName,
        cycle: newMenuForm.cycle,
        description:
          newMenuForm.description.trim() ||
          'Kombinasi menu bergizi seimbang standar TKPI Kemenkes RI yang disusun oleh Ahli Gizi SPPG.',
        allergens: allergenList,
        haccpPoint: newMenuForm.haccpPoint,
        servingTempStandard: newMenuForm.servingStandardTemp,
        nutrition: newMenuCalculatedNutrition,
        ingredients: newMenuForm.ingredients,
        isNational: false,
      }

      const created = await createSppgMenuPackage(payload, activeSppgId)
      const finalPkg = created || {
        ...payload,
        id: `paket-${Date.now()}`,
        verifiedBy: 'Satgas MBG Wilayah Pusat (Siap Verifikasi)',
      }

      setPackages((prev) => [...prev, finalPkg])
      setSelectedPackageId(finalPkg.id)
      setIsAddMenuModalOpen(false)
      showToast(`Menu "${finalPkg.name}" berhasil ditambahkan ke siklus dapur!`)
    } catch (err) {
      setFormError('Gagal menyimpan menu: ' + (err.message || 'Kesalahan server'))
    } finally {
      setIsCreatingMenu(false)
    }
  }

  return (
    <div className="space-y-5 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <BadgeCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Konfirmasi pembuka kunci resep resmi */}
      <ConfirmDialog
        isOpen={isUnlockConfirmOpen}
        tone="warning"
        eyebrow="Audit Revisi Menu"
        title="Buka kunci resep resmi?"
        description="Menu saat ini terkunci dan terverifikasi. Membuka kunci akan mencatat log revisi pada audit dapur."
        details={[
          selectedPackageId ? `Paket menu: ${selectedPackageId}` : null,
          lockTimestamp ? `Dikunci pada: ${lockTimestamp}` : null,
          'Takaran dan porsi dapat diubah kembali setelah dibuka.',
          'Revisi tercatat pada audit dan tidak dapat dihapus.',
        ].filter(Boolean)}
        confirmLabel="Ya, Buka Kunci"
        loading={isLocking}
        onCancel={() => !isLocking && setIsUnlockConfirmOpen(false)}
        onConfirm={toggleMenuLock}
      />

      {/* ========================================================================= */}
      {/* MULTI-TENANT KITCHEN SPACE HEADER (ISOLASI RUANG KERJA SPPG) */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3.5">
          {/* Active Kitchen Profile */}
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] tracking-wider uppercase font-bold bg-[#23259C] text-white px-2 py-0.5 rounded border border-indigo-400/30">
                  {activeSppgId}
                </span>
                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Ruang Kerja Dapur Mandiri
                </span>
                {isLocked ? (
                  <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5" />
                    Terkunci Resmi BGN
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Unlock className="h-2.5 w-2.5" />
                    Mode Draft / Buka Kunci
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-white tracking-tight mt-0.5 flex items-center gap-2">
                <span>{kitchenName}</span>
                <span className="text-xs font-normal text-slate-300">
                  · Target: <strong className="text-white font-bold">{portionCount.toLocaleString('id-ID')} Porsi</strong>
                </span>
              </h2>
            </div>
          </div>

          {/* Superadmin Tenant Switcher & Live Refresh */}
          <div className="flex flex-wrap items-center gap-2">
            {isSuperadmin ? (
              <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-xl border border-white/10 text-xs">
                <span className="text-[11px] text-slate-300 px-2 font-medium">
                  Inspeksi Dapur:
                </span>
                {SPPG_SPACES.map((space) => {
                  const isActive = space.id === activeSppgId
                  return (
                    <button
                      key={space.id}
                      onClick={() => setActiveSppgId(space.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        isActive
                          ? 'bg-[#23259C] text-white shadow-xs'
                          : 'text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                      title={space.name}
                    >
                      {space.id}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="text-[11px] text-slate-300 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl font-medium">
                Unit Terisolasi: <strong className="text-white">{user?.fullName || kitchenName}</strong>
              </div>
            )}

            <button
              onClick={() => loadBundle(activeSppgId)}
              disabled={isLoadingBundle}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10 transition cursor-pointer"
              title="Sinkronisasi data resep dari server"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingBundle ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TOP HEADER: CONTEXT & CONTROL BAR */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Title & Cycle Status */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#23259C]/10 text-[#23259C]">
                <Scale className="h-3 w-3" />
                Standar TKPI Kemenkes RI
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="h-3 w-3" />
                Sertifikasi NKV Terverifikasi
              </span>
              <span className="text-xs text-slate-600 font-medium">
                {currentPackage.cycle}
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span>{currentPackage.name}</span>
            </h1>
            <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
              {currentPackage.description}
            </p>
          </div>

          {/* Action Buttons: Lock & Modals */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Lock / Unlock Menu Action */}
            <button
              onClick={handleToggleLock}
              disabled={isLocking}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-60 ${
                isLocked
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
              }`}
            >
              {isLocking ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : isLocked ? (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span>Menu Terkunci (BGN Resmi)</span>
                </>
              ) : (
                <>
                  <Unlock className="h-3.5 w-3.5" />
                  <span>Kunci Menu Hari Ini</span>
                </>
              )}
            </button>

            {/* Substitution Dispensasi Button */}
            <button
              onClick={() => setIsSubModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition cursor-pointer"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span>Ajukan Substitusi</span>
            </button>

            {/* Tambah Menu Baru Button */}
            <button
              onClick={() => setIsAddMenuModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#23259C] hover:bg-[#1b1d7d] text-white shadow-sm transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah Menu</span>
            </button>

            {/* Runsheet Modal Button */}
            <button
              onClick={() => setIsRunsheetModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" />
              <span>Runsheet Dapur</span>
            </button>
          </div>
        </div>

        {/* Lock Metadata Ribbon */}
        {isLocked && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-600 gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>
                Resep dikonfirmasi dan diverifikasi oleh{' '}
                <strong className="text-slate-700">{dailyState?.verifiedBy || currentPackage.verifiedBy || 'Satgas MBG Wilayah Pusat'}</strong> pada{' '}
                <span className="text-slate-600">{lockTimestamp}</span>
              </span>
            </div>
            <div className="flex items-center gap-4 text-slate-600">
              <span>
                Titik Kritis HACCP: <strong className="text-slate-700">{currentPackage.haccpPoint}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SIKLUS MENU SELECTOR & NAVIGATION TABS */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        {/* Siklus Paket Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {packages.map((pkg) => {
            const isCurrent = pkg.id === selectedPackageId
            return (
              <button
                key={pkg.id}
                onClick={() => setSelectedPackageId(pkg.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  isCurrent
                    ? 'bg-[#23259C] text-white shadow-sm'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                <span>{pkg.code}</span>
                <span className="hidden md:inline font-normal opacity-90 truncate max-w-[150px]">
                  · {pkg.name.split('&')[0]}
                </span>
                {pkg.isLocked && isCurrent && (
                  <Lock className="h-3 w-3 text-emerald-300" />
                )}
              </button>
            )
          })}

          {/* Button Tambah Menu Baru */}
          <button
            onClick={() => setIsAddMenuModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-50 hover:bg-slate-100 text-[#23259C] border border-dashed border-[#23259C]/40 transition whitespace-nowrap cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tambah Menu</span>
          </button>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('recipe')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeTab === 'recipe'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Buku Resep & AKG
          </button>
          <button
            onClick={() => setActiveTab('procurement')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#23259C] gap-1.5 ${
              activeTab === 'procurement'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calculator className="h-3.5 w-3.5" />
            <span>Kalkulator Belanja</span>
          </button>
          <button
            onClick={() => setActiveTab('traceability')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#23259C] gap-1.5 ${
              activeTab === 'traceability'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
            <span>Log Batch NKV</span>
          </button>
          <button
            onClick={() => setActiveTab('substitutions')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#23259C] gap-1.5 ${
              activeTab === 'substitutions'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5 text-amber-500" />
            <span>Dispensasi Satgas ({substitutions.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: DETERMINISTIC NUTRITION CALCULATOR & COHORT VALIDATOR */}
      {/* ========================================================================= */}
      {(activeTab === 'recipe' || activeTab === 'procurement') && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#23259C]"></span>
                <h2 className="text-sm font-bold text-slate-900">
                  Kalkulator Makronutrien Deterministik & Validasi AKG
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Target gizi dihitung deterministik sesuai kelompok umur rujukan Permenkes No. 28/2019
              </p>
            </div>

            {/* Age Cohort Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold shrink-0">
              <span className="text-[11px] text-slate-500 px-2 font-medium">
                Target Sasaran:
              </span>
              <button
                onClick={() => setActiveCohortKey('sd_bawah')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  activeCohortKey === 'sd_bawah'
                    ? 'bg-[#23259C] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                SD Bawah (6–9 Thn)
              </button>
              <button
                onClick={() => setActiveCohortKey('sd_atas')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  activeCohortKey === 'sd_atas'
                    ? 'bg-[#23259C] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                SD Atas (10–12 Thn)
              </button>
              <button
                onClick={() => setActiveCohortKey('smp')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  activeCohortKey === 'smp'
                    ? 'bg-[#23259C] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                SMP (13–15 Thn)
              </button>
            </div>
          </div>

          {/* Lima zat utama. Badge menunjukkan hasil cek AKG yang sebenarnya,
              bukan kata dekoratif. */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Energi total', value: scaledNutrition.calories, unit: 'kkal',
                target: activeCohort.targetCalories, status: akgCompliance.calStatus },
              { label: 'Protein', value: scaledNutrition.protein, unit: 'g',
                target: activeCohort.targetProtein, status: akgCompliance.protStatus },
              { label: 'Karbohidrat', value: scaledNutrition.carbs, unit: 'g',
                target: activeCohort.targetCarbs, status: akgCompliance.carbStatus },
              { label: 'Lemak', value: scaledNutrition.fat, unit: 'g',
                target: activeCohort.targetFat, status: akgCompliance.fatStatus },
              { label: 'Serat', value: scaledNutrition.fiber, unit: 'g',
                target: activeCohort.targetFiber, status: akgCompliance.fiberStatus,
                extra: `Kalsium ${scaledNutrition.calcium} mg · Fe ${scaledNutrition.iron} mg` },
            ].map((n) => {
              const tone =
                n.status === 'SESUAI'
                  ? { badge: 'bg-emerald-50 text-emerald-800', bar: 'bg-emerald-600', label: 'Sesuai AKG' }
                  : n.status === 'KURANG'
                  ? { badge: 'bg-amber-50 text-amber-900', bar: 'bg-amber-600', label: 'Kurang' }
                  : n.status === 'LEBIH'
                  ? { badge: 'bg-rose-50 text-rose-800', bar: 'bg-rose-600', label: 'Lebih' }
                  : { badge: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400', label: 'Tidak ada data' }
              return (
                <div key={n.label} className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="text-[11px] font-medium text-slate-500">{n.label}</span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone.badge}`}>
                      {tone.label}
                    </span>
                  </div>
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
                      {n.value}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">{n.unit}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {n.extra || `Rujukan ${n.target.min}-${n.target.max} ${n.unit}`}
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${tone.bar}`}
                      style={{ width: `${rangePosition(n.value, n.target)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Cohort Insight Banner */}
          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">{activeCohort.name}: </span>
              <span>{activeCohort.guideline}</span>
              <span className="ml-2 font-semibold text-blue-700">
                (Faktor Porsi: {activeCohort.portionFactor * 100}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: BUKU RESEP STANDAR TKPI KEMENKES (GRAMATUR BAKU PER PORSI) */}
      {/* ========================================================================= */}
      {activeTab === 'recipe' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-[#23259C]" />
                  <span>Rincian Gramatur Bahan Baku Mentah Per Porsi Standar</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Takaran baku Kemenkes RI tidak boleh dikurangi pihak dapur demi menjaga kecukupan gizi anak
                </p>
              </div>

              {/* Search in Ingredients */}
              <div className="relative w-full sm:w-64">
                <Search className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari komoditas atau kode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#23259C] bg-slate-50/60"
                />
              </div>
            </div>

            {/* Ingredients Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[880px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th scope="col" className="py-2.5 px-4">Komoditas & Bahan Mentah</th>
                    <th scope="col" className="py-2.5 px-3">Kategori Pangan</th>
                    <th scope="col" className="py-2.5 px-3">Kode TKPI</th>
                    <th scope="col" className="py-2.5 px-3 text-right">Gramatur Baku</th>
                    <th scope="col" className="py-2.5 px-3 text-right">Kalori</th>
                    <th scope="col" className="py-2.5 px-3 text-right">Protein</th>
                    <th scope="col" className="py-2.5 px-3">Mitra & Sertifikasi</th>
                    <th scope="col" className="py-2.5 px-4 text-center">Status QC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredIngredients.map((ing) => {
                    const scaledGram = Math.round(ing.perPortionGram * activeCohort.portionFactor)
                    return (
                      <tr key={ing.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{ing.name}</div>
                          <div className="text-[11px] text-slate-600">
                            Batch: <span className="font-mono text-slate-700">{ing.currentBatch}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {ing.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                          {ing.tkpiCode}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="font-black text-slate-900">
                            {scaledGram} {ing.unit.includes('gram') ? 'g' : ing.unit}
                          </div>
                          {activeCohort.portionFactor !== 1 && (
                            <div className="text-[10px] text-slate-600">
                              (Basis 100%: {ing.perPortionGram}g)
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-slate-700">
                          {Math.round(ing.calories * activeCohort.portionFactor)} kkal
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-blue-700">
                          {(ing.protein * activeCohort.portionFactor).toFixed(1)} g
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-slate-800 font-medium truncate max-w-[190px]">
                            {ing.supplier}
                          </div>
                          <div className="text-[10px] text-emerald-700 flex items-center gap-1 font-semibold truncate max-w-[190px]">
                            <ShieldCheck className="h-3 w-3 shrink-0" />
                            <span>{ing.nkvOrCert}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <Check className="h-3 w-3" />
                            Lolos QC
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Allergens & Cooking Standard Footer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl border border-slate-200 bg-amber-50/50 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Indikasi Alergen Makanan:</div>
                  <div className="text-[11px] text-amber-800 mt-0.5">
                    {currentPackage.allergens.join(', ')} - Tandai secara jelas pada label QR boks bagi siswa dengan profil intoleransi.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-2.5 text-xs text-slate-700">
                <Clock className="h-4 w-4 text-[#23259C] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Standar Suhu & Waktu Penyajian:</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    {currentPackage.servingStandardTemp} · Batas konsumsi maksimal 4 jam pasca selesai masak.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: KALKULATOR KEBUTUHAN BELANJA BAHAN BAKU (MASS PROCUREMENT) */}
      {/* ========================================================================= */}
      {activeTab === 'procurement' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calculator className="h-4.5 w-4.5 text-[#23259C]" />
                <span>Kalkulator Kebutuhan Belanja Bahan Massal</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mengalikan gramatur baku per porsi dengan total alokasi siswa binaan SPPG secara otomatis
              </p>
            </div>

            {/* Input Porsi Target */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-600">Alokasi Porsi:</span>
              <div className="relative">
                <input
                  type="number"
                  min="100"
                  max="10000"
                  step="50"
                  value={portionCount}
                  onChange={(e) => setPortionCount(Number(e.target.value))}
                  className="w-28 px-2.5 py-1 text-xs font-bold text-right rounded-lg border border-slate-300 focus:outline-none focus:border-[#23259C] bg-white"
                />
              </div>
              <span className="text-xs font-bold text-slate-700">Porsi</span>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1 ml-2 border-l border-slate-200 pl-2">
                <button
                  onClick={() => {
                    setPortionCount(2000)
                    handleSaveDailyPortions(2000, activeCohortKey)
                  }}
                  className="px-2 py-0.5 text-[10px] font-semibold bg-white hover:bg-slate-100 rounded border border-slate-200 text-slate-600 cursor-pointer"
                >
                  2.000
                </button>
                <button
                  onClick={() => {
                    setPortionCount(2500)
                    handleSaveDailyPortions(2500, activeCohortKey)
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold bg-[#23259C] text-white rounded cursor-pointer"
                >
                  2.500 (Binaan)
                </button>
                <button
                  onClick={() => {
                    setPortionCount(3000)
                    handleSaveDailyPortions(3000, activeCohortKey)
                  }}
                  className="px-2 py-0.5 text-[10px] font-semibold bg-white hover:bg-slate-100 rounded border border-slate-200 text-slate-600 cursor-pointer"
                >
                  3.000
                </button>
              </div>

              {/* Simpan Kuota Button */}
              <button
                onClick={() => handleSaveDailyPortions(portionCount, activeCohortKey)}
                disabled={isSavingPortions}
                className="ml-2 px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg shadow-xs cursor-pointer flex items-center gap-1 transition"
                title="Simpan kuota porsi ke server dapur"
              >
                {isSavingPortions ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                <span>Simpan Kuota</span>
              </button>
            </div>
          </div>

          {/* Quick Summary Strip */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-[#23259C]/5 border border-[#23259C]/20 rounded-xl p-3">
              <div className="text-[11px] font-semibold text-[#23259C]">Total Siswa Dilayani</div>
              <div className="text-xl font-black text-slate-900 mt-0.5">
                {portionCount.toLocaleString('id-ID')} Siswa
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">4 Sekolah Binaan Aktif</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <div className="text-[11px] font-semibold text-emerald-800">Total Berat Bahan Baku</div>
              <div className="text-xl font-black text-emerald-900 mt-0.5">
                {totalKitchenKg} kg
              </div>
              <div className="text-[10px] text-emerald-700 mt-0.5">Termasuk buah & susu</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <div className="text-[11px] font-semibold text-blue-800">Daging Hewani (NKV)</div>
              <div className="text-xl font-black text-blue-900 mt-0.5">
                {((portionCount * 80) / 1000).toLocaleString('id-ID')} kg
              </div>
              <div className="text-[10px] text-blue-700 mt-0.5">Standar 80 gram per porsi</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="text-[11px] font-semibold text-amber-800">Kebutuhan Beras</div>
              <div className="text-xl font-black text-amber-900 mt-0.5">
                {((portionCount * 150) / 1000).toLocaleString('id-ID')} kg
              </div>
              <div className="text-[10px] text-amber-700 mt-0.5">Standar 150 gram per porsi</div>
            </div>
          </div>

          {/* Procurement Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[880px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th scope="col" className="py-2.5 px-4">Komoditas Bahan</th>
                  <th scope="col" className="py-2.5 px-3">Kategori</th>
                  <th scope="col" className="py-2.5 px-3 text-right">Gramatur / Porsi</th>
                  <th scope="col" className="py-2.5 px-3 text-right">Formula Kalkulasi</th>
                  <th scope="col" className="py-2.5 px-4 text-right bg-slate-100">Total Kebutuhan Belanja</th>
                  <th scope="col" className="py-2.5 px-4">Distributor / Petani Mitra</th>
                  <th scope="col" className="py-2.5 px-3 text-center">Status Stok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {procurementItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{item.tkpiCode}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] text-slate-700 font-medium">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-800">
                      {item.perPortionGram} {item.unit.includes('gram') ? 'gram' : item.unit}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-500 font-mono text-[11px]">
                      {portionCount.toLocaleString('id-ID')} × {item.perPortionGram}g
                    </td>
                    <td className="py-3 px-4 text-right bg-slate-50">
                      <div className="text-sm font-black text-[#23259C]">
                        {item.totalFormatted}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 text-xs">
                      <div className="font-medium text-slate-900">{item.supplier}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Batch: {item.currentBatch}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <Check className="h-3 w-3" />
                        Siap di Chiller
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Footer for Procurement */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>
                Kebutuhan logistik diverifikasi otomatis dengan kapasitas gudang & ruang chiller SPPG 01 Menteng
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const text = procurementItems
                    .map((i) => `${i.name}: ${i.totalFormatted}`)
                    .join('\n')
                  navigator.clipboard.writeText(
                    `DAFTAR BELANJA SPPG 01 MENTENG (${portionCount} PORSI)\nMenu: ${currentPackage.name}\n\n${text}`
                  )
                  showToast('Daftar belanja disalin ke clipboard!')
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition shadow-xs cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Salin Ringkasan Belanja</span>
              </button>

              <button
                onClick={() => {
                  showToast('Mengunduh Surat Perintah Kerja (SPK) Belanja Bahan Baku...')
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#23259C] hover:bg-[#1b1d7d] text-white transition shadow-sm cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh SPK Pengadaan (PDF)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LOG NOMOR BATCH BAHAN BAKU & TRACEABILITY (POIN 2.B.4) */}
      {/* ========================================================================= */}
      {activeTab === 'traceability' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-4.5 w-4.5 text-blue-600" />
                <span>Log Nomor Batch Bahan Baku & Traceability NKV</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mencatat nomor registrasi NKV RPH, sertifikasi halal, dan masa kedaluwarsa untuk audit ketertelusuran insiden
              </p>
            </div>

            {/* Search in Batches */}
            <div className="relative w-full sm:w-64">
              <Search className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nomor batch atau NKV..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#23259C] bg-slate-50/60"
              />
            </div>
          </div>

          {/* Traceability Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[880px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th scope="col" className="py-2.5 px-4">Komoditas & Nomor Batch</th>
                  <th scope="col" className="py-2.5 px-3">Sertifikasi NKV / PSAT</th>
                  <th scope="col" className="py-2.5 px-3 text-left">Tanggal Penerimaan</th>
                  <th scope="col" className="py-2.5 px-3 text-left">Kedaluwarsa (Exp Date)</th>
                  <th scope="col" className="py-2.5 px-3 text-left">Suhu Penyimpanan</th>
                  <th scope="col" className="py-2.5 px-3 text-left">Hasil Uji Lab Dapur</th>
                  <th scope="col" className="py-2.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{batch.commodity}</div>
                      <div className="font-mono text-xs font-semibold text-[#23259C]">
                        {batch.batchNo}
                      </div>
                      <div className="text-[11px] text-slate-500">{batch.supplier}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800 text-[11px]">
                        {batch.nkvNumber}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Halal: {batch.halalCertNo}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {batch.incomingDate}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[11px]">
                        {batch.expiryDate}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-mono font-semibold text-slate-800">
                        {batch.storageTemp}
                      </div>
                      <div className="text-[10px] text-slate-500">Kondisi Chilled</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800 text-[11px]">
                        {batch.qcResult}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Inspektur: {batch.qcInspector}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setIsDetailBatchOpen(batch)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#23259C] bg-[#23259C]/10 hover:bg-[#23259C]/20 rounded-lg transition cursor-pointer"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Sertifikat</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DISPENSASI SUBSTITUSI KOMODITAS SATGAS MBG (POIN 2.B.3 & 2.C) */}
      {/* ========================================================================= */}
      {activeTab === 'substitutions' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <RefreshCw className="h-4.5 w-4.5 text-amber-500" />
                <span>Manajemen Bahan Pengganti & Dispensasi Resmi Satgas MBG</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Penggantian bahan baku jika terjadi kelangkaan komoditas lokal dengan evaluasi kesetaraan nilai gizi
              </p>
            </div>

            <button
              onClick={() => setIsSubModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#23259C] hover:bg-[#1b1d7d] text-white shadow-sm transition cursor-pointer self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Ajukan Dispensasi Baru</span>
            </button>
          </div>

          {/* List of Substitutions */}
          <div className="grid grid-cols-1 gap-3.5">
            {substitutions.map((sub) => {
              const isApproved = sub.status === 'APPROVED'
              return (
                <div
                  key={sub.id}
                  className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 hover:bg-slate-50 transition space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {sub.ticketNo}
                      </span>
                      <span className="text-xs text-slate-500">·</span>
                      <span className="text-xs text-slate-500">Diajukan: {sub.submittedAt}</span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        isApproved
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {isApproved ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                      )}
                      <span>{sub.statusLabel || (isApproved ? 'Disetujui Satgas' : 'Menunggu Verifikasi')}</span>
                    </span>
                  </div>

                  {/* Comparison Row: Original vs Substitute */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-slate-200/70 text-xs">
                    {/* Original Item */}
                    <div className="space-y-1 border-r border-slate-100 pr-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                        Bahan Utama (Asal)
                      </span>
                      <div className="font-bold text-slate-900 text-sm mt-1">
                        {sub.originalItem?.name || sub.originalItem}
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        Gramatur: {sub.originalItem?.gramatur || 'Standar TKPI'} · Protein: {sub.originalItem?.protein || 0}g · Energi: {sub.originalItem?.calories || 0} kkal
                      </div>
                    </div>

                    {/* Substitute Item */}
                    <div className="space-y-1 pl-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Bahan Pengganti Resmi
                      </span>
                      <div className="font-bold text-slate-900 text-sm mt-1">
                        {sub.substituteItem?.name || sub.substituteItem}
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        Gramatur: {sub.substituteItem?.gramatur || 'Standar TKPI'} · Protein: {sub.substituteItem?.protein || 0}g · Energi: {sub.substituteItem?.calories || 0} kkal
                      </div>
                      {sub.substituteItem?.supplier && (
                        <div className="text-[11px] text-[#23259C] font-semibold">
                          Mitra: {sub.substituteItem.supplier}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reason & Nutritional Delta */}
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <strong className="text-slate-700 shrink-0">Alasan Kelangkaan Pasar:</strong>
                      <span>{sub.reason}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] bg-emerald-50/60 p-2 rounded-lg text-emerald-900 border border-emerald-100">
                      <span className="font-bold">Delta Gizi:</span>
                      <span>Protein: {sub.nutritionalDelta?.proteinDiff || 'Setara'}</span>
                      <span>·</span>
                      <span>Kalori: {sub.nutritionalDelta?.caloriesDiff || sub.nutritionalDelta?.calorieDiff || 'Setara'}</span>
                      <span>·</span>
                      <span className="font-semibold text-emerald-700">Memenuhi Standar AKG Satgas</span>
                    </div>
                  </div>

                  {/* Reviewer / Approval Note */}
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 border-t border-slate-200/60 pt-2">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-slate-500" />
                      <span>Verifikator: <strong className="text-slate-700">{sub.approvedBy || sub.reviewerName || 'Satgas MBG Wilayah'}</strong></span>
                    </div>
                    {sub.approvedAt && (
                      <span className="text-emerald-700 font-medium">Disetujui: {sub.approvedAt}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AJUKAN DISPENSASI SUBSTITUSI BAHAN (POIN 2.C) */}
      {/* ========================================================================= */}
      {isSubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                  <RefreshCw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Form Dispensasi Substitusi Bahan Baku
                  </h3>
                  <p className="text-xs text-slate-500">
                    Diteruskan langsung ke tim gizi Satgas MBG Wilayah Jakarta Pusat
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSubModalOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubstitution} className="space-y-3.5 text-xs">
              {formError && (
                <p
                  role="alert"
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-800"
                >
                  {formError}
                </p>
              )}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Bahan Utama yang Mengalami Kelangkaan di Pasar
                </label>
                <select
                  value={subForm.originalItem}
                  onChange={(e) => setSubForm({ ...subForm, originalItem: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#23259C] bg-white text-xs font-semibold text-slate-800"
                >
                  {currentPackage.ingredients.map((ing) => (
                    <option key={ing.id} value={ing.name}>
                      {ing.name} ({ing.perPortionGram}g · {ing.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Bahan Komoditas Pengganti (Lokal)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="misal: Ikan Kembung Segar Laut Jawa"
                    value={subForm.substituteItem}
                    onChange={(e) => setSubForm({ ...subForm, substituteItem: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#23259C] bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Pemasok Mitra & No. Sertifikasi NKV / GAP
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="misal: Koperasi Nelayan SKP No. 2891"
                    value={subForm.supplier}
                    onChange={(e) => setSubForm({ ...subForm, supplier: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#23259C] bg-white text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    Kandungan Protein Pengganti (gram/porsi)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={subForm.proteinVal}
                    onChange={(e) => setSubForm({ ...subForm, proteinVal: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    Kandungan Kalori Pengganti (kkal/porsi)
                  </label>
                  <input
                    type="number"
                    value={subForm.calorieVal}
                    onChange={(e) => setSubForm({ ...subForm, calorieVal: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Alasan Kelangkaan Pasar & Justifikasi Ahli Gizi SPPG
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="Jelaskan alasan resmi kelangkaan komoditas di pasar induk, kondisi cuaca, atau rantai suplai..."
                  value={subForm.reason}
                  onChange={(e) => setSubForm({ ...subForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#23259C] bg-white text-xs"
                ></textarea>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Lampiran Berita Acara Pasar / Sertifikat Komoditas
                </label>
                <div className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50 text-[11px] text-slate-600">
                  <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="font-mono truncate">{subForm.evidenceFileName}</span>
                  <span className="ml-auto text-emerald-700 font-bold">Siap Unggah</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button type="button"
                  onClick={() => setIsSubModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#23259C]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#23259C] hover:bg-[#1b1d7d] text-white shadow-sm transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Kirim ke Satgas MBG
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DETAIL TRACEABILITY SERTIFIKAT BATCH (POIN 2.B.4) */}
      {/* ========================================================================= */}
      {isDetailBatchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Sertifikat Ketertelusuran Batch Bahan Baku
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {isDetailBatchOpen.batchNo}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailBatchOpen(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Komoditas:</span>
                  <span className="font-bold text-slate-900">{isDetailBatchOpen.commodity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pemasok / Distributor:</span>
                  <span className="font-medium text-slate-800">{isDetailBatchOpen.supplier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nomor Registrasi NKV:</span>
                  <span className="font-mono font-bold text-emerald-800">
                    {isDetailBatchOpen.nkvNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sertifikat Halal:</span>
                  <span className="font-mono text-slate-800">{isDetailBatchOpen.halalCertNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kuantitas Diterima:</span>
                  <span className="font-bold text-slate-900">{isDetailBatchOpen.quantityReceived}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Suhu Cold Chain:</span>
                  <span className="font-mono font-bold text-blue-700">
                    {isDetailBatchOpen.storageTemp}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/70 text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Hasil Uji Lab Penerimaan Dapur:</span>
                </div>
                <p className="text-[11px] text-emerald-800">{isDetailBatchOpen.qcResult}</p>
                <div className="text-[10px] text-emerald-700 mt-1">
                  Diperiksa oleh: {isDetailBatchOpen.qcInspector} ({isDetailBatchOpen.incomingDate})
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsDetailBatchOpen(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer"
              >
                Tutup Dokumen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RUNSHEET DAPUR & SOP MASAK (POIN 1.C & 2.C) */}
      {/* ========================================================================= */}
      {isRunsheetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#23259C]/10 text-[#23259C]">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Kitchen Run-Sheet & SOP Pengolahan Dapur
                  </h3>
                  <p className="text-xs text-slate-500">
                    Instruksi baku masak SPPG 01 Menteng · {portionCount} Porsi
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRunsheetModalOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900">{currentPackage.name}</div>
                <div className="text-slate-600 text-[11px] leading-relaxed">
                  {currentPackage.prepStandard}
                </div>
                <div className="text-emerald-700 font-semibold text-[11px] pt-1">
                  Titik Kritis HACCP: Suhu inti ayam fillet wajib dicek dengan probe termometer ≥ 75°C sebelum diangkat.
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                  Alokasi Boks Termal Per Sekolah Binaan (2.500 Porsi):
                </div>
                <div className="divide-y divide-slate-100 text-[11px]">
                  <div className="px-3 py-2 flex justify-between">
                    <span>SDN Menteng 01 Pagi (SD Bawah 300 + SD Atas 350)</span>
                    <span className="font-bold text-slate-900">650 Porsi (13 Master Totes)</span>
                  </div>
                  <div className="px-3 py-2 flex justify-between">
                    <span>SDN Pegangsaan 02 (SD Bawah 250 + SD Atas 300)</span>
                    <span className="font-bold text-slate-900">550 Porsi (11 Master Totes)</span>
                  </div>
                  <div className="px-3 py-2 flex justify-between">
                    <span>SMPN 3 Jakarta (Porsi Remaja SMP)</span>
                    <span className="font-bold text-slate-900">750 Porsi (15 Master Totes)</span>
                  </div>
                  <div className="px-3 py-2 flex justify-between">
                    <span>SDN Cikini 01 (SD Bawah 250 + SD Atas 300)</span>
                    <span className="font-bold text-slate-900">550 Porsi (11 Master Totes)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRunsheetModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print()
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#23259C] hover:bg-[#1b1d7d] text-white shadow-sm transition cursor-pointer"
              >
                Cetak Lembar Kontrol Dapur
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH MENU & RESEP SIKLUS BARU (STANDAR TKPI KEMENKES RI) */}
      {/* ========================================================================= */}
      {isAddMenuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div role="dialog" aria-modal="true" className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-5 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#23259C]/10 text-[#23259C]">
                  <UtensilsCrossed className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Tambah Menu & Resep Baku Baru
                  </h3>
                  <p className="text-xs text-slate-500">
                    Standardisasi Gramatur TKPI Kemenkes RI & Siklus Nasional Satgas MBG
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddMenuModalOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body: Scrollable */}
            <form onSubmit={handleCreateNewMenu} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {formError && (
                <p
                  role="alert"
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-800"
                >
                  {formError}
                </p>
              )}
              {/* Live Nutrition Calculation Scorecard Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                    <Scale className="h-4 w-4 text-[#23259C]" />
                    <span>Estimasi Nilai Gizi Terhitung Otomatis (Basis Per Porsi)</span>
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {newMenuCalculatedNutrition.calories >= 450 && newMenuCalculatedNutrition.calories <= 650
                      ? '✓ Memenuhi Standar AKG Nasional'
                      : 'Perlu Penyesuaian Takaran'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center pt-1">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500">Energi Total</div>
                    <div className="text-base font-black text-slate-900">
                      {newMenuCalculatedNutrition.calories} <span className="text-xs font-normal">kkal</span>
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500">Protein</div>
                    <div className="text-base font-black text-blue-700">
                      {newMenuCalculatedNutrition.protein} <span className="text-xs font-normal">g</span>
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500">Karbohidrat</div>
                    <div className="text-base font-black text-amber-700">
                      {newMenuCalculatedNutrition.carbs} <span className="text-xs font-normal">g</span>
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="text-[10px] text-slate-500">Lemak Sehat</div>
                    <div className="text-base font-semibold tabular-nums text-slate-900">
                      {newMenuCalculatedNutrition.fat} <span className="text-xs font-normal">g</span>
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200 col-span-2 sm:col-span-1">
                    <div className="text-[10px] text-slate-500">Serat Pangan</div>
                    <div className="text-base font-black text-emerald-700">
                      {newMenuCalculatedNutrition.fiber} <span className="text-xs font-normal">g</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 1: Informasi Dasar Menu */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-1.5 text-xs uppercase tracking-wider text-[11px]">
                  1. Informasi Identitas Menu Hidangan
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Kode Paket Menu</label>
                    <input
                      type="text"
                      required
                      value={newMenuForm.code}
                      onChange={(e) => setNewMenuForm({ ...newMenuForm, code: e.target.value })}
                      placeholder="misal: PAKET-E-05"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#23259C] bg-white font-mono text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Hari & Tanggal Masak</label>
                    <input
                      type="text"
                      required
                      value={newMenuForm.dayName}
                      onChange={(e) => setNewMenuForm({ ...newMenuForm, dayName: e.target.value })}
                      placeholder="misal: Jumat, 03 Oktober 2026"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#23259C] bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Siklus Menu Nasional</label>
                    <input
                      type="text"
                      required
                      value={newMenuForm.cycle}
                      onChange={(e) => setNewMenuForm({ ...newMenuForm, cycle: e.target.value })}
                      placeholder="misal: Siklus Menu Nasional Minggu I"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#23259C] bg-white text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Menu Lengkap Hidangan
                  </label>
                  <input
                    type="text"
                    required
                    value={newMenuForm.name}
                    onChange={(e) => setNewMenuForm({ ...newMenuForm, name: e.target.value })}
                    placeholder="misal: Nasi Rawon Daging Sapi & Tauge Pendek Telur Asin"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#23259C] bg-white text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Deskripsi & Cita Rasa Menu</label>
                  <textarea
                    rows="2"
                    value={newMenuForm.description}
                    onChange={(e) => setNewMenuForm({ ...newMenuForm, description: e.target.value })}
                    placeholder="Kombinasi hidangan khas nusantara dengan kandungan protein hewani tinggi dan zat besi alami..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#23259C] bg-white text-xs"
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Indikasi Alergen Makanan</label>
                    <input
                      type="text"
                      value={newMenuForm.allergens}
                      onChange={(e) => setNewMenuForm({ ...newMenuForm, allergens: e.target.value })}
                      placeholder="Pisahkan dengan koma: Telur, Kedelai, Susu Sapi"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#23259C] bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Titik Kritis HACCP (CCP-1)</label>
                    <input
                      type="text"
                      value={newMenuForm.haccpPoint}
                      onChange={(e) => setNewMenuForm({ ...newMenuForm, haccpPoint: e.target.value })}
                      placeholder="misal: Suhu inti masak daging wajib ≥ 75°C selama 2 menit"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-[#23259C] bg-white text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Komposisi 6 Kelompok Bahan Baku Standar TKPI */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-[11px]">
                      2. Komposisi Bahan Baku Standar TKPI (Per Porsi)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Wajib mengacu pada 6 kelompok pangan baku Kemenkes RI demi keterpenuhan gizi
                    </p>
                  </div>
                  <button type="button"
                    onClick={handleAddIngredientRow}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#23259C] bg-[#23259C]/10 hover:bg-[#23259C]/20 rounded-lg transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#23259C]"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Tambah Baris Bahan</span>
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full min-w-[880px] text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                      <tr>
                        <th scope="col" className="py-2 px-3">Nama Komoditas</th>
                        <th scope="col" className="py-2 px-2.5">Kategori</th>
                        <th scope="col" className="py-2 px-2 text-right">Gramatur (g)</th>
                        <th scope="col" className="py-2 px-2 text-right">Kalori</th>
                        <th scope="col" className="py-2 px-2 text-right">Protein (g)</th>
                        <th scope="col" className="py-2 px-2.5">Pemasok / Sertifikasi</th>
                        <th scope="col" className="py-2 px-2 text-center w-10">Hapus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {newMenuForm.ingredients.map((ing, idx) => (
                        <tr key={ing.id} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              required
                              value={ing.name}
                              onChange={(e) => handleUpdateIngredient(idx, 'name', e.target.value)}
                              className="w-full px-2 py-1 rounded border border-slate-200 font-semibold text-slate-900 text-xs"
                            />
                          </td>
                          <td className="py-2 px-2.5">
                            <select
                              value={ing.category}
                              onChange={(e) => handleUpdateIngredient(idx, 'category', e.target.value)}
                              className="px-2 py-1 rounded border border-slate-200 text-[11px] bg-white font-medium"
                            >
                              <option value="Karbohidrat Pokok">Karbohidrat Pokok</option>
                              <option value="Protein Hewani">Protein Hewani</option>
                              <option value="Protein Nabati">Protein Nabati</option>
                              <option value="Serat & Vitamin">Serat & Vitamin</option>
                              <option value="Buah Segar">Buah Segar</option>
                              <option value="Minuman Gizi Tambahan">Minuman Gizi Tambahan</option>
                              <option value="Pelengkap Gizi">Pelengkap Gizi</option>
                            </select>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              required
                              min="1"
                              value={ing.perPortionGram}
                              onChange={(e) => handleUpdateIngredient(idx, 'perPortionGram', Number(e.target.value))}
                              className="w-16 px-1.5 py-1 rounded border border-slate-200 text-right font-mono text-xs font-bold"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              required
                              min="0"
                              value={ing.calories}
                              onChange={(e) => handleUpdateIngredient(idx, 'calories', Number(e.target.value))}
                              className="w-16 px-1.5 py-1 rounded border border-slate-200 text-right font-mono text-xs"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              step="0.1"
                              required
                              min="0"
                              value={ing.protein}
                              onChange={(e) => handleUpdateIngredient(idx, 'protein', Number(e.target.value))}
                              className="w-16 px-1.5 py-1 rounded border border-slate-200 text-right font-mono text-xs text-blue-700 font-bold"
                            />
                          </td>
                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={ing.supplier}
                              onChange={(e) => handleUpdateIngredient(idx, 'supplier', e.target.value)}
                              className="w-full px-2 py-1 rounded border border-slate-200 text-[11px] text-slate-700"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button type="button"
                              onClick={() => handleRemoveIngredient(idx)}
                              className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#23259C]"
                              title="Hapus baris bahan"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Form Footer Action */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button type="button"
                  onClick={() => setIsAddMenuModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#23259C]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#23259C] hover:bg-[#1b1d7d] text-white shadow-sm transition cursor-pointer flex items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>Simpan & Daftarkan Menu</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
