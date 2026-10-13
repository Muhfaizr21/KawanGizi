import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { ValidatorLayout } from '../../components/layout/ValidatorLayout'
import { navigate } from '../../App'
import { useAuth } from '../../context/AuthContext'
import { fetchRecentScans } from '../../lib/api'
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
 * kartu menu hari ini + alergen, quick action tiles.
 * ==============================================================================
 */

const QUICK_ACTIONS = [
  { label: 'Mulai Scan Hidangan', desc: 'Pengenalan menu + kesegaran masakan AI', icon: ScanLine, href: '/validator/foodscan', tone: 'amber' },
  { label: 'Serah Terima BAST', desc: '13 master tote, suhu holding & tanda tangan', icon: ClipboardCheck, href: '/validator/handover', tone: 'emerald' },
  { label: 'Laporkan Makanan Rusak', desc: 'Tombol siaga cepat ke Satgas MBG', icon: Siren, href: '/validator/incidents', tone: 'rose' },
]

const TONE_CLASS = {
  amber: 'bg-amber-50 text-amber-600 border-amber-100 group-hover:bg-amber-600 group-hover:text-white',
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white',
  rose: 'bg-rose-50 text-rose-600 border-rose-100 group-hover:bg-rose-600 group-hover:text-white',
}

// Dihitung sekali di module scope agar tidak memanggil Date saat render.
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
  return { ring: 'emerald', label: 'Aman', tone: 'text-emerald-600', track: 'bg-emerald-100', stroke: '#059669' }
}

