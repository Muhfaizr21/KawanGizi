import { useState, useEffect, useMemo, useCallback } from "react"
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  RefreshCw,
  Eye,
  EyeOff,
  ScanLine,
} from "lucide-react"

/**
 * Normalizes detection/compartment objects from various YOLOv8 backend formats
 * into uniform percentage coordinates: { left, top, width, height, label, confidence, status, color }
 */
function normalizeDetections(rawDetections) {
  if (!Array.isArray(rawDetections) || rawDetections.length === 0) {
    return []
  }

  return rawDetections
    .map((item, index) => {
      if (!item) return null

      let left = 0
      let top = 0
      let width = 0
      let height = 0
      let hasCoords = false

      // 1. Check bboxQuadNorm / bbox_quad_norm (4-point polygon quad)
      const quad = item.bboxQuadNorm || item.bbox_quad_norm
      if (Array.isArray(quad) && quad.length >= 4) {
        const xs = quad.map((pt) => Number(pt[0]) || 0)
        const ys = quad.map((pt) => Number(pt[1]) || 0)
        const minX = Math.max(0, Math.min(...xs))
        const maxX = Math.min(1, Math.max(...xs))
        const minY = Math.max(0, Math.min(...ys))
        const maxY = Math.min(1, Math.max(...ys))

        left = minX
        top = minY
        width = maxX - minX
        height = maxY - minY
        hasCoords = width > 0 && height > 0
      }

      // 2. Check bboxNorm / bbox_norm [x1, y1, x2, y2] normalized 0-1
      if (!hasCoords) {
        const boxNorm = item.bboxNorm || item.bbox_norm
        if (Array.isArray(boxNorm) && boxNorm.length === 4) {
          const [x1, y1, x2, y2] = boxNorm.map(Number)
          left = Math.max(0, Math.min(1, x1))
          top = Math.max(0, Math.min(1, y1))
          width = Math.max(0, Math.min(1 - left, x2 - x1))
          height = Math.max(0, Math.min(1 - top, y2 - y1))
          hasCoords = width > 0 && height > 0
        }
      }

      // 3. Check generic box / bbox [x1, y1, x2, y2]
      if (!hasCoords) {
        const box = item.box || item.bbox
        if (Array.isArray(box) && box.length === 4) {
          const [x1, y1, x2, y2] = box.map(Number)
          // If values are already 0-1 normalized
          if (x2 <= 1.0 && y2 <= 1.0) {
            left = Math.max(0, x1)
            top = Math.max(0, y1)
            width = Math.max(0, x2 - x1)
            height = Math.max(0, y2 - y1)
            hasCoords = width > 0 && height > 0
          }
        }
      }

      // 4. Check { left, top, width, height } or { x, y, width, height }
      if (!hasCoords) {
        const rawLeft = item.left ?? item.x
        const rawTop = item.top ?? item.y
        const rawW = item.width ?? item.w
        const rawH = item.height ?? item.h
        if (rawLeft !== undefined && rawTop !== undefined && rawW !== undefined && rawH !== undefined) {
          left = Number(rawLeft)
          top = Number(rawTop)
          width = Number(rawW)
          height = Number(rawH)
          if (left <= 1.0 && top <= 1.0) {
            hasCoords = true
          }
        }
      }

      if (!hasCoords) return null

      // Extract label
      const label =
        item.menu_display_name ||
        item.menuDisplayName ||
        item.nama_spesifik ||
        item.detected_category ||
        item.kategori_umum ||
        item.class_name ||
        item.label ||
        (item.cell ? `Sekat ${item.cell}` : `Objek ${index + 1}`)

      // Extract confidence
      const rawConf =
        item.detection_confidence ??
        item.confidence_deteksi ??
        item.confidence ??
        item.menu_confidence ??
        item.score ??
        null

      const confidence = rawConf !== null ? Math.round(Number(rawConf) * 100) : null

      // Determine color theme based on status or category
      const status = (item.status || "").toLowerCase()
      const cat = (item.detected_category || item.kategori_umum || "").toLowerCase()

      let borderColor = "border-emerald-400"
      let bgColor = "bg-emerald-500/20"
      let tagBg = "bg-emerald-600"
      let textColor = "text-emerald-100"

      if (status === "review" || status === "waspada" || cat.includes("lauk")) {
        borderColor = "border-amber-400"
        bgColor = "bg-amber-500/20"
        tagBg = "bg-amber-600"
        textColor = "text-amber-100"
      } else if (status === "mismatch" || status.includes("tidak") || status.includes("busuk")) {
        borderColor = "border-rose-500"
        bgColor = "bg-rose-500/25"
        tagBg = "bg-rose-600"
        textColor = "text-rose-100"
      } else if (status === "empty" || item.empty) {
        borderColor = "border-slate-400"
        bgColor = "bg-slate-500/15"
        tagBg = "bg-slate-700"
        textColor = "text-slate-200"
      } else if (cat.includes("buah")) {
        borderColor = "border-fuchsia-400"
        bgColor = "bg-fuchsia-500/20"
        tagBg = "bg-fuchsia-600"
        textColor = "text-fuchsia-100"
      } else if (cat.includes("sayur")) {
        borderColor = "border-teal-400"
        bgColor = "bg-teal-500/20"
        tagBg = "bg-teal-600"
        textColor = "text-teal-100"
      }

      return {
        id: item.cell || item.index || index,
        cell: item.cell,
        left: left * 100,
        top: top * 100,
        width: width * 100,
        height: height * 100,
        label,
        confidence,
        status,
        borderColor,
        bgColor,
        tagBg,
        textColor,
      }
    })
    .filter(Boolean)
}

