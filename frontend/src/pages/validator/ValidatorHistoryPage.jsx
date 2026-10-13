import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  History,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Users,
  Download,
  PackageCheck,
  RefreshCw,
  Building2,
  Clock,
  ShieldCheck,
  Flame,
  FileSpreadsheet,
  CheckCircle,
  FileCheck,
  Utensils,
} from 'lucide-react'
import { ValidatorLayout } from '../../components/layout/ValidatorLayout'
import { useAuth } from '../../context/AuthContext'
import { guardAdminAction } from '../../lib/adminActions'
import {
  SURPLUS_OPTIONS,
  HISTORY_FILTERS,
} from '../../data/validatorData'
import {
  fetchValidatorHistoryBundle,
  allocateValidatorSurplus,
} from '../../lib/api'

/**
 * ==============================================================================
 * PORTAL VALIDATOR: RIWAYAT PINDAI & PRESENSI MAKAN (REKONSILIASI RESMI BGN)
 * URL: /validator/history
 * VALIDATOR.md Bab 5: log pindai harian, rekonsiliasi distribusi kelas,
 * pengelolaan porsi sisa terverifikasi database, filter & pencarian, ekspor resmi.
 * ==============================================================================
 */

const STATUS_ICON = {
  verified: { Icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-600' },
  warning: { Icon: AlertTriangle, cls: 'bg-amber-50 text-amber-600' },
  rejected: { Icon: XCircle, cls: 'bg-rose-50 text-rose-600' },
}

export function ValidatorHistoryPage() {
  const { user } = useAuth()

  // State Data dari Backend
  const [bundle, setBundle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedNPSN, setSelectedNPSN] = useState('')

  // State Filter & Pencarian
  const [filter, setFilter] = useState('today')
  const [query, setQuery] = useState('')
  const [surplusSelections, setSurplusSelections] = useState({})
  const [savingSurplusClass, setSavingSurplusClass] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (message, tone = 'info') => {
    setToast({ message, tone })
    setTimeout(() => setToast(null), 4500)
  }

  const tones = {
    info: 'border-amber-200 bg-amber-50 text-amber-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900',
  }

  // Load Data dari API Backend
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)

    try {
      const data = await fetchValidatorHistoryBundle({
        npsn: selectedNPSN || undefined,
        limit: 100,
      })
      if (data) {
        setBundle(data)
        if (data.surplusSelections) {
          setSurplusSelections(data.surplusSelections)
        }
      }
    } catch (err) {
      console.error('Gagal memuat bundel riwayat rekonsiliasi:', err)
      showToast('Koneksi backend lambat, menggunakan data sementara.', 'info')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedNPSN])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Transformasi scan logs dari database
  const scanRows = useMemo(() => {
    return bundle?.scans || []
  }, [bundle])

  const scans = useMemo(() => {
    const q = query.trim().toLowerCase()
    const now = new Date()
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startYesterday = new Date(startToday)
    startYesterday.setDate(startYesterday.getDate() - 1)
    const startWeek = new Date(startToday)
    startWeek.setDate(startWeek.getDate() - 6)

    return scanRows
      .map((row) => {
        const created = new Date(row.createdAt)
        const isReject = row.verdict === 'tolak'
        const isWarn = row.verdict === 'peringatan'
        const status = isReject ? 'rejected' : isWarn ? 'warning' : 'verified'

        let statusLabel = 'Lolos Verifikasi SOP'
        if (status === 'rejected') {
          statusLabel = 'Ditahan untuk pemeriksaan'
        } else if (status === 'warning') {
          statusLabel = 'Perlu verifikasi petugas'
        }

        return {
          ...row,
          time: created.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
          classTarget: row.menuName || 'Nasi & Lauk MBG',
          temp: row.holdingTempC != null ? row.holdingTempC : (row.releaseTempC != null ? row.releaseTempC : null),
          score: row.aiConfidence != null ? Math.round(row.aiConfidence * 100) : (row.visualScore != null ? Math.round(row.visualScore) : null),
          status,
          statusLabel,
          created,
        }
      })
      .filter((row) => {
        const day = new Date(row.created.getFullYear(), row.created.getMonth(), row.created.getDate())
        const matchesFilter =
          filter === 'today'
            ? day >= startToday
            : filter === 'yesterday'
            ? day >= startYesterday && day < startToday
            : filter === '7d'
            ? day >= startWeek
            : row.created.getMonth() === now.getMonth() && row.created.getFullYear() === now.getFullYear()

        const matchesQuery =
          !q ||
          [row.boxId, row.batchId, row.qrToken, row.statusLabel, row.classTarget, row.menuName].some((value) =>
            String(value || '').toLowerCase().includes(q),
          )

        return matchesFilter && matchesQuery
      })
  }, [filter, query, scanRows])

  // Rekapitulasi Kelas & Porsi Sisa
  const classRecap = useMemo(() => {
    return bundle?.classRecap || []
  }, [bundle])

  const totals = useMemo(() => {
    if (bundle?.totals && bundle.totals.quota > 0) {
      return bundle.totals
    }
    const quota = classRecap.reduce((s, c) => s + c.quota, 0)
    const present = classRecap.reduce((s, c) => s + c.present, 0)
    const handed = classRecap.reduce((s, c) => s + c.handed, 0)
    const leftover = classRecap.reduce((s, c) => s + c.leftover, 0)
    const today = new Date().toDateString()
    const todayRows = scanRows.filter((row) => new Date(row.createdAt).toDateString() === today)
    const needsReview = todayRows.filter((row) => row.verdict === 'peringatan' || row.verdict === 'tolak').length
    const reviewRate = todayRows.length ? Math.round((needsReview / todayRows.length) * 100) : 0
    const attendancePct = quota > 0 ? (present / quota) * 100 : 100
    return { quota, present, handed, leftover, boxesScanned: todayRows.length, reviewRate, attendancePct }
  }, [bundle, classRecap, scanRows])

  // Handler Alokasi Porsi Sisa ke Server Backend
  const handleSetSurplus = async (className, optionId, leftoverPortions) => {
    const res = guardAdminAction(
      user,
      'ValidatorHistory',
      'alokasikan porsi sisa',
      { className, option: optionId },
      ['attendance.read'],
    )
    if (!res.allowed) {
      showToast(res.message, 'error')
      return
    }

    setSavingSurplusClass(className)
    try {
      const payload = {
        npsn: bundle?.school?.npsn || '33.210.130',
        className,
        option: optionId,
        leftoverPortions: leftoverPortions || 1,
        notes: `Alokasi porsi sisa ${className} via portal validator`,
      }

      const result = await allocateValidatorSurplus(payload)

      if (result) {
        setSurplusSelections((prev) => ({ ...prev, [className]: optionId }))
        const opt = SURPLUS_OPTIONS.find((o) => o.id === optionId)
        showToast(result.message || `Porsi sisa ${className} dialokasikan: ${opt?.label}.`, 'success')
      } else {
        throw new Error('Respon alokasi tidak valid')
      }
    } catch (err) {
      console.error('Gagal alokasi sisa:', err)
      showToast('Gagal menyimpan alokasi: ' + (err.message || 'Kesalahan jaringan'), 'error')
    } finally {
      setSavingSurplusClass(null)
    }
  }

  // Ekspor Laporan Rekonsiliasi Harian
  const exportReport = () => {
    const res = guardAdminAction(
      user,
      'ValidatorHistory',
      'ekspor laporan harian (PDF/CSV)',
      { date: bundle?.date || '2026-10-08', classes: classRecap.length },
      ['attendance.read'],
    )
    if (!res.allowed) {
      showToast(res.message, 'error')
      return
    }

    try {
      const reportData = {
        metadata: {
          title: 'BERITA ACARA REKONSILIASI HARIAN DISTRIBUSI MAKANAN BERGIZI GRATIS (MBG)',
          schoolName: bundle?.school?.name || 'SDN 01 Menteng Pagi',
          schoolNpsn: bundle?.school?.npsn || '33.210.130',
          sppgName: bundle?.parentSppg?.name || 'Dapur Sentral SPPG-01 Menteng',
          sppgCode: bundle?.parentSppg?.code || 'BGN-SPPG-001',
          activeBatch: bundle?.activeBatch || 'MBG-2026-SPPG01-SDN01P-B01',
          date: bundle?.date || new Date().toISOString().split('T')[0],
          exportedAt: new Date().toISOString(),
          validatorName: user?.fullName || 'Petugas Validator Lapangan',
        },
        totals,
        classRecap: classRecap.map((c) => ({
          ...c,
          allocatedOption: surplusSelections[c.className] || c.surplusOption || 'Belum dialokasikan',
        })),
        recentScansCount: scans.length,
      }

      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `BA_Rekonsiliasi_MBG_${bundle?.school?.npsn || '33210130'}_${bundle?.date || '20261008'}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      showToast('Laporan harian sekolah berhasil diekspor (Format JSON Resmi BGN).', 'success')
    } catch (err) {
      console.error('Ekspor laporan gagal:', err)
      showToast('Gagal mengekspor laporan: ' + err.message, 'error')
    }
  }

  return (
    <ValidatorLayout activeMenu="history" title="Riwayat & Presensi Makan" badge="REKONSILIASI HARIAN">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-xs animate-in fade-in transition shadow-sm ${tones[toast.tone]}`}
        >
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" />
          <p className="leading-relaxed font-semibold flex-1">{toast.message}</p>
        </div>
      )}

      {/* Header Context Bar */}
      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <ShieldCheck className="h-3 w-3 text-amber-400" />
                Papan Rekonsiliasi Distribusi & Mutu
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-slate-300 border border-white/10">
                <Clock className="h-3 w-3 text-emerald-400" />
                Golden Window: Aman Hingga {bundle?.goldenWindow?.safeUntil || '10:30 WIB'}
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-extrabold tracking-tight">
              {bundle?.school?.name || 'SDN 01 Menteng Pagi'}
              <span className="ml-2 font-mono text-xs font-normal text-slate-400">
                (NPSN: {bundle?.school?.npsn || '33.210.130'})
              </span>
            </h1>
            <p className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
              <span>Dapur Induk: <strong>{bundle?.parentSppg?.name || 'Dapur Sentral SPPG-01 Menteng'}</strong></span>
              <span className="text-slate-500">·</span>
              <span className="font-mono text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 text-[11px]">
                Batch: {bundle?.activeBatch || 'MBG-2026-SPPG01-SDN01P-B01'}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300">Tanggal: <strong>{bundle?.date || '2026-10-08'}</strong></span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            {/* Superadmin School Switcher */}
            {user?.role === 'superadmin' && bundle?.availableSchools?.length > 0 && (
              <select
                aria-label="Pilih sekolah untuk pantauan riwayat"
                value={selectedNPSN}
                onChange={(e) => setSelectedNPSN(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                <option value="">Semua Sekolah / Default</option>
                {bundle.availableSchools.map((s) => (
                  <option key={s.npsn} value={s.npsn}>
                    {s.name} ({s.npsn})
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-2 text-xs font-bold transition text-white cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Menyinkronkan...' : 'Segarkan Data'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4 Kartu Ringkasan Eksekutif */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            label: 'Hasil Scan Hari Ini',
            value: totals.boxesScanned,
            sub: `${totals.reviewRate}% perlu verifikasi manual`,
            tone: 'text-slate-900',
            bgIcon: 'bg-indigo-50 text-indigo-600',
            icon: Utensils,
          },
          {
            label: 'Siswa Hadir',
            value: totals.present,
            sub: `dari ${totals.quota} terdaftar (${typeof totals.attendancePct === 'number' ? totals.attendancePct.toFixed(1) : '97.5'}%)`,
            tone: 'text-emerald-700',
            bgIcon: 'bg-emerald-50 text-emerald-600',
            icon: Users,
          },
          {
            label: 'Porsi Diserahkan',
            value: totals.handed,
            sub: 'sesuai presensi kelas & BAST',
            tone: 'text-emerald-700',
            bgIcon: 'bg-emerald-50 text-emerald-600',
            icon: CheckCircle2,
          },
          {
            label: 'Porsi Sisa Terdata',
            value: totals.leftover,
            sub: 'perlu alokasi resmi regulasi BGN',
            tone: 'text-amber-600',
            bgIcon: 'bg-amber-50 text-amber-600',
            icon: Flame,
          },
        ].map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.label}</p>
                <span className={`p-1.5 rounded-lg ${s.bgIcon}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className={`text-xl font-extrabold mt-1 font-mono ${s.tone}`}>{s.value}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{s.sub}</p>
            </div>
          )
        })}
      </section>

      {/* Filter + Pencarian + Ekspor */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1 w-fit overflow-x-auto">
          {HISTORY_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`text-xs font-bold px-3.5 py-2 rounded-lg transition whitespace-nowrap cursor-pointer ${
                filter === f.id ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari ID boks, batch, atau menu..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
          />
        </div>
        <button
          type="button"
          onClick={exportReport}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2.5 text-xs font-bold transition shadow-xs cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Ekspor Laporan (BGN JSON)</span>
        </button>
      </section>

      {/* Log Pindai Hasil Classifier AI */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <History className="h-4 w-4 text-amber-600" />
              Buku Log Hasil Classifier & Verifikasi Suhu
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Catatan pemindaian digital boks makanan, sensor suhu infrared, dan probabilitas mutu hidangan.
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            {scans.length} catatan
          </span>
        </div>

        {scans.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <History className="h-9 w-9 mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-600">Tidak ada catatan scan yang cocok</p>
            <p className="mt-1 text-xs text-slate-400">Coba ubah kata kunci atau rentang tanggal di filter atas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Waktu', 'Boks / Batch Token', 'Komponen Hidangan', 'Suhu Suap', 'Skor Model', 'Status Kelayakan'].map((h) => (
                    <th
                      key={h}
                      className="py-2.5 pr-3 text-[10px] font-bold uppercase tracking-wide text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scans.map((s) => {
                  const { Icon, cls } = STATUS_ICON[s.status] || STATUS_ICON.verified
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 pr-3 font-mono text-xs font-bold text-slate-700">{s.time}</td>
                      <td className="py-2.5 pr-3">
                        <p className="font-mono text-xs font-bold text-slate-800">{s.boxId || 'BOK-MBG'}</p>
                        <p className="font-mono text-[10px] text-slate-400 truncate max-w-[180px]">
                          {s.qrToken || s.batchId || bundle?.activeBatch || 'MBG-2026-B01'}
                        </p>
                      </td>
                      <td className="py-2.5 pr-3">
                        <p className="text-xs font-semibold text-slate-700">{s.classTarget}</p>
                        {s.reason && (
                          <p className="text-[10px] text-slate-400 truncate max-w-[200px]" title={s.reason}>
                            {s.reason}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs font-bold">
                        {s.temp != null ? (
                          <span className={s.temp >= 60 ? 'text-emerald-700' : 'text-rose-600'}>
                            {s.temp.toFixed(1)}°C
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-slate-600">
                        {s.score != null ? `${s.score}%` : '—'}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold">
                          <span className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 ${cls}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span
                            className={
                              s.status === 'rejected'
                                ? 'text-rose-600'
                                : s.status === 'warning'
                                ? 'text-amber-600'
                                : 'text-emerald-700'
                            }
                          >
                            {s.statusLabel}
                          </span>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Papan Rekonsiliasi Distribusi Kelas & Porsi Sisa */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-600" />
              Papan Rekonsiliasi Distribusi Kelas & Alokasi Porsi Sisa
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Data terhubung langsung dengan buku presensi digital dan tercatat permanen di database BGN.
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            {classRecap.length} kelas aktif
          </span>
        </div>

        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-200">
                {['Kelas', 'Kuota Terdaftar', 'Hadir', 'Sakit/Izin', 'Porsi Diserahkan', 'Sisa', 'Alokasi Porsi Sisa (Regulasi BGN)'].map(
                  (h) => (
                    <th
                      key={h}
                      className="py-2.5 pr-3 text-[10px] font-bold uppercase tracking-wide text-slate-400"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classRecap.map((c) => {
                const currentOpt = surplusSelections[c.className] || c.surplusOption || ''
                const isSaving = savingSurplusClass === c.className
                return (
                  <tr key={c.className} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 pr-3 text-xs font-extrabold text-slate-800">{c.className}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-600">{c.quota}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs font-bold text-slate-700">{c.present}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">
                      {c.sick} / {c.permit}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs font-bold text-emerald-700">{c.handed}</td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`font-mono text-xs font-extrabold px-2 py-0.5 rounded ${
                          c.leftover > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {c.leftover}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      {c.leftover > 0 ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={currentOpt}
                            disabled={isSaving}
                            onChange={(e) => handleSetSurplus(c.className, e.target.value, c.leftover)}
                            className={`text-[11px] font-semibold rounded-lg border px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer max-w-[260px] transition ${
                              currentOpt
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-900 font-bold'
                                : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <option value="">Pilih alokasi resmi…</option>
                            {SURPLUS_OPTIONS.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          {isSaving && (
                            <RefreshCw className="h-3.5 w-3.5 text-amber-600 animate-spin shrink-0" />
                          )}
                          {currentOpt && !isSaving && (
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                          <PackageCheck className="h-3.5 w-3.5" />
                          Nol Porsi Sisa
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                <td className="py-2.5 pr-3 text-[11px] font-extrabold text-slate-800">Total Keseluruhan</td>
                <td className="py-2.5 pr-3 font-mono text-xs font-extrabold text-slate-900">{totals.quota}</td>
                <td className="py-2.5 pr-3 font-mono text-xs font-extrabold text-slate-900">{totals.present}</td>
                <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">
                  {classRecap.reduce((s, c) => s + c.sick, 0)} / {classRecap.reduce((s, c) => s + c.permit, 0)}
                </td>
                <td className="py-2.5 pr-3 font-mono text-xs font-extrabold text-emerald-700">
                  {totals.handed}
                </td>
                <td className="py-2.5 pr-3 font-mono text-xs font-extrabold text-amber-600">
                  {totals.leftover}
                </td>
                <td className="py-2.5 pr-3">
                  <span className="text-[10px] font-bold text-slate-500">
                    {Object.keys(surplusSelections).length} dari{' '}
                    {classRecap.filter((c) => c.leftover > 0).length} kelas bersisa telah dialokasikan
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Regulasi BGN Callout */}
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4 space-y-1.5 text-[11px] text-amber-900 leading-relaxed">
          <p className="font-bold flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-amber-700" />
            Ketentuan Alokasi Porsi Sisa Sesuai Pedoman Mutu BGN (Bab 5.B.3):
          </p>
          <ul className="list-disc pl-5 space-y-0.5 text-amber-800">
            <li>Porsi sisa utuh wajib dialokasikan resmi dalam masa <strong>Golden Window</strong> (maksimum 4 jam pasca masak).</li>
            <li>Alokasi dapat diserahkan kepada staf kebersihan/penjaga sekolah, program sore hari, atau panti asuhan mitra.</li>
            <li>Porsi yang rusak fisik atau tercemar dilarang keras dibagikan dan wajib dicatat pemusnahannya.</li>
          </ul>
        </div>
      </section>
    </ValidatorLayout>
  )
}

export default ValidatorHistoryPage
