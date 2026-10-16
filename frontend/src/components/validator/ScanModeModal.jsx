import { useEffect, useState } from 'react'
import { ShieldCheck, Salad, X, Camera, Sparkles, Upload, ArrowLeft } from 'lucide-react'
import { SCAN_MODES, SCAN_SOURCES } from '../../lib/scanMode'

/**
 * Modal dua langkah sebelum pemindaian dimulai.
 *
 * Langkah 1 — mode analisis. Kedua mode memakai satu kali inferensi yang sama
 * (deteksi objek + klasifikasi kesegaran), yang dibedakan hanya laporan keluaran:
 *   - kelayakan: status aman/tidak layak, skor kesegaran, tanda visual
 *   - nutrisi   : estimasi porsi dan makronutrisi dari dataset gizi
 *
 * Langkah 2 — sumber gambar (kamera atau upload). Dipisah supaya kotak utama
 * tidak dipenuhi tombol pintasan, dan pengguna membaca mode yang dipilih dulu
 * sebelum mengambil foto.
 */


const MODE_OPTIONS = [
  {
    id: SCAN_MODES.KELAYAKAN,
    icon: ShieldCheck,
    title: 'Scanning Kelayakan',
    tagline: 'Cek keamanan & kesegaran',
    description:
      'Menganalisis tanda pembusukan, jamur, dan perubahan warna, lalu menilai apakah makanan aman disajikan ke siswa.',
    bullets: ['Status layak / waspa / tidak layak', 'Skor kesegaran 1-100', 'Rekomendasi tindakan'],
    accent: 'emerald',
  },
  {
    id: SCAN_MODES.NUTRISI,
    icon: Salad,
    title: 'Scanning Makronutrisi',
    tagline: 'Hitung gizi per porsi',
    description:
      'Menghitung kalori, protein, karbohidrat, lemak, dan serat per porsi dari komposisi bahan pada resep batch.',
    bullets: ['Estimasi berat porsi', 'Rincian bahan per komponen', 'Kalori, protein, karbohidrat, lemak, serat'],
    accent: 'amber',
  },
]

const SOURCE_OPTIONS = [
  {
    id: SCAN_SOURCES.CAMERA,
    icon: Camera,
    title: 'Nyalakan Kamera',
    description: 'Ambil foto langsung memakai kamera, otomatis memakai kamera belakang di HP.',
  },
  {
    id: SCAN_SOURCES.UPLOAD,
    icon: Upload,
    title: 'Upload Gambar',
    description: 'Pilih foto nampan dari galeri atau berkas yang sudah ada di perangkat.',
  },
]

const ACCENT = {
  emerald: {
    cardBg: 'bg-[#ebf7f0] hover:bg-[#def1e5]',
    cardBorder: 'border-emerald-300 hover:border-emerald-500',
    iconBg: 'bg-[#185338]',
    iconText: 'text-white',
    badge: 'bg-emerald-600 text-white',
    bulletIcon: 'text-emerald-700',
    ctaText: 'text-[#185338] group-hover:text-emerald-950',
    header: 'bg-[#123624]',
    headerText: 'text-emerald-300',
  },
  amber: {
    cardBg: 'bg-[#fef5e7] hover:bg-[#fdeed6]',
    cardBorder: 'border-amber-300 hover:border-amber-500',
    iconBg: 'bg-amber-600',
    iconText: 'text-white',
    badge: 'bg-amber-600 text-white',
    bulletIcon: 'text-amber-700',
    ctaText: 'text-amber-800 group-hover:text-amber-950',
    header: 'bg-amber-600',
    headerText: 'text-amber-100',
  },
}