/**
 * ImagePreviewModal
 * Fullscreen modal with Zoom, Rotate, Reset, and YOLOv8 Bounding Box Overlays
 */
export function ImagePreviewModal({
  isOpen,
  onClose,
  imageUrl,
  detections = [],
  title = "Inspeksi Visual YOLOv8",
  subtitle = "Pindai & Analisis Sekat Gizi",
}) {
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [showBoxes, setShowBoxes] = useState(true)

  // Reset transforms whenever modal opens with a new image
  useEffect(() => {
    if (isOpen) {
      setScale(1)
      setRotation(0)
      setShowBoxes(true)
    }
  }, [isOpen, imageUrl])

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  // Normalized Bounding Boxes
  const normalizedBoxes = useMemo(() => {
    return normalizeDetections(detections)
  }, [detections])

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(3, +(prev + 0.25).toFixed(2)))
  }, [])

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(0.5, +(prev - 0.25).toFixed(2)))
  }, [])

  // Rotate handlers
  const handleRotateCw = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360)
  }, [])

  const handleRotateCcw = useCallback(() => {
    setRotation((prev) => (prev - 90 + 360) % 360)
  }, [])

  // Reset all transforms
  const handleReset = useCallback(() => {
    setScale(1)
    setRotation(0)
  }, [])

  if (!isOpen || !imageUrl) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between overflow-hidden animate-in fade-in duration-200 select-none"
    >
      {/* ========================================================================= */}
      {/* TOP BAR CONTROLS & HEADER */}
      {/* ========================================================================= */}
      <div
        className="relative z-30 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 1rem))" }}
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
            <ScanLine className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-2">
              <span>{title}</span>
              {normalizedBoxes.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  {normalizedBoxes.length} Sekat Terdeteksi
                </span>
              )}
            </h2>
            <p className="text-[11px] text-white/60 line-clamp-1">{subtitle}</p>
          </div>
        </div>

        {/* Top Actions: Toggle Bounding Boxes & Close Button */}
        <div className="flex items-center gap-2">
          {normalizedBoxes.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBoxes((prev) => !prev)}
              title={showBoxes ? "Sembunyikan Bounding Box" : "Tampilkan Bounding Box"}
              aria-label={showBoxes ? "Sembunyikan Bounding Box" : "Tampilkan Bounding Box"}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 cursor-pointer shadow-md ${
                showBoxes
                  ? "bg-emerald-600/80 border-emerald-400/40 text-white"
                  : "bg-white/10 border-white/20 text-white/70 hover:text-white"
              }`}
            >
              {showBoxes ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              <span className="hidden sm:inline">Bounding Box</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            title="Tutup Pratinjau (Esc)"
            aria-label="Tutup Pratinjau"
            className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 hover:text-white border border-white/20 transition cursor-pointer shadow-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN VIEWPORT: IMAGE + BOUNDING BOX OVERLAY */}
      {/* ========================================================================= */}
      <div className="relative flex-1 flex items-center justify-center p-4 sm:p-8 overflow-hidden">
        {/* Transformable Canvas Container */}
        <div
          className="relative max-w-full max-h-full flex items-center justify-center transition-transform duration-200 ease-out"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transformOrigin: "center center",
          }}
        >
          {/* Main Food Photo */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/15 bg-black/40">
            <img
              src={imageUrl}
              alt="Pratinjau Foto Nampan Makanan"
              className="max-w-[85vw] sm:max-w-[70vw] max-h-[65vh] sm:max-h-[70vh] object-contain block select-none pointer-events-none"
              draggable={false}
            />

            {/* YOLOv8 Detection Bounding Boxes Overlay */}
            {showBoxes && normalizedBoxes.length > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                {normalizedBoxes.map((box) => (
                  <div
                    key={box.id}
                    className={`absolute border-2 sm:border-[2.5px] rounded-lg ${box.borderColor} ${box.bgColor} transition-all duration-150 animate-in fade-in`}
                    style={{
                      left: `${box.left}%`,
                      top: `${box.top}%`,
                      width: `${box.width}%`,
                      height: `${box.height}%`,
                    }}
                  >
                    {/* Bounding Box Header Badge (Label + Confidence) */}
                    <div className="absolute -top-3 left-1 pointer-events-auto">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black tracking-tight text-white shadow-md ${box.tagBg} border border-white/20`}
                      >
                        {box.cell && <span className="opacity-80 font-mono">[{box.cell}]</span>}
                        <span>{box.label}</span>
                        {box.confidence !== null && (
                          <span className="opacity-85 text-[8px] sm:text-[9px]">
                            {box.confidence}%
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Corner Accent Guides */}
                    <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-white rounded-tl-sm" />
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-white rounded-tr-sm" />
                    <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-white rounded-bl-sm" />
                    <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-white rounded-br-sm" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM TOOLBAR: ZOOM, ROTATE, RESET CONTROLS */}
      {/* ========================================================================= */}
      <div
        className="relative z-30 px-4 py-3 sm:py-5 flex flex-col items-center gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 1.5rem))" }}
      >
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/20 shadow-2xl">
          {/* Zoom Out Button */}
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            title="Perkecil (-)"
            aria-label="Perkecil"
            className="p-2 sm:p-2.5 rounded-xl text-white/90 hover:text-white hover:bg-white/15 active:scale-90 disabled:opacity-40 transition cursor-pointer"
          >
            <ZoomOut className="h-5 w-5" />
          </button>

          {/* Current Scale Percentage Indicator */}
          <span className="min-w-14 sm:min-w-16 text-center text-xs font-mono font-black text-emerald-300">
            {Math.round(scale * 100)}%
          </span>

          {/* Zoom In Button */}
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 3}
            title="Perbesar (+)"
            aria-label="Perbesar"
            className="p-2 sm:p-2.5 rounded-xl text-white/90 hover:text-white hover:bg-white/15 active:scale-90 disabled:opacity-40 transition cursor-pointer"
          >
            <ZoomIn className="h-5 w-5" />
          </button>

          <div className="h-5 w-px bg-white/20 mx-1" />

          {/* Rotate Counter-Clockwise */}
          <button
            type="button"
            onClick={handleRotateCcw}
            title="Putar Berlawanan Jarum Jam (-90°)"
            aria-label="Putar Berlawanan Jarum Jam"
            className="p-2 sm:p-2.5 rounded-xl text-white/90 hover:text-white hover:bg-white/15 active:scale-90 transition cursor-pointer"
          >
            <RotateCcw className="h-5 w-5" />
          </button>

          {/* Rotate Clockwise */}
          <button
            type="button"
            onClick={handleRotateCw}
            title="Putar Searah Jarum Jam (90°)"
            aria-label="Putar Searah Jarum Jam"
            className="p-2 sm:p-2.5 rounded-xl text-white/90 hover:text-white hover:bg-white/15 active:scale-90 transition cursor-pointer"
          >
            <RotateCw className="h-5 w-5" />
          </button>

          <div className="h-5 w-px bg-white/20 mx-1" />

          {/* Reset Transforms */}
          <button
            type="button"
            onClick={handleReset}
            disabled={scale === 1 && rotation === 0}
            title="Reset Ukuran & Orientasi"
            aria-label="Reset Ukuran & Orientasi"
            className="p-2 sm:p-2.5 rounded-xl text-white/90 hover:text-white hover:bg-white/15 active:scale-90 disabled:opacity-40 transition cursor-pointer"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Hint */}
        <p className="text-[10px] text-white/50 text-center font-medium">
          Sentuh tombol untuk memperbesar porsi atau memutar sudut nampan makanan
        </p>
      </div>
    </div>
  )
}

export default ImagePreviewModal
