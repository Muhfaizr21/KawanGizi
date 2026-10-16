import { ArrowIcon } from '../ui/Icons'

export function BottomCta() {
  return (
    <section aria-label="Mulai Sekarang" className="border-t border-gray-100 bg-white px-4 sm:px-6 py-12 md:py-20">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bottom-face px-6 py-12 text-white sm:px-12 md:py-16 shadow-xl">
        <div className="max-w-2xl">
          <p className="font-serif text-sm italic text-white/80 sm:text-lg">Setiap Porsi Seharusnya Terverifikasi.</p>
          <h2 className="mt-2.5 text-2xl sm:text-5xl font-black tracking-tight leading-tight">
            Bantu Tutup Celah Validasi Tahap Akhir Nutrisi Pangan
          </h2>
          <p className="mt-3.5 text-xs sm:text-base leading-relaxed text-white/80">
            KawanGizi adalah purwarupa Minimum Viable Product. Integrasi pemindaian visual di lokasi sekolah dengan sinkronisasi data ke pusat komando menjawab tiga celah kritis: tidak adanya validasi tahap akhir, keterbatasan tenaga validator, dan subjektivitas pemeriksaan manual.
          </p>
          <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <a
              href="/mulai"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-xs font-bold uppercase tracking-widest text-gray-900 shadow-md transition-all hover:bg-gray-100 active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <span>Mulai Sekarang</span>
              <ArrowIcon />
            </a>
            <a
              href="/tentang-kami"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-white/20 active:scale-98"
            >
              <span>Pelajari Tentang Kami</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