export function ValidatorDashboardPage() {
  const { user } = useAuth()
  const firstName = (user?.fullName || '').split(' ')[0]
  const [secondsLeft, setSecondsLeft] = useState(HACCP_TIMER.secondsLeftSeed)
  const [recentScans, setRecentScans] = useState([])
  const [scanLoadError, setScanLoadError] = useState(null)

  useEffect(() => {
    const t = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let active = true
    fetchRecentScans(100)
      .then((rows) => { if (active) setRecentScans(Array.isArray(rows) ? rows : []) })
      .catch((err) => { if (active) { setRecentScans([]); setScanLoadError(err.message || 'Gagal memuat scan.') } })
    return () => { active = false }
  }, [])

  const pkg = MENU_PACKAGES.find((p) => p.id === TODAY_PACKAGE_ID)
  const day = INITIAL_CALENDAR_DAYS.find((d) => d.packageId === TODAY_PACKAGE_ID)
  const level = haccpLevel(secondsLeft)

  const todayRows = recentScans.filter((row) => new Date(row.createdAt).toDateString() === new Date().toDateString())
  const avgScore = todayRows.length
    ? Math.round(todayRows.reduce((sum, row) => sum + Number(row.aiConfidence || 0), 0) / todayRows.length)
    : null
  const rejectedToday = todayRows.filter((row) => row.verdict === 'tolak').length
  const temperatures = todayRows.map((row) => Number(row.holdingTempC)).filter(Number.isFinite)
  const averageHoldingTemp = temperatures.length
    ? (temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length).toFixed(1)
    : null

  const totalMinutes = HACCP_TIMER.windowMinutes
  const remainMinutes = Math.ceil(secondsLeft / 60)
  const progress = Math.max(0, Math.min(1, secondsLeft / (totalMinutes * 60)))
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  const validatedPct = Math.round((QUOTA_BOARD.validatedPortions / QUOTA_BOARD.targetPortions) * 100)
  const totePct = Math.round((QUOTA_BOARD.masterTotesReceived / QUOTA_BOARD.masterTotesTotal) * 100)

  return (
    <ValidatorLayout activeMenu="dashboard" title="Beranda & Kuota Sekolah" badge="PORTAL VALIDATOR">
      {/* Sapaan */}
      <div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-amber-700">{TODAY_LABEL}</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">
          Selamat pagi, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {VALIDATOR_SCHOOL.school} · NPSN {VALIDATOR_SCHOOL.npsn} · Gerbang siap pukul{' '}
          {VALIDATOR_SCHOOL.gateWindow}
        </p>
      </div>

      {/* Baris atas: Armada + HACCP */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Status armada */}
        <section className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold tracking-tight">Status armada logistik SPPG</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 text-cyan-700 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
              {FLEET_STATUS.statusLabel}
            </span>
          </div>

          <div className="mt-4 flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
              <Truck className="h-7 w-7 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-extrabold font-mono tracking-tight">{FLEET_STATUS.unit}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Driver: <span className="font-semibold text-slate-700">{FLEET_STATUS.driver}</span> ·
                Berangkat {FLEET_STATUS.departedAt}
              </p>
              <p className="mt-1 text-[10px] font-semibold text-amber-700">Data armada contoh — integrasi pelacakan belum tersedia.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{FLEET_STATUS.route}</p>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">ETA</p>
                  <p className="font-mono font-extrabold text-sm text-amber-700">{FLEET_STATUS.eta}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Muatan</p>
                  <p className="font-mono font-extrabold text-sm">
                    {FLEET_STATUS.masterTotes} tote · {FLEET_STATUS.portions} porsi
                  </p>
                </div>
                <a
                  href={`tel:${FLEET_STATUS.driverPhone.replace(/[^+\d]/g, '')}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 text-white px-3.5 py-2.5 text-xs font-bold hover:bg-amber-700 transition shadow-sm cursor-pointer"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {FLEET_STATUS.driverPhone}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* HACCP countdown */}
        <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold tracking-tight">Hitung mundur HACCP 4 jam</h2>
            <Timer className={`h-4 w-4 ${level.tone}`} />
          </div>

          <div className="mt-3 flex items-center gap-4 flex-1">
            <div className="relative h-32 w-32 shrink-0">
              <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  fill="none"
                  strokeWidth="12"
                  className={level.track}
                />
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  fill="none"
                  strokeWidth="12"
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
                <p className="text-[9px] text-slate-400 mt-1 font-semibold">tersisa</p>
              </div>
            </div>

            <div className="min-w-0">
              <p className={`text-xs font-bold ${level.tone}`}>{level.label}</p>
              <dl className="mt-2 space-y-1 text-[11px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Selesai masak</dt>
                  <dd className="font-mono font-bold">{HACCP_TIMER.cookedAt}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Batas konsumsi</dt>
                  <dd className="font-mono font-bold">{HACCP_TIMER.safeUntil}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-400">Sisa menit</dt>
                  <dd className="font-mono font-bold">{remainMinutes} menit</dd>
                </div>
              </dl>
              {secondsLeft <= 0 && (
                <p className="mt-2 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1.5">
                  Sistem melarang pembagian & mengunci tombol scan.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Papan kuota */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold tracking-tight">Papan kuota porsi sekolah</h2>
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Target {QUOTA_BOARD.targetPortions} porsi
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Users className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Target Kuota</span>
            </div>
            <p className="mt-1 font-mono font-extrabold text-xl">{QUOTA_BOARD.targetPortions}</p>
            <div className="mt-2 space-y-1">
              {QUOTA_BOARD.studentBreakdown.map((b) => (
                <p key={b.label} className="font-mono text-[9px] text-slate-400">
                  {b.label}: {b.value}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-4">
            <div className="flex items-center gap-1.5 text-emerald-700">
              <PackageCheck className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Berhasil Divalidasi</span>
            </div>
            <p className="mt-1 font-mono font-extrabold text-xl text-emerald-700">
              {QUOTA_BOARD.validatedPortions}
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-emerald-100 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${validatedPct}%` }} />
            </div>
            <p className="mt-1 font-mono text-[9px] text-emerald-600">{validatedPct}% dari target</p>
          </div>

          <div className="rounded-xl bg-rose-50/70 border border-rose-100 p-4">
            <div className="flex items-center gap-1.5 text-rose-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Ditolak / Rusak</span>
            </div>
            <p className="mt-1 font-mono font-extrabold text-xl text-rose-600">
              {QUOTA_BOARD.rejectedPortions}
            </p>
            <p className="mt-2 font-mono text-[9px] text-rose-500">boks diamankan & ditahan</p>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
            <div className="flex items-center gap-1.5 text-slate-500">
              <ClipboardCheck className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Master Totes</span>
            </div>
            <p className="mt-1 font-mono font-extrabold text-xl">
              {QUOTA_BOARD.masterTotesReceived}/{QUOTA_BOARD.masterTotesTotal}
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${totePct}%` }} />
            </div>
            <p className="mt-1 font-mono text-[9px] text-slate-400">@{QUOTA_BOARD.toteCapacity} porsi/kontainer</p>
          </div>
        </div>
      </section>

      {/* Menu hari ini + quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <section className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold tracking-tight">Menu hari ini</h2>
            {pkg && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                {day?.title}
              </span>
            )}
          </div>

          {pkg ? (
            <>
              <p className="mt-2 text-base sm:text-lg font-bold leading-snug">{pkg.name}</p>

              <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {[
                  ['Nasi', pkg.staple],
                  ['Lauk utama', pkg.proteinMain],
                  ['Sayur', pkg.sideVeggie],
                  ['Buah', pkg.fruit],
                  ['Minuman', pkg.dairyDrink],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2 min-w-0">
                    <dt className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-slate-400 pt-1">
                      {k}
                    </dt>
                    <dd className="text-slate-700 truncate" title={v}>
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: Flame, label: 'Kalori', value: pkg.calories, unit: 'kkal', key: 'calories' },
                  { icon: Beef, label: 'Protein', value: pkg.protein, unit: 'g', key: 'protein' },
                ].map((r) => {
                  const std = NATIONAL_AKG_STANDARDS[r.key]
                  const pct = Math.min(100, Math.round((r.value / std.target) * 100))
                  return (
                    <div key={r.key} className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <r.icon size={13} />
                        <span className="text-[10px] font-bold uppercase tracking-wide">{r.label}</span>
                      </div>
                      <p className="mt-1 font-mono font-extrabold text-lg leading-none">
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
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <BadgeCheck size={13} />
                    <span className="text-[10px] font-bold uppercase tracking-wide">Sertifikat</span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-emerald-700">Halal & SLHS</p>
                  <p className="mt-2 font-mono text-[9px] text-slate-400 truncate" title={pkg.halalCert}>
                    {pkg.halalCert}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <PackageCheck size={13} />
                  <span className="text-[10px] font-bold uppercase tracking-wide">Keyakinan rata-rata</span>
                  </div>
                  <p className="mt-1 font-mono font-extrabold text-lg leading-none text-amber-700">
                    {avgScore ?? '—'}
                    <span className="text-xs font-semibold text-slate-400"> / 100</span>
                  </p>
                  <p className="mt-2 font-mono text-[9px] text-slate-400">
                    {todayRows.length} hasil klasifikasi · data API
                  </p>
                </div>
              </div>

              {pkg.allergens?.length > 0 && (
                <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <strong>Perhatian alergi untuk wali kelas:</strong> {pkg.allergens.join(', ')}
                </p>
              )}
            </>
          ) : (
            <div className="mt-6 py-10 text-center">
              <p className="text-4xl">🌤️</p>
              <p className="mt-2 text-sm font-bold">Hari libur sekolah</p>
              <p className="text-xs text-slate-500">Tidak ada distribusi porsi hari ini.</p>
            </div>
          )}
        </section>

        {/* Quick actions */}
        <section className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-extrabold tracking-tight">Aksi cepat</h2>
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => navigate(a.href)}
              className="w-full text-left bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center gap-3.5 hover:shadow-md hover:border-amber-200 transition cursor-pointer group"
            >
              <span
                className={`h-11 w-11 rounded-2xl border flex items-center justify-center shrink-0 transition ${TONE_CLASS[a.tone]}`}
              >
                <a.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-slate-900">{a.label}</span>
                <span className="block text-[11px] text-slate-500 mt-0.5">{a.desc}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-amber-600 transition shrink-0" />
            </button>
          ))}

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
              Hasil scan hari ini · API
            </p>
            {scanLoadError && <p role="alert" className="mt-2 text-[10px] text-rose-700">Data API gagal dimuat: {scanLoadError}</p>}
            <div className="mt-2 grid grid-cols-2 gap-2 text-center">
              <div className="bg-white/70 rounded-xl py-2 border border-amber-100">
                <p className="font-mono font-extrabold text-base text-amber-700">
                  {todayRows.length}
                </p>
                <p className="text-[9px] font-semibold text-amber-600/80">Hasil scan</p>
              </div>
              <div className="bg-white/70 rounded-xl py-2 border border-amber-100">
                <p className="font-mono font-extrabold text-base text-rose-600">
                  {rejectedToday}
                </p>
                <p className="text-[9px] font-semibold text-rose-500/80">Status tolak</p>
              </div>
              <div className="bg-white/70 rounded-xl py-2 border border-amber-100">
                <p className="font-mono font-extrabold text-base text-amber-700">
                  {averageHoldingTemp ? `${averageHoldingTemp}°C` : '—'}
                </p>
                <p className="text-[9px] font-semibold text-amber-600/80">Rata-rata suhu</p>
              </div>
              <div className="bg-white/70 rounded-xl py-2 border border-amber-100">
                <p className="font-mono font-extrabold text-base text-amber-700">
                  —
                </p>
                <p className="text-[9px] font-semibold text-amber-600/80">Porsi sisa</p>
              </div>
            </div>
            <p className="mt-2 text-[9px] text-amber-700/80">Data presensi dan alokasi porsi belum terhubung ke API.</p>
          </div>
        </section>
      </div>
    </ValidatorLayout>
  )
}

export default ValidatorDashboardPage
