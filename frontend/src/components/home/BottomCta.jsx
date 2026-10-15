import { ArrowIcon } from '../ui/Icons'

export function BottomCta() {
  return (
    <section aria-label="Mulai Sekarang" className="border-t border-gray-100 bg-white px-6 py-16 md:py-24">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bottom-face px-8 py-16 text-white sm:px-14 md:py-20 shadow-xl">
        <div className="max-w-2xl">
          <p className="font-serif text-base italic text-white/80 sm:text-lg">Setiap Porsi Seharusnya Terverifikasi.</p>
          <h2 className="mt-3 text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Bantu Tutup Celah Validasi Tahap Akhir Nutrisi Pangan
          </h2>
          <p className="mt-4 text-sm sm:text-base leading-relaxed text-white/80">
            KawanGizi adalah purwarupa Minimum Viable Product. Integrasi pemindaian visual di lokasi sekolah dengan sinkronisasi data ke pusat komando menjawab tiga celah kritis: tidak adanya validasi tahap akhir, keterbatasan tenaga validator, dan subjektivitas pemeriksaan manual.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="/mulai"
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-xs font-bold uppercase tracking-widest text-gray-900 shadow-md transition-all hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Mulai Sekarang <ArrowIcon />
            </a>
            <a
              href="/tentang-kami"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-white/20"
            >
              Pelajari Tentang Kami
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
