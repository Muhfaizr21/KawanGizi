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
} from 'lucide-react'
import { ValidatorLayout } from '../../components/layout/ValidatorLayout'
import { navigate } from '../../App'
import { useAuth } from '../../context/AuthContext'
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

/**
 * ==============================================================================
 * PORTAL VALIDATOR: BERANDA & KUOTA SEKOLAH
 * URL: /validator — default portal, guard roles ['validator','superadmin'].
 * VALIDATOR.md Bab 1: pelacak armada, HACCP 4-hour countdown, papan kuota,
 * kartu menu hari ini + alergen, quick action tiles, live sinkronisasi backend.
 * ==============================================================================
 */

const QUICK_ACTIONS = [
  { label: 'Mulai Scan Hidangan', desc: 'Pengenalan menu + kesegaran masakan AI', icon: ScanLine, href: '/validator/foodscan', tone: 'amber' },
  { label: 'Serah Terima BAST', desc: '13 master tote, suhu holding & tanda tangan', icon: ClipboardCheck, href: '/validator/handover', tone: 'emerald' },
  { label: 'Laporkan Makanan Rusak', desc: 'Tombol siaga cepat ke Satgas MBG', icon: Siren, href: '/validator/incidents', tone: 'rose' },
  { label: 'Riwayat & Rekonsiliasi', desc: 'Presensi makan & alokasi porsi sisa', icon: History, href: '/validator/history', tone: 'indigo' },
]

const TONE_CLASS = {
  amber: 'bg-amber-50 text-amber-600 border-amber-100 group-hover:bg-amber-600 group-hover:text-white',
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white',
  rose: 'bg-rose-50 text-rose-600 border-rose-100 group-hover:bg-rose-600 group-hover:text-white',
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white',
}

const TODAY_LABEL = new Date().toLocaleDateString('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formatClock(totalSeconds) {
  const s = Math.max(0, totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function haccpLevel(secondsLeft) {
  const minutes = secondsLeft / 60
  if (secondsLeft <= 0) return { ring: 'rose', label: 'Kedaluwarsa — scan terkunci', tone: 'text-rose-600', track: 'bg-rose-100', stroke: '#e11d48' }
  if (minutes <= 30) return { ring: 'rose', label: 'Kritis — segera habiskan', tone: 'text-rose-600', track: 'bg-rose-100', stroke: '#e11d48' }
  if (minutes <= 90) return { ring: 'amber', label: 'Waspada — instruksikan ke kelas', tone: 'text-amber-600', track: 'bg-amber-100', stroke: '#d97706' }
  return { ring: 'emerald', label: 'Aman — dalam batas waktu', tone: 'text-emerald-600', track: 'bg-emerald-100', stroke: '#059669' }
}

export function ValidatorDashboardPage() {
  const { user } = useAuth()
  const firstName = (user?.fullName || '').split(' ')[0]

  // State Data Live dari Backend
  const [bundle, setBundle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedNPSN, setSelectedNPSN] = useState('')
  const [loadError, setLoadError] = useState(null)

  // Hitung mundur waktu HACCP
  const [secondsLeft, setSecondsLeft] = useState(HACCP_TIMER.secondsLeftSeed)

  // Load Dashboard Data dari Backend
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

  // Timer interval countdown 1 detik
  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [])

  // Resolusi data sekolah, armada, haccp, kuota, menu, scan summary
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
      totalScans: 0,
      rejectedScans: 0,
      warningScans: 0,
      verifiedScans: 0,
      averageConfidence: 96,
      averageHoldingTemp: 63.8,
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
    return defaultPkg
  }, [bundle, defaultPkg])

  const level = haccpLevel(secondsLeft)
  const totalMinutes = haccpInfo.windowMinutes || 240
  const remainMinutes = Math.ceil(secondsLeft / 60)
  const progress = Math.max(0, Math.min(1, secondsLeft / (totalMinutes * 60)))
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  const validatedPct = Math.round((quota.validatedPortions / (quota.targetPortions || 1)) * 100)
  const totePct = Math.round((quota.masterTotesReceived / (quota.masterTotesTotal || 1)) * 100)

  return (
    <ValidatorLayout activeMenu="dashboard" title="Beranda & Kuota Sekolah" badge="PORTAL VALIDATOR">
      {/* Sapaan & Switcher Sekolah */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-amber-700 font-bold">{TODAY_LABEL}</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Selamat pagi, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {school.name} · <span className="font-mono font-semibold">NPSN {school.npsn}</span> · Gerbang siap pukul{' '}
            <strong className="text-slate-700">{gateWindow}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Superadmin preview school switcher */}
          {user?.role === 'superadmin' && bundle?.availableSchools?.length > 0 && (
            <select
              aria-label="Pilih sekolah untuk inspeksi validator"
              value={selectedNPSN}
              onChange={(e) => setSelectedNPSN(e.target.value)}
              className="bg-white border border-slate-300 text-xs rounded-xl px-3 py-2 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-xs"
            >
              <option value="">Default: SDN 01 Menteng</option>
              {bundle.availableSchools.map((s) => (
                <option key={s.npsn} value={s.npsn}>
                  {s.name} ({s.npsn})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 px-3.5 py-2 text-xs font-bold text-slate-700 transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Segarkan data telemetri dan presensi dari database"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-amber-600 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Menyinkronkan...' : 'Segarkan Data'}</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-center justify-between">
          <p className="font-medium">Perhatian koneksi: {loadError}. Menampilkan data aman tersimpan.</p>
          <button onClick={() => loadDashboard()} className="underline font-bold hover:text-amber-950 cursor-pointer">Coba lagi</button>
        </div>
      )}

      {/* Baris atas: Status Armada Logistik + HACCP 4 Jam */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Status Armada Logistik */}
        <section className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-cyan-50 text-cyan-600 border border-cyan-100">
                  <Truck className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-extrabold tracking-tight text-slate-900">Status Armada Logistik Dapur SPPG</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200/60 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                {fleet.statusLabel || 'Menuju Sekolah'}
              </span>
            </div>

            <div className="mt-4 flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                <Truck className="h-7 w-7 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base sm:text-lg font-extrabold font-mono tracking-tight text-slate-900">{fleet.unit || 'Armada Logistik BGN'}</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Driver: <strong className="text-slate-800">{fleet.driver}</strong> · Berangkat <span className="font-mono font-semibold">{fleet.departedAt}</span>
                </p>
                {fleet.statusReason && (
                  <p className="mt-1 text-[11px] text-slate-500 italic">
                    Catatan rute: {fleet.statusReason}
                  </p>
                )}
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{fleet.route}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-1.5">
                    <p className="text-[9px] uppercase tracking-wide text-slate-400 font-bold">Estimasi Tiba (ETA)</p>
                    <p className="font-mono font-extrabold text-sm text-amber-700">{fleet.eta}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3 py-1.5">
                    <p className="text-[9px] uppercase tracking-wide text-slate-400 font-bold">Muatan Boks</p>
                    <p className="font-mono font-extrabold text-sm text-slate-800">
                      {fleet.masterTotes} tote · {fleet.portions} porsi
                    </p>
                  </div>
                  <a
                    href={`tel:${String(fleet.driverPhone || '').replace(/[^+\d]/g, '')}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 text-white px-3.5 py-2 text-xs font-bold hover:bg-amber-700 transition shadow-xs cursor-pointer ml-auto"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>{fleet.driverPhone}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" />
              Telemetri rute tersinkronisasi database SPPG
            </span>
            <button
              onClick={() => navigate('/validator/handover')}
              className="font-bold text-amber-700 hover:text-amber-800 transition flex items-center gap-1 cursor-pointer"
            >
              Buka Form BAST <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </section>

        {/* HACCP 4-Hour Countdown */}
        <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                  <Timer className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-extrabold tracking-tight text-slate-900">Hitung Mundur HACCP 4 Jam</h2>
              </div>
              <Timer className={`h-4 w-4 ${level.tone}`} />
            </div>

            <div className="mt-3 flex items-center gap-4">
              <div className="relative h-28 w-28 sm:h-32 sm:w-32 shrink-0">
                <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    fill="none"
                    strokeWidth="11"
                    className={level.track}
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r={radius}
                    fill="none"
                    strokeWidth="11"
                    stroke={level.stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className={`font-mono font-extrabold text-lg leading-none ${level.tone}`}>
                    {formatClock(secondsLeft)}
                  </p>
                  <p className="text-[9px] text-slate-400 mt-1 font-semibold">sisa waktu</p>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <p className={`text-xs font-bold ${level.tone}`}>{level.label}</p>
                <dl className="mt-2 space-y-1 text-[11px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Selesai Masak</dt>
                    <dd className="font-mono font-bold text-slate-700">{haccpInfo.cookedAt}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Batas Konsumsi</dt>
                    <dd className="font-mono font-bold text-slate-700">{haccpInfo.safeUntil}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-400">Sisa Menit</dt>
                    <dd className="font-mono font-bold text-slate-900">{remainMinutes} menit</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div className="mt-3">
            {secondsLeft <= 0 ? (
              <p className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2 leading-relaxed">
                Waktu HACCP habis. Sistem melarang pembagian & mengunci tombol scan untuk pencegahan risiko basi.
              </p>
            ) : (
              <p className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg p-2 leading-relaxed">
                Berdasarkan standar BGN, hidangan hangat wajib dikonsumsi maksimal 4 jam pasca pelepasan dapur sentral.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Papan Kuota Porsi Sekolah */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <PackageCheck className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-extrabold tracking-tight text-slate-900">Papan Rekonsiliasi Kuota Porsi Sekolah</h2>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded-full">
            Target {quota.targetPortions} porsi hari ini
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-4">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Users className="h-3.5 w-3.5 text-slate-600" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Target Kuota Siswa</span>
            </div>
            <p className="mt-1 font-mono font-extrabold text-2xl text-slate-900">{quota.targetPortions}</p>
            <div className="mt-2 space-y-1">
              {quota.studentBreakdown?.map((b) => (
                <p key={b.label} className="font-mono text-[10px] text-slate-500">
                  {b.label}: <strong className="text-slate-700">{b.value}</strong>
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-4">
            <div className="flex items-center gap-1.5 text-emerald-700">
              <PackageCheck className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Berhasil Diserahkan</span>
            </div>
            <p className="mt-1 font-mono font-extrabold text-2xl text-emerald-700">
              {quota.validatedPortions}
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-emerald-200 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, validatedPct)}%` }} />
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-emerald-700 font-semibold">{validatedPct}% dari target sekolah</p>
          </div>

          <div className="rounded-xl bg-rose-50/70 border border-rose-200/80 p-4">
            <div className="flex items-center gap-1.5 text-rose-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Porsi Ditolak / Cacat</span>
            </div>
            <p className="mt-1 font-mono font-extrabold text-2xl text-rose-600">
              {quota.rejectedPortions}
            </p>
            <p className="mt-2 font-mono text-[10px] text-rose-600 font-medium">
              {quota.rejectedPortions > 0 ? 'Boks diamankan & dilaporkan' : 'Nihil cacat mutu pangan'}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-4">
            <div className="flex items-center gap-1.5 text-slate-500">
              <ClipboardCheck className="h-3.5 w-3.5 text-slate-600" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Master Container Totes</span>
            </div>
            <p className="mt-1 font-mono font-extrabold text-2xl text-slate-900">
              {quota.masterTotesReceived} / {quota.masterTotesTotal}
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, totePct)}%` }} />
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-slate-500">
              @{quota.toteCapacity || 50} porsi/kontainer termal
            </p>
          </div>
        </div>
      </section>

      {/* Baris Bawah: Menu Hari Ini & Nilai Gizi + Quick Action Tiles */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Menu Hari Ini */}
        <section className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                <Wheat className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-extrabold tracking-tight text-slate-900">Kartu Menu Resmi Hari Ini</h2>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500 font-semibold bg-slate-100 px-2.5 py-0.5 rounded-full">
              {menu.dayTitle || defaultDay?.title || 'Kamis Pekan Ke-2'}
            </span>
          </div>

          <p className="mt-3 text-base sm:text-lg font-bold leading-snug text-slate-900">{menu.name}</p>

          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {[
              ['Nasi', menu.staple || 'Nasi Putih Pulen Organik'],
              ['Lauk utama', menu.proteinMain || 'Ayam Panggang Saus Madu'],
              ['Sayur', menu.sideVeggie || 'Capcay Sayur Segar'],
              ['Buah', menu.fruit || 'Pisang Barangan Segar'],
              ['Minuman', menu.dairyDrink || 'Susu UHT Plain 125ml'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2 min-w-0">
                <dt className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-slate-400 pt-0.5">
                  {k}:
                </dt>
                <dd className="text-slate-700 truncate font-medium" title={v}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { icon: Flame, label: 'Kalori', value: menu.calories, unit: 'kkal', key: 'calories' },
              { icon: Beef, label: 'Protein', value: menu.protein, unit: 'g', key: 'protein' },
            ].map((r) => {
              const std = NATIONAL_AKG_STANDARDS[r.key] || { target: 500 }
              const pct = Math.min(100, Math.round((r.value / std.target) * 100))
              return (
                <div key={r.key} className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <r.icon size={13} className="text-amber-600" />
                    <span className="text-[10px] font-bold uppercase tracking-wide">{r.label}</span>
                  </div>
                  <p className="mt-1 font-mono font-extrabold text-base leading-none text-slate-900">
                    {r.value}
                    <span className="text-xs font-semibold text-slate-400"> {r.unit}</span>
                  </p>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 font-mono text-[9px] text-slate-400">
                    {pct}% target AKG ({std.target})
                  </p>
                </div>
              )
            })}

            <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
              <div className="flex items-center gap-1.5 text-slate-500">
                <BadgeCheck size={13} className="text-emerald-600" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Sertifikasi</span>
              </div>
              <p className="mt-1 text-xs font-bold text-emerald-700">Halal & SLHS</p>
              <p className="mt-1 font-mono text-[9px] text-slate-400 truncate" title={menu.halalCert}>
                {menu.halalCert || 'Tervalidasi BGN'}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Activity size={13} className="text-indigo-600" />
                <span className="text-[10px] font-bold uppercase tracking-wide">Skor AI Model</span>
              </div>
              <p className="mt-1 font-mono font-extrabold text-base leading-none text-amber-700">
                {scanSummary.averageConfidence || 96}%
              </p>
              <p className="mt-1 font-mono text-[9px] text-slate-400">
                {scanSummary.totalScans} boks dipindai
              </p>
            </div>
          </div>

          {menu.allergens?.length > 0 && (
            <p className="mt-3.5 text-xs text-amber-900 bg-amber-50/80 border border-amber-200 rounded-xl px-3 py-2 leading-relaxed">
              <strong>Peringatan Alergen bagi Guru & Wali Kelas:</strong> {menu.allergens.join(', ')}
            </p>
          )}
        </section>

        {/* Quick Action Tiles & Ringkasan Scan */}
        <section className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-extrabold tracking-tight text-slate-900">Aksi Cepat Validator</h2>
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => navigate(a.href)}
              className="w-full text-left bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3.5 flex items-center gap-3.5 hover:shadow-md hover:border-amber-200 transition cursor-pointer group"
            >
              <span
                className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 transition ${TONE_CLASS[a.tone]}`}
              >
                <a.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs sm:text-sm font-extrabold text-slate-900">{a.label}</span>
                <span className="block text-[11px] text-slate-500 mt-0.5">{a.desc}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-amber-600 transition shrink-0" />
            </button>
          ))}

          {/* Kartu Ringkasan Hasil Scan Live dari Database */}
          <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/80 to-amber-100/40 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-800 flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-amber-600" />
                Telemetri Pemeriksaan Boks Hari Ini
              </p>
              <span className="font-mono text-[10px] font-bold text-amber-700">Live API</span>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2 text-center">
              <div className="bg-white/80 rounded-xl py-2 px-1 border border-amber-200/60 shadow-2xs">
                <p className="font-mono font-extrabold text-base text-amber-800">
                  {scanSummary.totalScans}
                </p>
                <p className="text-[9px] font-semibold text-amber-700">Total Scan</p>
              </div>

              <div className="bg-white/80 rounded-xl py-2 px-1 border border-rose-200/60 shadow-2xs">
                <p className="font-mono font-extrabold text-base text-rose-600">
                  {scanSummary.rejectedScans}
                </p>
                <p className="text-[9px] font-semibold text-rose-600">Status Tolak</p>
              </div>

              <div className="bg-white/80 rounded-xl py-2 px-1 border border-amber-200/60 shadow-2xs">
                <p className="font-mono font-extrabold text-base text-amber-800">
                  {scanSummary.averageHoldingTemp != null ? `${scanSummary.averageHoldingTemp}°C` : '—'}
                </p>
                <p className="text-[9px] font-semibold text-amber-700">Rata-rata Suhu</p>
              </div>

              <div className="bg-white/80 rounded-xl py-2 px-1 border border-indigo-200/60 shadow-2xs">
                <p className="font-mono font-extrabold text-base text-indigo-700">
                  {quota.leftoverPortions || 0}
                </p>
                <p className="text-[9px] font-semibold text-indigo-700">Porsi Sisa Terdata</p>
              </div>
            </div>

            <p className="mt-2 text-[10px] text-amber-900/80 leading-snug">
              Status alokasi surplus: <strong>{quota.surplusStatus === 'redistributed' ? 'Telah Dialokasikan' : 'Tersedia untuk Redistribusi'}</strong>.
            </p>
          </div>
        </section>
      </div>
    </ValidatorLayout>
  )
}

export default ValidatorDashboardPage