export function ScanModeModal({ open, onSelect, onClose, busy = false }) {
  const [step, setStep] = useState('mode')
  const [mode, setMode] = useState(SCAN_MODES.KELAYAKAN)
  const [wasOpen, setWasOpen] = useState(open)

  // Mulai lagi dari langkah mode setiap kali modal dibuka. Penyesuaian saat
  // render (bukan useEffect) supaya tidak memicu render kedua.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setStep('mode')
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  const active = MODE_OPTIONS.find((o) => o.id === mode) || MODE_OPTIONS[0]
  const activeAccent = ACCENT[active.accent]

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-mode-title"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4">
          <div className="flex items-center gap-2.5">
            {step === 'source' ? (
              <button
                type="button"
                onClick={() => setStep('mode')}
                disabled={busy}
                aria-label="Kembali ke pilihan mode"
                className="rounded-xl bg-slate-200 p-2 text-slate-700 transition hover:bg-slate-300 disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : (
              <div className="rounded-xl bg-[#123624] p-2 text-emerald-300">
                <Camera className="h-5 w-5" />
              </div>
            )}
            <div>
              <h2 id="scan-mode-title" className="text-sm font-extrabold tracking-tight text-slate-900">
                {step === 'mode' ? 'Pilih Jenis Pemindaian' : 'Pilih Sumber Gambar'}
              </h2>
              <p className="text-[11px] text-slate-500">
                {step === 'mode'
                  ? 'Tentukan fokus analisis sebelum foto dipindai.'
                  : 'Mode dipilih: Scanning ' + (mode === SCAN_MODES.NUTRISI ? 'Makronutrisi' : 'Kelayakan')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Tutup"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 'mode' ? (
          <>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {MODE_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const a = ACCENT[opt.accent]
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setMode(opt.id)
                      setStep('source')
                    }}
                    className={`group relative flex flex-col items-start gap-2.5 rounded-2xl border-2 p-4 text-left transition-all duration-200 cursor-pointer active:scale-[0.98] disabled:opacity-50 shadow-2xs hover:shadow-md ${a.cardBg} ${a.cardBorder}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`rounded-xl p-2.5 shadow-xs transition-transform group-hover:scale-105 ${a.iconBg} ${a.iconText}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold shadow-2xs ${a.badge}`}>
                        {opt.tagline}
                      </span>
                    </div>

                    <div>
                      <p className="text-sm font-extrabold tracking-tight text-slate-900">{opt.title}</p>
                    </div>

                    <p className="text-[11px] leading-relaxed text-slate-600">{opt.description}</p>

                    <ul className="space-y-1 pt-1 w-full">
                      {opt.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-1.5 text-[11px] text-slate-700">
                          <Sparkles className={`mt-0.5 h-3 w-3 shrink-0 ${a.bulletIcon}`} />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-2 pt-2 border-t border-black/5 w-full flex items-center justify-between">
                      <span className={`text-[10px] font-bold tracking-tight ${a.ctaText}`}>
                        Pilih mode pemindaian ini
                      </span>
                      <span className="text-xs font-bold text-slate-600 transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-[11px] text-slate-500">
              Kedua mode membaca foto yang sama. Nutrisi dihitung dari dataset gizi resmi, bukan
              ditebak dari gambar.
            </p>
          </>
        ) : (
          <>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {SOURCE_OPTIONS.map((opt) => {
                const Icon = opt.icon
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={busy}
                    onClick={() => onSelect(mode, opt.id)}
                    className={`group flex flex-col items-start gap-2.5 rounded-2xl border-2 p-4 text-left transition-all duration-200 cursor-pointer active:scale-[0.98] disabled:opacity-50 shadow-2xs hover:shadow-md ${
                      mode === SCAN_MODES.NUTRISI
                        ? 'bg-[#fef5e7] hover:bg-[#fdeed6] border-amber-300 hover:border-amber-500'
                        : 'bg-[#ebf7f0] hover:bg-[#def1e5] border-emerald-300 hover:border-emerald-500'
                    }`}
                  >
                    <span className={`rounded-xl p-2.5 shadow-xs transition-transform group-hover:scale-105 ${activeAccent.iconBg} ${activeAccent.iconText}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-extrabold tracking-tight text-slate-900">{opt.title}</p>
                      <p className="text-[11px] leading-relaxed text-slate-600 mt-0.5">{opt.description}</p>
                    </div>
                    <div className="mt-1 pt-2 border-t border-black/5 w-full flex items-center justify-between">
                      <span className={`text-[10px] font-bold tracking-tight ${activeAccent.ctaText}`}>
                        Gunakan sumber ini
                      </span>
                      <span className="text-xs font-bold text-slate-600 transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-[11px] text-slate-500">
              Tips: ambil foto tegak lurus ke nampan agar sekat lebih akurat terdeteksi.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default ScanModeModal
