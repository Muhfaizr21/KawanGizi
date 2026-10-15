import { useEffect, useRef } from 'react'
import { AlertTriangle, Info, Loader2, Trash2, X } from 'lucide-react'

const TONE_THEME = {
  danger: {
    icon: Trash2,
    iconChip: 'bg-rose-50 text-rose-600 border-rose-100',
    eyebrow: 'text-rose-600',
    confirm: 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-600/25',
    halo: 'from-rose-500/10',
  },
  warning: {
    icon: AlertTriangle,
    iconChip: 'bg-amber-50 text-amber-600 border-amber-100',
    eyebrow: 'text-amber-600',
    confirm: 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/25',
    halo: 'from-amber-500/10',
  },
  info: {
    icon: Info,
    iconChip: 'bg-emerald-50 text-[#185338] border-emerald-100',
    eyebrow: 'text-[#185338]',
    confirm: 'bg-[#185338] text-white hover:bg-[#12422c] shadow-[#185338]/25',
    halo: 'from-[#185338]/10',
  },
}

/**
 * ConfirmDialog replaces the native window.confirm with a branded, accessible
 * confirmation modal that follows the validator design language.
 */
export function ConfirmDialog({
  isOpen,
  tone = 'danger',
  eyebrow,
  title,
  description,
  details = [],
  confirmLabel = 'Ya, lanjutkan',
  cancelLabel = 'Batal',
  hideCancel = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  const theme = TONE_THEME[tone] || TONE_THEME.danger
  const Icon = theme.icon
  const confirmRef = useRef(null)
  const cancelRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) onCancel?.()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, loading, onCancel])

  // Fokus diarahkan ke tombol Batal, bukan tombol hapus. Kalau fokus mendarat
  // di tombol destruktif, satu penekanan Enter oleh pengguna yang tidak sengaja
  // sudah cukup untuk menghapus data.
  useEffect(() => {
    if (isOpen) cancelRef.current?.focus()
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      onClick={() => !loading && onCancel?.()}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-[26px] border border-slate-100 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${theme.halo} to-transparent`} />

        {/* Header */}
        <div className="relative flex items-start gap-3.5 px-6 pt-6 pb-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${theme.iconChip}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className={`text-[10px] font-extrabold uppercase tracking-[0.18em] ${theme.eyebrow}`}>
                {eyebrow}
              </p>
            )}
            <h3 className="mt-1 text-base font-extrabold leading-snug tracking-tight text-slate-900">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            title="Tutup"
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-5">
          {description && (
            <p className="text-[13px] leading-relaxed text-slate-600">{description}</p>
          )}

          {details.length > 0 && (
            <ul className="mt-4 space-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
              {details.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[12px] leading-relaxed text-slate-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#185338]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className={`rounded-full border border-slate-200 bg-white px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 ${hideCancel ? 'hidden' : ''}`}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${theme.confirm}`}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog