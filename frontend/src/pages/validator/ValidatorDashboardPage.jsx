import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Truck,
  Phone,
  Timer,
  PackageCheck,
  Users,
  AlertTriangle,
  ArrowRight,
  Flame,
  Beef,
  BadgeCheck,
  ClipboardCheck,
  ScanLine,
  Siren,
  RefreshCw,
  History,
  ShieldCheck,
  Thermometer,
  CheckCircle2,
  Wheat,
  Activity,
  Plus,
  ArrowUpRight,
  Play,
  Pause,
  Square,
  Sparkles,
  Info,
  Calendar,
  ExternalLink,
} from 'lucide-react'
import { ValidatorLayout } from '../../components/layout/ValidatorLayout'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ToastNotice } from '../../components/ui/ToastNotice'
import { navigate } from '../../App'
import { useAuth } from '../../context/AuthContext'
import { getSelectedSchool } from '../../lib/validatorSchool'
import { fetchValidatorDashboardBundle } from '../../lib/api'
import {
  VALIDATOR_SCHOOL,
  FLEET_STATUS,
  HACCP_TIMER,
  QUOTA_BOARD,
} from '../../data/validatorData'
import {
  MENU_PACKAGES,
  INITIAL_CALENDAR_DAYS,
  NATIONAL_AKG_STANDARDS,
} from '../../data/calendarData'

const TODAY_PACKAGE_ID = 'PKG-B'

