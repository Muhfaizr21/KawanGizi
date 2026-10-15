import { useState, useMemo, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Printer,
  Plus,
  X,
  Check,
  Search,
  Thermometer,
  Clock,
  AlertTriangle,
  Building2,
  ShieldAlert,
  RefreshCw,
  Trash2,
  ShieldCheck,
  AlertOctagon,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  fetchSppgBatchesBundle,
  createSppgBatch,
  updateSppgBatchStatus,
  verifySppgBatchToken,
  quarantineSppgBatch,
  deleteSppgBatch,
} from '../../lib/api'
import { ASSIGNED_SCHOOLS_MANIFEST, SPPG_PROFILE } from '../../data/sppgPortalData'
import { NATIONAL_MENU_PACKAGES } from '../../data/sppgRecipesData'
import {
  SAFE_WINDOW_MINUTES,
  TOTE_CAPACITY,
  SCHOOL_CODES,
  BATCH_STATUSES,
  SEED_BATCHES,
  buildBoxToken,
  buildMasterToken,
  totesFor,
  canonicalPayload,
  sha256Hex,
  addMinutesToClock,
} from '../../data/sppgBatchesData'

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#23259C]'

const SPPG_SPACES = [
  { id: 'SPPG-01', name: 'SPPG 01 Menteng Jaya Mandiri' },
  { id: 'SPPG-02', name: 'SPPG 02 Kebayoran Baru Mandiri' },
  { id: 'SPPG-03', name: 'SPPG 03 Cikini Mitra Gizi' },
]

function shortHash(hash) {
  return hash ? hash.slice(0, 12).toUpperCase() : 'MENGHITUNG'
}

