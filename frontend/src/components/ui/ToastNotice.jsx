import { useEffect } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

const TONE_THEME = {
  success: { icon: CheckCircle2, accent: 'text-emerald-600', bar: 'bg-emerald-500' },
  error: { icon: AlertTriangle, accent: 'text-rose-600', bar: 'bg-rose-500' },
  info: { icon: Info, accent: 'text-slate-700', bar: 'bg-[#185338]' },
}

/**
 * ToastNotice renders a non-blocking, themed status message in place of the
 * browser alert dialog. It auto-dismisses and pauses on hover.
 */
export function ToastNotice({ tone = 'success', title, message, duration = 4000, onDismiss }) {
  const theme = TONE_THEME[tone] || TONE_THEME.info
  const Icon = theme.icon

  useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(() => onDismiss?.(), duration)
    return () => window.clearTimeout(timer)
  }, [message, duration, onDismiss])

  if (!message) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[70] flex w-[min(360px,calc(100vw-2rem))] items-start gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xl"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${theme.bar}`} />
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${theme.accent}`} />
      <div className="min-w-0 flex-1">
        {title && <p className="text-xs font-extrabold text-slate-900">{title}</p>}
        <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        title="Tutup notifikasi"
        className="rounded-full p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export default ToastNotice