function formatClock(totalSeconds) {
  const s = Math.max(0, totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function haccpLevel(secondsLeft) {
  const minutes = secondsLeft / 60
  if (secondsLeft <= 0) return { ring: 'rose', label: 'Kedaluwarsa — scan terkunci', tone: 'text-rose-400', badge: 'bg-rose-500/20 text-rose-300' }
  if (minutes <= 30) return { ring: 'rose', label: 'Kritis — segera habiskan', tone: 'text-rose-400', badge: 'bg-rose-500/20 text-rose-300' }
  if (minutes <= 90) return { ring: 'amber', label: 'Waspada — instruksikan ke kelas', tone: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300' }
  return { ring: 'emerald', label: 'Aman — dalam batas waktu', tone: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' }
}

export function ValidatorDashboardPage() {
  const { user } = useAuth()
  const firstName = (user?.fullName || '').split(' ')[0]

  // Live state from backend API
  const [bundle, setBundle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedNPSN, setSelectedNPSN] = useState(() => getSelectedSchool(user).npsn)
  const [loadError, setLoadError] = useState(null)
  const [isTimerPaused, setIsTimerPaused] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)
  const [isContactOpen, setIsContactOpen] = useState(false)

  const EMERGENCY_CONTACTS = [
    { label: 'Kontak Darurat Dapur SPPG', value: '0812-3456-7890', note: 'Kurir dan petugas dapur' },
    { label: 'Satgas MBG Pusat', value: '0811-9988-7766', note: 'Koordinator Jawa Timur' },
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

  // Countdown timer for HACCP
  const [secondsLeft, setSecondsLeft] = useState(HACCP_TIMER.secondsLeftSeed)

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
        if (data.haccp && Number.isFinite(data.haccp.secondsLeft) && data.haccp.secondsLeft > 0) {
          setSecondsLeft(data.haccp.secondsLeft)
        }
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
  }, [loadDashboard])

  // Timer interval countdown 1s
  useEffect(() => {
    if (isTimerPaused) return
    const t = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [isTimerPaused])

  // Resolved models
  const school = useMemo(() => {
    return bundle?.school || {
      name: VALIDATOR_SCHOOL.school,
      npsn: VALIDATOR_SCHOOL.npsn,
      address: 'Jl. Pegangsaan Barat No. 12, Menteng, Jakarta Pusat',
      totalStudents: 668,
    }
  }, [bundle])

  const gateWindow = bundle?.gateWindow || VALIDATOR_SCHOOL.gateWindow

  const fleet = useMemo(() => {
    return bundle?.fleet || FLEET_STATUS
  }, [bundle])

  const haccpInfo = useMemo(() => {
    return bundle?.haccp || {
      cookedAt: HACCP_TIMER.cookedAt,
      safeUntil: HACCP_TIMER.safeUntil,
      windowMinutes: HACCP_TIMER.windowMinutes,
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
      leftoverPortions: 9,
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
  const defaultDay = INITIAL_CALENDAR_DAYS.find((d) => d.packageId === TODAY_PACKAGE_ID)

  const menu = useMemo(() => {
    if (bundle?.menu && bundle.menu.name) {
      return {
        ...bundle.menu,
        calories: bundle.menu.calories || defaultPkg?.calories || 545,
        protein: bundle.menu.protein || defaultPkg?.protein || 34,
        fat: bundle.menu.fat || defaultPkg?.fat || 14,
        carbohydrate: bundle.menu.carbohydrate || defaultPkg?.carbs || 68,
        halalCert: bundle.menu.halalCert || defaultPkg?.halalCert || 'ID31110001892310123',
        allergens: bundle.menu.allergens?.length ? bundle.menu.allergens : (defaultPkg?.allergens || ['Laktosa susu sapi', 'Kedelai']),
      }
    }
    return defaultPkg || {
      name: 'Nasi Pulen, Ayam Panggang Madu & Capcay',
      calories: 545,
      protein: 34,
    }
  }, [bundle, defaultPkg])

  const level = haccpLevel(secondsLeft)
  const validatedPct = Math.min(100, Math.round((quota.validatedPortions / (quota.targetPortions || 1)) * 100))

  return (
    <ValidatorLayout
      activeMenu="dashboard"
      title="Dashboard Validator"
      subtitle="Pemantauan distribusi pangan, hitung mundur HACCP 4 jam & kepatuhan mutu sekolah."
      primaryAction={
        <button
          type="button"
          onClick={() => navigate('/validator/foodscan')}
          className="flex items-center gap-2 rounded-full bg-[#185338] text-white px-5 py-2.5 text-xs font-bold hover:bg-[#12422c] transition shadow-xs cursor-pointer"
        >
          <ScanLine className="h-4 w-4" />
          <span>+ Mulai Scan Hidangan</span>
        </button>
      }
      secondaryAction={
        <button
          type="button"
          onClick={() => navigate('/validator/handover')}
          className="flex items-center gap-2 rounded-full bg-white border border-slate-300 text-slate-800 px-5 py-2.5 text-xs font-bold hover:bg-slate-50 transition shadow-xs cursor-pointer"
        >
          <ClipboardCheck className="h-4 w-4 text-[#185338]" />
          <span>Buka Serah Terima BAST</span>
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

      {/* Warning/Connection Banner if needed */}
      {loadError && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 flex items-center justify-between mb-4">
          <p className="font-medium">Sinkronisasi lokal aktif: {loadError}. Data tersimpan tetap akurat.</p>
          <button onClick={() => loadDashboard()} className="underline font-bold hover:text-amber-950 cursor-pointer">
            Muat ulang
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ROW 1: 4 KPI STAT CARDS (Donezo Signature Cards, Validator Domain) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
        {/* Card 1: Total Kuota Siswa (Featured Donezo Dark Green Card) */}
        <div className="rounded-[22px] bg-[#185338] text-white p-5.5 flex flex-col justify-between shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-100/90">Target Kuota Siswa</span>
            <button
              onClick={() => navigate('/validator/history')}
              className="h-8 w-8 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
              title="Lihat Rekonsiliasi Presensi"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          <div className="my-3">
            <h3 className="text-4xl sm:text-5xl font-black tracking-tight font-sans">
              {quota.targetPortions || 668}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-emerald-100/90 font-medium">
            <span className="inline-flex items-center justify-center h-4 px-1.5 rounded-sm border border-emerald-400/40 text-[9px] font-bold text-emerald-300">
              Nutrisi
            </span>
            <span>Porsi Siswa Terdaftar Hari Ini</span>
          </div>
        </div>

        {/* Card 2: Porsi Lolos Uji */}
        <div className="rounded-[22px] bg-white border border-slate-200/80 p-5.5 flex flex-col justify-between shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Porsi Lolos Uji</span>
            <button
              onClick={() => navigate('/validator/handover')}
              className="h-8 w-8 rounded-full border border-slate-200 hover:border-slate-300 bg-white flex items-center justify-center text-slate-700 transition cursor-pointer"
              title="Lihat BAST Serah Terima"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          <div className="my-3">
            <h3 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 font-sans">
              {quota.validatedPortions || 638}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
            <span className="inline-flex items-center justify-center h-4 px-1.5 rounded-sm border border-emerald-200 bg-emerald-50 text-[9px] font-bold text-emerald-800">
              98.6%
            </span>
            <span>Lolos Uji Suhu & Organoleptik</span>
          </div>
        </div>

        {/* Card 3: Master Tote Termal */}
        <div className="rounded-[22px] bg-white border border-slate-200/80 p-5.5 flex flex-col justify-between shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Master Tote Termal</span>
            <button
              onClick={() => navigate('/validator/foodscan')}
              className="h-8 w-8 rounded-full border border-slate-200 hover:border-slate-300 bg-white flex items-center justify-center text-slate-700 transition cursor-pointer"
              title="Buka Pindai Nampan"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          <div className="my-3">
            <h3 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 font-sans">
              {quota.masterTotesReceived || 13}
              <span className="text-xl font-normal text-slate-400"> / {quota.masterTotesTotal || 13}</span>
            </h3>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <span className="inline-flex items-center justify-center h-4 px-1.5 rounded-sm border border-slate-300 text-[9px] font-bold text-slate-700">
              64.2°C
            </span>
            <span>Suhu Rata-rata Kontainer</span>
          </div>
        </div>

        {/* Card 4: Porsi Karantina / Rusak */}
        <div className="rounded-[22px] bg-white border border-slate-200/80 p-5.5 flex flex-col justify-between shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Porsi Karantina / Rusak</span>
            <button
              onClick={() => navigate('/validator/incidents')}
              className="h-8 w-8 rounded-full border border-slate-200 hover:border-slate-300 bg-white flex items-center justify-center text-slate-700 transition cursor-pointer"
              title="Tiket Insiden Mutu"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          <div className="my-3">
            <h3 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 font-sans">
              {quota.rejectedPortions || 0}
            </h3>
          </div>

          <div className="flex items-center text-[11px] text-emerald-700 font-semibold">
            <span>Nihil Cacat Mutu Pangan</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROW 2: 3 COLUMNS (Analitik Kelolosan + Jadwal Armada + Komponen Menu) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 mb-6">
        {/* Col 1: Analitik Kelolosan Mutu (Capsule Bar Chart) */}
        <div className="lg:col-span-4 rounded-[22px] bg-white border border-slate-200/80 p-5.5 flex flex-col justify-between shadow-xs">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Analitik Kelolosan Mutu</h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Tingkat kelolosan uji organoleptik per hari</p>
          </div>

          {/* S M T W T F S Capsule Bars Container */}
          <div className="my-5 flex items-end justify-between px-2 pt-8 pb-1">
            {/* Minggu */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-8 h-18 rounded-full border border-slate-200"
                style={{
                  background: 'repeating-linear-gradient(45deg, #cbd5e1, #cbd5e1 2px, transparent 2px, transparent 6px)',
                }}
              />
              <span className="text-[11px] font-semibold text-slate-400">M</span>
            </div>

            {/* Senin */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-24 rounded-full bg-[#185338]" />
              <span className="text-[11px] font-semibold text-slate-400">S</span>
            </div>

            {/* Selasa (With floating tooltip chip) */}
            <div className="flex flex-col items-center gap-2 relative">
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#185338] text-white px-2 py-0.5 rounded-full shadow-xs text-[10px] font-black whitespace-nowrap">
                98%
              </div>
              <div className="w-8 h-20 rounded-full bg-[#48bb78]" />
              <span className="text-[11px] font-semibold text-slate-400">S</span>
            </div>

            {/* Rabu (Today, Tall Deep Green) */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-28 rounded-full bg-[#0d3b25]" />
              <span className="text-[11px] font-extrabold text-slate-900">R</span>
            </div>

            {/* Kamis */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-8 h-22 rounded-full border border-slate-200"
                style={{
                  background: 'repeating-linear-gradient(45deg, #cbd5e1, #cbd5e1 2px, transparent 2px, transparent 6px)',
                }}
              />
              <span className="text-[11px] font-semibold text-slate-400">K</span>
            </div>

            {/* Jumat */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-8 h-20 rounded-full border border-slate-200"
                style={{
                  background: 'repeating-linear-gradient(45deg, #cbd5e1, #cbd5e1 2px, transparent 2px, transparent 6px)',
                }}
              />
              <span className="text-[11px] font-semibold text-slate-400">J</span>
            </div>

            {/* Sabtu */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-8 h-16 rounded-full border border-slate-200"
                style={{
                  background: 'repeating-linear-gradient(45deg, #cbd5e1, #cbd5e1 2px, transparent 2px, transparent 6px)',
                }}
              />
              <span className="text-[11px] font-semibold text-slate-400">S</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Rata-rata Pekan Ini</span>
            <span className="font-extrabold text-emerald-800">97.8% Sesuai Standar Mutu</span>
          </div>
        </div>

        {/* Col 2: Jadwal Kedatangan Armada */}
        <div className="lg:col-span-4 rounded-[22px] bg-white border border-slate-200/80 p-5.5 flex flex-col justify-between shadow-xs">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Jadwal Kedatangan Armada</h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Logistik pengiriman dari Dapur Sentral SPPG</p>
          </div>

          <div className="my-4 space-y-1.5">
            <h4 className="text-lg font-black text-slate-900 leading-snug">
              Armada Logistik {fleet.unit || 'B-9281-KBA'}
            </h4>
            <p className="text-xs text-emerald-800 font-bold">
              Jendela Kedatangan: {gateWindow || '06.45 - 07.15 WIB'}
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed pt-0.5">
              Driver: <strong className="text-slate-800">{fleet.driver || 'Bpk. Mulyono'}</strong> · Rute: Dapur Sentral SPPG Menteng → Gerbang SDN 01 Menteng Pagi
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => navigate('/validator/handover')}
              className="w-full py-3 px-5 rounded-full bg-[#185338] hover:bg-[#12422c] text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <ClipboardCheck className="h-4 w-4" />
              <span>Buka Serah Terima BAST</span>
            </button>
          </div>
        </div>

        {/* Col 3: Komponen Menu Hari Ini */}
        <div className="lg:col-span-4 rounded-[22px] bg-white border border-slate-200/80 p-5.5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900">Menu Hidangan Hari Ini</h3>
            <button
              onClick={() => navigate('/validator/foodscan')}
              className="px-3 py-1 rounded-full border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              + Scan AI
            </button>
          </div>

          <div className="divide-y divide-slate-100 my-2">
            {/* Item 1 */}
            <div className="py-2 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold shrink-0">
                <div className="flex gap-0.5 -rotate-45">
                  <div className="w-1 h-3 bg-blue-600 rounded-full" />
                  <div className="w-1 h-3 bg-blue-600 rounded-full" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-slate-800 truncate">Nasi Putih Pulen Organik</p>
                <p className="text-[10px] text-slate-400">Karbohidrat Pokok · Takaran 150g</p>
              </div>
            </div>

            {/* Item 2 */}
            <div className="py-2 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 font-bold shrink-0">
                <div className="h-3.5 w-3.5 rounded-full border-2 border-teal-600 border-t-transparent -rotate-45" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-slate-800 truncate">Ayam Panggang Saus Madu</p>
                <p className="text-[10px] text-slate-400">Lauk Utama Protein · Suhu 65.2°C</p>
              </div>
            </div>

            {/* Item 3 */}
            <div className="py-2 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold shrink-0">
                <div className="grid grid-cols-2 gap-0.5">
                  <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-slate-800 truncate">Capcay Sayur Segar</p>
                <p className="text-[10px] text-slate-400">Sayur Serat · Wortel, Brokoli & Jagung</p>
              </div>
            </div>

            {/* Item 4 */}
            <div className="py-2 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 font-bold shrink-0">
                <div className="h-3.5 w-3.5 rounded-full bg-amber-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-slate-800 truncate">Pisang Barangan Segar</p>
                <p className="text-[10px] text-slate-400">Buah Pencuci Mulut · Matang Alami</p>
              </div>
            </div>

            {/* Item 5 */}
            <div className="py-2 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 font-bold shrink-0">
                <div className="flex gap-0.5">
                  <div className="w-1.5 h-1.5 bg-purple-600 rounded-full" />
                  <div className="w-1.5 h-1.5 bg-purple-600 rounded-full" />
                  <div className="w-1.5 h-1.5 bg-purple-600 rounded-full" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-slate-800 truncate">Susu UHT Plain 125ml</p>
                <p className="text-[10px] text-slate-400">Susu Tambahan Kalsium · Segel Utuh</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ROW 3: 3 COLUMNS (Tim Pelaksana Sekolah + Kepatuhan SOP + Time Tracker) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Col 1: Tim Pelaksana Sekolah & SPPG */}
        <div className="lg:col-span-4 rounded-[22px] bg-white border border-slate-200/80 p-5.5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900">Tim Pelaksana Sekolah</h3>
            <button
              onClick={() => setIsContactOpen(true)}
              className="px-3 py-1 rounded-full border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              + Kontak Tim
            </button>
          </div>

          <div className="divide-y divide-slate-100 my-2">
            {/* Member 1: Guru Validator */}
            <div className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-extrabold text-emerald-800 shrink-0">
                  SA
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-slate-900 truncate">Ibu Siti Aminah, S.Pd.</p>
                  <p className="text-[10px] text-slate-400 truncate">Guru Piket · Pemeriksaan Fisik Nampan</p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Selesai
              </span>
            </div>

            {/* Member 2: Kurir SPPG */}
            <div className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center text-xs font-extrabold text-amber-800 shrink-0">
                  MY
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-slate-900 truncate">Bpk. Mulyono Santoso</p>
                  <p className="text-[10px] text-slate-400 truncate">Kurir SPPG · Serah Terima 13 Tote</p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                Proses
              </span>
            </div>

            {/* Member 3: Petugas Medis */}
            <div className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-sky-100 flex items-center justify-center text-xs font-extrabold text-sky-800 shrink-0">
                  RW
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-slate-900 truncate">dr. Ratna Wulandari</p>
                  <p className="text-[10px] text-slate-400 truncate">Puskesmas Menteng · Pengawasan Alergen</p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                Siaga
              </span>
            </div>

            {/* Member 4: Kepala Sekolah */}
            <div className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center text-xs font-extrabold text-purple-800 shrink-0">
                  BS
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-slate-900 truncate">Drs. Bambang Sutrisno</p>
                  <p className="text-[10px] text-slate-400 truncate">Kepala Sekolah · Otorisator BAST</p>
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                Proses
              </span>
            </div>
          </div>
        </div>

        {/* Col 2: Kepatuhan SOP Distribusi (Semi-Circular Arc Gauge) */}
        <div className="lg:col-span-4 rounded-[22px] bg-white border border-slate-200/80 p-5.5 flex flex-col justify-between shadow-xs">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Kepatuhan SOP Distribusi</h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Tingkat pemenuhan higienitas & kuota sekolah</p>
          </div>

          {/* Semi-circular gauge SVG */}
          <div className="relative flex flex-col items-center justify-center my-3">
            <svg viewBox="0 0 200 120" className="w-56 h-36">
              {/* Background Arc: Cadangan Guru (Hatched Stripe pattern) */}
              <path
                d="M 20 105 A 80 80 0 0 1 180 105"
                fill="none"
                stroke="url(#donezo-diagonal-stripe)"
                strokeWidth="24"
                strokeLinecap="round"
              />
              {/* In Progress Arc Segment: Distribusi Kelas (Dark Teal) */}
              <path
                d="M 20 105 A 80 80 0 0 1 155 42"
                fill="none"
                stroke="#156b50"
                strokeWidth="24"
                strokeLinecap="round"
              />
              {/* Completed Arc Segment: Lolos Uji Suhu (Dark Forest Green) */}
              <path
                d="M 20 105 A 80 80 0 0 1 110 26"
                fill="none"
                stroke="#185338"
                strokeWidth="24"
                strokeLinecap="round"
              />
            </svg>

            {/* Centered Value */}
            <div className="absolute bottom-2 flex flex-col items-center justify-center">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-sans">
                {validatedPct}%
              </span>
              <span className="text-[11px] font-semibold text-slate-400 mt-0.5">
                SOP Terpenuhi
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-600 font-semibold pt-1">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#185338]" />
              <span>Lolos Uji (638)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#156b50]" />
              <span>Distribusi (22)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full border border-slate-300"
                style={{
                  background: 'repeating-linear-gradient(45deg, #94a3b8, #94a3b8 1px, transparent 1px, transparent 3px)',
                }}
              />
              <span>Cadangan (8)</span>
            </div>
          </div>
        </div>

        {/* Col 3: Hitung Mundur HACCP 4 Jam (Dark Forest Green / Obsidian Contour Card) */}
        <div className="lg:col-span-4 rounded-[22px] bg-[#0c2e20] text-white p-5.5 relative overflow-hidden shadow-lg flex flex-col justify-between min-h-[220px]">
          {/* Wavy Topographic Contour Background */}
          <svg
            className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
            viewBox="0 0 300 200"
            preserveAspectRatio="none"
          >
            <path d="M-30,40 Q60,130 150,50 T330,90" fill="none" stroke="#2dd4bf" strokeWidth="2" />
            <path d="M-30,70 Q60,160 150,80 T330,120" fill="none" stroke="#34d399" strokeWidth="2.5" />
            <path d="M-30,100 Q60,190 150,110 T330,150" fill="none" stroke="#10b981" strokeWidth="2" />
            <path d="M-30,130 Q60,220 150,140 T330,180" fill="none" stroke="#059669" strokeWidth="1.5" />
            <path d="M-30,160 Q60,250 150,170 T330,210" fill="none" stroke="#047857" strokeWidth="1" />
          </svg>

          <div className="relative z-10 flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-200/90 tracking-wide">Hitung Mundur HACCP 4 Jam</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${level.badge}`}>
              {level.label}
            </span>
          </div>

          {/* Clock Display */}
          <div className="relative z-10 my-3 text-center">
            <p className="font-mono text-4xl sm:text-5xl font-black tracking-widest text-white drop-shadow-xs">
              {formatClock(secondsLeft)}
            </p>
            <p className="text-[10px] text-emerald-200/80 font-mono mt-1">
              Masak: {haccpInfo.cookedAt} · Batas Konsumsi: {haccpInfo.safeUntil}
            </p>
          </div>

          {/* Control Buttons */}
          <div className="relative z-10 flex items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setIsTimerPaused((p) => !p)}
              className="h-10 w-10 rounded-full bg-white hover:bg-slate-100 text-slate-900 flex items-center justify-center transition shadow-md cursor-pointer"
              title={isTimerPaused ? 'Lanjutkan Timer' : 'Jeda Timer'}
            >
              {isTimerPaused ? <Play className="h-4 w-4 fill-current ml-0.5" /> : <Pause className="h-4 w-4 fill-current" />}
            </button>
            <button
              type="button"
              onClick={() => navigate('/validator/incidents')}
              className="h-10 w-10 rounded-full bg-[#e53e3e] hover:bg-[#c53030] text-white flex items-center justify-center transition shadow-md cursor-pointer"
              title="Lapor Insiden Darurat"
            >
              <Siren className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isContactOpen}
        tone="info"
        eyebrow="Jalur Eskalasi Darurat"
        title="Kontak tim pelaksana"
        description="Gunakan nomor berikut bila terjadi kondisi darurat pada nampan atau distribusi MBG."
        details={EMERGENCY_CONTACTS.map((c) => `${c.label} · ${c.note}: ${c.value}`)}
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
