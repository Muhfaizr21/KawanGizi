import { useState } from 'react'
import { X, Send, Image as ImageIcon, Loader2 } from 'lucide-react'

const TAG_OPTIONS = [
  'SOP Suhu',
  'Rekap Presensi',
  'Menu Alergi',
  'Pindai AI',
  'Distribusi',
  'Kebersihan',
]

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#185338] focus:bg-white focus:ring-2 focus:ring-[#185338]/15'

export function CreatePostModal({ isOpen, onClose, onSubmit }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tag, setTag] = useState('SOP Suhu')
  const [mediaUri, setMediaUri] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const cleanTitle = title.trim()
    const cleanContent = content.trim()

    if (!cleanTitle) {
      setError('Judul topik postingan wajib diisi.')
      return
    }
    if (!cleanContent) {
      setError('Isi pesan / keterangan diskusi tidak boleh kosong.')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        title: cleanTitle,
        content: cleanContent,
        tag,
        mediaUri: mediaUri.trim() || undefined,
        mediaType: mediaUri.trim() ? 'image' : undefined,
      })
      setTitle('')
      setContent('')
      setMediaUri('')
      setTag('SOP Suhu')
      onClose()
    } catch (err) {
      setError(err?.message || 'Gagal menerbitkan postingan. Coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-[26px] bg-white shadow-2xl border border-slate-100 flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Dark Green Identity */}
        <div className="px-6 py-5 bg-[#123624] text-white flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              FORUM KOMUNITAS MBG
            </p>
            <h2 className="text-base sm:text-lg font-extrabold text-white mt-0.5">
              Buat Postingan Baru
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {/* Judul */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Judul Topik / Diskusi <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Penanganan porsi saat suhu holding turun..."
              className={inputClass}
              maxLength={150}
              required
            />
          </div>

          {/* Kategori Tag */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Kategori / Topik
            </label>
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className={inputClass}
            >
              {TAG_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Isi Pesan */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Isi Pesan / Catatan <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Jelaskan kendala, praktik baik, atau pertanyaan seputar SOP makanan bergizi di sekolah Anda..."
              className={`${inputClass} resize-none`}
              required
            />
          </div>

          {/* Lampiran Gambar (URL) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-[#185338]" />
              <span>URL Foto Hidangan / Kondisi (Opsional)</span>
            </label>
            <input
              type="url"
              value={mediaUri}
              onChange={(e) => setMediaUri(e.target.value)}
              placeholder="https://images.unsplash.com/photo-..."
              className={inputClass}
            />
            <p className="text-[11px] text-slate-400">
              Masukkan tautan gambar hidangan atau bukti visual SOP.
            </p>
          </div>

          {/* Error notice */}
          {error && (
            <p className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {error}
            </p>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#123624] hover:bg-[#0e2c1d] text-white text-xs font-extrabold transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>{isSubmitting ? 'Menerbitkan…' : 'Terbitkan Postingan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
