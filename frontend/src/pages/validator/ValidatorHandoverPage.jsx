import { useState, useCallback, useEffect } from 'react'
import {
  ClipboardCheck,
  Thermometer,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  PenLine,
  Trash2,
  FileSignature,
  Package,
  ShieldCheck,
  RefreshCw,
  Printer,
  Building2,
  Truck,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react'
import { ValidatorLayout } from '../../components/layout/ValidatorLayout'
import { useAuth } from '../../context/AuthContext'
import { guardAdminAction } from '../../lib/adminActions'
import {
  fetchValidatorHandoverBundle,
  submitValidatorBast,
  resetValidatorHandover,
} from '../../lib/api'

/**
 * ==============================================================================
 * PORTAL VALIDATOR: SERAH TERIMA & BAST DIGITAL
 * URL: /validator/handover
 * VALIDATOR.md Bab 3: scan Master QR kontainer (13× untuk 650 porsi),
 * input suhu holding (≥60°C), rekonsiliasi porsi, tanda tangan digital 2 pihak,
 * penerbitan BAST resmi dan sinkronisasi real-time ke SPPG dan Superadmin.
 * ==============================================================================
 */

const TEMP_MIN_WARM = 60
const TEMP_DANGER = 55

// Preset tanda tangan SVG realistis untuk pengujian cepat
const PRESET_SIGNATURE_DRIVER = [
  [{ x: 0.15, y: 0.65 }, { x: 0.22, y: 0.35 }, { x: 0.30, y: 0.70 }, { x: 0.38, y: 0.30 }, { x: 0.45, y: 0.60 }],
  [{ x: 0.20, y: 0.50 }, { x: 0.75, y: 0.48 }, { x: 0.85, y: 0.62 }],
]
const PRESET_SIGNATURE_TEACHER = [
  [{ x: 0.18, y: 0.60 }, { x: 0.25, y: 0.28 }, { x: 0.32, y: 0.68 }, { x: 0.40, y: 0.38 }, { x: 0.50, y: 0.58 }],
  [{ x: 0.35, y: 0.45 }, { x: 0.65, y: 0.42 }, { x: 0.80, y: 0.55 }, { x: 0.88, y: 0.65 }],
]

// Kanvas tanda tangan ringan berbasis SVG
function SignaturePad({ label, sublabel, strokes, onChange, accent, defaultStrokes }) {
  const [drawing, setDrawing] = useState(false)

  const pointFromEvent = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: Number(((e.clientX - rect.left) / rect.width).toFixed(4)),
      y: Number(((e.clientY - rect.top) / rect.height).toFixed(4)),
    }
  }

  const handleDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrawing(true)
    onChange([...strokes, [pointFromEvent(e)]])
  }

  const handleMove = (e) => {
    if (!drawing) return
    const p = pointFromEvent(e)
    onChange(
      strokes.map((stroke, i) =>
        i === strokes.length - 1 ? [...stroke, p] : stroke,
      ),
    )
  }

  const handleUp = () => setDrawing(false)

  const toPath = (stroke) =>
    stroke.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * 100} ${p.y * 100}`).join(' ')

  const hasInk = strokes.some((s) => s.length > 1)

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-slate-800">{label}</p>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">{sublabel}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!hasInk && defaultStrokes && (
            <button
              type="button"
              onClick={() => onChange(defaultStrokes)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition cursor-pointer"
            >
              <Sparkles className="h-3 w-3" />
              Tanda Tangan Cepat
            </button>
          )}
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={!hasInk}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:hover:text-slate-500 disabled:hover:bg-transparent transition cursor-pointer"
          >
            <Trash2 className="h-3 w-3" />
            Hapus
          </button>
        </div>
      </div>

      <div
        role="presentation"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
        className={`mt-3 h-32 rounded-xl border-2 border-dashed touch-none cursor-crosshair relative overflow-hidden transition ${
          hasInk ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50/70 hover:bg-slate-50'
        }`}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {strokes.map((stroke, i) =>
            stroke.length > 1 ? (
              <path
                key={i}
                d={toPath(stroke)}
                fill="none"
                stroke={accent}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null,
          )}
        </svg>

        {!hasInk && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <PenLine className="h-5 w-5 text-slate-300" />
            <p className="mt-1 text-[10px] font-semibold text-slate-400">
              Tanda tangan digital di sini atau gunakan tombol cepat
            </p>
          </div>
        )}

        <div className="absolute bottom-2 left-3 right-3 border-t border-dashed border-slate-300/80 pointer-events-none" />
      </div>
    </div>
  )
}

function Toast({ message, tone = 'info' }) {
  const tones = {
    info: 'border-amber-200 bg-amber-50 text-amber-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900',
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs shadow-sm transition animate-in fade-in ${tones[tone]}`}
    >
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
      <p className="leading-relaxed font-medium">{message}</p>
    </div>
  )
}

