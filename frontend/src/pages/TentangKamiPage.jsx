import { useState } from 'react'
import { ArrowIcon, CheckIcon } from '../components/ui/Icons'

const PROBLEMS = [
  {
    aspect: 'Cek di detik terakhir tidak ada',
    body: 'Makanan tiba di sekolah langsung dibagikan. Yang memeriksa hanya penglihatan, tanpa alat ukur, dan tidak ada yang mencatat apakah porsi itu layak atau sudah berbau.',
  },
  {
    aspect: 'Bahan harian berubah, nilai gizi lama',
    body: 'Ayam diganti ikan lokal, buncis diganti daun kelor. Angka gizi di papan menu tidak pernah ikut berubah. Yang tertulis bukan yang benar-benar dimakan.',
  },
  {
    aspect: 'Keluhan datang terlambat',
    body: 'Saat anak sakit atau ada keluhan, yang bisa dicari baru nama sekolah. Tidak ada jejak batch, tidak ada penanggung jawab, tidak ada waktu masak.',
  },
]

const PRINCIPLES = [
  {
    t: 'Deteksi, bukan perkiraan',
    d: 'YOLOv8 menilai ciri fisik porsi dari foto kamera. Keputusan lolos atau ditahan keluar dari bobot konfidensi, bukan dari tebakan petugas.',
  },
  {
    t: 'Gizi dihitung dari bahan yang ditimbang',
    d: 'Nilai gizi dihitung saat produksi dari gramatur bahan, lalu ikut terbawa di setiap hasil pindaian. Angka di layar berasal dari porsi itu, bukan dari brosur.',
  },
  {
    t: 'Batas empat jam tidak bisa dilewati',
    d: 'Empat jam dihitung dari jam masak. Melewati batas itu mengubah status di layar. Dapur tidak bisa menimpanya.',
  },
  {
    t: 'PWA ringan tanpa beban memori',
    d: 'Progressive Web App (PWA) yang dapat diinstal langsung dari browser tanpa memenuhi memori HP dan siap digunakan seketika.',
  },
]

const ETHICS = [
  {
    t: 'Data tidak dipoles biar terlihat bagus',
    d: 'Kalau sebuah porsi gagal deteksi, statusnya merah di layar dan masuk daftar tinjauan. Sistem tidak menahan temuan demi membuat dasbor terlihat bersih.',
  },
  {
    t: 'Harus dipakai orang yang sibuk jam empat pagi',
    d: 'Alurnya sependek mungkin: pindai, baca hasil, lanjutkan. Tidak ada istilah teknis yang harus dihafal, tidak ada langkah yang bisa dilewati karena tidak paham.',
  },
  {
    t: 'Gratis untuk yang memindai',
    d: 'Tidak ada paywall, tidak ada pendaftaran wajib untuk melihat informasi porsi. Mau tahu isi makanan di depan mata, cukup arahkan kamera.',
  },
]

const TRACE_STEPS = [
  { t: 'Dapur menimbang bahan', d: 'Gramatur bahan tercatat saat produksi. Gizi dan batch terbentuk di titik ini.' },
  { t: 'Makanan dikirim ke sekolah', d: 'Jam masak mengikuti batch. Di mana pun masak, jam tetap tercatat.' },
  { t: 'Validator menyorot porsi', d: 'Kamera menangkap porsi. YOLOv8 menilai kelayakan fisik.' },
  { t: 'Keputusan di layar', d: 'Layak: dilanjutkan. Tidak layak: ditahan, dicatat, masuk dasbor Super Admin.' },
  { t: 'Dapur asal bisa ditunjuk', d: 'Dari satu temuan di satu sekolah, Super Admin bisa melihat batch asal yang sama masih berjalan di sekolah lain.' },
]

