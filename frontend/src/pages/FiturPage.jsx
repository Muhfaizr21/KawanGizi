import scanImg from '../assets/scan.png'
import overviewImg from '../assets/overview.png'
import { useState } from 'react'
import { SAMPLE_MENUS, ROLES_DATA, FLOW_STEPS, FAQS } from '../data/mbgData'
import { ArrowIcon, CheckIcon } from '../components/ui/Icons'

const ARCHITECTURE = [
  { layer: 'React Native', runsOn: 'Ponsel validator', job: 'Buka kamera, kirim citra, tampilkan hasil layak atau tidak.' },
  { layer: 'Golang', runsOn: 'API gateway', job: 'Terima antrean pemindaian, auth, teruskan ke inferensi.' },
  { layer: 'Python + YOLOv8', runsOn: 'Backend AI terisolasi', job: 'Deteksi anomali fisik porsi dan hitung estimasi gizi.' },
  { layer: 'Next.js', runsOn: 'Dasbor Super Admin', job: 'Petakan hasil per sekolah, tandai dapur bermasalah.' },
]

const COMPARISON = [
  {
    aspect: 'Cek terakhir sebelum dibagi',
    old: 'Tidak ada. Porsi langsung dibagikan ke siswa.',
    now: 'Validator menyorot tiap porsi dengan kamera, YOLOv8 menilai kelayakan fisik saat itu juga.',
  },
  {
    aspect: 'Siapa yang bisa menilai',
    old: 'Guru atau staf tanpa alat ukur dan tanpa bekal ilmu gizi.',
    now: 'Siapa pun bisa memindai. Estimasi karbohidrat, protein, dan lemak muncul otomatis di layar.',
  },
  {
    aspect: 'Ketepatan penilaian',
    old: 'Mata telanjang. Ciri busuk yang samar lolos.',
    now: 'Model yang sama menilai setiap porsi dengan ambang konfidensi terukur.',
  },
  {
    aspect: 'Tindak lanjut temuan',
    old: 'Laporan kertas berjenjang. Dapur bermasalah ketahuan berminggu kemudian.',
    now: 'Hasil masuk dasbor Super Admin detik itu juga. Distribusi batch bermasalah bisa dihentikan hari yang sama.',
  },
  {
    aspect: 'Data untuk kebijakan',
    old: 'Catatan tercecer per sekolah, sulit direkap.',
    now: 'Agregat gizi harian dan peta sebaran siap diaudit per kabupaten dan kota.',
  },
]

