import { MenuSimulator } from '../components/home/MenuSimulator'
import { PortionScanner } from '../components/scan/PortionScanner'

export function ScanPage() {
  return (
    <div className="pt-6 pb-16">
      <div className="mx-auto max-w-6xl px-6 text-center pt-8 pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-700">
          Pemindai Porsi Nutrisi
        </p>
        <h1 className="mt-2 text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-950">
          Analisis Foto <em className="font-serif italic font-normal text-emerald-800">Porsi Makanan</em>
        </h1>
        <p className="mt-3 text-sm sm:text-base text-gray-500 max-w-2xl mx-auto">
          Tarik atau unggah foto porsi, lalu dapatkan penilaian kelayakan dari model AI YOLOv8,
          nama bahan makanan, dan rincian gizi per porsi dari dataset nasional.
        </p>
      </div>

      <PortionScanner />

      <MenuSimulator />
    </div>
  )
}