export function TentangKamiPage() {
  const [formData, setFormData] = useState({
    name: '',
    organization: '',
    email: '',
    role: 'Pengelola SPPG',
    message: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!formData.name.trim() || !formData.email.includes('@') || !formData.message.trim()) {
      setError('Lengkapi nama, email yang valid, dan pesan Anda.')
      return
    }
    setError('')
    setSubmitted(true)
  }

  return (
    <div className="bg-white text-gray-900">
      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12 md:py-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-800">
            Tentang KawanGizi
          </p>
          <h1 className="mt-3 sm:mt-4 max-w-3xl text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.12] sm:leading-[1.1]">
            Yang anak makan, dicek sebelum sampai.
          </h1>
          <p className="mt-4 sm:mt-5 max-w-2xl text-sm sm:text-base leading-relaxed text-gray-600">
            KawanGizi menghubungkan dapur SPPG, sekolah, dan satuan tugas pengawas gizi lewat satu
            alur: pindai porsi, putuskan layak atau tidak, catat hasilnya. Berbasis computer
            vision, bukan catatan kertas yang tidak nyambung antar lokasi.
          </p>
          <dl className="mt-8 sm:mt-10 grid grid-cols-2 gap-4 sm:gap-6 border-t border-gray-200 pt-6 sm:grid-cols-4">
            {[
              ['Model', 'YOLOv8'],
              ['Batas aman', '≤ 4 jam'],
              ['Aplikasi', 'PWA Ringan'],
              ['Keputusan', '< 1 detik'],
            ].map(([k, v]) => (
              <div key={k} className="bg-gray-50/70 sm:bg-transparent rounded-xl p-3 sm:p-0">
                <dt className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest text-gray-500">{k}</dt>
                <dd className="mt-1 text-base sm:text-lg font-bold text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-12 md:py-20">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-800">Masalahnya</p>
        <h2 className="mt-2.5 max-w-xl text-2xl sm:text-4xl font-extrabold tracking-tight">
          Tidak tercatat, dan tidak ada yang bisa dicek.
        </h2>
        <p className="mt-3 sm:mt-4 max-w-2xl text-xs sm:text-sm leading-relaxed text-gray-600">
          Program Makan Bergizi Gratis menyentuh ratusan ribu porsi setiap hari. Pada skala itu,
          satu porsi yang lolos tanpa dicek adalah satu kesempatan yang hilang.
        </p>
        <div className="mt-8 sm:mt-10 divide-y divide-gray-200 border-t border-gray-200">
          {PROBLEMS.map((p) => (
            <div key={p.aspect} className="flex flex-col gap-1.5 py-4 sm:py-6 sm:grid sm:grid-cols-12 sm:gap-6">
              <p className="text-sm font-bold text-gray-900 sm:col-span-5">{p.aspect}</p>
              <p className="text-xs sm:text-sm leading-relaxed text-gray-600 sm:col-span-7">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-gray-200 bg-gray-50/60">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12 md:py-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-800">Prinsip kerja</p>
          <h2 className="mt-2.5 max-w-xl text-2xl sm:text-4xl font-extrabold tracking-tight">
            Dibuat untuk lapangan, bukan untuk demo.
          </h2>
          <p className="mt-3 max-w-2xl text-xs sm:text-sm leading-relaxed text-gray-600">
            Setiap keputusan teknis diambil dengan satu pertanyaan: masih berguna tidak, saat
            petugas bercelemek bekerja di dapur yang basah?
          </p>

          {/* Mobile Card View (Eliminates awkward horizontal table scrolling on mobile) */}
          <div className="mt-6 flex flex-col gap-3 sm:hidden">
            {PRINCIPLES.map((f) => (
              <div key={f.t} className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
                <p className="font-bold text-sm text-gray-900">{f.t}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-600">{f.d}</p>
              </div>
            ))}
          </div>

          {/* Desktop / Tablet Table View */}
          <div className="mt-8 hidden sm:block overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-2xs">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="px-6 py-3.5 font-mono text-[11px] uppercase tracking-widest text-gray-500">Prinsip</th>
                  <th className="px-6 py-3.5 font-mono text-[11px] uppercase tracking-widest text-gray-500">Yang dikerjakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {PRINCIPLES.map((f) => (
                  <tr key={f.t}>
                    <td className="whitespace-nowrap px-6 py-4 font-bold text-gray-900">{f.t}</td>
                    <td className="px-6 py-4 leading-relaxed text-gray-700">{f.d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-12 md:py-20">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-800">Jejak porsi</p>
        <h2 className="mt-2.5 max-w-xl text-2xl sm:text-4xl font-extrabold tracking-tight">
          Satu batch, dari dapur sampai ditahan.
        </h2>
        <p className="mt-3 max-w-2xl text-xs sm:text-sm leading-relaxed text-gray-600">
          Berikut yang terjadi pada satu porsi, apa adanya. Tidak ada langkah yang disembunyikan.
        </p>
        <ol className="mt-8 sm:mt-10 border-t border-gray-200">
          {TRACE_STEPS.map((s, i) => (
            <li key={s.t} className="flex flex-col gap-1.5 py-4 sm:py-6 sm:grid sm:grid-cols-12 sm:gap-6 border-b border-gray-200">
              <p className="font-mono text-xs font-bold text-emerald-800 sm:col-span-5">
                0{i + 1} · {s.t}
              </p>
              <p className="text-xs sm:text-sm leading-relaxed text-gray-600 sm:col-span-7">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-gray-200 bg-gray-50/60">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12 md:py-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-800">Batas kami</p>
          <h2 className="mt-2.5 max-w-xl text-2xl sm:text-4xl font-extrabold tracking-tight">
            Tiga hal yang tidak kami kompromikan.
          </h2>
          <div className="mt-8 sm:mt-10 grid gap-6 sm:gap-8 md:grid-cols-3">
            {ETHICS.map((c) => (
              <div key={c.t} className="border-t-2 border-gray-900 pt-4 bg-white sm:bg-transparent rounded-xl p-4 sm:p-0 border border-gray-200 sm:border-0 sm:border-t-2 shadow-2xs sm:shadow-none">
                <p className="flex items-start gap-2 text-sm font-bold text-gray-900">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  {c.t}
                </p>
                <p className="mt-2 text-xs sm:text-sm leading-relaxed text-gray-600">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="kontak" className="mx-auto max-w-5xl scroll-mt-20 px-4 sm:px-6 py-12 md:py-20">
        <div className="overflow-hidden rounded-2xl border border-gray-200 flex flex-col lg:grid lg:grid-cols-12 shadow-sm">
          <div className="flex flex-col justify-between bg-[#0C1210] p-6 sm:p-8 md:p-10 text-white lg:col-span-5">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-white/60">Kolaborasi</p>
              <h2 className="mt-2.5 text-xl sm:text-2xl font-extrabold tracking-tight">Hubungi KawanGizi</h2>
              <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-white/75">
                Untuk pengelola SPPG, pengelola sekolah, dan dinas yang ingin memakai validasi
                porsi yang sama pada program makan masing-masing.
              </p>
              <div className="mt-6 sm:mt-8 space-y-3.5 sm:space-y-4 text-xs sm:text-sm">
                <div>
                  <p className="font-semibold text-white">Surel kemitraan</p>
                  <p className="font-mono text-white/60 text-xs sm:text-sm mt-0.5">kemitraan@kawangizi.id</p>
                </div>
                <div>
                  <p className="font-semibold text-white">Wilayah uji coba</p>
                  <p className="text-white/60 text-xs sm:text-sm mt-0.5">Jakarta Selatan & Bandung, Indonesia</p>
                </div>
                <div>
                  <p className="font-semibold text-white">Jam operasional</p>
                  <p className="text-white/60 text-xs sm:text-sm mt-0.5">Senin–Jumat, 08.00–17.00 WIB</p>
                </div>
              </div>
            </div>
            <p className="mt-8 border-t border-white/10 pt-4 text-[11px] text-white/40">
              Pemantauan porsi dan transparansi gizi untuk sekolah Indonesia.
            </p>
          </div>

          <div className="p-5 sm:p-8 md:p-10 lg:col-span-7 bg-white">
            {submitted ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-700 text-white">
                  <CheckIcon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-xl font-bold">Pesan belum terkirim</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-600">
                  Terima kasih, {formData.name}. Formulir ini bagian dari purwarupa: isian Anda
                  belum dikirim ke mana pun dan tidak akan dibalas.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false)
                    setFormData({ name: '', organization: '', email: '', role: 'Pengelola SPPG', message: '' })
                  }}
                  className="mt-6 rounded-full bg-gray-900 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
                >
                  Kirim pesan lain
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Kirim pesan</h3>
                <p className="mt-1 text-xs text-gray-500">Isi formulir untuk menjadwalkan diskusi integrasi wilayah.</p>

                {error && (
                  <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs sm:text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="mt-5 sm:mt-6 space-y-4 sm:space-y-5">
                  <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:gap-5">
                    <div>
                      <label htmlFor="name" className="block text-xs font-semibold text-gray-700">
                        Nama lengkap *
                      </label>
                      <input
                        id="name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Budi Setiawan"
                        className="mt-1.5 w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="organization" className="block text-xs font-semibold text-gray-700">
                        Instansi / SPPG
                      </label>
                      <input
                        id="organization"
                        type="text"
                        value={formData.organization}
                        onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                        placeholder="SPPG Menteng 01"
                        className="mt-1.5 w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2 sm:gap-5">
                    <div>
                      <label htmlFor="email" className="block text-xs font-semibold text-gray-700">
                        Email *
                      </label>
                      <input
                        id="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="budi@instansi.id"
                        className="mt-1.5 w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="role" className="block text-xs font-semibold text-gray-700">
                        Peran
                      </label>
                      <select
                        id="role"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm focus:border-gray-900 focus:outline-none"
                      >
                        <option value="Pengelola SPPG">Pengelola SPPG</option>
                        <option value="Pihak Sekolah / Guru">Pihak Sekolah / Guru</option>
                        <option value="Komite / Orang Tua">Komite / Orang Tua</option>
                        <option value="Dinas Terkait">Dinas Terkait</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-xs font-semibold text-gray-700">
                      Pesan *
                    </label>
                    <textarea
                      id="message"
                      rows={4}
                      required
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Contoh: Kami mengelola 1.200 porsi per hari di Jakarta Timur, ingin memahami cara integrasi KawanGizi."
                      className="mt-1.5 w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-gray-900 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 transition-colors cursor-pointer"
                  >
                    Kirim formulir <ArrowIcon />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