export function FiturPage() {
  const [activeMenuId, setActiveMenuId] = useState('menu-1')
  const [openFaq, setOpenFaq] = useState(null)

  const activeMenu = SAMPLE_MENUS.find((m) => m.id === activeMenuId) || SAMPLE_MENUS[0]
  const layak = activeMenu.freshness >= 90

  return (
    <div className="bg-white text-gray-900">
      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-6">
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-800">
                KawanGizi / Validasi Porsi Nutrisi
              </p>
              <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1]">
                Lihat porsinya. Putuskan sebelum dibagikan.
              </h1>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-gray-600">
                Validator menyorot makanan dengan kamera ponsel. YOLOv8 menilai kelayakan
                fisik porsi dan menampilkan estimasi gizinya: hijau dibagikan, merah ditahan.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href="#demo"
                  className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
                >
                  Coba hasil pindaian <ArrowIcon />
                </a>
                <a
                  href="#cara-kerja"
                  className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-6 py-3 text-xs font-bold uppercase tracking-widest text-gray-900 transition-colors hover:border-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
                >
                  Cara kerja
                </a>
              </div>
              <dl className="mt-9 grid grid-cols-3 gap-4 border-t border-gray-200 pt-6">
                {[
                  ['Model', 'YOLOv8'],
                  ['Keputusan', '< 1 detik'],
                  ['Output', 'Layak · Gizi · Asal'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-mono text-[11px] uppercase tracking-widest text-gray-500">{k}</dt>
                    <dd className="mt-1 text-sm font-bold">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 font-mono text-[11px] text-gray-500">* Angka di halaman ini data simulasi.</p>
            </div>

            <div className="lg:col-span-6">
              <div className="overflow-hidden rounded-2xl bg-[#0C1210] text-white shadow-xl">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                  <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-white/70">
                    <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                    Kamera validator
                  </p>
                  <p className="font-mono text-[11px] text-white/50">yolov8n-food · 640px</p>
                </div>
                <div className="relative">
                  <img src={scanImg} alt="Porsi makanan dipindai kamera dengan kotak deteksi" className="aspect-[4/3] w-full object-cover" />
                  <span className="viewfinder-corner left-3 top-3 border-l-2 border-t-2 border-b-0 border-r-0" />
                  <span className="viewfinder-corner right-3 top-3 border-r-2 border-t-2 border-b-0 border-l-0" />
                  <span className="viewfinder-corner bottom-3 left-3 border-b-2 border-l-2 border-r-0 border-t-0" />
                  <span className="viewfinder-corner bottom-3 right-3 border-b-2 border-r-2 border-l-0 border-t-0" />
                  <span className="pointer-events-none absolute left-[18%] top-[30%] rounded border-2 border-emerald-400 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                    lauk · 0.94
                  </span>
                  <span className="pointer-events-none absolute bottom-[22%] right-[16%] rounded border-2 border-emerald-400 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                    sayur · 0.91
                  </span>
                  <span className="scanline pointer-events-none absolute left-3 right-3 h-0.5 bg-emerald-400/80" aria-hidden="true" />
                </div>
                <div className="space-y-1.5 px-5 py-4 font-mono text-xs">
                  <p className="text-white/60">&gt; 3 objek terdeteksi · conf ≥ 0.85 · 240ms</p>
                  <p className="flex items-center justify-between border-t border-white/10 pt-2.5">
                    <span className="font-bold text-emerald-400">LAYAK: bagikan</span>
                    <span className="text-white/70">545 kkal · P 34g · {activeMenu.token}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="cara-kerja" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16 md:py-24">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-800">Cara kerja</p>
        <h2 className="mt-3 max-w-xl text-3xl sm:text-4xl font-extrabold tracking-tight">
          Dari kamera ke keputusan, lima langkah.
        </h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
          {FLOW_STEPS.map((s) => (
            <li key={s.no} className="border-t-2 border-gray-900 pt-4">
              <p className="font-mono text-xs font-bold text-gray-500">{s.no}</p>
              <h3 className="mt-2 text-sm font-bold">{s.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-600">{s.desc}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 overflow-hidden rounded-2xl border border-gray-200">
          <img
            src={overviewImg}
            alt="Petugas dapur menyiapkan porsi makanan"
            className="w-full object-cover"
            loading="lazy"
          />
        </div>
      </section>

      <section id="demo" className="scroll-mt-20 border-y border-gray-200 bg-gray-50/60">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-800">Hasil pindaian</p>
          <h2 className="mt-3 max-w-xl text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ini yang tampil di layar validator.
          </h2>
          <div className="mt-8 flex flex-wrap gap-x-7 gap-y-2 border-b border-gray-200">
            {SAMPLE_MENUS.map((menu) => (
              <button
                key={menu.id}
                type="button"
                onClick={() => setActiveMenuId(menu.id)}
                aria-pressed={activeMenuId === menu.id}
                className={`border-b-2 pb-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gray-900 ${
                  activeMenuId === menu.id
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                {menu.name.split('&')[0]}
              </button>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-12">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white lg:col-span-7">
              <div className={`border-b px-6 py-4 ${layak ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                <p className={`font-mono text-[11px] font-bold uppercase tracking-widest ${layak ? 'text-emerald-800' : 'text-red-800'}`}>
                  {layak ? `Layak: bagikan · kesegaran ${activeMenu.freshness}%` : 'Tidak layak: tahan'}
                </p>
                <h3 className="mt-1 text-xl font-bold tracking-tight">{activeMenu.name}</h3>
                <p className="mt-1 font-mono text-xs text-gray-600">
                  {activeMenu.sppg} · masak {activeMenu.cookTime} · {activeMenu.token}
                </p>
              </div>
              <dl className="divide-y divide-gray-100 px-6">
                {[
                  ['Kalori', `${activeMenu.calories} kkal`],
                  ['Protein', `${activeMenu.protein} g`],
                  ['Karbohidrat', `${activeMenu.carbs} g`],
                  ['Lemak', `${activeMenu.fat} g`],
                  ['Serat', `${activeMenu.fiber} g`],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between py-3">
                    <dt className="text-sm text-gray-600">{k}</dt>
                    <dd className="font-mono text-sm font-bold">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="border-t border-gray-100 px-6 py-4 text-xs leading-relaxed text-gray-600">
                <span className="font-bold text-gray-900">Alergen: </span>
                {activeMenu.allergen}
              </p>
            </div>

            <div className="flex flex-col overflow-hidden rounded-2xl bg-[#0C1210] text-white lg:col-span-5">
              <p className="border-b border-white/10 px-6 py-3 font-mono text-[11px] uppercase tracking-widest text-white/60">
                Log keputusan
              </p>
              <div className="flex-1 space-y-2 px-6 py-5 font-mono text-xs leading-relaxed">
                <p className="text-white/60">&gt; citra 640px diterima via gateway golang</p>
                <p className="text-white/60">&gt; yolov8n-food · 3 objek · conf tertinggi 0.94</p>
                <p className="text-white/60">&gt; suhu {activeMenu.temp} · {activeMenu.shelfLife.toLowerCase()}</p>
                <p className="border-t border-white/10 pt-2 text-white/80">{activeMenu.aiNotes}</p>
              </div>
              <div className="border-t border-white/10 px-6 py-4">
                <div className="flex items-baseline justify-between font-mono text-[11px] text-white/60">
                  <span>Kesegaran</span>
                  <span className="font-bold text-white">{activeMenu.freshness}% · {activeMenu.status}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${activeMenu.freshness}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-800">Siapa memakai apa</p>
        <h2 className="mt-3 max-w-xl text-3xl sm:text-4xl font-extrabold tracking-tight">
          Tiga peran, satu alur yang sama.
        </h2>
        <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
          {ROLES_DATA.map((r) => (
            <div key={r.id} className="border-t-2 border-gray-900 pt-5">
              <p className="font-mono text-[11px] uppercase tracking-widest text-gray-500">{r.role} · {r.tag}</p>
              <h3 className="mt-2 text-lg font-bold tracking-tight">{r.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{r.desc}</p>
              <ul className="mt-4 space-y-2">
                {r.points.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-gray-200 bg-gray-50/60">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-800">Arsitektur</p>
          <h2 className="mt-3 max-w-xl text-3xl sm:text-4xl font-extrabold tracking-tight">
            Empat layanan, masing-masing satu tugas.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-600">
            Komputasi AI berjalan terpisah dari antarmuka. Inferensi yang berat tidak pernah
            membuat kamera validator macet.
          </p>
          <div className="mt-8 overflow-x-auto rounded-2xl border border-gray-200 bg-white">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-5 py-3.5 font-mono text-[11px] uppercase tracking-widest text-gray-500">Lapisan</th>
                  <th className="px-5 py-3.5 font-mono text-[11px] uppercase tracking-widest text-gray-500">Berjalan di</th>
                  <th className="px-5 py-3.5 font-mono text-[11px] uppercase tracking-widest text-gray-500">Tugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ARCHITECTURE.map((a) => (
                  <tr key={a.layer}>
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-[13px] font-bold">{a.layer}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-gray-600">{a.runsOn}</td>
                    <td className="px-5 py-4 text-gray-800">{a.job}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-800">Perbandingan</p>
        <h2 className="mt-3 max-w-xl text-3xl sm:text-4xl font-extrabold tracking-tight">
          Yang berubah dibanding cara lama.
        </h2>
        <div className="mt-8 overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-5 py-3.5 font-mono text-[11px] uppercase tracking-widest text-gray-500">Aspek</th>
                <th className="px-5 py-3.5 font-mono text-[11px] uppercase tracking-widest text-gray-500">Cara lama</th>
                <th className="px-5 py-3.5 font-mono text-[11px] uppercase tracking-widest text-emerald-800">Dengan KawanGizi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {COMPARISON.map((row) => (
                <tr key={row.aspect}>
                  <td className="whitespace-nowrap px-5 py-4 font-bold">{row.aspect}</td>
                  <td className="px-5 py-4 leading-relaxed text-gray-600">{row.old}</td>
                  <td className="px-5 py-4 leading-relaxed">{row.now}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-t border-gray-200 bg-gray-50/60">
        <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
          <p className="text-center font-mono text-xs font-semibold uppercase tracking-widest text-emerald-800">Tanya jawab</p>
          <h2 className="mt-3 text-center text-3xl sm:text-4xl font-extrabold tracking-tight">
            Yang sering ditanyakan.
          </h2>
          <div className="mt-10 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
            {FAQS.map((faq, i) => (
              <div key={i} className="px-6 py-5">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                  className="flex w-full items-center justify-between gap-4 text-left text-sm sm:text-base font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gray-900"
                >
                  <span>{faq.q}</span>
                  <span className="shrink-0 font-mono text-lg text-gray-500" aria-hidden="true">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && (
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">{faq.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <div className="bottom-face overflow-hidden rounded-3xl px-8 py-14 text-white sm:px-12">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-white/60">Mulai</p>
          <h2 className="mt-3 max-w-xl text-3xl sm:text-4xl font-extrabold tracking-tight">
            Pasang validasi di titik bagi.
          </h2>
          <p className="mt-3 max-w-lg text-sm sm:text-base leading-relaxed text-white/75">
            Coba pemindai interaktif atau daftar untuk menghubungkan dapur dan sekolah Anda.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/mulai"
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-xs font-bold uppercase tracking-widest text-gray-900 transition-colors hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Mulai sekarang <ArrowIcon />
            </a>
            <a
              href="#demo"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Lihat hasil pindaian
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
