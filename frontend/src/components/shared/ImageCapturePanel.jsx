import { useState, useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from "react"
import {
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ScanLine,
  HelpCircle,
  Maximize2,
} from "lucide-react"
import { ImagePreviewModal } from "./ImagePreviewModal"

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
    onPreviewClick,
    detections = [],
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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
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

  // Ensure video element plays stream immediately on mount
  useEffect(() => {
    if (mode === "camera" && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current
        videoRef.current.play().catch(() => {})
      }
    }
  }, [mode])

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  const startCamera = async (facingMode = "environment") => {
    const targetFacing = facingMode || "environment"
    stopCamera()
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: targetFacing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      setFacing(targetFacing)
      setMode("camera")
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        try {
          await videoRef.current.play()
        } catch (_) {}
      }
    } catch (err) {
      // Fallback if high resolution request is rejected on certain hardware
      try {
        const streamFallback = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: targetFacing } },
          audio: false,
        })
        streamRef.current = streamFallback
        setFacing(targetFacing)
        setMode("camera")
        if (videoRef.current) {
          videoRef.current.srcObject = streamFallback
          try {
            await videoRef.current.play()
          } catch (_) {}
        }
      } catch (err2) {
        setCameraError(
          err2.name === "NotAllowedError"
            ? "Izin kamera ditolak. Aktifkan akses kamera di pengaturan browser."
            : `Kamera tidak tersedia: ${err2.message}`,
        )
      }
    }
  }

  const flipCamera = async () => {
    const next = facing === "environment" ? "user" : "environment"
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
    openCamera: () => startCamera("environment"),
  }))

  return (
    <div className="space-y-3">
      {label && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      )}

      {/* State: Preview Foto Terambil */}
      {mode === "preview" && preview && (
        <>
          <div
            onClick={() => {
              if (onPreviewClick) {
                onPreviewClick()
              } else {
                setIsPreviewOpen(true)
              }
            }}
            title="Ketuk foto untuk inspeksi visual interaktif (Zoom & Rotasi)"
            className="relative rounded-[22px] overflow-hidden border border-emerald-500/40 bg-[#0e2c1c] shadow-lg cursor-pointer group"
          >
            <img
              src={preview}
              alt="Preview nampan makanan"
              className="w-full max-h-72 object-cover group-hover:scale-[1.01] transition-transform duration-200"
            />
            <div className="absolute top-2.5 right-2.5 flex items-center gap-2 z-10">
              <span className="inline-flex items-center gap-1 bg-emerald-600/90 backdrop-blur-xs text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-md border border-emerald-400/30">
                <CheckCircle2 className="h-3 w-3" /> WebP Siap Uji
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    reset()
                  }}
                  title="Hapus & ambil ulang"
                  className="bg-black/60 hover:bg-black/80 backdrop-blur-xs text-white rounded-full p-1.5 shadow-md border border-white/20 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Bottom Info Bar with Zoom Button */}
            <div className="p-3 bg-gradient-to-t from-black/85 via-black/50 to-transparent absolute bottom-0 inset-x-0 flex items-center justify-between text-white text-xs">
              <span className="text-[11px] font-medium text-emerald-200 flex items-center gap-1.5">
                <Maximize2 className="h-3.5 w-3.5 text-emerald-300" />
                <span>Ketuk untuk Zoom & Rotasi</span>
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    reset()
                  }}
                  className="text-[11px] font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer"
                >
                  Ambil Ulang
                </button>
              )}
            </div>
          </div>

          {/* Fallback Internal Modal if parent does not provide onPreviewClick */}
          {!onPreviewClick && (
            <ImagePreviewModal
              isOpen={isPreviewOpen}
              onClose={() => setIsPreviewOpen(false)}
              imageUrl={preview}
              detections={detections}
              title={title}
              subtitle="Pratinjau Foto Nampan Makanan"
            />
          )}
        </>
      )}

      {/* State: Kamera WebRTC Full-Screen Immersive Mobile View */}
      {mode === "camera" && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden">
          {/* Full Screen Live Video Feed */}
          <video
            ref={(el) => {
              videoRef.current = el
              if (el && streamRef.current && el.srcObject !== streamRef.current) {
                el.srcObject = streamRef.current
                el.play().catch(() => {})
              }
            }}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Close (X) Button positioned top-right with safe area support */}
          <button
            type="button"
            onClick={reset}
            title="Tutup Kamera"
            aria-label="Tutup Kamera"
            className="absolute top-6 right-6 pt-safe p-3 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/20 transition active:scale-95 cursor-pointer shadow-lg z-20"
            style={{ top: "max(1.5rem, env(safe-area-inset-top, 1.5rem))" }}
          >
            <X className="h-6 w-6" />
          </button>

          {/* Top Left Guide Pill */}
          <div
            className="absolute top-6 left-6 pt-safe z-20 pointer-events-none"
            style={{ top: "max(1.5rem, env(safe-area-inset-top, 1.5rem))" }}
          >
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-xs font-semibold text-white/90 shadow-md">
              <ScanLine className="h-4 w-4 text-emerald-400" />
              <span>Arahkan ke Nampan</span>
            </span>
          </div>

          {/* Center Food Tray Reticle / Framing Guide */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6 sm:p-12 z-10">
            <div className="relative w-full max-w-sm sm:max-w-md aspect-[4/3] border-2 border-dashed border-white/40 rounded-3xl">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md text-white text-[10px] font-mono tracking-wider uppercase px-3 py-0.5 rounded-full border border-white/20">
                ARAHKAN KE OBJEK MAKANAN
              </span>
              {/* Corner accents */}
              <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-3 border-l-3 border-emerald-400 rounded-tl-xl" />
              <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-3 border-r-3 border-emerald-400 rounded-tr-xl" />
              <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-3 border-l-3 border-emerald-400 rounded-bl-xl" />
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-3 border-r-3 border-emerald-400 rounded-br-xl" />
            </div>
          </div>

          {/* Main Controls Overlay: Flip Camera, Large Circular Shutter, Gallery Trigger */}
          <div
            className="absolute bottom-10 pb-safe pb-8 left-0 right-0 flex justify-center items-center gap-8 z-20"
            style={{ bottom: "max(2.5rem, env(safe-area-inset-bottom, 2.5rem))" }}
          >
            {/* Flip Camera Button */}
            <button
              type="button"
              onClick={flipCamera}
              title="Ganti Lensa Kamera"
              aria-label="Ganti Lensa Kamera"
              className="p-4 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-white border border-white/25 transition active:scale-90 cursor-pointer shadow-xl flex items-center justify-center"
            >
              <RefreshCw className="h-6 w-6" />
            </button>

            {/* Large Circular Capture Button (Native Camera Style) */}
            <button
              type="button"
              onClick={captureFromCamera}
              title="Ambil Foto"
              aria-label="Ambil Foto"
              className="relative p-1.5 rounded-full border-4 border-white shadow-2xl active:scale-95 transition cursor-pointer group"
            >
              <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-[#123624] group-hover:bg-[#1a4a32] border-2 border-emerald-400/60 flex items-center justify-center transition-all shadow-inner">
                <div className="w-8 h-8 rounded-full bg-emerald-400/20 flex items-center justify-center">
                  <ScanLine className="h-5 w-5 text-emerald-200" />
                </div>
              </div>
            </button>

            {/* Gallery Shortcut Button for Visual Balance */}
            <button
              type="button"
              onClick={() => {
                reset()
                uploadRef.current?.click()
              }}
              title="Pilih dari Galeri"
              aria-label="Pilih dari Galeri"
              className="p-4 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md text-white border border-white/25 transition active:scale-90 cursor-pointer shadow-xl flex flex-col items-center justify-center"
            >
              <span className="text-[11px] font-bold">Galeri</span>
            </button>
          </div>

          {/* Error Message if Camera Access Fails */}
          {cameraError && (
            <div className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
              <AlertTriangle className="h-12 w-12 text-amber-400" />
              <p className="text-sm font-semibold max-w-xs">{cameraError}</p>
              <button
                type="button"
                onClick={reset}
                className="px-6 py-2.5 rounded-full bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
              >
                Tutup & Kembali
              </button>
            </div>
          )}

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

