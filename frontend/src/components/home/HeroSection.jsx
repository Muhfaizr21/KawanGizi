import heroAuraImg from '../../assets/hero-aura.png'
import { CtaButton } from '../ui/CtaButton'

export function HeroSection() {
  return (
    <section id="home" className="relative overflow-hidden bg-white pt-12 pb-4 sm:pt-16 md:pt-20 scroll-mt-24">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <p className="font-serif text-base italic text-gray-500 sm:text-lg md:text-xl tracking-wide">
          Sistem Skrining Kelayakan Konsumsi &middot; KawanGizi.
        </p>
        <h1 className="mx-auto mt-4 max-w-4xl text-5xl sm:text-7xl md:text-8xl font-black tracking-tight text-gray-900 leading-[1.06]">
          Pangan Aman.
          <br />
          Gizi Terjamin.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-gray-500 sm:text-base md:text-lg font-normal">
          KawanGizi memadukan Computer Vision YOLOv8 dan arsitektur terdesentralisasi untuk menskrining kelayakan fisik makanan serta mengestimasi kandungan makronutrien secara instan untuk mencegah risiko keracunan pangan dan menjaga mutu nutrisi anak.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <CtaButton href="/mulai">Mulai Sekarang</CtaButton>
        </div>
      </div>

      {/* Hero Visual: Centered Hand + Phone with Ambient Glowing Aura */}
      <div className="relative mx-auto mt-2 sm:mt-4 w-full max-w-5xl px-4 select-none">
        <img
          src={heroAuraImg}
          alt="Tangan memegang iPhone menampilkan antarmuka pemindaian visual kelayakan makanan KawanGizi"
          className="w-full object-contain mx-auto"
          loading="eager"
        />
      </div>
    </section>
  )
}