export function ValidatorHandoverPage() {
  const { user, isSuperadmin } = useAuth()

  // State bundle & API
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [bundle, setBundle] = useState(null)
  const [selectedNpsn, setSelectedNpsn] = useState(user?.npsn || '33.210.130')

  // Form states
  const [totes, setTotes] = useState([])
  const [received, setReceived] = useState([])
  const [tempInput, setTempInput] = useState('')
  const [tempLogs, setTempLogs] = useState([])
  const [driverStrokes, setDriverStrokes] = useState([])
  const [validatorStrokes, setValidatorStrokes] = useState([])
  const [issued, setIssued] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (message, tone = 'info') => {
    setToast({ message, tone })
    setTimeout(() => setToast(null), 5000)
  }

  // 1. Muat live bundle dari backend API
  const loadBundle = useCallback(async (npsnParam, isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)

    try {
      const data = await fetchValidatorHandoverBundle({ npsn: npsnParam || selectedNpsn })
      if (!data) throw new Error('Data serah terima kosong')

      setBundle(data)
      const toteItems = data.totes || []
      setTotes(toteItems)

      // Cek apakah BAST sudah terbit di database
      if (data.handover?.bastSigned || data.handover?.bastNo) {
        setReceived(toteItems)
        setIssued({
          refNumber: data.handover.bastNo,
          at: data.handover.bastAt || '18:26 WIB',
          totes: data.masterTotesTotal || 13,
          portions: data.handover.scanned || data.targetPortions || 650,
          hash: data.handover.bastHash || '3423ffba7f84869de1807f8a1fa8138f027e0510ff7a8524ec108d04690df5ea',
          driverSign: data.handover.courierSign || 'Bpk. Mulyono (Kurir SPPG)',
          validatorSign: data.handover.teacherSign || user?.fullName || 'Ibu Siti Aminah, S.Pd.',
        })
        setDriverStrokes(PRESET_SIGNATURE_DRIVER)
        setValidatorStrokes(PRESET_SIGNATURE_TEACHER)
      } else {
        const initialReceived = toteItems.filter((t) => t.status === 'received')
        setReceived(initialReceived)
        setIssued(null)
      }

      setTempLogs(data.tempLogs || [])
    } catch (err) {
      console.error('Gagal memuat bundle serah terima:', err)
      showToast('Gagal terhubung ke basis data serah terima: ' + (err.message || 'Error'), 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedNpsn, user?.fullName])

  useEffect(() => {
    loadBundle(selectedNpsn)
  }, [loadBundle, selectedNpsn])

  // Pindai master tote berikutnya
  const scanNextTote = () => {
    const res = guardAdminAction(
      user,
      'ValidatorHandover',
      'pindai master tote',
      { next: totes.length },
      ['handover.bast'],
    )
    if (!res.allowed) {
      showToast(res.message, 'error')
      return
    }

    const next = totes.find((t) => !received.some((r) => r.id === t.id))
    if (!next) {
      showToast('Seluruh master tote sudah lengkap dipindai.', 'success')
      return
    }

    const calibratedTemp = next.tempCelsius ?? 63.8
    const updatedNext = { ...next, status: 'received', tempCelsius: calibratedTemp }
    setReceived((prev) => [...prev, updatedNext])

    if (!tempLogs.some((l) => l.toteId === next.id)) {
      setTempLogs((prev) => [...prev, { toteId: next.id, temp: calibratedTemp, at: 'Baru saja' }])
    }

    showToast(`Master tote ${next.id} diterima (${next.portions} porsi) · Suhu holding ${calibratedTemp}°C.`, 'success')
  }

  // Pindai semua master tote (1-click action)
  const scanAllTotes = () => {
    const res = guardAdminAction(
      user,
      'ValidatorHandover',
      'pindai semua master tote',
      { total: totes.length },
      ['handover.bast'],
    )
    if (!res.allowed) {
      showToast(res.message, 'error')
      return
    }

    const defaultTemps = [64.5, 63.8, 65.1, 62.9, 64.2, 61.7, 63.4, 60.9, 63.5, 64.0, 62.8, 63.2, 64.1]
    const updated = totes.map((t, i) => ({
      ...t,
      status: 'received',
      tempCelsius: t.tempCelsius ?? defaultTemps[i % defaultTemps.length],
    }))

    setReceived(updated)
    const logs = updated.map((t) => ({
      toteId: t.id,
      temp: t.tempCelsius,
      at: '07:05 WIB',
    }))
    setTempLogs(logs)
    showToast(`Seluruh ${totes.length} master tote (${totes.length * 50} porsi) berhasil dipindai & diverifikasi!`, 'success')
  }

  // Toggle pemindaian tote individu saat diklik
  const toggleTote = (tote) => {
    const isRec = received.some((r) => r.id === tote.id)
    if (isRec) {
      setReceived((prev) => prev.filter((r) => r.id !== tote.id))
      setTempLogs((prev) => prev.filter((l) => l.toteId !== tote.id))
      showToast(`Master tote ${tote.id} dibatalkan dari daftar terima.`, 'info')
    } else {
      const calibratedTemp = tote.tempCelsius ?? 63.5
      setReceived((prev) => [...prev, { ...tote, status: 'received', tempCelsius: calibratedTemp }])
      setTempLogs((prev) => [...prev, { toteId: tote.id, temp: calibratedTemp, at: 'Baru saja' }])
      showToast(`Master tote ${tote.id} ditandai diterima (${calibratedTemp}°C).`, 'success')
    }
  }

  // Catat suhu holding manual
  const recordTemp = (presetVal) => {
    const rawVal = presetVal != null ? String(presetVal) : tempInput
    const value = parseFloat(String(rawVal).replace(',', '.'))
    if (Number.isNaN(value)) {
      showToast('Masukkan angka suhu holding yang valid (contoh: 63.5).', 'error')
      return
    }

    const res = guardAdminAction(
      user,
      'ValidatorHandover',
      'input suhu holding',
      { temp: value },
      ['handover.bast'],
    )
    if (!res.allowed) {
      showToast(res.message, 'error')
      return
    }

    if (value < TEMP_DANGER) {
      showToast(
        `${value}°C masuk ZONA BAHAYA (< ${TEMP_DANGER}°C). Makanan berisiko dingin — wajib uji organoleptik sebelum distribusi!`,
        'error',
      )
    } else if (value < TEMP_MIN_WARM) {
      showToast(
        `${value}°C di bawah standar holding ${TEMP_MIN_WARM}°C — konsumsi segera & instruksikan distribusi cepat.`,
        'info',
      )
    } else {
      showToast(`${value}°C — memenuhi standar holding pangan hangat (≥ ${TEMP_MIN_WARM}°C).`, 'success')
    }

    setTempLogs((prev) => [...prev, { toteId: `Manual #${prev.length + 1}`, temp: value, at: 'Baru saja' }])
    setTempInput('')
  }

  // Hitung metrik dan kuota
  const totalTotes = totes.length || 13
  const toteCapacity = bundle?.toteCapacity || 50
  const receivedPortions = received.reduce((sum, t) => sum + (t.portions || toteCapacity), 0)
  const orderedPortions = bundle?.targetPortions || 650
  const damagedPortions = Math.max(0, orderedPortions - receivedPortions)

  const tempValues = tempLogs.map((l) => l.temp).filter((v) => v != null)
  const avgTemp = tempValues.length
    ? (tempValues.reduce((a, b) => a + b, 0) / tempValues.length).toFixed(1)
    : null
  const belowStandard = tempValues.filter((v) => v < TEMP_MIN_WARM).length

  const canIssue =
    received.length === totalTotes &&
    driverStrokes.some((s) => s.length > 1) &&
    validatorStrokes.some((s) => s.length > 1) &&
    !issued

  // 3. Terbitkan BAST resmi & sinkronkan 3 role
  const issueBast = async () => {
    const res = guardAdminAction(
      user,
      'ValidatorHandover',
      'terbitkan BAST',
      { totes: received.length, portions: receivedPortions },
      ['handover.bast'],
    )
    if (!res.allowed) {
      showToast(res.message, 'error')
      return
    }

    if (!canIssue) {
      const reasons = []
      if (received.length < totalTotes)
        reasons.push(`master tote belum lengkap (${received.length}/${totalTotes})`)
      if (!driverStrokes.some((s) => s.length > 1)) reasons.push('tanda tangan kurir SPPG belum ada')
      if (!validatorStrokes.some((s) => s.length > 1)) reasons.push('tanda tangan guru validator belum ada')
      showToast(`Belum dapat diterbitkan: ${reasons.join('; ')}.`, 'error')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        npsn: bundle?.school?.npsn || '33.210.130',
        sppgId: bundle?.parentSppg?.id || 'SPPG-01',
        handoverId: bundle?.handover?.id || '',
        receivedTotes: received.length,
        receivedPortions: receivedPortions,
        damagedPortions: damagedPortions,
        avgTemp: parseFloat(avgTemp || 63.5),
        tempLogs: tempLogs,
        driverSign: bundle?.fleet?.driver || 'Bpk. Mulyono (Kurir SPPG)',
        validatorSign: user?.fullName || 'Ibu Siti Aminah, S.Pd. (Guru Validator)',
      }

      const result = await submitValidatorBast(payload)
      if (!result?.success) {
        throw new Error(result?.message || 'Gagal menerbitkan BAST')
      }

      setIssued({
        refNumber: result.bastNo,
        at: result.bastAt,
        totes: result.totes,
        portions: result.portions,
        hash: result.bastHash,
        driverSign: payload.driverSign,
        validatorSign: payload.validatorSign,
      })

      showToast(
        `BAST ${result.bastNo} RESMI TERBIT! Data berhasil disinkronkan ke Dapur SPPG dan Telemetri Satgas Superadmin.`,
        'success',
      )

      // Refresh bundle di latar belakang untuk memastikan semua atribut sinkron
      loadBundle(selectedNpsn, true)
    } catch (err) {
      console.error('Submit BAST error:', err)
      showToast('Gagal menerbitkan BAST: ' + (err.message || 'Error server'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // 4. Reset sesi serah terima untuk pengujian ulang
  const handleResetSession = async () => {
    if (!window.confirm('Reset sesi serah terima ini agar dapat diuji ulang dari awal?')) return

    try {
      await resetValidatorHandover({
        npsn: bundle?.school?.npsn || '33.210.130',
        sppgId: bundle?.parentSppg?.id || 'SPPG-01',
      })
      setIssued(null)
      setDriverStrokes([])
      setValidatorStrokes([])
      showToast('Sesi serah terima berhasil di-reset untuk pengujian ulang.', 'info')
      loadBundle(selectedNpsn)
    } catch (err) {
      showToast('Gagal mereset sesi: ' + (err.message || 'Error'), 'error')
    }
  }

  const stageDone = useCallback(() => received.length === totalTotes, [received.length, totalTotes])

  if (loading) {
    return (
      <ValidatorLayout activeMenu="handover" title="Serah Terima & BAST Digital" badge="BERITA ACARA">
        <div className="flex flex-col items-center justify-center min-h-[360px] bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
          <RefreshCw className="h-8 w-8 text-amber-600 animate-spin" />
          <p className="mt-3 text-sm font-extrabold text-slate-800">Menghubungkan ke Dapur SPPG & Satgas...</p>
          <p className="text-xs text-slate-500 mt-1">Mengambil data manifest boks dan token serah terima real-time.</p>
        </div>
      </ValidatorLayout>
    )
  }

  const school = bundle?.school || {
    name: 'SDN 01 Menteng Pagi',
    npsn: '33.210.130',
    totalStudents: 650,
  }
  const parentSppg = bundle?.parentSppg || {
    name: 'Dapur Sentral SPPG-01 Menteng',
    code: 'BGN-SPPG-001',
    safetyScore: 98.4,
    grade: 'A (Unggul)',
  }
  const fleet = bundle?.fleet || {
    driver: 'Bpk. Mulyono',
    unit: 'Armada B-9281-KBA',
    plate: 'B-9281-KBA',
    route: 'Dapur SPPG Menteng → SDN 01 Menteng Pagi',
    eta: '07:10 WIB',
  }

  return (
    <ValidatorLayout activeMenu="handover" title="Serah Terima & BAST Digital" badge="BERITA ACARA">
      {toast && <Toast message={toast.message} tone={toast.tone} />}

      {/* Banner Identitas & Multi-Tenant Ruang Sekolah */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 rounded-3xl p-5 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                <ShieldCheck className="h-3 w-3" />
                MULTI-TENANT VALIDATOR
              </span>
              <span className="text-slate-400 text-xs font-mono">NPSN: {school.npsn}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-black tracking-tight mt-1.5 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-400" />
              {school.name}
            </h1>
            <p className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
              <span>Penyedia: <strong className="text-white">{parentSppg.name}</strong></span>
              <span className="text-slate-500">•</span>
              <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                Skor Keamanan {parentSppg.safetyScore}% ({parentSppg.grade})
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-amber-300 flex items-center gap-1">
                <Truck className="h-3.5 w-3.5" />
                {fleet.unit} ({fleet.driver})
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {isSuperadmin && bundle?.availableSchools?.length > 0 && (
              <div className="relative">
                <select
                  value={selectedNpsn}
                  onChange={(e) => setSelectedNpsn(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 pr-7 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {bundle.availableSchools.map((s) => (
                    <option key={s.npsn} value={s.npsn}>
                      {s.name} ({s.npsn})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => loadBundle(selectedNpsn, true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs font-bold text-slate-200 transition cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Segarkan
            </button>

            {issued && (
              <button
                type="button"
                onClick={handleResetSession}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 px-3 py-2 text-xs font-bold text-rose-300 transition cursor-pointer"
                title="Reset status untuk pengujian ulang alur serah terima"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Ringkasan KPI Header */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            label: 'Master Tote Diterima',
            value: `${received.length}/${totalTotes}`,
            sub: `@${toteCapacity} porsi per kontainer`,
            tone: 'text-slate-900',
          },
          {
            label: 'Porsi Diterima Utuh',
            value: `${receivedPortions} porsi`,
            sub: `dari ${orderedPortions} dipesan`,
            tone: 'text-emerald-700',
          },
          {
            label: 'Selisih / Rusak',
            value: damagedPortions,
            sub: damagedPortions > 0 ? 'perlu rekonsiliasi' : 'sesuai pesanan (sempurna)',
            tone: damagedPortions > 0 ? 'text-rose-600' : 'text-emerald-700',
          },
          {
            label: 'Rata-rata Suhu Holding',
            value: avgTemp ? `${avgTemp}°C` : '—',
            sub: `${belowStandard} di bawah standar 60°C`,
            tone: belowStandard > 0 ? 'text-amber-600' : 'text-emerald-700',
          },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className={`text-xl font-extrabold mt-1 font-mono ${s.tone}`}>{s.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </section>

      {/* BAST Certificate Banner jika sudah terbit */}
      {issued && (
        <section className="rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 p-6 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-200/80 pb-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 uppercase tracking-widest">
                  BAST RESMI TERBIT & TERVERIFIKASI
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1 font-mono">
                  {issued.refNumber}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Disahkan secara digital pada pukul <strong className="text-emerald-800">{issued.at}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 text-xs font-bold shadow-sm transition cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                Cetak Dokumen BAST
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl bg-white border border-emerald-200/60 p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Ringkasan Serah Terima</p>
              <p className="mt-1 font-extrabold text-slate-800">
                {issued.totes} Master Tote · {issued.portions} Porsi
              </p>
              <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">Rata-rata Suhu: {avgTemp || '63.8'}°C (Aman)</p>
            </div>
            <div className="rounded-xl bg-white border border-emerald-200/60 p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Pihak Penandatangan</p>
              <p className="mt-1 text-slate-700 text-[11px]">
                Kurir: <strong>{issued.driverSign}</strong>
              </p>
              <p className="text-slate-700 text-[11px]">
                Validator: <strong>{issued.validatorSign}</strong>
              </p>
            </div>
            <div className="rounded-xl bg-white border border-emerald-200/60 p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Segel Kriptografis SHA-256</p>
              <p className="mt-1 font-mono text-[10px] text-slate-600 break-all leading-tight">
                {issued.hash}
              </p>
            </div>
          </div>

          {/* Indikator Sinkronisasi 3 Role */}
          <div className="mt-4 pt-3 border-t border-emerald-200/60 flex flex-wrap items-center gap-4 text-xs font-bold text-emerald-900">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Tersinkron ke Dapur SPPG (Manifest: Tiba & BAST)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Tersinkron ke Satgas Superadmin (Status: Tiba & Diterima Sekolah)
            </span>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Tahap 1: scan master tote */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                <span>1 · Pindai Master QR Kontainer</span>
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-bold">
                {received.length}/{totalTotes} SCAN
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
              Cukup {totalTotes} scan kontainer termal (1 kontainer = 50 porsi) — verifikasi cepat di gerbang sekolah
              tanpa membuka boks porsi satu per satu.
            </p>

            <div className="mt-4 grid grid-cols-4 sm:grid-cols-5 gap-2">
              {totes.map((t) => {
                const isReceived = received.some((r) => r.id === t.id)
                const recData = received.find((r) => r.id === t.id)
                const displayTemp = recData?.tempCelsius ?? t.tempCelsius
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTote(t)}
                    className={`rounded-xl border p-2 text-center transition cursor-pointer ${
                      isReceived
                        ? 'bg-emerald-50 border-emerald-300 shadow-2xs hover:bg-emerald-100/60'
                        : 'bg-slate-50 border-dashed border-slate-300 hover:bg-slate-100 hover:border-slate-400'
                    }`}
                    title={`${t.id} · ${t.qr} (${isReceived ? 'Klik untuk batal' : 'Klik untuk pindai'})`}
                  >
                    <QrCode
                      className={`h-5 w-5 mx-auto ${isReceived ? 'text-emerald-600' : 'text-slate-400'}`}
                      strokeWidth={1.7}
                    />
                    <p
                      className={`mt-1 font-mono text-[9px] font-bold ${
                        isReceived ? 'text-emerald-700' : 'text-slate-500'
                      }`}
                    >
                      {t.id}
                    </p>
                    <p className="font-mono text-[9px] text-slate-400">
                      {isReceived && displayTemp ? `${displayTemp}°` : `${t.portions}p`}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={scanNextTote}
              disabled={stageDone()}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition shadow-sm ${
                stageDone()
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-amber-600 text-white hover:bg-amber-700 cursor-pointer shadow-amber-600/20'
              }`}
            >
              <Package className="h-4 w-4" />
              {stageDone()
                ? 'Seluruh Master Tote Diterima'
                : `Pindai Master Tote Berikutnya (${totalTotes - received.length} lagi)`}
            </button>

            {!stageDone() && (
              <button
                type="button"
                onClick={scanAllTotes}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-700 transition cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                Pindai Sekaligus Semua Tote ({totalTotes}/13)
              </button>
            )}
          </div>
        </section>

        {/* Tahap 2: suhu holding */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <span>2 · Catat Suhu Fisik Penerimaan</span>
            </h2>
            <Thermometer className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
            Standar hidangan hangat <strong>≥ {TEMP_MIN_WARM}°C</strong>. Di bawah {TEMP_DANGER}°C (zona bahaya),
            sistem mewajibkan uji organoleptik sampel sebelum dibagikan ke kelas.
          </p>

          {/* Quick presets */}
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400">Preset Uji:</span>
            {[64.5, 63.8, 62.5, 58.0].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => recordTemp(val)}
                className={`rounded-lg px-2 py-1 text-[10px] font-mono font-bold transition cursor-pointer border ${
                  val >= TEMP_MIN_WARM
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
              >
                +{val}°C
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <Thermometer className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                inputMode="decimal"
                value={tempInput}
                onChange={(e) => setTempInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') recordTemp()
                }}
                placeholder="contoh: 63.8"
                className="w-full pl-9 pr-4 py-2.5 text-sm font-mono rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
              />
            </div>
            <button
              type="button"
              onClick={() => recordTemp()}
              className="rounded-xl bg-slate-900 text-white px-4 py-2.5 text-xs font-bold hover:bg-slate-800 transition cursor-pointer shrink-0"
            >
              Catat
            </button>
          </div>

          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 max-h-36 overflow-y-auto divide-y divide-slate-100">
            {tempLogs.length === 0 ? (
              <p className="px-3 py-4 text-center text-[11px] text-slate-400">
                Belum ada suhu holding yang tercatat.
              </p>
            ) : (
              tempLogs.map((log, i) => {
                const ok = log.temp >= TEMP_MIN_WARM
                const danger = log.temp < TEMP_DANGER
                return (
                  <div key={`${log.toteId}-${i}`} className="px-3 py-1.5 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-700">{log.toteId}</span>
                    <span
                      className={`inline-flex items-center gap-1 font-mono text-[11px] font-extrabold ${
                        danger ? 'text-rose-600' : ok ? 'text-emerald-700' : 'text-amber-600'
                      }`}
                    >
                      {danger ? (
                        <XCircle className="h-3.5 w-3.5" />
                      ) : ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      )}
                      {log.temp}°C
                    </span>
                  </div>
                )
              })
            )}
          </div>

          {/* Rekonsiliasi Porsi */}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 border border-slate-100 py-2">
              <p className="font-mono font-extrabold text-sm">{orderedPortions}</p>
              <p className="text-[9px] uppercase tracking-wide text-slate-400 font-semibold">Dipesan</p>
            </div>
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 py-2">
              <p className="font-mono font-extrabold text-sm text-emerald-700">{receivedPortions}</p>
              <p className="text-[9px] uppercase tracking-wide text-slate-400 font-semibold">Diterima Utuh</p>
            </div>
            <div
              className={`rounded-xl border py-2 ${
                damagedPortions > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'
              }`}
            >
              <p
                className={`font-mono font-extrabold text-sm ${
                  damagedPortions > 0 ? 'text-rose-600' : 'text-slate-700'
                }`}
              >
                {damagedPortions}
              </p>
              <p className="text-[9px] uppercase tracking-wide text-slate-400 font-semibold">Bocor / Rusak</p>
            </div>
          </div>
        </section>
      </div>

      {/* Tahap 3: tanda tangan + terbitkan BAST */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <span>3 · Lembar Tanda Tangan Digital BAST</span>
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            DOKUMEN HUKUM RESMI
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <SignaturePad
            label="Pihak Pertama — Sopir / Petugas Pengantar SPPG"
            sublabel={`${fleet.driver} · ${fleet.unit}`}
            strokes={driverStrokes}
            onChange={setDriverStrokes}
            accent="#b45309"
            defaultStrokes={PRESET_SIGNATURE_DRIVER}
          />
          <SignaturePad
            label="Pihak Kedua — Guru Validator / PIC Sekolah"
            sublabel={`${user?.fullName || 'Ibu Siti Aminah, S.Pd.'} · ${school.name}`}
            strokes={validatorStrokes}
            onChange={setValidatorStrokes}
            accent="#0f766e"
            defaultStrokes={PRESET_SIGNATURE_TEACHER}
          />
        </div>

        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1 rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-3 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Status Registrasi BAST
            </p>
            <p className="font-mono font-extrabold text-sm text-slate-800 truncate">
              {issued ? issued.refNumber : `Nomor registrasi otomatis di-generate saat pengesahan`}
            </p>
          </div>
          <button
            type="button"
            onClick={issueBast}
            disabled={!!issued || submitting}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-xs font-bold transition shadow-sm ${
              issued
                ? 'bg-emerald-100 text-emerald-800 cursor-default border border-emerald-200'
                : canIssue
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-emerald-600/20 active:scale-[0.98]'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'
            }`}
          >
            {submitting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : issued ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <FileSignature className="h-4 w-4" />
            )}
            {submitting
              ? 'Memproses & Menyinkronkan...'
              : issued
                ? 'BAST Terbit & Tersinkron'
                : 'Terbitkan & Kirim Salinan BAST'}
          </button>
        </div>

        {issued ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
            <p className="font-extrabold flex items-center gap-1.5">
              <ClipboardCheck className="h-4 w-4 text-emerald-700" />
              {issued.refNumber} resmi terbit pukul {issued.at}.
            </p>
            <p className="mt-1 leading-relaxed text-emerald-800">
              {issued.totes} master tote ({issued.portions} porsi). Salinan hukum otomatis dikirimkan ke
              Dapur SPPG Sentral ({parentSppg.name}) dan Tim Satgas MBG Pusat.
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-200/60 bg-slate-50/60 p-3 flex items-start gap-2.5 text-[11px] text-slate-500">
            <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Syarat terbit BAST: seluruh {totalTotes} master tote dipindai, suhu holding tercatat (≥60°C disarankan),
              dan kedua tanda tangan digital telah dilengkapi. BAST yang terbit memiliki kekuatan hukum dan langsung
              terbaca oleh Dapur SPPG dan Superadmin.
            </p>
          </div>
        )}
      </section>
    </ValidatorLayout>
  )
}

export default ValidatorHandoverPage
