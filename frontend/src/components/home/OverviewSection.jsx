export function OverviewSection() {
  return (
    <section id="overview" className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black leading-[1.08] tracking-tight text-gray-900">
              Instrumen Validasi Proaktif{' '}
              <em className="font-serif italic font-normal text-gray-700">Sebelum Distribusi</em>
            </h2>
          </div>
          <div className="md:col-span-5">
            <p className="text-base sm:text-lg leading-relaxed text-gray-500">
              Mendigitalisasi inspeksi yang sebelumnya manual dan subjektif menjadi sistem terukur dan objektif: skrining kelayakan fisik via YOLOv8 dan estimasi makronutrien instan di titik sekolah.
            </p>
          </div>
        </div>

        {/* 3 Pillars Grid */}
        <div className="mt-16 grid gap-10 border-t border-gray-100 pt-12 md:grid-cols-3">
          <div>
            <p className="font-serif text-sm italic text-gray-500">01 / Skrining Visual</p>
            <h3 className="mt-2 text-lg font-bold text-gray-900">Deteksi Kelayakan YOLOv8</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              Sorot kamera ponsel ke porsi makanan. Model YOLOv8 mendeteksi indikasi pembusukan dan anomali fisik dengan latensi rendah, tanpa spekulasi.
            </p>
          </div>
          <div>
            <p className="font-serif text-sm italic text-gray-500">02 / Estimasi Gizi</p>
            <h3 className="mt-2 text-lg font-bold text-gray-900">Kalkulasi Makronutrien</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              Estimasi kalori, protein, karbohidrat, lemak, dan serat dihitung deterministik berbasis gramatur bahan, sehingga transparan untuk validator tanpa keahlian gizi.
            </p>
          </div>
          <div>
            <p className="font-serif text-sm italic text-gray-500">03 / Peringatan Dini</p>
            <h3 className="mt-2 text-lg font-bold text-gray-900">Sinkronisasi & Eskalasi</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              Hasil pemindaian tersinkronisasi seketika ke dasbor Satgas KawanGizi, sehingga anomali terdeteksi memicu pelacakan dapur penyuplai dan pembekuan distribusi.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
