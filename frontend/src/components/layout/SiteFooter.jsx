export function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white text-gray-600">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:gap-8">
          {/* Brand & Purpose */}
          <div className="md:col-span-5 space-y-3">
            <a href="/" className="inline-flex items-center gap-2 text-lg font-black tracking-tight text-gray-900">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
              <span>KawanGizi</span>
            </a>
            <p className="max-w-md text-sm leading-relaxed text-gray-600">
              Purwarupa Minimum Viable Product untuk ICONFEST 2026. Computer Vision YOLOv8 + arsitektur terdesentralisasi untuk skrining kelayakan fisik porsi & estimasi makronutrien instan sebelum distribusi ke siswa.
            </p>
            <p className="text-xs text-gray-500 pt-1">
              Pusat Uji Coba: Jakarta & Bandung &bull; Kontak: <a href="mailto:kemitraan@kawangizi.id" className="font-semibold text-gray-900 hover:underline">kemitraan@kawangizi.id</a>
            </p>
          </div>

          {/* Navigation Sections */}
          <div className="md:col-span-3 space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-900">Navigasi Platform</p>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/" className="text-gray-600 hover:text-gray-900 transition-colors">Beranda</a>
              </li>
              <li>
                <a href="/fitur" className="text-gray-600 hover:text-gray-900 transition-colors">Arsitektur & Fitur</a>
              </li>
              <li>
                <a href="/mulai" className="text-gray-600 hover:text-gray-900 transition-colors">Mulai Sekarang</a>
              </li>
              <li>
                <a href="/tentang-kami" className="text-gray-600 hover:text-gray-900 transition-colors">Tentang Kami</a>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-900">Akses & Kemitraan</p>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/login" className="text-gray-600 hover:text-gray-900 transition-colors">Portal Masuk SPPG / Dapur</a>
              </li>
              <li>
                <a href="/register" className="text-gray-600 hover:text-gray-900 transition-colors">Registrasi Dapur Wilayah Baru</a>
              </li>
              <li>
                <a href="/tentang-kami#kontak" className="text-gray-600 hover:text-gray-900 transition-colors">Formulir Konsultasi Integrasi</a>
              </li>
              <li className="pt-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  Purwarupa MVP &bull; Zero-Install
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-gray-100 pt-6 text-xs text-gray-500 sm:flex-row">
          <p>&copy; 2026 KawanGizi, purwarupa ICONFEST 2026. Seluruh hak cipta dilindungi.</p>
          <div className="flex items-center gap-4">
            <a href="/tentang-kami" className="hover:text-gray-900 transition-colors">Standar TKPI</a>
            <span>&bull;</span>
            <a href="/tentang-kami" className="hover:text-gray-900 transition-colors">Protokol HACCP 4 Jam</a>
            <span>&bull;</span>
            <a href="/tentang-kami#kontak" className="hover:text-gray-900 transition-colors">Bantuan</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
