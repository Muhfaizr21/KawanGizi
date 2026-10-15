import { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from "react"
import {
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ScanLine,
  HelpCircle,
} from "lucide-react"

export async function convertToWebP(sourceFile, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(sourceFile)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1920
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (w > MAX) { h = Math.round(h * (MAX / w)); w = MAX }
      if (h > MAX) { h = Math.round(h * (MAX / h)); h = MAX }
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      canvas.getContext("2d").drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Gagal konversi ke WebP")); return }
          resolve({ blob, previewUrl: URL.createObjectURL(blob) })
        },
        "image/webp",
        quality,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("File gambar tidak valid")) }
    img.src = url
  })
}

export const ImageCapturePanel = forwardRef(function ImageCapturePanel(
  {
    onCapture,
    onScanStart,
    onScanRequest,
    disabled = false,
    label = "",
    hint,
    title = "Pemindai Visual Kelayakan & Makronutrien AI",
    description = "Arahkan kamera ke porsi hidangan untuk skrining visual kebusukan instan serta kalkulasi otomatis karbohidrat, protein, & lemak porsi anak.",
    badges = ["✨ YOLOv8 Edge AI", "⚡ Latensi ~45ms"],
    scanButtonText = "Mulai Pindai Makanan Bergizi",
    onHelpClick,
  },
  ref
) {
  const [mode, setMode] = useState("idle")
  const [preview, setPreview] = useState(null)
  const [cameraError, setCameraError] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [facing, setFacing] = useState("environment")
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const cameraRef = useRef(null)
  const uploadRef = useRef(null)
  // Compatibility aliases
  const cameraInputRef = cameraRef
  const fileInputRef = uploadRef

  useEffect(() => {
    return () => stopCamera()
  }, [])

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  const startCamera = async (facingMode) => {
    const fm = facingMode ?? facing
    stopCamera()
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: fm, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setMode("camera")
    } catch (err) {
      setCameraError(
        err.name === "NotAllowedError"
          ? "Izin kamera ditolak. Aktifkan akses kamera di pengaturan browser."
          : `Kamera tidak tersedia: ${err.message}`,
      )
    }
  }

  const flipCamera = async () => {
    const next = facing === "environment" ? "user" : "environment"
    setFacing(next)
    await startCamera(next)
  }

  const captureFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) return
    onScanStart?.()
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext("2d").drawImage(video, 0, 0)
    stopCamera()
    setMode("converting")
    canvas.toBlob(async (rawBlob) => {
      try {
        const { blob, previewUrl } = await convertToWebP(rawBlob)
        setPreview(previewUrl)
        setMode("preview")
        onCapture?.(blob, previewUrl)
      } catch (e) {
        setCameraError(`Gagal konversi: ${e.message}`)
        setMode("idle")
      }
    }, "image/jpeg", 0.95)
  }

  const handleFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith("image/")) {
      setCameraError("File harus berupa gambar (jpg, png, webp, heic, dll.)")
      return
    }
    setMode("converting")
    try {
      const { blob, previewUrl } = await convertToWebP(file)
      setPreview(previewUrl)
      setMode("preview")
      onCapture?.(blob, previewUrl)
    } catch (e) {
      setCameraError(`Gagal memproses gambar: ${e.message}`)
      setMode("idle")
    }
  }, [onCapture])

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    onScanStart?.()
    const previewUrl = URL.createObjectURL(file)
    setPreview(previewUrl)
    setMode("preview")
    onCapture?.(file, previewUrl)

    // Delay resetting input value to the very end to prevent destroying file reference in mobile browsers
    try {
      e.target.value = ""
    } catch (_) {}
  }

  const handleFileInput = handleFileSelect

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    onScanStart?.()
    const previewUrl = URL.createObjectURL(file)
    setPreview(previewUrl)
    setMode("preview")
    onCapture?.(file, previewUrl)
  }

  const reset = () => {
    stopCamera()
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setCameraError(null)
    setMode("idle")
    onCapture?.(null, null)
  }

  // Meminta sumber gambar. When the caller supplies onScanRequest it owns the
  // first step (memilih mode analisis lalu sumber gambar), so the picker only
  // opens after those choices are done. Without it the old one-tap capture flow
  // is kept.
  const requestScan = useCallback(() => {
    if (disabled) return
    if (onScanRequest) {
      onScanRequest()
      return
    }
    cameraRef.current?.click()
  }, [disabled, onScanRequest])

  // Pemanggil (halaman induk) membuka pilihan sumber gambar setelah mode
  // dipilih, sehingga perlu cara memicu kedua sumber tanpa menyalin input.
  useImperativeHandle(ref, () => ({
    openFilePicker: () => uploadRef.current?.click(),
    openCamera: () => startCamera(facing),
  }))

  return (
    <div className="space-y-3">
      {label && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      )}

      {/* State: Preview Foto Terambil */}
      {mode === "preview" && preview && (
        <div className="relative rounded-[22px] overflow-hidden border border-emerald-500/40 bg-[#0e2c1c] shadow-lg">
          <img src={preview} alt="Preview nampan makanan" className="w-full max-h-72 object-cover" />
          <div className="absolute top-2.5 right-2.5 flex items-center gap-2 z-10">
            <span className="inline-flex items-center gap-1 bg-emerald-600/90 backdrop-blur-xs text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-md border border-emerald-400/30">
              <CheckCircle2 className="h-3 w-3" /> WebP Siap Uji
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={reset}
                title="Hapus & ambil ulang"
                className="bg-black/60 hover:bg-black/80 backdrop-blur-xs text-white rounded-full p-1.5 shadow-md border border-white/20 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent absolute bottom-0 inset-x-0 flex items-center justify-between text-white text-xs">
            <span className="text-[11px] font-medium text-emerald-200">Foto nampan berhasil dimuat</span>
            {!disabled && (
              <button
                type="button"
                onClick={reset}
                className="text-[11px] font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer"
              >
                Ganti / Ambil Ulang
              </button>
            )}
          </div>
        </div>
      )}

      {/* State: Kamera WebRTC Langsung (Desktop Fallback) */}
      {mode === "camera" && (
        <div className="relative rounded-[22px] overflow-hidden border border-amber-400 shadow-lg bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-72 object-cover" />
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-6 border-2 border-dashed border-amber-400/80 rounded-xl animate-pulse" />
            <span className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 text-amber-300 text-[10px] font-mono px-3 py-1 rounded-full">
              ARAHKAN KE OBJEK MAKANAN
            </span>
          </div>
          <div className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={flipCamera}
              title="Ganti kamera"
              className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={captureFromCamera}
              className="px-6 py-2 rounded-full bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition shadow-lg cursor-pointer"
            >
              Ambil Foto
            </button>
            <button
              type="button"
              onClick={reset}
              title="Batalkan"
              className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* State: Konversi ke WebP */}
      {mode === "converting" && (
        <div className="rounded-[22px] border border-emerald-900/40 bg-[#123624] py-10 flex flex-col items-center gap-3 text-white">
          <div className="h-8 w-8 border-[3px] border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-emerald-100">Mengoptimalkan & Mengkonversi ke WebP...</p>
        </div>
      )}

      {/* State: Idle / Premium Dark Green Wavy Card with YOLOv8 Edge AI */}
      {mode === "idle" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative overflow-hidden rounded-[22px] bg-[#123624] p-5 sm:p-6 shadow-md border border-emerald-900/60 text-white transition-all ${
            isDragging ? "ring-2 ring-emerald-400 bg-[#0e2c1c]" : ""
          } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        >
          {/* Wavy Contour Lines Background Pattern (PWA Dark Green Signature) */}
          <svg
            className="absolute inset-0 w-full h-full opacity-20 pointer-events-none text-emerald-400"
            viewBox="0 0 320 200"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
          >
            <path d="M-30,50 Q80,130 160,60 T350,100" stroke="currentColor" strokeWidth="2.5" />
            <path d="M-30,80 Q80,160 160,90 T350,130" stroke="currentColor" strokeWidth="2" />
            <path d="M-30,110 Q80,190 160,120 T350,160" stroke="currentColor" strokeWidth="1.5" />
            <path d="M-30,140 Q80,220 160,150 T350,190" stroke="currentColor" strokeWidth="1" />
          </svg>

          {/* Top Badges Inside Card: ✨ YOLOv8 Edge AI & ⚡ Latensi ~45ms */}
          <div className="relative z-10 flex items-center flex-wrap gap-2 mb-3">
            {badges.map((badge, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 text-emerald-200 border border-white/15 text-[10px] font-bold backdrop-blur-xs tracking-tight shadow-2xs"
              >
                {badge}
              </span>
            ))}
          </div>

          {/* Card Title & YOLOv8 Copywriting */}
          <div className="relative z-10 space-y-1.5 mb-4">
            <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-snug">
              {title}
            </h3>
            <p className="text-xs sm:text-[13px] text-emerald-100/90 leading-relaxed font-normal">
              {description}
            </p>
          </div>

          {/* Action Row: Prominent White Button & Question Mark Icon Button */}
          <div className="relative z-10 flex items-center gap-2.5 mb-3">
            {/* White Prominent Button with Dark Text */}
            <button
              type="button"
              onClick={requestScan}
              disabled={disabled}
              className="flex-1 flex items-center justify-center gap-2.5 px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-900 font-extrabold text-xs sm:text-sm transition-all shadow-md cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              <ScanLine className="h-4.5 w-4.5 text-slate-900 shrink-0" />
              <span>{scanButtonText}</span>
            </button>

            {/* Small Question Mark Icon Button (Opens AI Guide Modal) */}
            <button
              type="button"
              onClick={onHelpClick}
              className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/20 flex items-center justify-center transition shadow-xs cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-white/30"
              title="Panduan Pemindai AI"
            >
              <HelpCircle className="h-5 w-5 text-emerald-200" />
            </button>
          </div>

          {/* Hint bar — pilihan upload / kamera dipindah ke modal setelah mode dipilih */}
          <div className="relative z-10 flex items-center gap-2 pt-2.5 border-t border-emerald-800/40 text-[11px] text-emerald-200/80">
            <span className="truncate">
              {isDragging
                ? "Lepaskan file nampan untuk memulai inspeksi..."
                : (hint || "Tekan tombol putih di atas, lalu pilih mode analisis dan sumber gambar.")}
            </span>
          </div>

          {/* Hidden HTML Inputs for PWA Functionality */}
          {/* 1. Direct rear-camera trigger for mobile PWA */}
          <input
            id="foodscan-camera-input"
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />
          {/* 2. Standard file picker / gallery upload */}
          <input
            id="foodscan-file-input"
            ref={uploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      )}

      {cameraError && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
          <p className="text-xs text-rose-700 leading-relaxed flex-1">{cameraError}</p>
          <button type="button" onClick={() => setCameraError(null)} className="text-rose-400 hover:text-rose-600 cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
})

ImageCapturePanel.displayName = "ImageCapturePanel"

export default ImageCapturePanel