function StatusPill({ status }) {
  if (status === 'quarantined') {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
        <AlertOctagon className="h-3 w-3 text-rose-600" />
        DIKARANTINA
      </span>
    )
  }
  if (status === 'recalled') {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold bg-red-200 text-red-900 border border-red-400">
        <AlertTriangle className="h-3 w-3 text-red-700" />
        DITARIK DARURAT
      </span>
    )
  }
  const meta = BATCH_STATUSES[status] || BATCH_STATUSES.draft
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${meta.tone}`}>
      {meta.label}
    </span>
  )
}

export function SppgBatchesPanel() {
  const { user, isSuperadmin } = useAuth()

  // Ruang dapur aktif (multi-tenant per SPPG)
  const [activeSppgId, setActiveSppgId] = useState(() => {
    if (user?.sppgId) return user.sppgId
    return 'SPPG-01'
  })

  const [isLoadingBundle, setIsLoadingBundle] = useState(false)
  const [kitchenName, setKitchenName] = useState(SPPG_PROFILE.name)
  const [kitchenCode, setKitchenCode] = useState(SPPG_PROFILE.code)
  const [targetBoxes, setTargetBoxes] = useState(2500)
  const [cookingDate, setCookingDate] = useState('2026-10-08')

  const [batches, setBatches] = useState(SEED_BATCHES)
  const [availableSchools, setAvailableSchools] = useState(ASSIGNED_SCHOOLS_MANIFEST)
  const [availableMenus, setAvailableMenus] = useState(NATIONAL_MENU_PACKAGES)

  const [hashReady, setHashReady] = useState(false)
  const [form, setForm] = useState({
    schoolId: 'sch-01',
    menuId: 'PAKET-A-01',
    boxCount: '',
    cookedAt: '06:00',
    cookTemp: '78.5',
  })
  const [formError, setFormError] = useState('')
  const [formOk, setFormOk] = useState('')
  const [queue, setQueue] = useState(['batch-20261008-02'])
  const [previewId, setPreviewId] = useState(null)
  const [printTargets, setPrintTargets] = useState([])
  const [toteBatchId, setToteBatchId] = useState('batch-20261008-01')
  const [checkToken, setCheckToken] = useState('')
  const [checkResult, setCheckResult] = useState(null)
  const [copiedToken, setCopiedToken] = useState('')

  // State untuk Intervensi Keamanan Pangan Superadmin (Karantina / Tarik Batch)
  const [quarantineModalBatch, setQuarantineModalBatch] = useState(null)
  const [quarantineReason, setQuarantineReason] = useState('')
  const [isSubmittingQuarantine, setIsSubmittingQuarantine] = useState(false)
  const [quarantineError, setQuarantineError] = useState('')
  const [batchToDelete, setBatchToDelete] = useState(null)

  // Memuat data bundle lengkap dari backend sesuai dapur yang dipilih
  const loadBundle = useCallback(async (sppgIdToFetch) => {
    setIsLoadingBundle(true)
    try {
      const data = await fetchSppgBatchesBundle(sppgIdToFetch)
      if (data) {
        if (data.batches && Array.isArray(data.batches)) {
          setBatches(data.batches)
          // Sinkronkan antrean cetak dari batch yang berstatus 'queued'
          const queuedIds = data.batches.filter((b) => b.status === 'queued').map((b) => b.id)
          setQueue(queuedIds)
          if (data.batches.length > 0) {
            setToteBatchId(data.batches[0].id)
          }
        }
        if (data.kitchenName) setKitchenName(data.kitchenName)
        if (data.kitchenCode) setKitchenCode(data.kitchenCode)
        if (data.cookingDate) setCookingDate(data.cookingDate)
        if (data.targetBoxes) setTargetBoxes(data.targetBoxes)
        if (data.availableSchools && data.availableSchools.length > 0) {
          setAvailableSchools(data.availableSchools)
          setForm((f) => ({
            ...f,
            schoolId: f.schoolId || data.availableSchools[0].id,
          }))
        }
        if (data.availableMenus && data.availableMenus.length > 0) {
          setAvailableMenus(data.availableMenus)
          setForm((f) => ({
            ...f,
            menuId: f.menuId || data.availableMenus[0].code || data.availableMenus[0].id,
          }))
        }
      }
    } catch (err) {
      console.warn('Gagal sinkronisasi bundle batch dari backend, gunakan offline buffer:', err)
    } finally {
      setIsLoadingBundle(false)
      setHashReady(true)
    }
  }, [])

  useEffect(() => {
    loadBundle(activeSppgId)
  }, [activeSppgId, loadBundle])

  // Dialog label tertutup dengan Escape.
  useEffect(() => {
    if (!previewId && !quarantineModalBatch) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setPreviewId(null)
        setQuarantineModalBatch(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewId, quarantineModalBatch])

  // Mencetak berarti membuka dialog cetak sistem. Staf memilih printer
  // Bluetooth atau WiFi dapur dari dialog itu.
  useEffect(() => {
    if (printTargets.length === 0) return
    const t = setTimeout(() => window.print(), 150)
    return () => clearTimeout(t)
  }, [printTargets])

  const totals = useMemo(() => {
    const boxes = batches.reduce((sum, b) => sum + (b.boxCount || 0), 0)
    const totes = batches.reduce((sum, b) => sum + totesFor(b.boxCount || 0).length, 0)
    return {
      boxes,
      totes,
      queued: queue.length,
      verified: batches.filter((b) => b.verified).length,
      count: batches.length,
    }
  }, [batches, queue])

  const previewBatch = batches.find((b) => b.id === previewId) || null
  const toteBatch = batches.find((b) => b.id === toteBatchId) || batches[0] || null
  const printBatches = printTargets
    .map((id) => batches.find((b) => b.id === id))
    .filter(Boolean)

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setFormError('')
    setFormOk('')
  }

  async function handleGenerate(e) {
    e.preventDefault()
    const boxCount = parseInt(form.boxCount, 10)
    const cookTemp = parseFloat(form.cookTemp)

    if (!form.schoolId || !form.menuId) {
      setFormError('Pilih sekolah sasaran dan paket menu.')
      return
    }
    if (!Number.isInteger(boxCount) || boxCount < 1 || boxCount > 2500) {
      setFormError('Jumlah boks diisi 1 sampai 2500.')
      return
    }
    if (!form.cookedAt) {
      setFormError('Isi jam selesai masak.')
      return
    }
    // Standar HACCP: 70C s/d 100C
    if (Number.isNaN(cookTemp) || cookTemp < 70 || cookTemp > 100) {
      setFormError('Suhu masak inti tidak memenuhi standar HACCP (harus 70 sampai 100 derajat Celsius).')
      return
    }

    try {
      const payload = {
        schoolId: form.schoolId,
        menuCode: form.menuId,
        menuId: form.menuId,
        boxCount,
        cookedAt: form.cookedAt,
        cookTemp,
      }

      const res = await createSppgBatch(payload, activeSppgId)
      if (res) {
        setBatches((list) => [res, ...list])
        setToteBatchId(res.id)
        setForm((f) => ({ ...f, boxCount: '' }))
        setFormOk(`Batch ${res.token} terbentuk dan tersimpan di database, ${boxCount} boks dalam ${totesFor(boxCount).length} kontainer.`)
      } else {
        // Fallback lokal jika offline
        const schoolCode = SCHOOL_CODES[form.schoolId] || 'SCH01'
        const seq = batches.filter((b) => b.schoolId === form.schoolId).length + 1
        const fallbackBatch = {
          id: `batch-${Date.now()}`,
          sppgId: activeSppgId,
          seq,
          token: buildBoxToken(schoolCode, seq),
          schoolId: form.schoolId,
          schoolCode,
          schoolName: 'Sekolah Sasaran MBG',
          menuCode: form.menuId,
          menuName: 'Paket Menu BGN',
          boxCount,
          cookedAt: form.cookedAt,
          consumeBy: addMinutesToClock(form.cookedAt, SAFE_WINDOW_MINUTES),
          cookTemp,
          allergens: ['Kedelai (Tahu/Kecap)'],
          status: 'draft',
          verified: false,
          checksum: '',
        }
        fallbackBatch.checksum = (await sha256Hex(canonicalPayload(fallbackBatch))) || 'TIDAK-TERSEDIA'
        setBatches((list) => [fallbackBatch, ...list])
        setToteBatchId(fallbackBatch.id)
        setForm((f) => ({ ...f, boxCount: '' }))
        setFormOk(`Batch ${fallbackBatch.token} terbentuk secara lokal.`)
      }
    } catch (err) {
      setFormError(err.message || 'Gagal generate batch ke server.')
    }
  }

  async function toggleQueue(id) {
    const isQueued = queue.includes(id)
    const newStatus = isQueued ? 'draft' : 'queued'

    try {
      await updateSppgBatchStatus(id, newStatus, activeSppgId)
    } catch (err) {
      console.warn('Gagal sinkronkan status batch ke server:', err)
    }

    setQueue((q) => (isQueued ? q.filter((x) => x !== id) : [...q, id]))
    setBatches((list) =>
      list.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
    )
  }

  async function removeBatch(id) {
    try {
      await deleteSppgBatch(id, activeSppgId)
    } catch (err) {
      console.warn('Gagal hapus batch di server:', err)
    }
    setBatches((list) => list.filter((b) => b.id !== id))
    setQueue((q) => q.filter((x) => x !== id))
    if (previewId === id) setPreviewId(null)
  }

  async function handleSelfCheck(e) {
    e.preventDefault()
    const token = checkToken.trim().toUpperCase()
    if (!token) {
      setCheckResult({ ok: false, message: 'Tempel atau ketik token QR, lalu tekan Verifikasi.' })
      return
    }

    try {
      const res = await verifySppgBatchToken(token, activeSppgId)
      if (res) {
        setCheckResult({
          ok: res.ok,
          message: res.message,
        })
        if (res.ok && res.batch) {
          setBatches((list) =>
            list.map((b) => (b.id === res.batch.id ? { ...b, verified: true } : b))
          )
        }
        return
      }
    } catch (err) {
      console.warn('Gagal verifikasi token via server, fallback ke Web Crypto:', err)
    }

    // Fallback verifikasi lokal jika server tidak merespon
    const batch = batches.find(
      (b) =>
        b.token === token ||
        totesFor(b.boxCount).some((t) => buildMasterToken(b.schoolCode, b.seq, t.index) === token)
    )
    if (!batch) {
      setCheckResult({ ok: false, message: `Token ${token} tidak terdaftar di sesi dapur hari ini.` })
      return
    }
    const recomputed = await sha256Hex(canonicalPayload(batch))
    if (recomputed && recomputed === batch.checksum) {
      setBatches((list) => list.map((b) => (b.id === batch.id ? { ...b, verified: true } : b)))
      setCheckResult({
        ok: true,
        message: `Token cocok dan checksum valid. ${batch.token}, ${batch.schoolName}, ${batch.boxCount} boks.`,
      })
    } else {
      setCheckResult({
        ok: false,
        message: `Token terdaftar tetapi checksum ${batch.token} tidak cocok. Tahan batch ini.`,
      })
    }
  }

  // Eksekusi Karantina / Penarikan Batch oleh Superadmin
  async function handleQuarantineSubmit(e) {
    e.preventDefault()
    if (!quarantineModalBatch) return
    if (!quarantineReason || quarantineReason.trim().length < 5) {
      setQuarantineError('Alasan karantina wajib diisi minimal 5 karakter untuk jejak audit forensik.')
      return
    }

    setIsSubmittingQuarantine(true)
    setQuarantineError('')
    try {
      const res = await quarantineBatch(quarantineModalBatch.id, quarantineReason.trim())
      if (res) {
        setBatches((list) =>
          list.map((b) =>
            b.id === quarantineModalBatch.id
              ? {
                  ...b,
                  status: 'quarantined',
                  quarantineReason: quarantineReason.trim(),
                  quarantinedBy: user?.fullName || 'Superadmin BGN',
                  quarantinedAt: new Date().toISOString(),
                }
              : b
          )
        )
        // Keluarkan dari antrean cetak jika ada
        setQueue((q) => q.filter((id) => id !== quarantineModalBatch.id))
        setQuarantineModalBatch(null)
        setQuarantineReason('')
        setFormOk(`Batch ${quarantineModalBatch.token} BERHASIL DIKARANTINA dan tercatat pada audit_logs forensik.`)
      }
    } catch (err) {
      setQuarantineError(err.message || 'Gagal mengeksekusi karantina batch.')
    } finally {
      setIsSubmittingQuarantine(false)
    }
  }

  return (
    <div className="space-y-5">
      <style>{`@page{size:80mm auto;margin:3mm}.batch-print-sheet{display:none}@media print{body *{visibility:hidden}.batch-print-sheet,.batch-print-sheet *{visibility:visible}.batch-print-sheet{display:block !important;position:absolute;inset:0}}`}</style>

      {/* ========================================================================= */}
      {/* MULTI-TENANT WORKSPACE & SUPERADMIN INSPECTION HEADER */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg">
        <div className="flex flex-col gap-3.5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-amber-400 shadow-inner">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded border border-indigo-400/30 bg-[#23259C] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                  {activeSppgId}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400"></span>
                  Ruang Kerja Batch Mandiri
                </span>
                {isSuperadmin && (
                  <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    Otoritas Superadmin BGN
                  </span>
                )}
              </div>
              <h2 className="mt-0.5 flex items-center gap-2 text-base font-bold tracking-tight text-white">
                <span>{kitchenName}</span>
                <span className="text-xs font-normal text-slate-300">
                  · Target: <strong className="font-bold text-white">{targetBoxes.toLocaleString('id-ID')} Boks</strong>
                </span>
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isSuperadmin ? (
              <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 p-1 text-xs">
                <span className="px-2 font-medium text-[11px] text-slate-300">
                  Inspeksi Dapur:
                </span>
                {SPPG_SPACES.map((space) => {
                  const isActive = space.id === activeSppgId
                  return (
                    <button
                      key={space.id}
                      onClick={() => setActiveSppgId(space.id)}
                      className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                        isActive
                          ? 'bg-[#23259C] text-white shadow-xs'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                      title={space.name}
                    >
                      {space.id}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-slate-300">
                Unit Terisolasi: <strong className="text-white">{user?.fullName || kitchenName}</strong>
              </div>
            )}

            <button
              onClick={() => loadBundle(activeSppgId)}
              disabled={isLoadingBundle}
              className="cursor-pointer rounded-xl border border-white/10 bg-white/10 p-2 text-white transition hover:bg-white/20"
              title="Sinkronisasi data batch dari server"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingBundle ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* HERO BANNER & KPI METRICS */}
      {/* ========================================================================= */}
      <section className="overflow-hidden rounded-2xl bg-[#1B1D7D] text-white shadow-[0_18px_40px_-20px_rgba(27,29,125,0.65)]">
        <div className="flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-bold tracking-[0.18em] text-amber-300">
              {kitchenCode} · {cookingDate} · SHIFT 03.30-07.30
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Batch dan label QR
            </h1>
            <p className="mt-2 max-w-lg text-xs leading-relaxed text-white/70">
              Setiap boks mendapat token berformat sistem dan checksum SHA-256 yang dihitung secara kanonikal.
              Lima puluh boks dihimpun dalam satu kontainer master sebelum naik armada ke sekolah binaan.
            </p>
          </div>
          <div className="shrink-0 lg:text-right">
            <p className="text-[11px] font-bold tracking-[0.18em] text-white/60">
              BOKS BERTOKEN / TARGET {targetBoxes.toLocaleString('id-ID')}
            </p>
            <p className="mt-1 text-5xl font-extrabold tabular-nums tracking-tight text-white">
              {totals.boxes.toLocaleString('id-ID')}
            </p>
            <div className="mt-2 h-1.5 w-56 overflow-hidden rounded-full bg-white/15 lg:ml-auto">
              <div
                className="h-full rounded-full bg-amber-400"
                style={{ width: `${Math.min(100, (totals.boxes / targetBoxes) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] font-medium text-white/70">
              {totals.totes} kontainer · {totals.queued} antre cetak · {totals.verified} dari{' '}
              {totals.count} batch lolos uji mandiri
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SLIP 01 & SLIP 02: GENERATE BATCH & THERMAL PRINTER QUEUE */}
      {/* ========================================================================= */}
      <div className="grid gap-5 xl:grid-cols-5">
        <form
          onSubmit={handleGenerate}
          className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-5 text-xs shadow-[0_14px_30px_-22px_rgba(27,29,125,0.4)] xl:col-span-2"
        >
          <div className="pb-1">
            <p className="text-[11px] font-bold tracking-wide text-slate-500">
              SLIP 01 · BATCH BARU
            </p>
            <h2 className="mt-1 text-base font-extrabold tracking-tight text-slate-900">
              Generate QR batch baru
            </h2>
          </div>
          <div aria-hidden="true" className="border-t border-dashed border-slate-300" />
          {formError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-800">
              {formError}
            </p>
          )}
          {formOk && (
            <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-800">
              {formOk}
            </p>
          )}
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block font-semibold text-slate-700">Sekolah sasaran</span>
              <select
                value={form.schoolId}
                onChange={set('schoolId')}
                className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 ${FOCUS}`}
              >
                {availableSchools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.quota || s.active_students || 500} porsi)
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block font-semibold text-slate-700">Paket menu</span>
              <select
                value={form.menuId}
                onChange={set('menuId')}
                className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 ${FOCUS}`}
              >
                {availableMenus.map((m) => (
                  <option key={m.id || m.code} value={m.code || m.id}>
                    {m.code} - {m.name ? m.name.slice(0, 24) + '...' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block font-semibold text-slate-700">Boks lolos uji masak</span>
              <input
                type="number"
                min="1"
                max="2500"
                value={form.boxCount}
                onChange={set('boxCount')}
                placeholder="misal 550"
                className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs tabular-nums text-slate-800 ${FOCUS}`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-semibold text-slate-700">Jam selesai masak</span>
              <input
                type="time"
                value={form.cookedAt}
                onChange={set('cookedAt')}
                className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs tabular-nums text-slate-800 ${FOCUS}`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-semibold text-slate-700">Suhu inti masak (C)</span>
              <input
                type="number"
                step="0.1"
                min="70"
                max="100"
                value={form.cookTemp}
                onChange={set('cookTemp')}
                className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs tabular-nums text-slate-800 ${FOCUS}`}
              />
            </label>
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
              Batas aman konsumsi dihitung otomatis 4 jam setelah masak selesai. Kontrol suhu inti HACCP wajib &gt;= 70°C.
            </div>
          </div>
          <button
            type="submit"
            className={`inline-flex items-center gap-1.5 rounded-xl bg-[#23259C] px-5 py-2.5 text-xs font-bold text-white shadow-[0_10px_20px_-10px_rgba(27,29,125,0.7)] transition hover:bg-[#1b1d7d] active:scale-[0.98] ${FOCUS}`}
          >
            <Plus className="h-4 w-4" />
            Generate batch
          </button>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs shadow-[0_14px_30px_-22px_rgba(27,29,125,0.4)] xl:col-span-3">
          <div className="pb-1">
            <p className="text-[11px] font-bold tracking-wide text-slate-500">
              SLIP 02 · PRINTER THERMAL 80 MM
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-extrabold tracking-tight text-slate-900">
                Antrean cetak label
              </h2>
              <button
                type="button"
                disabled={queue.length === 0}
                onClick={() => setPrintTargets(queue)}
                className={`inline-flex items-center gap-1.5 rounded-xl bg-[#23259C] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#1b1d7d] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 ${FOCUS}`}
              >
                <Printer className="h-4 w-4" />
                Cetak {queue.length} batch
              </button>
            </div>
          </div>
          <div aria-hidden="true" className="my-3 border-t border-dashed border-slate-300" />
          {queue.length === 0 ? (
            <p className="py-6 text-center text-[11px] text-slate-500">
              Antrean kosong. Centang batch di tabel atau pratinjau label untuk mengisi antrean.
              Tombol cetak membuka dialog cetak sistem, pilih printer dapur di sana.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {queue.map((id) => {
                const b = batches.find((x) => x.id === id)
                if (!b) return null
                return (
                  <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="font-mono text-[11px] font-bold text-slate-900">{b.token}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {b.schoolName} · {b.boxCount} boks · {totesFor(b.boxCount).length} tote
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewId(id)}
                        className={`rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 ${FOCUS}`}
                      >
                        Pratinjau
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleQueue(id)}
                        className={`rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 ${FOCUS}`}
                      >
                        Keluarkan
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SLIP 03: REGISTRY SESI HARI INI */}
      {/* ========================================================================= */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_30px_-22px_rgba(27,29,125,0.4)]">
        <div className="px-5 pt-5">
          <p className="text-[11px] font-bold tracking-wide text-slate-500">
            SLIP 03 · REGISTRY SESI HARI INI
          </p>
          <h2 className="mt-1 text-base font-extrabold tracking-tight text-slate-900">
            Daftar batch masak & kontrol suhu HACCP
          </h2>
        </div>
        <div aria-hidden="true" className="mx-5 my-3 border-t border-dashed border-slate-300" />
        {batches.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-slate-500">
            Belum ada batch. Isi form generate di atas untuk membuat batch pertama.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px] text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                <tr>
                  <th scope="col" className="w-10 px-4 py-2.5 text-right">No</th>
                  <th scope="col" className="px-3 py-2.5">Token batch</th>
                  <th scope="col" className="px-3 py-2.5">Sekolah</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Boks</th>
                  <th scope="col" className="px-3 py-2.5 text-right">Tote</th>
                  <th scope="col" className="px-3 py-2.5">Suhu / Jam</th>
                  <th scope="col" className="px-3 py-2.5 text-center">Status</th>
                  <th scope="col" className="px-3 py-2.5 text-center">Uji mandiri</th>
                  <th scope="col" className="px-3 py-2.5 text-center">Aksi & Karantina</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((b, i) => (
                  <tr key={b.id} className="transition hover:bg-[#23259C]/[0.03]">
                    <td className="px-4 py-3 text-right text-[11px] font-semibold tabular-nums text-slate-500">
                      {String(i + 1).padStart(2, '0')}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-mono text-[11px] font-bold text-slate-900">{b.token}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                        SHA {shortHash(b.checksum)}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-slate-800">{b.schoolName}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{b.menuCode}</p>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                      {b.boxCount.toLocaleString('id-ID')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                      {totesFor(b.boxCount).length}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-slate-600">
                      <div>
                        <span className="font-semibold text-slate-800">{b.cookTemp}°C</span>
                        <span className="text-[10px] text-emerald-600 ml-1 font-bold">HACCP</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {b.cookedAt} - {b.consumeBy} WIB
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <StatusPill status={b.status} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {b.verified ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                          <Check className="h-3 w-3" /> Lolos
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500">Belum</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewId(b.id)}
                          className={`rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 ${FOCUS}`}
                        >
                          Label
                        </button>

                        {b.status !== 'quarantined' && (
                          <button
                            type="button"
                            onClick={() => toggleQueue(b.id)}
                            aria-pressed={queue.includes(b.id)}
                            className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${FOCUS} ${
                              queue.includes(b.id)
                                ? 'border-[#23259C]/30 bg-[#23259C]/10 text-[#23259C]'
                                : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {queue.includes(b.id) ? 'Di antrean' : 'Antrekan'}
                          </button>
                        )}

                        {b.status === 'draft' && (
                          <button
                            type="button"
                            onClick={() => setBatchToDelete(b)}
                            className={`rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 ${FOCUS}`}
                            title="Hapus batch draf"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Tombol Intervensi Karantina Keamanan Pangan bagi Superadmin */}
                        {isSuperadmin && b.status !== 'quarantined' && (
                          <button
                            type="button"
                            onClick={() => {
                              setQuarantineModalBatch(b)
                              setQuarantineReason('')
                              setQuarantineError('')
                            }}
                            className={`rounded-lg border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100 ${FOCUS}`}
                            title="Tindakan Superadmin: Karantina / Tarik Batch Darurat"
                          >
                            <ShieldAlert className="inline mr-1 h-3 w-3 text-rose-600" />
                            Karantina
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SLIP 04 & SLIP 05: KONTAINER MASTER & UJI MANDIRI TOKEN QR */}
      {/* ========================================================================= */}
      <div className="grid gap-5 xl:grid-cols-5">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_30px_-22px_rgba(27,29,125,0.4)] xl:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
            <div>
              <p className="text-[11px] font-bold tracking-wide text-slate-500">
                SLIP 04 · 50 BOKS PER TOTE
              </p>
              <h2 className="mt-1 text-base font-extrabold tracking-tight text-slate-900">
                Kontainer master
              </h2>
            </div>
            <select
              value={toteBatch ? toteBatch.id : ''}
              onChange={(e) => setToteBatchId(e.target.value)}
              aria-label="Pilih batch untuk melihat kontainer"
              className={`rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 ${FOCUS}`}
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.token}
                </option>
              ))}
            </select>
          </div>
          <div aria-hidden="true" className="mx-5 my-3 border-t border-dashed border-slate-300" />
          {!toteBatch ? (
            <p className="px-5 py-6 text-center text-[11px] text-slate-500">Belum ada batch.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                  <tr>
                    <th scope="col" className="px-5 py-2.5">Tote</th>
                    <th scope="col" className="px-3 py-2.5">Token master</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Isi</th>
                    <th scope="col" className="px-3 py-2.5 text-center">Status</th>
                    <th scope="col" className="px-3 py-2.5 text-center">QR</th>
                    <th scope="col" className="px-5 py-2.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {totesFor(toteBatch.boxCount).map((t) => {
                    const master = buildMasterToken(toteBatch.schoolCode, toteBatch.seq, t.index)
                    const full = t.boxes === TOTE_CAPACITY
                    return (
                      <tr key={t.index} className="transition hover:bg-[#23259C]/[0.03]">
                        <td className="px-5 py-2.5 font-mono text-[11px] font-bold tabular-nums text-slate-900">
                          M{String(t.index).padStart(2, '0')}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px] font-bold text-slate-900">
                          {master}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                          {t.boxes}
                          <span className="font-normal text-slate-500">/{TOTE_CAPACITY}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                              full ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'
                            }`}
                          >
                            {full ? 'Penuh' : 'Parsial'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-center">
                            <QRCodeSVG
                              value={master}
                              size={48}
                              level="M"
                              role="img"
                              aria-label={`QR kontainer ${t.index} batch ${toteBatch.token}`}
                            />
                          </div>
                        </td>
                        <td className="px-5 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(master)
                                setCopiedToken(master)
                              } catch {
                                setCopiedToken('')
                              }
                            }}
                            className={`rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-[0.97] ${FOCUS}`}
                          >
                            {copiedToken === master ? 'Disalin' : 'Salin'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSelfCheck}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-xs shadow-[0_14px_30px_-22px_rgba(27,29,125,0.4)] xl:col-span-2"
        >
          <div className="pb-1">
            <p className="text-[11px] font-bold tracking-wide text-slate-500">
              SLIP 05 · GATE TERAKHIR
            </p>
            <h2 className="mt-1 text-base font-extrabold tracking-tight text-slate-900">
              Uji mandiri sebelum naik armada
            </h2>
          </div>
          <div aria-hidden="true" className="border-t border-dashed border-slate-300" />
          <p className="text-[11px] leading-relaxed text-slate-500">
            Pindai dengan scanner dapur atau ketik token. Sistem memeriksa token terdaftar dan
            menghitung ulang checksumnya secara SHA-256. Batch yang lolos ditandai otomatis.
          </p>
          <label className="block">
            <span className="mb-1 block font-semibold text-slate-700">Token QR boks atau master</span>
            <input
              type="text"
              value={checkToken}
              onChange={(e) => {
                setCheckToken(e.target.value)
                setCheckResult(null)
              }}
              placeholder="MBG-2026-SPPG01-..."
              autoComplete="off"
              spellCheck={false}
              className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-800 ${FOCUS}`}
            />
          </label>
          <button
            type="submit"
            className={`inline-flex items-center gap-1.5 rounded-xl bg-[#23259C] px-5 py-2.5 text-xs font-bold text-white shadow-[0_10px_20px_-10px_rgba(27,29,125,0.7)] transition hover:bg-[#1b1d7d] active:scale-[0.98] ${FOCUS}`}
          >
            <Search className="h-4 w-4" />
            Verifikasi token
          </button>
          {checkResult && (
            <p
              role={checkResult.ok ? 'status' : 'alert'}
              className={`rounded-lg border px-3 py-2 text-[11px] font-medium ${
                checkResult.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {checkResult.message}
            </p>
          )}
          {!hashReady && (
            <p className="text-[11px] text-slate-500">Menghubungkan ke server dapur, tunggu sebentar...</p>
          )}
        </form>
      </div>

      {/* ========================================================================= */}
      {/* THERMAL LABEL PREVIEW MODAL */}
      {/* ========================================================================= */}
      {previewBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Pratinjau label ${previewBatch.token}`}
            className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-1">
              <div>
                <p className="text-[11px] font-bold tracking-wide text-slate-500">
                  HASIL CETAK · LEBAR 80 MM
                </p>
                <h2 className="mt-1 text-base font-extrabold tracking-tight text-slate-900">
                  Pratinjau label termal
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewId(null)}
                aria-label="Tutup pratinjau"
                className={`rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 ${FOCUS}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div aria-hidden="true" className="my-3 border-t border-dashed border-slate-300" />
            <div className="grid gap-5 md:grid-cols-2">
              <div className="mx-auto w-[76mm] border border-dashed border-slate-300 bg-white p-3 text-center text-black">
                <p className="text-[11px] font-bold tracking-wide">BGN · KAWANGIZI</p>
                <p className="text-[11px]">{kitchenCode} · {kitchenName}</p>
                <div className="my-2 flex justify-center">
                  <QRCodeSVG value={previewBatch.token} size={160} level="H" role="img" aria-label={`QR ${previewBatch.token}`} />
                </div>
                <p className="font-mono text-[11px] font-bold">{previewBatch.token}</p>
                <p className="mt-1 text-[12px] font-bold">{previewBatch.schoolName}</p>
                <p className="text-[11px]">{previewBatch.menuName}</p>
                <p className="mt-1.5 text-[13px] font-bold">
                  Masak {previewBatch.cookedAt} · Habis {previewBatch.consumeBy} WIB
                </p>
                <p className="text-[11px]">
                  Suhu {previewBatch.cookTemp}°C (HACCP) · Alergen:{' '}
                  {previewBatch.allergens && previewBatch.allergens.length > 0
                    ? previewBatch.allergens.join(', ')
                    : 'tidak ada'}
                </p>
                <p className="mt-1 font-mono text-[11px]">SHA {shortHash(previewBatch.checksum)}</p>
              </div>
              <div className="space-y-2 text-xs text-slate-600">
                <p className="flex items-start gap-1.5">
                  <Thermometer className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                  Suhu inti {previewBatch.cookTemp}°C dicatat dari probe dapur saat batch dikunci memenuhi HACCP.
                </p>
                <p className="flex items-start gap-1.5">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                  Batas konsumsi {previewBatch.consumeBy} WIB, 4 jam setelah masak selesai.
                </p>
                <p className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                  Alergen tercetak di setiap label supaya guru validator memeriksanya saat tiba.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!queue.includes(previewBatch.id)) toggleQueue(previewBatch.id)
                      setPrintTargets([previewBatch.id])
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-xl bg-[#23259C] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#1b1d7d] ${FOCUS}`}
                  >
                    <Printer className="h-4 w-4" />
                    Cetak label ini
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewId(null)}
                    className={`rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 ${FOCUS}`}
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUPERADMIN QUARANTINE / RECALL MODAL */}
      {/* ========================================================================= */}
      {quarantineModalBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Karantina Batch Masak"
            className="w-full max-w-lg rounded-2xl border border-rose-300 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-rose-100">
              <div className="flex items-center gap-2 text-rose-700">
                <ShieldAlert className="h-5 w-5" />
                <h3 className="text-base font-extrabold tracking-tight">
                  Karantina / Tarik Batch Darurat
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setQuarantineModalBatch(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleQuarantineSubmit} className="mt-4 space-y-4 text-xs">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-900">
                <p className="font-bold">Perhatian Keamanan Pangan Nasional:</p>
                <p className="mt-1 text-[11px] leading-relaxed">
                  Tindakan ini akan mengunci status batch menjadi <strong>DIKARANTINA</strong>,
                  menghentikan distribusi ke sekolah sasaran, dan mencatat entitas forensik permanen
                  pada <code>audit_logs</code>.
                </p>
                <div className="mt-2 text-[11px]">
                  <div>Token: <span className="font-mono font-bold">{quarantineModalBatch.token}</span></div>
                  <div>Sekolah: <span className="font-semibold">{quarantineModalBatch.schoolName}</span> ({quarantineModalBatch.boxCount} boks)</div>
                  <div>Suhu Terakhir: <span className="font-semibold">{quarantineModalBatch.cookTemp}°C</span></div>
                </div>
              </div>

              {quarantineError && (
                <p role="alert" className="rounded-lg border border-rose-300 bg-rose-100 px-3 py-2 text-[11px] font-bold text-rose-800">
                  {quarantineError}
                </p>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alasan Karantina / Temuan Bahaya HACCP:
                </label>
                <textarea
                  rows="3"
                  value={quarantineReason}
                  onChange={(e) => setQuarantineReason(e.target.value)}
                  placeholder="Contoh: Suhu drop di bawah batas aman / anomali organoleptik / kontaminasi silang kemasan..."
                  className={`w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 ${FOCUS}`}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuarantineModalBatch(null)}
                  disabled={isSubmittingQuarantine}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuarantine}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 font-bold text-white shadow-md hover:bg-rose-700 disabled:bg-slate-300"
                >
                  <AlertOctagon className="h-4 w-4" />
                  {isSubmittingQuarantine ? 'Memproses...' : 'Eksekusi Karantina BGN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* THERMAL 80MM SHEET PRINTING TARGET (ONLY VISIBLE ON PRINT) */}
      {/* ========================================================================= */}
      <div className="batch-print-sheet" aria-hidden="true">
        {printBatches.map((b) => (
          <div
            key={b.id}
            style={{ width: '76mm', pageBreakAfter: 'always', color: '#000', background: '#fff', textAlign: 'center', padding: '8px 4px' }}
          >
            <p style={{ fontSize: 11, fontWeight: 700 }}>BGN · KAWANGIZI</p>
            <p style={{ fontSize: 10 }}>{kitchenCode} · {kitchenName}</p>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
              <QRCodeSVG value={b.token} size={200} level="H" />
            </div>
            <p style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700 }}>{b.token}</p>
            <p style={{ fontSize: 13, fontWeight: 700 }}>{b.schoolName}</p>
            <p style={{ fontSize: 11 }}>{b.menuName}</p>
            <p style={{ fontSize: 14, fontWeight: 700 }}>
              Masak {b.cookedAt} · Habis {b.consumeBy} WIB
            </p>
            <p style={{ fontSize: 10 }}>
              Suhu {b.cookTemp}°C · Alergen: {b.allergens && b.allergens.length > 0 ? b.allergens.join(', ') : 'tidak ada'}
            </p>
            <p style={{ fontFamily: 'monospace', fontSize: 9 }}>SHA {shortHash(b.checksum)}</p>
          </div>
        ))}
      </div>

      {/* Modal Konfirmasi Hapus Batch Draf */}
      {batchToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi hapus batch"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setBatchToDelete(null)}
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
                <h3 className="text-base font-extrabold text-slate-900">Hapus Batch Draf</h3>
                <p className="text-xs text-slate-600 leading-relaxed mt-1">
                  Batch masak berstatus draf ini akan dibatalkan dan dihapus permanen dari sistem.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-3 text-xs text-slate-700 space-y-1">
              <p className="font-bold text-slate-900">{batchToDelete.code} &bull; {batchToDelete.menuName}</p>
              <p className="text-[11px] text-slate-500 font-mono">
                Porsi: {batchToDelete.portionTarget} boks &bull; Sekolah: {batchToDelete.schoolName}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setBatchToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Batalkan
              </button>
              <button
                type="button"
                onClick={async () => {
                  const bId = batchToDelete.id
                  setBatchToDelete(null)
                  await removeBatch(bId)
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition shadow-sm cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span>Hapus Batch</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
