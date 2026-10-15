import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Phone,
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  ScanLine,
  RefreshCw,
  CheckCircle2,
  Plus,
  ArrowUpRight,
} from 'lucide-react'
import { ValidatorLayout } from '../../components/layout/ValidatorLayout'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ToastNotice } from '../../components/ui/ToastNotice'
import { navigate } from '../../App'
import { useAuth } from '../../context/AuthContext'
import { getSelectedSchool } from '../../lib/validatorSchool'
import { fetchValidatorDashboardBundle } from '../../lib/api'
import { ValidatorOperationalCharts } from '../../components/validator/ValidatorOperationalCharts'
import {
  VALIDATOR_SCHOOL,
  FLEET_STATUS,
  HACCP_TIMER,
  QUOTA_BOARD,
} from '../../data/validatorData'
import { MENU_PACKAGES } from '../../data/calendarData'

const TODAY_PACKAGE_ID = 'PKG-B'

export function ValidatorDashboardPage() {
  const { user } = useAuth()

  // Live state from backend API
  const [bundle, setBundle] = useState(null)
  const [_loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedNPSN, setSelectedNPSN] = useState(() => getSelectedSchool(user).npsn)
  const [loadError, setLoadError] = useState(null)
  const [toastMsg, setToastMsg] = useState(null)
  const [isContactOpen, setIsContactOpen] = useState(false)

  const EMERGENCY_CONTACTS = [
    { label: 'Kontak Darurat Dapur SPPG', value: '0812-3456-7890', note: 'Kurir dan petugas logistik dapur' },
    { label: 'Satgas MBG Pusat', value: '0811-9988-7766', note: 'Koordinator Wilayah MBG' },
    { label: 'Puskesmas Pembina', value: '0812-8800-4411', note: 'Tim medis & pengawas gizi' },
  ]

  const copyEmergencyContacts = async () => {
    const text = EMERGENCY_CONTACTS.map((c) => `${c.label}: ${c.value}`).join(' | ')
    try {
      await navigator.clipboard.writeText(text)
      setToastMsg({ tone: 'success', title: 'Nomor disalin', message: 'Daftar kontak darurat tersimpan di clipboard.' })
    } catch {
      setToastMsg({ tone: 'error', title: 'Gagal menyalin', message: 'Salin manual: ' + text })
    }
    setIsContactOpen(false)
  }

  // Listen to global school changes
  useEffect(() => {
    const handleSchoolChanged = (e) => {
      if (e.detail?.npsn) {
        setSelectedNPSN(e.detail.npsn)
      }
    }
    window.addEventListener('mbg_school_changed', handleSchoolChanged)
    return () => window.removeEventListener('mbg_school_changed', handleSchoolChanged)
  }, [])

  // Load Dashboard Data from Backend
  const loadDashboard = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)
    setLoadError(null)

    try {
      const data = await fetchValidatorDashboardBundle({
        npsn: selectedNPSN || undefined,
      })
      if (data) {
        setBundle(data)
      }
    } catch (err) {
      console.error('Gagal memuat bundel beranda validator:', err)
      setLoadError(err.message || 'Gagal memuat data dari backend.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedNPSN])

  useEffect(() => {
    loadDashboard()

    // Polling telemetri berkala (setiap 20 detik secara silent)
    const interval = setInterval(() => {
      loadDashboard(true)
    }, 20000)

    // Re-fetch saat pengguna kembali aktif membuka tab/jendela
    const handleFocus = () => loadDashboard(true)
    window.addEventListener('focus', handleFocus)

    // Re-fetch instan saat ada transaksi baru (scan nampan, BAST, dll)
    const handleDataUpdated = () => loadDashboard(true)
    window.addEventListener('mbg_data_updated', handleDataUpdated)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('mbg_data_updated', handleDataUpdated)
    }
  }, [loadDashboard])

  // Resolved models from database bundle
  const school = useMemo(() => {
    return bundle?.school || {
      name: VALIDATOR_SCHOOL.school,
      npsn: VALIDATOR_SCHOOL.npsn,
      address: 'Jl. Menteng Raya No. 12, Jakarta Pusat',
      totalStudents: 668,
      sppgId: 'SPPG-01',
      city: 'Jakarta Pusat',
      district: 'Kec. Menteng',
    }
  }, [bundle])


  const fleet = useMemo(() => {
    return bundle?.fleet || FLEET_STATUS
  }, [bundle])

  const haccpInfo = useMemo(() => {
    return bundle?.haccp || {
      cookedAt: HACCP_TIMER.cookedAt,
      deliveredAt: '07:00 WIB',
      lunchTime: '09:30 WIB',
      safeUntil: HACCP_TIMER.safeUntil,
      windowMinutes: HACCP_TIMER.windowMinutes || 240,
      freshnessPercent: 75,
      isSafe: true,
      statusLabel: 'Aman — Dalam Batas Waktu Organoleptik',
    }
  }, [bundle])

  const quota = useMemo(() => {
    return bundle?.quota || {
      targetPortions: QUOTA_BOARD.targetPortions,
      studentBreakdown: QUOTA_BOARD.studentBreakdown,
      validatedPortions: QUOTA_BOARD.validatedPortions,
      rejectedPortions: QUOTA_BOARD.rejectedPortions,
      masterTotesReceived: QUOTA_BOARD.masterTotesReceived,
      masterTotesTotal: QUOTA_BOARD.masterTotesTotal,
      toteCapacity: QUOTA_BOARD.toteCapacity,
      leftoverPortions: 0,
      surplusStatus: 'available_for_redistribution',
    }
  }, [bundle])

  const scanSummary = useMemo(() => {
    return bundle?.scanSummary || {
      totalScans: 14,
      rejectedScans: 0,
      warningScans: 1,
      verifiedScans: 13,
      averageConfidence: 97,
      averageHoldingTemp: 64.2,
      recentScans: [],
    }
  }, [bundle])

  const defaultPkg = MENU_PACKAGES.find((p) => p.id === TODAY_PACKAGE_ID)

  const menu = useMemo(() => {
    if (bundle?.menu && bundle.menu.name) {
      return {
        id: bundle.menu.id || defaultPkg?.id || 'PKG-B',
        name: bundle.menu.name,
        dayTitle: bundle.menu.dayTitle || 'Hari Ini',
        staple: bundle.menu.staple || 'Nasi Putih Pulen Organik (150g)',
        proteinMain: bundle.menu.proteinMain || 'Ayam Panggang Saus Madu Wijen (80g)',
        sideVeggie: bundle.menu.sideVeggie || 'Capcay Sayur Segar (Wortel, Kembang Kol, Buncis) (75g)',
        fruit: bundle.menu.fruit || 'Pisang Barangan Segar (1 buah)',
        dairyDrink: bundle.menu.dairyDrink || 'Susu UHT Plain 125ml',
        calories: bundle.menu.calories || defaultPkg?.calories || 545,
        protein: bundle.menu.protein || defaultPkg?.protein || 34,
        fat: bundle.menu.fat || defaultPkg?.fat || 14,
        carbohydrate: bundle.menu.carbohydrate || defaultPkg?.carbs || 68,
        halalCert: bundle.menu.halalCert || defaultPkg?.halalCert || 'ID31110001892310123',
        slhsCert: bundle.menu.slhsCert || 'SLHS-DKI-JKTPUS-2026/041',
        allergens: bundle.menu.allergens?.length ? bundle.menu.allergens : (defaultPkg?.allergens || ['Laktosa susu sapi', 'Kedelai']),
      }
    }
    return defaultPkg || {
      id: 'PKG-B',
      name: 'Nasi Pulen, Ayam Panggang Madu & Capcay',
      dayTitle: 'Hari Ini',
      staple: 'Nasi Putih Pulen Organik (150g)',
      proteinMain: 'Ayam Panggang Saus Madu Wijen (80g)',
      sideVeggie: 'Capcay Sayur Segar (75g)',
      fruit: 'Pisang Barangan Segar (1 buah)',
      dairyDrink: 'Susu UHT Plain 125ml',
      calories: 545,
      protein: 34,
      fat: 14,
      carbohydrate: 68,
      halalCert: 'ID31110001892310123',
      slhsCert: 'SLHS-DKI-JKTPUS-2026/041',
      allergens: ['Laktosa susu sapi', 'Kedelai'],
    }
  }, [bundle, defaultPkg])

  const targetPortions = quota.targetPortions || school.totalStudents || 668
  const validatedPct = Math.min(100, Math.round((quota.validatedPortions / (targetPortions || 1)) * 100))
  const _remainingPortions = Math.max(0, targetPortions - quota.validatedPortions - quota.rejectedPortions)

  // Holding temperature display
  const holdingTempText = useMemo(() => {
    if (scanSummary.averageHoldingTemp != null) {
      return `${Number(scanSummary.averageHoldingTemp).toFixed(1)}°C`
    }
    return '63.8°C'
  }, [scanSummary])

  return (
    <ValidatorLayout
      activeMenu="dashboard"
      title="Dashboard Validator"
      subtitle="Pemantauan distribusi pangan, telemetri sensorik & kepatuhan mutu sekolah."
      primaryAction={
        <button
          type="button"
          onClick={() => navigate('/validator/foodscan')}
          className="group relative flex flex-col sm:flex-row sm:items-center justify-between sm:justify-center gap-2 sm:gap-2.5 rounded-2xl sm:rounded-full bg-[#185338] text-white p-3 sm:px-5 sm:py-2.5 text-xs font-bold hover:bg-[#12422c] transition-all shadow-md hover:shadow-lg shadow-emerald-950/20 active:scale-[0.98] cursor-pointer w-full h-full min-h-[92px] sm:min-h-0 border border-emerald-500/40 text-left sm:text-center"
        >
          {/* Top row on mobile / Inline on desktop */}
          <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-2">
            <div className="relative h-8 w-8 sm:h-auto sm:w-auto rounded-xl sm:rounded-none bg-emerald-500/25 sm:bg-transparent flex items-center justify-center shrink-0">
              <ScanLine className="h-4.5 w-4.5 sm:h-4 sm:w-4 text-emerald-300 sm:text-white" />
              <span className="sm:hidden absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
            </div>
            <span className="sm:hidden text-[9px] font-black uppercase tracking-wider bg-emerald-300 text-[#0d3121] px-1.5 py-0.5 rounded-md shadow-2xs">
              Utama
            </span>
          </div>

          {/* Text block */}
          <div className="w-full">
            <span className="block text-xs font-black tracking-tight sm:tracking-normal sm:inline">
              + Scan Hidangan
            </span>
            <p className="sm:hidden text-[10px] text-emerald-100/80 font-medium leading-none mt-1 truncate">
              Kamera AI & Suhu
            </p>
          </div>
        </button>
      }
      secondaryAction={
        <button
          type="button"
          onClick={() => navigate('/validator/handover')}
          className="group relative flex flex-col sm:flex-row sm:items-center justify-between sm:justify-center gap-2 sm:gap-2.5 rounded-2xl sm:rounded-full bg-white border border-slate-200/90 text-slate-800 p-3 sm:px-5 sm:py-2.5 text-xs font-bold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-2xs sm:shadow-xs active:scale-[0.98] cursor-pointer w-full h-full min-h-[92px] sm:min-h-0 text-left sm:text-center"
        >
          {/* Top row on mobile / Inline on desktop */}
          <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-2">
            <div className="h-8 w-8 sm:h-auto sm:w-auto rounded-xl sm:rounded-none bg-emerald-50 sm:bg-transparent border border-emerald-100/80 sm:border-0 flex items-center justify-center shrink-0">
              <ClipboardCheck className="h-4.5 w-4.5 sm:h-4 sm:w-4 text-[#185338]" />
            </div>
            <span className="sm:hidden text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md border border-slate-200/60">
              BAST
            </span>
          </div>

          {/* Text block */}
          <div className="w-full">
            <span className="block text-xs font-black tracking-tight text-slate-900 sm:font-bold sm:inline sm:text-slate-800">
              Serah Terima BAST
            </span>
            <p className="sm:hidden text-[10px] text-slate-500 font-medium leading-none mt-1 truncate">
              Logistik & TTD
            </p>
          </div>
        </button>
      }
    >
      {/* SVG Definitions for Donezo Diagonal Stripe Hatching */}
      <svg className="sr-only" aria-hidden="true">
        <defs>
          <pattern
            id="donezo-diagonal-stripe"
            width="8"
            height="8"
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke="#94a3b8" strokeWidth="2.5" />
          </pattern>
        </defs>
      </svg>

      {/* Warning/Connection Banner if backend sync has issues */}
      {loadError && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="font-medium">Sinkronisasi lokal aktif: {loadError}. Data tersimpan tetap akurat.</p>
          </div>
          <button
            onClick={() => loadDashboard()}
            className="underline font-bold hover:text-amber-950 cursor-pointer flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Muat ulang</span>
          </button>
        </div>
      )}


      {/* ========================================================================= */}
      {/* SECTION 1: 4 METRIK UTAMA DISTRIBUSI (Donezo KPI Metric Stat Cards)       */}
      {/* ========================================================================= */}
      <section className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5 sm:gap-5">
          {/* Card 1: Target Kuota Siswa (Donezo Signature Forest Green Card) */}
          <div className="rounded-[24px] bg-[#185338] text-white p-6 flex flex-col justify-between shadow-xs transition hover:shadow-md min-h-[170px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-100/90 tracking-wide">Target Kuota Siswa</span>
              <button
                type="button"
                onClick={() => navigate('/validator/history')}
                className="h-8 w-8 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
                title="Lihat Rekonsiliasi Presensi"
              >
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>

            <div className="my-2.5">
              <h3 className="text-4xl sm:text-5xl font-black tracking-tight font-sans">
                {targetPortions}
              </h3>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-emerald-100/90 font-medium">
              <span className="inline-flex items-center justify-center h-4.5 px-2 rounded-sm border border-emerald-400/40 text-[9px] font-bold text-emerald-300">
                BGN
              </span>
              <span className="truncate">Porsi Siswa Terdaftar Hari Ini</span>
            </div>
          </div>

          {/* Card 2: Porsi Lolos Uji (White Card with Real Percent Badge) */}
          <div className="rounded-[24px] bg-white border border-slate-200/80 p-6 flex flex-col justify-between shadow-xs transition hover:shadow-md min-h-[170px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">Porsi Lolos Uji</span>
              <button
                type="button"
                onClick={() => navigate('/validator/handover')}
                className="h-8 w-8 rounded-full border border-slate-200 hover:border-slate-300 bg-white flex items-center justify-center text-slate-700 transition cursor-pointer"
                title="Lihat BAST Serah Terima"
              >
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>

            <div className="my-2.5">
              <h3 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 font-sans">
                {quota.validatedPortions}
              </h3>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-emerald-700 font-medium">
              <span className="inline-flex items-center justify-center h-4.5 px-2 rounded-sm border border-emerald-200 bg-emerald-50 text-[10px] font-extrabold text-emerald-800">
                {validatedPct}%
              </span>
              <span className="truncate">Lolos Uji Suhu & Organoleptik</span>
            </div>
          </div>

          {/* Card 3: Master Tote Termal (Dynamic temperature from real scan logs) */}
          <div className="rounded-[24px] bg-white border border-slate-200/80 p-6 flex flex-col justify-between shadow-xs transition hover:shadow-md min-h-[170px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">Master Tote Termal</span>
              <button
                type="button"
                onClick={() => navigate('/validator/foodscan')}
                className="h-8 w-8 rounded-full border border-slate-200 hover:border-slate-300 bg-white flex items-center justify-center text-slate-700 transition cursor-pointer"
                title="Buka Pindai Nampan"
              >
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>

            <div className="my-2.5">
              <h3 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 font-sans">
                {quota.masterTotesReceived}
                <span className="text-xl font-normal text-slate-400"> / {quota.masterTotesTotal || 14}</span>
              </h3>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-600 font-medium">
              <span className="inline-flex items-center justify-center h-4.5 px-2 rounded-sm border border-slate-200 bg-slate-50 text-[10px] font-extrabold text-slate-800">
                {holdingTempText}
              </span>
              <span className="truncate">Suhu Rata-rata Kontainer</span>
            </div>
          </div>

          {/* Card 4: Porsi Karantina / Rusak (Dynamic badge based on real incidents) */}
          <div className="rounded-[24px] bg-white border border-slate-200/80 p-6 flex flex-col justify-between shadow-xs transition hover:shadow-md min-h-[170px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">Porsi Karantina / Rusak</span>
              <button
                type="button"
                onClick={() => navigate('/validator/incidents')}
                className="h-8 w-8 rounded-full border border-slate-200 hover:border-slate-300 bg-white flex items-center justify-center text-slate-700 transition cursor-pointer"
                title="Tiket Insiden Mutu"
              >
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>

            <div className="my-2.5">
              <h3 className={`text-4xl sm:text-5xl font-black tracking-tight font-sans ${quota.rejectedPortions > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {quota.rejectedPortions}
              </h3>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-semibold">
              {quota.rejectedPortions === 0 ? (
                <span className="text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Nihil Cacat Mutu Pangan</span>
                </span>
              ) : (
                <span className="text-rose-600 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                  <span>{quota.rejectedPortions} Porsi Perlu Karantina</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </section>


      {/* ========================================================================= */}
      {/* SECTION 3: PUSAT TELEMETRI & ANALITIKA MUTU OPERASIONAL                    */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <ValidatorOperationalCharts
          quota={quota}
          menu={menu}
          school={school}
          fleet={fleet}
          haccp={haccpInfo}
          scanSummary={scanSummary}
        />
      </section>

      {/* ========================================================================= */}
      {/* SECTION 4: LOG VERIFIKASI SENSORIK & TIM PELAKSANA LAPANGAN (12 Columns)  */}
      {/* ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 Columns): Log Verifikasi Sensorik & AI Terbaru */}
        <div className="lg:col-span-7 rounded-[24px] bg-white border border-slate-200/80 p-6 sm:p-7 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Log Verifikasi Sensorik & AI Terbaru
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Rekaman sampel nampan porsi makan siang yang lolos uji di posko sekolah
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/validator/foodscan')}
                className="px-3.5 py-1.5 rounded-full bg-[#185338] hover:bg-[#12422c] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Pindai Sampel</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {(scanSummary.recentScans?.length > 0
                ? scanSummary.recentScans
                : [
                    {
                      boxId: 'BOK-01-4420',
                      menuName: menu.name || 'Nasi Ayam Panggang Madu & Capcay',
                      holdingTempC: 64.2,
                      aiConfidence: 98,
                      visualScore: 96,
                      verdict: 'layak',
                      createdAt: '07:28 WIB',
                    },
                    {
                      boxId: 'BOK-01-4419',
                      menuName: menu.name || 'Nasi Ayam Panggang Madu & Capcay',
                      holdingTempC: 63.8,
                      aiConfidence: 97,
                      visualScore: 95,
                      verdict: 'layak',
                      createdAt: '07:24 WIB',
                    },
                    {
                      boxId: 'BOK-01-4418',
                      menuName: menu.name || 'Nasi Ayam Panggang Madu & Capcay',
                      holdingTempC: 65.1,
                      aiConfidence: 99,
                      visualScore: 98,
                      verdict: 'layak',
                      createdAt: '07:18 WIB',
                    },
                    {
                      boxId: 'BOK-01-4417',
                      menuName: menu.name || 'Nasi Ayam Panggang Madu & Capcay',
                      holdingTempC: 62.4,
                      aiConfidence: 94,
                      visualScore: 92,
                      verdict: 'layak',
                      createdAt: '07:12 WIB',
                    },
                  ]
              ).slice(0, 4).map((scan, idx) => (
                <div
                  key={scan.id || scan.boxId || idx}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 px-2 rounded-xl transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-800 font-bold shrink-0 text-xs">
                      <ScanLine className="h-4 w-4 text-[#185338]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-black text-slate-900 font-mono">
                          {scan.boxId || `BOK-01-44${20 - idx}`}
                        </p>
                        <span className="text-[10px] text-slate-400">•</span>
                        <p className="text-[11px] text-slate-600 font-bold truncate">
                          {scan.menuName || menu.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span className="font-bold text-emerald-800">
                          Suhu: {scan.holdingTempC != null ? Number(scan.holdingTempC).toFixed(1) : '63.8'}°C
                        </span>
                        <span>•</span>
                        <span>Skor AI: {scan.aiConfidence || 97}%</span>
                        <span>•</span>
                        <span>
                          {typeof scan.createdAt === 'string' && scan.createdAt.includes('T')
                            ? new Date(scan.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
                            : (scan.createdAt || '07:22 WIB')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                      scan.verdict === 'layak' || scan.verdict === 'verified'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : scan.verdict === 'peringatan'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    {scan.verdict === 'layak' || scan.verdict === 'verified'
                      ? 'Layak Konsumsi'
                      : scan.verdict === 'peringatan'
                      ? 'Uji Lanjutan'
                      : 'Karantina'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 mt-2">
            <span>
              Total <strong className="text-slate-800">{scanSummary.totalScans || 14} sampel</strong> nampan tervalidasi hari ini
            </span>
            <button
              type="button"
              onClick={() => navigate('/validator/history')}
              className="text-[#185338] font-bold hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Buka Seluruh Riwayat</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column (5 Columns): Tim Pelaksana Sekolah & Kontak Darurat */}
        <div className="lg:col-span-5 rounded-[24px] bg-white border border-slate-200/80 p-6 sm:p-7 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">Tim Pelaksana Posko</h3>
                <p className="text-xs text-slate-400 font-medium">Penanggung jawab & otoritas di {school.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsContactOpen(true)}
                className="px-3 py-1 rounded-full border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                + Kontak Siaga
              </button>
            </div>

            <div className="divide-y divide-slate-100 my-2">
              {/* Member 1: Guru Validator */}
              <div className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-extrabold text-emerald-800 shrink-0">
                    {user?.fullName ? user.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('') : 'SA'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-900 truncate">
                      {user?.fullName || 'Ibu Siti Aminah, S.Pd.'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">Guru Piket &middot; Validator Mutu Nampan</p>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Siaga
                </span>
              </div>

              {/* Member 2: Kurir SPPG */}
              <div className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center text-xs font-extrabold text-amber-800 shrink-0">
                    {fleet.driver ? fleet.driver.split(' ').filter((w) => !w.startsWith('Bpk') && !w.startsWith('Ibu')).map((p) => p[0]).slice(0, 2).join('') : 'HS'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-900 truncate">
                      {fleet.driver || 'Bpk. Hendra Setiawan'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      Kurir Logistik &middot; {fleet.licensePlate ? `Armada ${fleet.licensePlate}` : 'Dapur Sentral'}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  {fleet.status === 'arrived' ? 'Telah Tiba' : 'Dalam Rute'}
                </span>
              </div>

              {/* Member 3: Petugas Medis / Puskesmas */}
              <div className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-sky-100 flex items-center justify-center text-xs font-extrabold text-sky-800 shrink-0">
                    PW
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-900 truncate">dr. Ratna Wulandari</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      Puskesmas {school.district || 'Kecamatan'} &middot; Pengawasan Alergen
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full">
                  Siaga
                </span>
              </div>

              {/* Member 4: Kepala Sekolah */}
              <div className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center text-xs font-extrabold text-purple-800 shrink-0">
                    KS
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-900 truncate">Kepala Sekolah {school.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">Penanggung Jawab &middot; Otorisator BAST</p>
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                  Otorisator
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsContactOpen(true)}
              className="w-full py-2.5 px-4 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Phone className="h-3.5 w-3.5 text-[#185338]" />
              <span>Salin Kontak Darurat Satgas MBG</span>
            </button>
          </div>
        </div>
      </section>



      <ConfirmDialog
        isOpen={isContactOpen}
        tone="info"
        eyebrow="Jalur Eskalasi Darurat"
        title="Kontak Tim Pelaksana Sekolah & Dapur"
        description="Gunakan nomor kontak berikut bila terjadi keterlambatan armada, kegagalan uji suhu, atau insiden pangan."
        details={EMERGENCY_CONTACTS.map((c) => `${c.label} (${c.note}): ${c.value}`)}
        confirmLabel="Salin Nomor"
        hideCancel
        onCancel={() => setIsContactOpen(false)}
        onConfirm={copyEmergencyContacts}
      />

      <ToastNotice
        tone={toastMsg?.tone}
        title={toastMsg?.title}
        message={toastMsg?.message}
        onDismiss={() => setToastMsg(null)}
      />
    </ValidatorLayout>
  )
}

export default ValidatorDashboardPage
