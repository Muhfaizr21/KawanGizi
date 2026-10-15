import { useState, useMemo, useRef, useEffect } from 'react'
import {
  School,
  Building,
  MapPin,
  Users,
  Flame,
  Phone,
  ShieldCheck,
  AlertTriangle,
  Search,
  Download,
  Printer,
  Plus,
  MoreVertical,
  ExternalLink,
  CheckCircle2,
  XCircle,
  X,
  HeartPulse,
  Navigation,
  Compass,
  Check,
  Trash2
} from 'lucide-react'
import { SchoolsCharts } from './SchoolsCharts'
import { AVAILABLE_SPPG_ALTERNATIVES, NUTRITION_STANDARDS } from '../../data/schoolsData'
import { Figure, RowAction, StatusDot } from './tableKit'
import { createSchool, reassignSchoolSPPG, updateSchoolContacts, toggleSchoolStatus, deleteSchool, fetchSppgList } from '../../lib/api'
import { toSchoolView } from './schoolView'

export function SchoolsPanel({
  schoolsList = [],
  onSuperadminAction = () => {},
  showToast = () => {},
  onReload = () => {}
}) {
  const [schools, setSchools] = useState(schoolsList)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sppgList, setSppgList] = useState(AVAILABLE_SPPG_ALTERNATIVES)

  useEffect(() => {
    fetchSppgList()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((k) => ({
            id: k.id,
            name: k.name,
            code: k.code || k.id,
            city: k.city || 'DKI Jakarta',
            address: k.address || '',
            capacity: k.capacity || 3000,
            remainingCapacity: (k.capacity || 3000) - ((k.activeSchoolsCount || 0) * 500),
            activeSchoolsCount: k.activeSchoolsCount || 0,
            status: k.status || 'Active',
            safetyScore: k.safetyScore || 99.0,
          }))
          setSppgList(mapped)
        }
      })
      .catch((err) => console.warn('Gagal memuat SPPG real dari DB:', err))
  }, [])

  // Sync state whenever parent schoolsList finishes async load
  useEffect(() => {
    if (Array.isArray(schoolsList) && schoolsList.length > 0) {
      setSchools(schoolsList)
    }
  }, [schoolsList])

  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all') // 'all' | 'SD' | 'MI' | 'SMP' | 'MTs'
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'radius_warning' | 'temp_inactive'
  const [cityFilter, setCityFilter] = useState('all')
  const [density, setDensity] = useState('normal') // 'normal' | 'compact'

  // Modals & Drawer State
  const [selectedSchool, setSelectedSchool] = useState(null)
  const [drawerTab, setDrawerTab] = useState('overview') // 'overview' | 'nutrition' | 'contacts' | 'logistics'
  const [openMenuId, setOpenMenuId] = useState(null)

  // Superadmin Action Modals
  const [onboardModalOpen, setOnboardModalOpen] = useState(false)
  const [reassignModalData, setReassignModalData] = useState(null) // { school, targetSppgId, reason }
  const [contactModalData, setContactModalData] = useState(null) // { school, formData }
  const [suspendModalData, setSuspendModalData] = useState(null) // { school, reason, returnDate }
  const [deleteModalData, setDeleteModalData] = useState(null) // { school, reason }

  // Form state for Onboarding new school
  const [newSchoolForm, setNewSchoolForm] = useState({
    npsn: '',
    name: '',
    level: 'SD',
    city: 'Jakarta Pusat',
    address: '',
    principalName: '',
    principalPhone: '',
    uksName: '',
    uksPhone: '',
    clinicName: '',
    clinicPhone: '',
    lat: '-6.2088',
    lng: '106.8456',
    lowerGrade: 150,
    upperGrade: 180,
    smpGrade: 0,
    sppgId: 'SPPG-001'
  })

  const dropdownRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // List of unique cities
  const uniqueCities = useMemo(() => {
    const set = new Set(schools.map((s) => s.city))
    return Array.from(set)
  }, [schools])

  // Filtered schools
  const filtered = useMemo(() => {
    return schools.filter((sch) => {
      const matchSearch =
        sch.name.toLowerCase().includes(search.toLowerCase()) ||
        sch.npsn.includes(search) ||
        sch.city.toLowerCase().includes(search.toLowerCase()) ||
        sch.principal.name.toLowerCase().includes(search.toLowerCase()) ||
        sch.sppgSupplier.name.toLowerCase().includes(search.toLowerCase())

      const matchLevel = levelFilter === 'all' || sch.level === levelFilter
      const matchStatus = statusFilter === 'all' || sch.status === statusFilter
      const matchCity = cityFilter === 'all' || sch.city === cityFilter

      return matchSearch && matchLevel && matchStatus && matchCity
    })
  }, [schools, search, levelFilter, statusFilter, cityFilter])

  // Aggregate KPI stats
  const kpiStats = useMemo(() => {
    const totalSchools = schools.length
    const activeSchools = schools.filter((s) => s.status === 'active').length
    const warningSchools = schools.filter((s) => s.status === 'radius_warning').length
    const inactiveSchools = schools.filter((s) => s.status === 'temp_inactive').length

    const totalStudents = schools.reduce((acc, s) => acc + s.demographics.totalStudents, 0)
    const lowerCount = schools.reduce((acc, s) => acc + s.demographics.lowerGrade, 0)
    const upperCount = schools.reduce((acc, s) => acc + s.demographics.upperGrade, 0)
    const smpCount = schools.reduce((acc, s) => acc + s.demographics.smpGrade, 0)

    const totalCalories = schools.reduce((acc, s) => acc + s.demographics.totalCalorieTarget, 0)
    const avgCalorie = totalStudents ? Math.round(totalCalories / totalStudents) : 0

    const safeTransitCount = schools.filter((s) => s.sppgSupplier.transitMinutes <= 30).length
    const safeTransitPercent = totalSchools ? Math.round((safeTransitCount / totalSchools) * 100) : 100

    return {
      totalSchools,
      activeSchools,
      warningSchools,
      inactiveSchools,
      totalStudents,
      lowerCount,
      upperCount,
      smpCount,
      totalCalories,
      avgCalorie,
      safeTransitPercent
    }
  }, [schools])

  // Export to CSV
  const exportCsv = () => {
    const headers = [
      'NPSN',
      'Nama Sekolah',
      'Jenjang',
      'Kota',
      'Status',
      'Kepala Sekolah',
      'No Telp Kepsek',
      'SD Bawah (7-9 thn)',
      'SD Atas (10-12 thn)',
      'SMP (13-15 thn)',
      'Total Siswa',
      'Kebutuhan Kalori (kkal/hari)',
      'Dapur SPPG Penyuplai',
      'Jarak Tempuh (km)',
      'Durasi Tempuh (menit)',
      'Puskesmas Rujukan'
    ]

    const rows = filtered.map((s) => [
      `"${s.npsn}"`,
      `"${s.name}"`,
      `"${s.level}"`,
      `"${s.city}"`,
      `"${s.statusLabel}"`,
      `"${s.principal.name}"`,
      `"${s.principal.phone}"`,
      s.demographics.lowerGrade,
      s.demographics.upperGrade,
      s.demographics.smpGrade,
      s.demographics.totalStudents,
      s.demographics.totalCalorieTarget,
      `"${s.sppgSupplier.name}"`,
      s.sppgSupplier.distanceKm,
      s.sppgSupplier.transitMinutes,
      `"${s.emergencyContacts.referralClinic}"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Pangkalan_Data_Sekolah_MBG_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Pangkalan Data Master Sekolah berhasil diekspor dalam format CSV!')
  }

  // Handle Onboarding New School
  const handleOnboardSubmit = async (e) => {
    e.preventDefault()
    if (onSuperadminAction?.('ONBOARD_SCHOOL')?.allowed === false) return
    if (!newSchoolForm.npsn || !newSchoolForm.name) {
      showToast('NPSN dan Nama Sekolah wajib diisi!')
      return
    }

    const lower = Number(newSchoolForm.lowerGrade) || 0
    const upper = Number(newSchoolForm.upperGrade) || 0
    const smp = Number(newSchoolForm.smpGrade) || 0
    const assignedSppg = sppgList.find((s) => s.id === newSchoolForm.sppgId) || sppgList[0] || { id: 'SPPG-01' }

    const payload = {
      npsn: newSchoolForm.npsn.trim(),
      name: newSchoolForm.name.trim(),
      level: newSchoolForm.level || 'SD',
      city: newSchoolForm.city || 'Jakarta Pusat',
      district: 'Kecamatan Terpadu',
      address: newSchoolForm.address || 'Alamat operasional sekolah binaan',
      lat: parseFloat(newSchoolForm.lat) || -6.2,
      lng: parseFloat(newSchoolForm.lng) || 106.8,
      principalName: newSchoolForm.principalName || 'Kepala Sekolah Terdaftar',
      principalPhone: newSchoolForm.principalPhone || '0812-0000-0000',
      uksName: newSchoolForm.uksName || 'Koordinator UKS',
      uksPhone: newSchoolForm.uksPhone || '0813-0000-0000',
      clinicName: newSchoolForm.clinicName || `Puskesmas ${newSchoolForm.city || 'Kecamatan'}`,
      clinicPhone: newSchoolForm.clinicPhone || '021-1234567',
      lowerGrade: lower,
      upperGrade: upper,
      smpGrade: smp,
      sppgId: assignedSppg.id || 'SPPG-01',
    }

    setIsSubmitting(true)
    try {
      const created = await createSchool(payload)
      const mapped = toSchoolView(created)
      setSchools((prev) => [mapped, ...prev.filter((s) => s.npsn !== mapped.npsn)])
      setOnboardModalOpen(false)
      showToast(`Sekolah ${mapped.name} (NPSN: ${mapped.npsn}) berhasil didaftarkan ke jaringan MBG!`)
      onReload?.()
    } catch (err) {
      showToast(`Gagal mendaftarkan sekolah: ${err.message || 'Kesalahan server'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Reassign SPPG
  const handleReassignSubmit = async (e) => {
    if (onSuperadminAction?.('REASSIGN_SPPG')?.allowed === false) return
    e.preventDefault()
    if (!reassignModalData) return

    const { school, targetSppgId, reason } = reassignModalData
    const selectedSppgObj = sppgList.find((s) => s.id === targetSppgId)

    if (!selectedSppgObj && !targetSppgId) {
      showToast('Pilih Dapur SPPG pengganti!')
      return
    }

    setIsSubmitting(true)
    try {
      const chosenId = targetSppgId || selectedSppgObj?.id || 'SPPG-01'
      const updated = await reassignSchoolSPPG(school.npsn, {
        targetSppgId: chosenId,
        reason: reason || 'Optimalisasi rute distribusi last-mile MBG',
      })
      const mapped = toSchoolView(updated)
      setSchools((prev) => prev.map((s) => (s.npsn === school.npsn ? mapped : s)))
      if (selectedSchool && selectedSchool.npsn === school.npsn) {
        setSelectedSchool(mapped)
      }
      setReassignModalData(null)
      showToast(`Alokasi dapur penyuplai untuk ${school.name} berhasil dipindahkan ke ${mapped.sppgSupplier?.name || chosenId}!`)
      onReload?.()
    } catch (err) {
      showToast(`Gagal memindahkan dapur SPPG: ${err.message || 'Kesalahan server'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Update Emergency Contacts
  const handleUpdateContactSubmit = async (e) => {
    if (onSuperadminAction?.('UPDATE_EMERGENCY_CONTACTS')?.allowed === false) return
    e.preventDefault()
    if (!contactModalData) return

    const { school, formData } = contactModalData

    const payload = {
      principalName: formData.principalName || school.principal?.name || 'Kepala Sekolah',
      principalPhone: formData.principalPhone || school.principal?.phone || '0812-0000-0000',
      uksCoordinatorName: formData.uksCoordinatorName || school.emergencyContacts?.uksCoordinatorName || 'Koordinator UKS',
      uksPhone: formData.uksPhone || school.emergencyContacts?.uksPhone || '0813-0000-0000',
      referralClinic: formData.referralClinic || school.emergencyContacts?.referralClinic || 'Puskesmas Kecamatan Binaan',
      clinicAddress: formData.clinicAddress || school.emergencyContacts?.clinicAddress || school.city || '',
      clinicPhone: formData.clinicPhone || school.emergencyContacts?.clinicPhone || '021-1234567',
      ambulanceHotline: formData.ambulanceHotline || school.emergencyContacts?.ambulanceHotline || '119',
    }

    setIsSubmitting(true)
    try {
      const updated = await updateSchoolContacts(school.npsn, payload)
      const mapped = toSchoolView(updated)
      setSchools((prev) => prev.map((s) => (s.npsn === school.npsn ? mapped : s)))
      if (selectedSchool && selectedSchool.npsn === school.npsn) {
        setSelectedSchool(mapped)
      }
      setContactModalData(null)
      showToast(`Data kontak darurat dan Puskesmas rujukan untuk ${school.name} berhasil diperbarui!`)
      onReload?.()
    } catch (err) {
      showToast(`Gagal memperbarui kontak: ${err.message || 'Kesalahan server'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Temporarily Suspend / Reactivate School
  const handleSuspendSubmit = async (e) => {
    if (onSuperadminAction?.('TOGGLE_SCHOOL_STATUS')?.allowed === false) return
    e.preventDefault()
    if (!suspendModalData) return

    const { school, isDeactivating, reason, returnDate } = suspendModalData
    const newStatus = isDeactivating ? 'temp_inactive' : 'active'
    const statusReason = reason || (isDeactivating ? 'Distribusi dinonaktifkan sementara' : 'Operasional alokasi porsi diaktifkan kembali.')

    setIsSubmitting(true)
    try {
      const updated = await toggleSchoolStatus(school.npsn, {
        status: newStatus,
        statusReason,
        returnDate: returnDate || '',
      })
      const mapped = toSchoolView(updated)
      setSchools((prev) => prev.map((s) => (s.npsn === school.npsn ? mapped : s)))
      if (selectedSchool && selectedSchool.npsn === school.npsn) {
        setSelectedSchool(mapped)
      }
      setSuspendModalData(null)
      const actText = isDeactivating ? 'dinonaktifkan sementara' : 'diaktifkan kembali'
      showToast(`Status alokasi distribusi untuk ${school.name} berhasil ${actText}!`)
      onReload?.()
    } catch (err) {
      showToast(`Gagal mengubah status sekolah: ${err.message || 'Kesalahan server'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Delete School
  const handleDeleteSchoolSubmit = async (e) => {
    if (onSuperadminAction?.('DELETE_SCHOOL')?.allowed === false) return
    e.preventDefault()
    if (!deleteModalData) return

    const { school, reason } = deleteModalData
    setIsSubmitting(true)
    try {
      await deleteSchool(school.npsn, reason)
      setSchools((prev) => prev.filter((s) => s.npsn !== school.npsn))
      if (selectedSchool && selectedSchool.npsn === school.npsn) {
        setSelectedSchool(null)
      }
      setDeleteModalData(null)
      showToast(`[PENGHAPUSAN BERHASIL] Sekolah ${school.name} (NPSN ${school.npsn}) telah dihapus dari sistem.`)
      onReload?.()
    } catch (err) {
      showToast(`Gagal menghapus sekolah: ${err.message || 'Kesalahan server'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ====================================================================
          1. COMPACT TOP UTILITY & ACTION BAR (NO BLOATED CARDS, NO LIVE COUNTDOWN)
          ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-slate-500 font-medium">
          Pangkalan Data Master Sekolah (NPSN) &amp; Titik Last-Mile MBG
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition flex items-center gap-2 shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Ekspor Data (CSV)</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition flex items-center gap-2 shadow-2xs cursor-pointer hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            <span>Cetak Rekap</span>
          </button>

          <button
            onClick={() => setOnboardModalOpen(true)}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tambah Sekolah (NPSN)</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          2. EXECUTIVE KPI COMMAND RIBBON (4 METRICS)
          ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Sekolah */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Sekolah Binaan</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-800 border border-blue-100">
              <School className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">{kpiStats.totalSchools}</span>
            <span className="text-xs font-medium text-slate-500">Institusi</span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <span className="text-emerald-700 font-semibold">{kpiStats.activeSchools} Aktif Penuh</span>
            <span>&bull;</span>
            <span className="text-slate-500">{kpiStats.inactiveSchools} Nonaktif Libur</span>
          </div>
        </div>

        {/* KPI 2: Total Siswa Sasaran */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Total Siswa Sasaran</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {kpiStats.totalStudents.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-slate-500">Siswa Dapodik</span>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-500 border-t border-slate-100 pt-2 font-mono">
            <span className="text-emerald-700 font-semibold">{kpiStats.lowerCount} SD Bwh</span>
            <span>|</span>
            <span className="text-blue-700 font-semibold">{kpiStats.upperCount} SD Ats</span>
            <span>|</span>
            <span className="text-blue-700 font-semibold">{kpiStats.smpCount} SMP</span>
          </div>
        </div>

        {/* KPI 3: Total Kebutuhan Kalori */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Total Kebutuhan Gizi</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-100">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {(kpiStats.totalCalories / 1000).toFixed(1)}k
            </span>
            <span className="text-xs font-medium text-slate-500">kkal / hari</span>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <span className="text-slate-600">Rerata: <strong className="text-slate-900 font-mono">{kpiStats.avgCalorie} kkal</strong>/porsi</span>
            <span>&bull;</span>
            <span className="text-emerald-700 font-semibold">Terkalibrasi</span>
          </div>
        </div>

        {/* KPI 4: Kepatuhan Radius Tempuh */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Kepatuhan Radius SPPG</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-100">
              <Navigation className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">{kpiStats.safeTransitPercent}%</span>
            <span className="text-xs font-medium text-slate-500">&le; 30 Menit Tempuh</span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[11px] border-t border-slate-100 pt-2">
            {kpiStats.warningSchools > 0 ? (
              <span className="text-amber-700 font-semibold flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                <span>{kpiStats.warningSchools} Sekolah Waspada (&gt;35m)</span>
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                <span>Semua Titik Radius Aman</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================================
          3. VISUALIZATION CHARTS: DEMOGRAFI GIZI & RADIUS TEMPUH
          ==================================================================== */}
      <SchoolsCharts schools={schools} />

      {/* ====================================================================
          4. SEARCH, FILTER & DENSITY TOOLBAR
          ==================================================================== */}
      <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama sekolah, NPSN, kota, nama kepsek, atau SPPG penyuplai..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200/90 text-slate-900 placeholder:text-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* City Select */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium rounded-xl bg-slate-50 border border-slate-200/90 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              <option value="all">Semua Wilayah / Kota</option>
              {uniqueCities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Density Toggle */}
            <div className="flex items-center rounded-xl border border-slate-200/90 bg-slate-50 p-0.5 text-xs">
              <button
                onClick={() => setDensity('normal')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  density === 'normal'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Tampilan Normal"
              >
                Normal
              </button>
              <button
                onClick={() => setDensity('compact')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  density === 'compact'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Tampilan Rapat"
              >
                Rapat
              </button>
            </div>
          </div>
        </div>

        {/* Filter Chips: Level & Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">
              Jenjang:
            </span>
            {[
              { id: 'all', label: 'Semua Jenjang' },
              { id: 'SD', label: 'SD (7-12 Thn)' },
              { id: 'MI', label: 'MI (7-12 Thn)' },
              { id: 'SMP', label: 'SMP (13-15 Thn)' }
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => setLevelFilter(chip.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer text-xs ${
                  levelFilter === chip.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">
              Status:
            </span>
            {[
              { id: 'all', label: 'Semua Status' },
              { id: 'active', label: 'Aktif Penuh' },
              { id: 'radius_warning', label: 'Radius Waspada' },
              { id: 'temp_inactive', label: 'Nonaktif Sementara' }
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer text-xs ${
                  statusFilter === st.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ====================================================================
          5. MASTER DATA TABLE: SEKOLAH BINAAN (TABLE-FIXED)
          ==================================================================== */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed min-w-[1050px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[26%]">
                  Sekolah
                </th>
                <th className="py-2.5 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[22%]">
                  Demografi siswa
                </th>
                <th className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[20%]">
                  Dapur penyuplai
                </th>
                <th className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[17%]">
                  Kepala sekolah
                </th>
                <th className="py-2.5 px-4 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[9%]">
                  Status
                </th>
                <th className="py-2.5 px-4 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[6%]">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <School className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-600">Tidak ada sekolah yang cocok dengan filter</p>
                    <p className="text-[11px] text-slate-500 mt-1">Coba ubah kata kunci pencarian atau bersihkan filter</p>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isMenuOpen = openMenuId === item.id
                  const isCompact = density === 'compact'
                  const padClass = isCompact ? 'py-2.5 px-4' : 'py-3.5 px-4'

                  return (
                    <tr
                      key={item.id}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedSchool(item)
                          setDrawerTab('overview')
                        }
                      }}
                      aria-label={`Profil ${item.name}`}
                      onClick={() => {
                        setSelectedSchool(item)
                        setDrawerTab('overview')
                      }}
                      className={`cursor-pointer transition-colors ${
                        item.status === 'radius_warning'
                          ? 'bg-amber-50/40'
                          : item.status === 'temp_inactive'
                          ? 'bg-slate-50'
                          : 'hover:bg-slate-50'
                      } focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600`}
                    >
                      {/* Col 1: Sekolah */}
                      <td className={padClass}>
                        <span className="font-semibold text-slate-900 text-sm block truncate">{item.name}</span>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                          NPSN {item.npsn} &middot; {item.level} &middot; {item.city}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs">{item.address}</p>
                      </td>

                      {/* Col 2: Demografi. Angka rata kanan, tanpa pil per kelompok umur. */}
                      <td className={`${padClass} text-right`}>
                        <Figure
                          value={item.demographics.totalStudents.toLocaleString('id-ID')}
                          hint="siswa terdata"
                        />
                        <p className="text-[11px] text-slate-500 mt-1 font-mono">
                          {item.demographics.lowerGrade > 0 && <>7&ndash;9: {item.demographics.lowerGrade} &middot; </>}
                          {item.demographics.upperGrade > 0 && <>10&ndash;12: {item.demographics.upperGrade} &middot; </>}
                          {item.demographics.smpGrade > 0 && <>13&ndash;15: {item.demographics.smpGrade}</>}
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          {(item.demographics.totalCalorieTarget / 1000).toFixed(1)}k kkal/hari
                        </p>
                      </td>

                      {/* Col 3: Dapur penyuplai + radius */}
                      <td className={padClass}>
                        <span className="text-slate-800 block truncate" title={item.sppgSupplier.name}>
                          {item.sppgSupplier.name}
                        </span>
                        <div className="mt-1 flex items-center gap-2">
                          <StatusDot
                            tone={
                              item.sppgSupplier.transitMinutes >= 40
                                ? 'critical'
                                : item.sppgSupplier.transitMinutes >= 30
                                ? 'warn'
                                : 'ok'
                            }
                          >
                            {item.sppgSupplier.transitMinutes} mnt
                          </StatusDot>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {item.sppgSupplier.distanceKm} km
                          </span>
                        </div>
                        <div className="mt-1 h-1 w-full max-w-[9rem] bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              item.sppgSupplier.transitMinutes >= 40
                                ? 'bg-rose-600'
                                : item.sppgSupplier.transitMinutes >= 30
                                ? 'bg-amber-600'
                                : 'bg-emerald-600'
                            }`}
                            style={{ width: `${Math.min(100, (item.sppgSupplier.transitMinutes / 45) * 100)}%` }}
                          />
                        </div>
                      </td>

                      {/* Col 4: Kepala sekolah & kontak */}
                      <td className={padClass}>
                        <span className="text-slate-900 block truncate" title={item.principal.name}>
                          {item.principal.name}
                        </span>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">{item.principal.phone}</p>
                        <p
                          className="text-[11px] text-slate-500 mt-0.5 truncate"
                          title={item.emergencyContacts.referralClinic}
                        >
                          {item.emergencyContacts.referralClinic}
                        </p>
                      </td>

                      {/* Col 5: Status. Satu titik + label, bukan pil. */}
                      <td className={padClass}>
                        {item.status === 'active' && <StatusDot tone="ok">Aktif</StatusDot>}
                        {item.status === 'radius_warning' && <StatusDot tone="warn">Radius tinggi</StatusDot>}
                        {item.status === 'temp_inactive' && <StatusDot tone="idle">Nonaktif</StatusDot>}
                      </td>

                      {/* Col 6: Aksi */}
                      <td className={`${padClass} text-right`} onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block text-left" ref={isMenuOpen ? dropdownRef : null}>
                          <RowAction
                            onClick={() => {
                              setSelectedSchool(item)
                              setDrawerTab('overview')
                            }}
                          >
                            Detail
                          </RowAction>
                          <button
                            type="button"
                            onClick={() => setOpenMenuId(isMenuOpen ? null : item.id)}
                            aria-label={`Tindakan lain untuk ${item.name}`}
                            aria-expanded={isMenuOpen}
                            className="ml-1 p-2 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {isMenuOpen && (
                            <div className="absolute right-0 mt-1 w-56 rounded-lg bg-white border border-slate-200 shadow-lg z-30 py-1 text-xs text-slate-700">
                              <div className="px-3 py-1.5 border-b border-slate-100 font-semibold text-slate-500 text-[11px]">
                                Tindakan untuk {item.npsn}
                              </div>

                              <button
                                onClick={() => {
                                  setSelectedSchool(item)
                                  setDrawerTab('overview')
                                  setOpenMenuId(null)
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <School className="h-3.5 w-3.5 text-blue-800" />
                                <span>Lihat profil &amp; demografi</span>
                              </button>

                              <button
                                onClick={() => {
                                  setReassignModalData({
                                    school: item,
                                    targetSppgId: (sppgList[0] || {}).id || 'SPPG-01',
                                    reason: 'Jarak tempuh terlalu padat',
                                  })
                                  setOpenMenuId(null)
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-blue-800 cursor-pointer"
                              >
                                <Navigation className="h-3.5 w-3.5" />
                                <span>Pindah dapur SPPG</span>
                              </button>

                              <button
                                onClick={() => {
                                  setContactModalData({
                                    school: item,
                                    formData: {
                                      principalName: item.principal.name,
                                      principalPhone: item.principal.phone,
                                      uksCoordinatorName: item.emergencyContacts.uksCoordinatorName,
                                      uksPhone: item.emergencyContacts.uksPhone,
                                      referralClinic: item.emergencyContacts.referralClinic,
                                      clinicPhone: item.emergencyContacts.clinicPhone,
                                      clinicAddress: item.emergencyContacts.clinicAddress,
                                      ambulanceHotline: item.emergencyContacts.ambulanceHotline,
                                    },
                                  })
                                  setOpenMenuId(null)
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Phone className="h-3.5 w-3.5 text-slate-500" />
                                <span>Perbarui kontak darurat</span>
                              </button>

                              <div className="border-t border-slate-100 my-1" />

                              <button
                                onClick={() => {
                                  setSuspendModalData({
                                    school: item,
                                    isDeactivating: item.status !== 'temp_inactive',
                                    reason: 'Libur semester genap',
                                    returnDate: '05 Okt 2026',
                                  })
                                  setOpenMenuId(null)
                                }}
                                className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer ${
                                  item.status === 'temp_inactive' ? 'text-emerald-800' : 'text-rose-800'
                                }`}
                              >
                                {item.status === 'temp_inactive' ? (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5" />
                                )}
                                <span>
                                  {item.status === 'temp_inactive'
                                    ? 'Aktifkan kembali alokasi'
                                    : 'Nonaktifkan sementara'}
                                </span>
                              </button>

                              <div className="border-t border-slate-100 my-1" />

                              <button
                                onClick={() => {
                                  setDeleteModalData({
                                    school: item,
                                    reason: '',
                                  })
                                  setOpenMenuId(null)
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-rose-50 flex items-center gap-2 text-rose-700 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Hapus sekolah binaan</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Menampilkan <strong className="text-slate-900">{filtered.length}</strong> dari{' '}
            <strong className="text-slate-900">{schools.length}</strong> sekolah binaan terdata
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            DAPODIK SYNC &bull; JUKNIS DISTRIBUSI BAB 3.2.1
          </span>
        </div>
      </div>

      {/* ====================================================================
          MODAL 1: PENDAFTARAN SEKOLAH BARU (ONBOARDING NPSN)
          ==================================================================== */}
      {onboardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                  <School className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Pendaftaran Sekolah Baru (Onboarding NPSN)</h3>
                  <p className="text-xs text-slate-500">Integrasikan sekolah baru ke dalam klaster distribusi porsi MBG</p>
                </div>
              </div>
              <button
                onClick={() => setOnboardModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {/* Row 1: NPSN & Nama Sekolah */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    NPSN (8 Digit) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    placeholder="Contoh: 20109988"
                    value={newSchoolForm.npsn}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, npsn: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Resmi Sekolah <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: SDN 03 Kramat Jati"
                    value={newSchoolForm.name}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Row 2: Jenjang & Kota */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jenjang Pendidikan</label>
                  <select
                    value={newSchoolForm.level}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, level: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer bg-white"
                  >
                    <option value="SD">Sekolah Dasar (SD)</option>
                    <option value="MI">Madrasah Ibtidaiyah (MI)</option>
                    <option value="SMP">Sekolah Menengah Pertama (SMP)</option>
                    <option value="MTs">Madrasah Tsanawiyah (MTs)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Wilayah / Kota</label>
                  <select
                    value={newSchoolForm.city}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer bg-white"
                  >
                    {uniqueCities.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Alamat Lengkap */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap Sekolah</label>
                <input
                  type="text"
                  placeholder="Jl. Merdeka Barat No. 20, RT 02/RW 04..."
                  value={newSchoolForm.address}
                  onChange={(e) => setNewSchoolForm({ ...newSchoolForm, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Row 4: Demografi Siswa */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                  Demografi Siswa Sasaran (Kalkulasi Kalori Otomatis)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 font-medium mb-1">
                      SD Bawah (7-9 thn / 480 kkal)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newSchoolForm.lowerGrade}
                      onChange={(e) => setNewSchoolForm({ ...newSchoolForm, lowerGrade: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 font-medium mb-1">
                      SD Atas (10-12 thn / 550 kkal)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newSchoolForm.upperGrade}
                      onChange={(e) => setNewSchoolForm({ ...newSchoolForm, upperGrade: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 font-medium mb-1">
                      SMP (13-15 thn / 650 kkal)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newSchoolForm.smpGrade}
                      onChange={(e) => setNewSchoolForm({ ...newSchoolForm, smpGrade: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Row 5: Kepala Sekolah & Koordinator UKS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Kepala Sekolah</label>
                  <input
                    type="text"
                    placeholder="Dra. Hj. Mulyani, M.Pd"
                    value={newSchoolForm.principalName}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, principalName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">No. WhatsApp Kepala Sekolah</label>
                  <input
                    type="text"
                    placeholder="0812-3456-7890"
                    value={newSchoolForm.principalPhone}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, principalPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>
              </div>

              {/* Row 6: Puskesmas Rujukan & Telp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Puskesmas Rujukan Terdekat</label>
                  <input
                    type="text"
                    placeholder="Puskesmas Kecamatan Setempat"
                    value={newSchoolForm.clinicName}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, clinicName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">No. Kontak Medis Puskesmas</label>
                  <input
                    type="text"
                    placeholder="021-7654321 / 119"
                    value={newSchoolForm.clinicPhone}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, clinicPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>
              </div>

              {/* Row 7: Alokasi Dapur SPPG Penyuplai */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alokasi Dapur SPPG Penyuplai (Radius Aman &le; 30-45 Menit)
                </label>
                <select
                  value={newSchoolForm.sppgId}
                  onChange={(e) => setNewSchoolForm({ ...newSchoolForm, sppgId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer bg-white"
                >
                  {sppgList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.city}) - Sisa Kapasitas: {s.remainingCapacity != null ? s.remainingCapacity : 1200} porsi/hari
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOnboardModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>{isSubmitting ? 'Mendaftarkan...' : 'Daftarkan Sekolah'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: PEMINDAHAN ALOKASI DAPUR SPPG
          ==================================================================== */}
      {reassignModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                  <Navigation className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Pemindahan Alokasi Dapur SPPG</h3>
                  <p className="text-xs text-slate-500">Relokasi titik penyuplai untuk menjamin batas aman 45 menit</p>
                </div>
              </div>
              <button
                onClick={() => setReassignModalData(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-slate-500 text-[11px]">Sekolah Penerima:</div>
                <div className="font-bold text-slate-900 text-sm">{reassignModalData.school.name}</div>
                <div className="text-slate-600 font-mono text-[11px]">
                  Dapur Saat Ini: <strong className="text-slate-800">{reassignModalData.school.sppgSupplier.name}</strong> ({reassignModalData.school.sppgSupplier.transitMinutes} menit tempuh)
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pilih Dapur SPPG Baru (Penyuplai Pengganti)
                </label>
                <select
                  value={reassignModalData.targetSppgId}
                  onChange={(e) =>
                    setReassignModalData({ ...reassignModalData, targetSppgId: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                >
                  {sppgList.filter(
                    (s) => s.id !== reassignModalData.school.sppgSupplier?.id
                  ).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.city}) - Sisa Kapasitas: {s.remainingCapacity != null ? s.remainingCapacity : 1200} porsi
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alasan Pemindahan Alokasi</label>
                <textarea
                  rows={2}
                  required
                  value={reassignModalData.reason}
                  onChange={(e) =>
                    setReassignModalData({ ...reassignModalData, reason: e.target.value })
                  }
                  placeholder="Contoh: Kemacetan perbaikan jembatan utama melebihi 45 menit / Audit sanitasi dapur lama..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-[11px] text-blue-800 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-700" />
                  <span>Kalkulasi Otomatis Logistik MBG</span>
                </span>
                <p>
                  Sistem akan mengalihkan pesanan porsi harian ke dapur baru mulai jadwal pengiriman esok hari (H+1) dan memperbarui rute kurir pada peta telemetri.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReassignModalData(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  <Navigation className="h-4 w-4" />
                  <span>{isSubmitting ? 'Memproses...' : 'Otorisasi Pemindahan Dapur'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: PEMBARUAN DATA KONTAK DARURAT
          ==================================================================== */}
      {contactModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Pembaruan Data Kontak Darurat</h3>
                  <p className="text-xs text-slate-500">{contactModalData.school.name}</p>
                </div>
              </div>
              <button
                onClick={() => setContactModalData(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateContactSubmit} className="p-6 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Kepala Sekolah</label>
                  <input
                    type="text"
                    required
                    value={contactModalData.formData.principalName}
                    onChange={(e) =>
                      setContactModalData({
                        ...contactModalData,
                        formData: { ...contactModalData.formData, principalName: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">No. Telp / WhatsApp</label>
                  <input
                    type="text"
                    required
                    value={contactModalData.formData.principalPhone}
                    onChange={(e) =>
                      setContactModalData({
                        ...contactModalData,
                        formData: { ...contactModalData.formData, principalPhone: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Guru Pembina UKS</label>
                  <input
                    type="text"
                    required
                    value={contactModalData.formData.uksCoordinatorName}
                    onChange={(e) =>
                      setContactModalData({
                        ...contactModalData,
                        formData: { ...contactModalData.formData, uksCoordinatorName: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">No. Telp UKS</label>
                  <input
                    type="text"
                    required
                    value={contactModalData.formData.uksPhone}
                    onChange={(e) =>
                      setContactModalData({
                        ...contactModalData,
                        formData: { ...contactModalData.formData, uksPhone: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Puskesmas Rujukan</label>
                  <input
                    type="text"
                    required
                    value={contactModalData.formData.referralClinic}
                    onChange={(e) =>
                      setContactModalData({
                        ...contactModalData,
                        formData: { ...contactModalData.formData, referralClinic: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">No. Telp Puskesmas</label>
                  <input
                    type="text"
                    required
                    value={contactModalData.formData.clinicPhone}
                    onChange={(e) =>
                      setContactModalData({
                        ...contactModalData,
                        formData: { ...contactModalData.formData, clinicPhone: e.target.value }
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hotline Gawat Darurat / Ambulans</label>
                <input
                  type="text"
                  required
                  value={contactModalData.formData.ambulanceHotline}
                  onChange={(e) =>
                    setContactModalData({
                      ...contactModalData,
                      formData: { ...contactModalData.formData, ambulanceHotline: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setContactModalData(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan Kontak'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 4: PENONAKTIFAN SEMENTARA / PENGAKTIFAN KEMBALI
          ==================================================================== */}
      {suspendModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-xl ${
                    suspendModalData.isDeactivating
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {suspendModalData.isDeactivating ? (
                    <XCircle className="h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {suspendModalData.isDeactivating
                      ? 'Penonaktifan Sementara Sekolah'
                      : 'Pengaktifan Kembali Distribusi'}
                  </h3>
                  <p className="text-xs text-slate-500">{suspendModalData.school.name}</p>
                </div>
              </div>
              <button
                onClick={() => setSuspendModalData(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSuspendSubmit} className="p-6 space-y-4 text-xs">
              {suspendModalData.isDeactivating ? (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Alasan Penghentian Sementara
                    </label>
                    <select
                      value={suspendModalData.reason}
                      onChange={(e) =>
                        setSuspendModalData({ ...suspendModalData, reason: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-600 cursor-pointer"
                    >
                      <option value="Libur Semester Genap">Libur Semester Genap</option>
                      <option value="Libur Semester Ganjil">Libur Semester Ganjil</option>
                      <option value="Masa Ujian Daring Nasional (Siswa Belajar di Rumah)">
                        Masa Ujian Daring Nasional (Belajar Daring)
                      </option>
                      <option value="Renovasi Gedung &amp; Fasilitas Sanitasi Sekolah">
                        Renovasi Gedung &amp; Ruang Makan Sekolah
                      </option>
                      <option value="Karantina Kesehatan / KLB Lokal">Karantina Kesehatan / KLB</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Estimasi Tanggal Aktif Kembali
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: 12 Oktober 2026"
                      value={suspendModalData.returnDate}
                      onChange={(e) =>
                        setSuspendModalData({ ...suspendModalData, returnDate: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-600 font-mono"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-[11px] text-rose-800 space-y-1">
                    <span className="font-bold">Konsekuensi Penonaktifan:</span>
                    <p>
                      Alokasi porsi harian dari Dapur SPPG akan otomatis dihentikan sementara sehingga anggaran negara tidak terbuang sia-sia (*zero food waste*).
                    </p>
                  </div>
                </>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-900 space-y-2">
                  <p className="font-bold">Konfirmasi Pengaktifan Kembali:</p>
                  <p>
                    Sekolah akan dimasukkan kembali ke jadwal pengiriman harian reguler. Pastikan dapur SPPG penyuplai telah menerima notifikasi kesiapan bahan baku.
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSuspendModalData(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-5 py-2 rounded-xl text-white font-semibold shadow-sm transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                    suspendModalData.isDeactivating
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {suspendModalData.isDeactivating ? (
                    <>
                      <XCircle className="h-4 w-4" />
                      <span>{isSubmitting ? 'Memproses...' : 'Hentikan Distribusi Sementara'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{isSubmitting ? 'Memproses...' : 'Aktifkan Kembali Distribusi'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: KONFIRMASI HAPUS SEKOLAH BINAAN (PERMANEN)
          ==================================================================== */}
      {deleteModalData && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi hapus sekolah binaan"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => !isSubmitting && setDeleteModalData(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-slate-900">Hapus Sekolah Binaan</h3>
                <p className="text-xs text-slate-600 leading-relaxed mt-1">
                  Sekolah beserta seluruh data operasionalnya akan dihapus permanen dari pangkalan data MBG. Tindakan ini memerlukan otorisasi Superadmin.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-3 text-xs text-slate-700 space-y-1">
              <p className="font-bold text-slate-900">{deleteModalData.school.name}</p>
              <p className="font-mono text-[11px] text-slate-500">
                NPSN: {deleteModalData.school.npsn} &bull; {deleteModalData.school.city} &bull; Dapur: {deleteModalData.school.sppg}
              </p>
            </div>

            <form onSubmit={handleDeleteSchoolSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alasan Penghapusan Sekolah (Wajib diisi):
                </label>
                <textarea
                  rows={2}
                  required
                  value={deleteModalData.reason}
                  onChange={(e) => setDeleteModalData({ ...deleteModalData, reason: e.target.value })}
                  placeholder="Contoh: Sekolah merger dengan sekolah lain atau alih binaan..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setDeleteModalData(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
                >
                  Batalkan
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !deleteModalData.reason.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{isSubmitting ? 'Menghapus...' : 'Hapus Permanen'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          DRAWER: DETAIL PROFIL LENGKAP SEKOLAH & DEMOGRAFI GIZI
          ==================================================================== */}
      {selectedSchool && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300 overflow-hidden">
            {/* Drawer Header */}
            <div className="px-6 py-4.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700">
                  <School className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">{selectedSchool.name}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                      {selectedSchool.level}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    NPSN: {selectedSchool.npsn} &bull; {selectedSchool.city}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSchool(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Navigation Tabs */}
            <div className="flex items-center gap-1 px-6 border-b border-slate-200 bg-white shrink-0 text-xs">
              {[
                { id: 'overview', label: 'Ringkasan & Lokasi', icon: Compass },
                { id: 'nutrition', label: 'Demografi & Gizi', icon: Flame },
                { id: 'contacts', label: 'Kontak Darurat', icon: Phone },
                { id: 'logistics', label: 'Dapur & Radius', icon: Navigation }
              ].map((tab) => {
                const IconComponent = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setDrawerTab(tab.id)}
                    className={`py-3 px-3 font-semibold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                      drawerTab === tab.id
                        ? 'border-blue-600 text-blue-800'
                        : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <IconComponent className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {/* Tab 1: Overview & Location */}
              {drawerTab === 'overview' && (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div
                    className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                      selectedSchool.status === 'active'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : selectedSchool.status === 'radius_warning'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  >
                    {selectedSchool.status === 'active' && <CheckCircle2 className="h-4 w-4 text-emerald-800 shrink-0 mt-0.5" />}
                    {selectedSchool.status === 'radius_warning' && <AlertTriangle className="h-4 w-4 text-amber-800 shrink-0 mt-0.5" />}
                    {selectedSchool.status === 'temp_inactive' && <XCircle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />}
                    <div>
                      <div className="font-bold text-xs">{selectedSchool.statusLabel}</div>
                      <p className="text-[11px] mt-0.5 opacity-90 leading-relaxed">
                        {selectedSchool.statusReason}
                      </p>
                    </div>
                  </div>

                  {/* Geolocation Card */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-blue-800" />
                      <span>Titik Koordinat &amp; Geografis</span>
                    </span>
                    <p className="text-slate-700 leading-relaxed">{selectedSchool.address}</p>
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-200/80 text-[11px] font-mono text-slate-600">
                      <span>Latitude: <strong>{selectedSchool.coordinates.lat}</strong></span>
                      <span>Longitude: <strong>{selectedSchool.coordinates.lng}</strong></span>
                    </div>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedSchool.coordinates.lat},${selectedSchool.coordinates.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-800 font-semibold text-[11px] hover:underline pt-1"
                    >
                      <span>Buka di Google Maps Navigasi</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {/* Principal Details */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <School className="h-3.5 w-3.5 text-slate-600" />
                      <span>Kepala Sekolah &amp; Legalitas</span>
                    </span>
                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Nama Lengkap:</span>
                        <strong className="text-slate-800">{selectedSchool.principal.name}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">NIP:</span>
                        <span className="font-mono text-slate-700">{selectedSchool.principal.nip}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Kontak WhatsApp:</span>
                        <span className="font-mono text-blue-800 font-semibold">{selectedSchool.principal.phone}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Email Institusi:</span>
                        <span className="font-mono text-slate-600 truncate">{selectedSchool.principal.email}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Nutrition & Demographics */}
              {drawerTab === 'nutrition' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Flame className="h-4 w-4 text-amber-500" />
                      <span>Kalkulasi Kebutuhan Kalori Harian MBG</span>
                    </span>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                        <span className="text-[10px] text-emerald-800 font-bold block">SD Bawah (7-9 thn)</span>
                        <span className="text-base font-bold font-mono text-emerald-900">
                          {selectedSchool.demographics.lowerGrade}
                        </span>
                        <span className="text-[10px] text-emerald-700 block mt-0.5">480 kkal/porsi</span>
                      </div>
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                        <span className="text-[10px] text-blue-800 font-bold block">SD Atas (10-12 thn)</span>
                        <span className="text-base font-bold font-mono text-blue-900">
                          {selectedSchool.demographics.upperGrade}
                        </span>
                        <span className="text-[10px] text-blue-700 block mt-0.5">550 kkal/porsi</span>
                      </div>
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                        <span className="text-[10px] text-blue-800 font-bold block">SMP (13-15 thn)</span>
                        <span className="text-base font-bold font-mono text-blue-900">
                          {selectedSchool.demographics.smpGrade}
                        </span>
                        <span className="text-[10px] text-blue-700 block mt-0.5">650 kkal/porsi</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-500 block">Total Kebutuhan Energi:</span>
                        <strong className="text-slate-900 font-mono text-sm">
                          {selectedSchool.demographics.totalCalorieTarget.toLocaleString()} kkal / hari
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block">Rata-rata per Porsi:</span>
                        <strong className="text-amber-800 font-mono text-sm">
                          {selectedSchool.demographics.avgCaloriePerPortion} kkal
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Dietary & Allergies */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <HeartPulse className="h-3.5 w-3.5 text-rose-500" />
                      <span>Catatan Alergi &amp; Pola Makan Khusus</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded bg-rose-50 border border-rose-200 text-rose-700 font-bold font-mono text-xs">
                        {selectedSchool.demographics.allergiesCount} Siswa
                      </span>
                      <span className="text-slate-600 text-xs">
                        {selectedSchool.demographics.dietaryNotes}
                      </span>
                    </div>
                  </div>

                  {/* Reference Nutrition Table */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                    <span className="font-bold text-slate-800 text-xs block">
                      Standar Acuan Pedoman Gizi Nasional MBG
                    </span>
                    <div className="space-y-2 text-[11px]">
                      {NUTRITION_STANDARDS.map((std, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 block">{std.bracket}</span>
                            <span className="text-slate-500 text-[10px]">{std.gradeLevel}</span>
                          </div>
                          <div className="text-right font-mono">
                            <span className="font-bold text-slate-900 block">{std.calorieRange}</span>
                            <span className="text-slate-500 text-[10px]">Protein {std.proteinTarget}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Emergency Contacts */}
              {drawerTab === 'contacts' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-blue-800" />
                      <span>Kontak Darurat Lapangan &amp; UKS</span>
                    </span>

                    <div className="space-y-2.5">
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-slate-500 text-[10px] block">Kepala Sekolah:</span>
                          <span className="font-bold text-slate-900">{selectedSchool.principal.name}</span>
                        </div>
                        <a
                          href={`tel:${selectedSchool.emergencyContacts.principalPhone}`}
                          className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-mono font-bold text-xs hover:bg-blue-100 flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" />
                          <span>{selectedSchool.emergencyContacts.principalPhone}</span>
                        </a>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-slate-500 text-[10px] block">Koordinator Guru Pembina UKS:</span>
                          <span className="font-bold text-slate-900">{selectedSchool.emergencyContacts.uksCoordinatorName}</span>
                        </div>
                        <a
                          href={`tel:${selectedSchool.emergencyContacts.uksPhone}`}
                          className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-mono font-bold text-xs hover:bg-emerald-100 flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" />
                          <span>{selectedSchool.emergencyContacts.uksPhone}</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Medical Referral */}
                  <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-2">
                    <span className="font-bold text-rose-900 text-xs flex items-center gap-1.5">
                      <HeartPulse className="h-3.5 w-3.5 text-rose-800" />
                      <span>Fasilitas Pelayanan Kesehatan Rujukan Resmi</span>
                    </span>

                    <div className="space-y-1 text-[11px] text-rose-950">
                      <div className="font-bold text-sm">{selectedSchool.emergencyContacts.referralClinic}</div>
                      <p className="text-rose-800">{selectedSchool.emergencyContacts.clinicAddress}</p>
                      <div className="flex items-center gap-3 pt-2 font-mono">
                        <span>Telp Puskesmas: <strong>{selectedSchool.emergencyContacts.clinicPhone}</strong></span>
                        <span>&bull;</span>
                        <span>Hotline: <strong className="text-rose-800">{selectedSchool.emergencyContacts.ambulanceHotline}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Logistics & Radius */}
              {drawerTab === 'logistics' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-blue-700" />
                      <span>Dapur SPPG Penanggung Jawab Suplai</span>
                    </span>

                    <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-100 space-y-1">
                      <div className="font-bold text-blue-950 text-sm">{selectedSchool.sppgSupplier.name}</div>
                      <div className="text-[11px] text-blue-800">{selectedSchool.sppgSupplier.type}</div>
                      <p className="text-[11px] text-blue-900/80">{selectedSchool.sppgSupplier.address}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 text-[10px] block">Jarak Tempuh:</span>
                        <strong className="text-slate-900 font-mono text-base">{selectedSchool.sppgSupplier.distanceKm} km</strong>
                      </div>
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 text-[10px] block">Waktu Perjalanan:</span>
                        <strong
                          className={`font-mono text-base ${
                            selectedSchool.sppgSupplier.transitMinutes >= 35
                              ? 'text-amber-800'
                              : 'text-emerald-800'
                          }`}
                        >
                          {selectedSchool.sppgSupplier.transitMinutes} Menit
                        </strong>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 pt-1">
                      Rute Koridor: <strong className="text-slate-700">{selectedSchool.sppgSupplier.corridorRoute}</strong>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 text-xs">
                    <span className="font-bold text-slate-800 text-xs block">
                      Metrik Layanan Distribusi MBG
                    </span>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-b border-slate-200/80 pb-2">
                      <span className="text-slate-500">Rata-rata Tiba di Meja Siswa:</span>
                      <strong className="text-slate-900 font-mono">{selectedSchool.avgArrivalTime}</strong>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-slate-500">Tingkat Penerimaan Fisik:</span>
                      <strong className="text-emerald-700 font-mono">{selectedSchool.acceptanceRate}%</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2 shrink-0">
              <button
                onClick={() => {
                  setContactModalData({
                    school: selectedSchool,
                    formData: {
                      principalName: selectedSchool.principal.name,
                      principalPhone: selectedSchool.principal.phone,
                      uksCoordinatorName: selectedSchool.emergencyContacts.uksCoordinatorName,
                      uksPhone: selectedSchool.emergencyContacts.uksPhone,
                      referralClinic: selectedSchool.emergencyContacts.referralClinic,
                      clinicPhone: selectedSchool.emergencyContacts.clinicPhone,
                      clinicAddress: selectedSchool.emergencyContacts.clinicAddress,
                      ambulanceHotline: selectedSchool.emergencyContacts.ambulanceHotline
                    }
                  })
                }}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition cursor-pointer"
              >
                Edit Kontak
              </button>

              <button
                onClick={() => {
                  setReassignModalData({
                    school: selectedSchool,
                    targetSppgId: (sppgList[0] || {}).id || 'SPPG-01',
                    reason: 'Jarak tempuh terlalu padat'
                  })
                }}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer flex items-center gap-1.5"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>Pindah Dapur SPPG</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
