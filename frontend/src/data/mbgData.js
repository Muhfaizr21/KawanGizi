export const ROUTES = [
  { href: '/', label: 'Home' },
  { href: '/fitur', label: 'Fitur' },
  { href: '/tentang-kami', label: 'Tentang Kami' },
]

export const SAMPLE_MENUS = [
  {
    id: 'menu-1',
    badge: 'Paket A · Pilihan Favorit Siswa',
    name: 'Nasi Ayam Panggang Madu & Capcay Brokoli',
    portion: 'Porsi SD/SMP (1 Porsi Lengkap)',
    sppg: 'SPPG 01 Menteng, Jakarta Pusat',
    cookTime: '06:15 WIB',
    calories: 545,
    protein: 34,
    carbs: 68,
    fat: 14,
    fiber: 6.2,
    freshness: 97,
    status: 'Optimal & Sangat Segar',
    temp: '23.8°C (Rentang Aman 20–25°C)',
    shelfLife: '3 Jam 15 Menit Tersisa',
    allergen: 'Mengandung wijen & kedelai alami (Bebas kacang tanah)',
    aiNotes: 'Kombinasi protein ayam madu dan serat brokoli memenuhi 35% kebutuhan energi harian anak. Suhu penyimpanan cold-chain tercatat sangat stabil prima.',
    token: 'MBG-2026-JKT-0982'
  },
  {
    id: 'menu-2',
    badge: 'Paket B · Tinggi Asam Lemak Omega-3',
    name: 'Nasi Kuning Cakalang Asap & Sayur Urap Kelapa',
    portion: 'Porsi SD/SMP (1 Porsi Lengkap)',
    sppg: 'SPPG 04 Wetan, Kota Bandung',
    cookTime: '06:30 WIB',
    calories: 510,
    protein: 31,
    carbs: 64,
    fat: 13,
    fiber: 7.1,
    freshness: 95,
    status: 'Optimal & Sangat Segar',
    temp: '24.1°C (Rentang Aman 20–25°C)',
    shelfLife: '3 Jam 45 Menit Tersisa',
    allergen: 'Ikan laut segar (Bebas gluten & produk susu)',
    aiNotes: 'Kaya asam lemak Omega-3 dan zat besi sayuran hijau untuk mendukung daya konsentrasi belajar serta perkembangan otak siswa.',
    token: 'MBG-2026-BDG-4412'
  },
  {
    id: 'menu-3',
    badge: 'Paket C · Sumber Zat Besi & Serat',
    name: 'Nasi Merah Daging Sapi Teriyaki & Tumis Buncis Tahu',
    portion: 'Porsi SD/SMP (1 Porsi Lengkap)',
    sppg: 'SPPG 02 Sleman, D.I. Yogyakarta',
    cookTime: '06:00 WIB',
    calories: 560,
    protein: 36,
    carbs: 66,
    fat: 15,
    fiber: 8.0,
    freshness: 94,
    status: 'Segar & Siap Santap',
    temp: '24.5°C (Rentang Aman 20–25°C)',
    shelfLife: '2 Jam 30 Menit Tersisa',
    allergen: 'Mengandung kedelai (Bebas telur & makanan laut)',
    aiNotes: 'Daging sapi kaya zat besi heme untuk mencegah anemia pada remaja. Karbohidrat kompleks beras merah menjaga pelepasan glukosa stabil.',
    token: 'MBG-2026-SLM-7719'
  }
]

export const ROLES_DATA = [
  {
    id: 'validator',
    role: 'Validator Lapangan',
    tag: 'Guru & Staf Sekolah',
    title: 'Pemindai Visual Kelayakan Porsi di Titik Terakhir',
    desc: 'Validator menggunakan kamera ponsel untuk memindai porsi makanan sesaat sebelum dibagikan. YOLOv8 mendeteksi anomali fisik secara instan, memberikan keputusan lolos/tidak lolos tanpa memerlukan keahlian gizi.',
    points: [
      'Akses via PWA ringan langsung dari browser atau pasang di layar utama',
      'Indikator visual: hijau (aman) / merah (tidak layak konsumsi)',
      'Estimasi makronutrien otomatis ditampilkan berdampingan',
      'Riwayat pemindaian harian tersinkron ke buku catatan digital'
    ],
    highlight: 'Pertama kali validasi kelayakan fisik jadi objektif, terukur, dan tak bergantung pada observasi manual.'
  },
  {
    id: 'superadmin',
    role: 'Super Admin',
    tag: 'BGN & Pengelola Sistem',
    title: 'Pemantauan Nasional & Peringatan Dini Anomali',
    desc: 'Super Admin memantau sebaran distribusi, kepatuhan SPPG, dan anomali kesegaran melalui dasbor web.',
    points: [
      'Peta geospasial sekolah, SPPG, dan status logistik harian',
      'Notifikasi otomatis saat lonjakan temuan tidak layak di satu titik',
      'Pelacakan batch bermasalah hingga nomor wadah & dapur asal',
      'Laporan kepatuhan AKG skala kabupaten/kota untuk evaluasi kebijakan'
    ],
    highlight: 'Transformasi pengawasan dari reaktif (pasca keracunan) ke proaktif (pencegahan sebelum distribusi).'
  },
  {
    id: 'sppg',
    role: 'SPPG / Dapur Umum',
    tag: 'Produksi & Logistik',
    title: 'Standarisasi Resep, Sensor Suhu, & Generasi QR',
    desc: 'Petugas SPPG mengelola produksi harian: input resep + gramatur bahan, kalkulasi gizi deterministik TKPI, pencatatan suhu masak & cold-chain, dan cetak QR unik per porsi.',
    points: [
      'Integrasi Tabel Komposisi Pangan Kemenkes RI (basis data resmi)',
      'Sensor IoT suhu/kelembapan otomatis merekam riwayat cold-chain',
      'Generate batch QR unik per porsi dalam hitungan detik',
      'Validasi batas aman 4 jam sejak penyajian sebelum keberangkatan'
    ],
    highlight: 'Dapur jadi sumber data terpercaya: setiap porsi punya identitas digital yang tidak bisa dimanipulasi.'
  }
]

export const SAFETY_STEPS = [
  {
    no: '01',
    title: 'Computer Vision YOLOv8',
    desc: 'Model deteksi objek real-time mengidentifikasi indikasi pembusukan dan anomali fisik porsi via kamera ponsel untuk menggantikan observasi manual subjektif.'
  },
  {
    no: '02',
    title: 'Deterministic Nutrition Engine',
    desc: 'Kalkulasi kalori, protein, karbohidrat, lemak, serat berbasis gramatur bahan & Tabel Komposisi Pangan Kemenkes, sebuah formula murni, tanpa bias generatif.'
  },
  {
    no: '03',
    title: 'Cold-Chain & Time Logging',
    desc: 'Sensor IoT suhu/kelembapan + stempel waktu masak merekam riwayat rantai dingin. Batas aman konsumsi: 4 jam sejak penyajian.'
  },
  {
    no: '04',
    title: 'Decoupled Architecture',
    desc: 'React Native (mobile validator) + Next.js (dasbor Satgas) + Golang API Gateway (concurrency) + Python AI backend dengan beban kerja terisolasi, tanpa bottleneck.'
  }
]

export const FLOW_STEPS = [
  { no: '01', title: 'Sorot Kamera', desc: 'Validator memindai porsi makanan di sekolah sebelum distribusi via aplikasi React Native.' },
  { no: '02', title: 'Deteksi YOLOv8', desc: 'Model AI mendeteksi indikasi pembusukan & anomali fisik dengan latensi rendah.' },
  { no: '03', title: 'Estimasi Makronutrien', desc: 'Kalkulasi kalori, protein, karbohidrat, lemak, serat dari data resep secara deterministik.' },
  { no: '04', title: 'Keputusan Instan', desc: 'Indikator visual (Hijau/Aman / Merah/Tidak Layak) + rincian gizi ditampilkan ke validator.' },
  { no: '05', title: 'Sinkronisasi ke Satgas', desc: 'Hasil keputusan terkirim seketika ke dasbor Next.js, sementara peta anomali & pelacakan dapur diperbarui real-time.' },
]

export const FEATURES = [
  {
    no: '01',
    title: 'Scan QR Code',
    desc: 'Pindai QR pada kemasan makanan. Validasi token dan status QR secara instan.',
  },
  {
    no: '02',
    title: 'Nutrition Engine',
    desc: 'Hitung kalori, protein, karbohidrat, lemak, serat, dan nutrisi dari data bahan secara deterministik.',
  },
  {
    no: '03',
    title: 'Freshness & AI Analysis',
    desc: 'Analisis kesegaran berdasarkan waktu produksi, suhu, dan kelembapan. AI memberikan penjelasan ringkas hasil analisis.',
  },
  {
    no: '04',
    title: 'Monitoring & Audit',
    desc: 'Pengawasan terpusat bagi sekolah dan Dinas Kesehatan untuk memantau asupan gizi harian siswa.',
  },
]

export const FAQS = [
  {
    q: 'Bagaimana sistem KawanGizi memastikan deteksi kelayakan porsi akurat tanpa spekulasi?',
    a: 'Model YOLOv8 dilatih dengan dataset anomali fisik (pembusukan, kontaminasi) dari porsi makanan sebenarnya dan tidak menggunakan fitur generatif. Setiap prediksi berbasis bobot konfidensi yang terukur.'
  },
  {
    q: 'Apakah orang tua dan siswa perlu memasang aplikasi khusus untuk memindai porsi?',
    a: 'Tidak wajib! Cukup buka kamera smartphone dan arahkan ke label porsi. Sistem akan membuka halaman web instan yang menampilkan data menu, nutrisi, suhu, serta hasil deteksi YOLOv8 secara real-time.'
  },
  {
    q: 'Bagaimana sistem menghitung kalori dan makronutrien porsi makanan?',
    a: 'Nutrition Engine KawanGizi menggunakan Tabel Komposisi Pangan Kemenkes RI sebagai dasar perhitungan deterministik. Petugas SPPG memasukkan gramatur bahan baku saat produksi, sehingga kalkulasi kalori dan makronutrisi bersifat matematis pasti tanpa asumsi.'
  },
  {
    q: 'Bagaimana sistem memastikan tidak ada makanan yang melewati batas aman 4 jam sejak penyajian?',
    a: 'Setiap batch produksi mencatat stempel waktu masak dan riwayat sensor suhu IoT. Sistem menolak pemindaian jika selisih waktu saat ini > 4 jam sejak waktu masak terakhir yang tercatat.'
  },
  {
    q: 'Apa yang terjadi jika model AI mendeteksi indikasi pembusukan pada suatu porsi?',
    a: 'Sistem akan menampilkan peringatan merah "Tidak Layak Konsumsi" pada layar validator, mencatat kejadian ke database utama, dan secara otomatis mengirim notifikasi ke Satgas MBG untuk pelacakan dapur penyuplai serta pembekuan sementara distribusi dari batch terkait.'
  }
]

export const REGIONAL_DEMOGRAPHICS = [
  {
    id: 'all',
    label: 'Nasional (Semua Wilayah)',
    badge: 'Cakupan Terintegrasi 38 Provinsi',
    totalStudents: '542.850',
    totalSchools: '1.248',
    activeKitchens: '128',
    onTimeRate: '99.4%',
    freshnessAvg: '96.8%',
    sdRatio: 68,
    smpRatio: 32,
    avgTemp: '23.8°C',
    description: 'Pemantauan komprehensif distribusi porsi makan bergizi gratis harian lintas klaster pendidikan dari Sabang sampai Merauke secara real-time.',
    topDistricts: [
      { name: 'DKI Jakarta & Bodetabek', students: '168.200 Siswa', schools: '382 Sekolah', status: 'Optimal' },
      { name: 'Bandung Raya & Priangan', students: '114.500 Siswa', schools: '264 Sekolah', status: 'Optimal' },
      { name: 'Semarang & Solo Raya', students: '98.400 Siswa', schools: '228 Sekolah', status: 'Optimal' },
      { name: 'Surabaya & Gerbangkertosusila', students: '102.750 Siswa', schools: '236 Sekolah', status: 'Optimal' },
      { name: 'Medan, Makassar & Jayapura', students: '59.000 Siswa', schools: '138 Sekolah', status: 'Optimal' },
    ],
    hotspots: [
      { id: 'jkt', label: 'DKI Jakarta', x: 26, y: 72, portions: '168k', status: 'Lancar', schools: 382, sppg: 42 },
      { id: 'bdg', label: 'Bandung & Jabar', x: 30, y: 75, portions: '114k', status: 'Lancar', schools: 264, sppg: 28 },
      { id: 'smg', label: 'Jawa Tengah', x: 36, y: 76, portions: '98k', status: 'Lancar', schools: 228, sppg: 24 },
      { id: 'sby', label: 'Jawa Timur', x: 44, y: 78, portions: '102k', status: 'Lancar', schools: 236, sppg: 22 },
      { id: 'mdn', label: 'Medan & Sumut', x: 14, y: 28, portions: '24k', status: 'Lancar', schools: 58, sppg: 6 },
      { id: 'mks', label: 'Makassar & Sulsel', x: 60, y: 64, portions: '21k', status: 'Lancar', schools: 48, sppg: 4 },
      { id: 'dps', label: 'Bali & Nusra', x: 50, y: 81, portions: '15k', status: 'Lancar', schools: 32, sppg: 4 },
      { id: 'jyp', label: 'Jayapura & Papua', x: 92, y: 66, portions: '8k', status: 'Lancar', schools: 20, sppg: 2 },
    ]
  },
  {
    id: 'jkt',
    label: 'DKI Jakarta & Banten',
    badge: 'Metropolitan & Urban Core',
    totalStudents: '168.200',
    totalSchools: '382',
    activeKitchens: '42',
    onTimeRate: '99.7%',
    freshnessAvg: '97.4%',
    sdRatio: 65,
    smpRatio: 35,
    avgTemp: '23.4°C',
    description: 'Armada logistik berpendingin khusus melayani sekolah-sekolah di wilayah urban padat dengan radius kirim rata-rata 18 menit dari SPPG terdekat.',
    topDistricts: [
      { name: 'Jakarta Timur & Pusat', students: '56.400 Siswa', schools: '128 Sekolah', status: 'Optimal' },
      { name: 'Jakarta Selatan & Barat', students: '52.100 Siswa', schools: '118 Sekolah', status: 'Optimal' },
      { name: 'Tangerang Raya & Banten', students: '38.500 Siswa', schools: '86 Sekolah', status: 'Optimal' },
      { name: 'Jakarta Utara & Kep. Seribu', students: '21.200 Siswa', schools: '50 Sekolah', status: 'Optimal' },
    ],
    hotspots: [
      { id: 'jkt-core', label: 'Jakarta Core Hub', x: 26, y: 72, portions: '129k', status: 'Lancar', schools: 296, sppg: 34 },
      { id: 'tgr-hub', label: 'Tangerang & Banten Hub', x: 23, y: 71, portions: '39k', status: 'Lancar', schools: 86, sppg: 8 },
    ]
  },
  {
    id: 'jabar_jateng',
    label: 'Jawa Barat & Jateng',
    badge: 'Sabuk Jawa Barat - Tengah',
    totalStudents: '212.900',
    totalSchools: '492',
    activeKitchens: '52',
    onTimeRate: '99.2%',
    freshnessAvg: '96.5%',
    sdRatio: 70,
    smpRatio: 30,
    avgTemp: '23.9°C',
    description: 'Konektivitas SPPG sentral di Bandung, Bogor, Semarang, hingga Solo melayani area perkotaan hingga pedesaan secara terjadwal ketat.',
    topDistricts: [
      { name: 'Bandung Raya & Cimahi', students: '64.800 Siswa', schools: '148 Sekolah', status: 'Optimal' },
      { name: 'Semarang & Solo Raya', students: '58.200 Siswa', schools: '136 Sekolah', status: 'Optimal' },
      { name: 'Bogor & Depok Koridor', students: '49.700 Siswa', schools: '116 Sekolah', status: 'Optimal' },
      { name: 'Banyumas & Pantura', students: '40.200 Siswa', schools: '92 Sekolah', status: 'Optimal' },
    ],
    hotspots: [
      { id: 'bdg', label: 'Bandung Raya Hub', x: 30, y: 75, portions: '114k', status: 'Lancar', schools: 264, sppg: 28 },
      { id: 'smg', label: 'Semarang Hub', x: 36, y: 76, portions: '98k', status: 'Lancar', schools: 228, sppg: 24 },
    ]
  },
  {
    id: 'diy_jatim',
    label: 'D.I. Yogyakarta & Jatim',
    badge: 'Klaster Mataram & Gerbangkertosusila',
    totalStudents: '102.750',
    totalSchools: '236',
    activeKitchens: '22',
    onTimeRate: '99.5%',
    freshnessAvg: '96.9%',
    sdRatio: 67,
    smpRatio: 33,
    avgTemp: '23.7°C',
    description: 'Pemanfaatan jalur logistik trans-Jawa mendukung efisiensi distribusi cepat dari lumbung pangan lokal langsung ke piring makan siswa.',
    topDistricts: [
      { name: 'Surabaya & Sidoarjo', students: '44.300 Siswa', schools: '102 Sekolah', status: 'Optimal' },
      { name: 'Sleman, Bantul & Kota Yogya', students: '32.150 Siswa', schools: '74 Sekolah', status: 'Optimal' },
      { name: 'Malang Raya & Pasuruan', students: '26.300 Siswa', schools: '60 Sekolah', status: 'Optimal' },
    ],
    hotspots: [
      { id: 'ygy', label: 'Yogyakarta Hub', x: 38, y: 78, portions: '32k', status: 'Lancar', schools: 74, sppg: 8 },
      { id: 'sby', label: 'Surabaya Hub', x: 44, y: 78, portions: '70k', status: 'Lancar', schools: 162, sppg: 14 },
    ]
  },
  {
    id: 'luar_jawa',
    label: 'Luar Jawa (Sumatera, Sulawesi, Papua)',
    badge: 'Konektivitas Nusantara & Kepulauan',
    totalStudents: '59.000',
    totalSchools: '138',
    activeKitchens: '12',
    onTimeRate: '98.8%',
    freshnessAvg: '96.1%',
    sdRatio: 72,
    smpRatio: 28,
    avgTemp: '24.2°C',
    description: 'Integrasi rantai pasok dengan kearifan pangan lokal dan logistik terdesentralisasi melayani sentra sekolah kepulauan di luar pulau Jawa.',
    topDistricts: [
      { name: 'Medan & Deli Serdang', students: '24.000 Siswa', schools: '58 Sekolah', status: 'Optimal' },
      { name: 'Makassar & Gowa', students: '21.000 Siswa', schools: '48 Sekolah', status: 'Optimal' },
      { name: 'Jayapura & Sentani', students: '8.000 Siswa', schools: '20 Sekolah', status: 'Optimal' },
      { name: 'Denpasar & Badung', students: '6.000 Siswa', schools: '12 Sekolah', status: 'Optimal' },
    ],
    hotspots: [
      { id: 'mdn', label: 'Medan Hub', x: 14, y: 28, portions: '24k', status: 'Lancar', schools: 58, sppg: 6 },
      { id: 'mks', label: 'Makassar Hub', x: 60, y: 64, portions: '21k', status: 'Lancar', schools: 48, sppg: 4 },
      { id: 'dps', label: 'Denpasar Hub', x: 50, y: 81, portions: '6k', status: 'Lancar', schools: 12, sppg: 2 },
      { id: 'jyp', label: 'Jayapura Hub', x: 92, y: 66, portions: '8k', status: 'Lancar', schools: 20, sppg: 2 },
    ]
  }
]

export const LIVE_DELIVERIES = [
  {
    id: 'del-1',
    school: 'SDN 01 Menteng Pagi',
    sppg: 'SPPG 01 Menteng',
    city: 'Jakarta Pusat',
    portions: 480,
    time: '07:12 WIB',
    temp: '23.4°C',
    status: 'Tiba & Tervalidasi',
    quality: 'Sangat Segar (98%)'
  },
  {
    id: 'del-2',
    school: 'SMPN 2 Bandung Wetan',
    sppg: 'SPPG 04 Wetan',
    city: 'Kota Bandung',
    portions: 620,
    time: '07:18 WIB',
    temp: '23.8°C',
    status: 'Tiba & Tervalidasi',
    quality: 'Sangat Segar (97%)'
  },
  {
    id: 'del-3',
    school: 'SDN Percobaan 1 Sleman',
    sppg: 'SPPG 02 Sleman',
    city: 'D.I. Yogyakarta',
    portions: 410,
    time: '07:25 WIB',
    temp: '24.1°C',
    status: 'Tiba & Tervalidasi',
    quality: 'Segar Optimal (96%)'
  },
  {
    id: 'del-4',
    school: 'SMPN 1 Surabaya Pusat',
    sppg: 'SPPG 03 Gubeng',
    city: 'Kota Surabaya',
    portions: 550,
    time: '07:35 WIB',
    temp: '23.6°C',
    status: 'Tiba & Tervalidasi',
    quality: 'Sangat Segar (97%)'
  },
  {
    id: 'del-5',
    school: 'SDN Kompleks IKIP Makassar',
    sppg: 'SPPG 01 Tamalate',
    city: 'Kota Makassar',
    portions: 390,
    time: '07:40 WITA',
    temp: '24.0°C',
    status: 'Tiba & Tervalidasi',
    quality: 'Segar Optimal (95%)'
  },
  {
    id: 'del-6',
    school: 'SD Inpres Kotaraja',
    sppg: 'SPPG 01 Abepura',
    city: 'Kota Jayapura',
    portions: 320,
    time: '07:45 WIT',
    temp: '24.3°C',
    status: 'Tiba & Tervalidasi',
    quality: 'Segar Optimal (95%)'
  }
]

export const GIS_REGIONS = [
  { id: 'all', label: 'Seluruh Nusantara', center: [-2.5489, 118.0149], zoom: 5 },
  { id: 'jkt', label: 'DKI Jakarta & Banten', center: [-6.2088, 106.8456], zoom: 12 },
  { id: 'jabar', label: 'Jawa Barat (Bandung & Bogor)', center: [-6.9030, 107.6180], zoom: 12 },
  { id: 'jateng_diy', label: 'Jateng & D.I. Yogyakarta', center: [-7.7550, 110.3700], zoom: 11 },
  { id: 'jatim', label: 'Jawa Timur (Surabaya)', center: [-7.2750, 112.7520], zoom: 12 },
  { id: 'sumatera', label: 'Sumatera (Medan)', center: [3.5850, 98.6850], zoom: 12 },
  { id: 'sulawesi', label: 'Sulawesi (Makassar)', center: [-5.1650, 119.4200], zoom: 12 },
  { id: 'papua', label: 'Papua (Jayapura)', center: [-2.5950, 140.6720], zoom: 12 },
]

export const GIS_NODES = [
  // DKI Jakarta & Bodetabek
  {
    id: 'sppg-jkt-1',
    regionId: 'jkt',
    type: 'sppg',
    name: 'SPPG 01 Menteng Sentral',
    cluster: 'Jakarta Pusat',
    lat: -6.1950,
    lng: 106.8340,
    capacity: '2.500 porsi/hari',
    temp: '23.2°C',
    activeSchools: 8,
    status: 'Beroperasi Optimal'
  },
  {
    id: 'sch-jkt-1',
    regionId: 'jkt',
    type: 'school',
    sppgId: 'sppg-jkt-1',
    name: 'SDN 01 Menteng Pagi',
    cluster: 'Jakarta Pusat',
    lat: -6.1910,
    lng: 106.8315,
    portions: 480,
    level: 'SD / MI',
    deliveryTime: '07:12 WIB',
    temp: '23.4°C',
    freshness: 98,
    status: 'Tiba & Tervalidasi'
  },
  {
    id: 'sch-jkt-2',
    regionId: 'jkt',
    type: 'school',
    sppgId: 'sppg-jkt-1',
    name: 'SMPN 1 Cikini Raya',
    cluster: 'Jakarta Pusat',
    lat: -6.1905,
    lng: 106.8395,
    portions: 520,
    level: 'SMP / MTs',
    deliveryTime: '07:20 WIB',
    temp: '23.6°C',
    freshness: 97,
    status: 'Tiba & Tervalidasi'
  },
  {
    id: 'sppg-jkt-2',
    regionId: 'jkt',
    type: 'sppg',
    name: 'SPPG 02 Kebayoran Baru',
    cluster: 'Jakarta Selatan',
    lat: -6.2420,
    lng: 106.7970,
    capacity: '2.800 porsi/hari',
    temp: '23.5°C',
    activeSchools: 10,
    status: 'Beroperasi Optimal'
  },
  {
    id: 'sch-jkt-3',
    regionId: 'jkt',
    type: 'school',
    sppgId: 'sppg-jkt-2',
    name: 'SMPN 11 Kebayoran Baru',
    cluster: 'Jakarta Selatan',
    lat: -6.2380,
    lng: 106.8020,
    portions: 590,
    level: 'SMP / MTs',
    deliveryTime: '07:15 WIB',
    temp: '23.5°C',
    freshness: 97,
    status: 'Tiba & Tervalidasi'
  },
  {
    id: 'sch-jkt-4',
    regionId: 'jkt',
    type: 'school',
    sppgId: 'sppg-jkt-2',
    name: 'SDN 03 Tebet Barat',
    cluster: 'Jakarta Selatan',
    lat: -6.2360,
    lng: 106.8520,
    portions: 410,
    level: 'SD / MI',
    deliveryTime: '07:28 WIB',
    temp: '23.7°C',
    freshness: 96,
    status: 'Tiba & Tervalidasi'
  },
  {
    id: 'sppg-tgr-1',
    regionId: 'jkt',
    type: 'sppg',
    name: 'SPPG 05 Tangerang Kota',
    cluster: 'Kota Tangerang',
    lat: -6.1780,
    lng: 106.6300,
    capacity: '2.400 porsi/hari',
    temp: '23.6°C',
    activeSchools: 7,
    status: 'Beroperasi Optimal'
  },
  {
    id: 'sch-tgr-1',
    regionId: 'jkt',
    type: 'school',
    sppgId: 'sppg-tgr-1',
    name: 'SDN 1 Sukasari Tangerang',
    cluster: 'Kota Tangerang',
    lat: -6.1820,
    lng: 106.6340,
    portions: 430,
    level: 'SD / MI',
    deliveryTime: '07:30 WIB',
    temp: '23.8°C',
    freshness: 96,
    status: 'Tiba & Tervalidasi'
  },

  // Jawa Barat (Bandung & Bogor)
  {
    id: 'sppg-bdg-1',
    regionId: 'jabar',
    type: 'sppg',
    name: 'SPPG 04 Bandung Wetan',
    cluster: 'Kota Bandung',
    lat: -6.9030,
    lng: 107.6180,
    capacity: '2.600 porsi/hari',
    temp: '23.4°C',
    activeSchools: 9,
    status: 'Beroperasi Optimal'
  },
  {
    id: 'sch-bdg-1',
    regionId: 'jabar',
    type: 'school',
    sppgId: 'sppg-bdg-1',
    name: 'SMPN 2 Bandung Wetan',
    cluster: 'Kota Bandung',
    lat: -6.9070,
    lng: 107.6140,
    portions: 620,
    level: 'SMP / MTs',
    deliveryTime: '07:18 WIB',
    temp: '23.8°C',
    freshness: 97,
    status: 'Tiba & Tervalidasi'
  },
  {
    id: 'sch-bdg-2',
    regionId: 'jabar',
    type: 'school',
    sppgId: 'sppg-bdg-1',
    name: 'SDN Merdeka 5 Bandung',
    cluster: 'Kota Bandung',
    lat: -6.9120,
    lng: 107.6120,
    portions: 380,
    level: 'SD / MI',
    deliveryTime: '07:22 WIB',
    temp: '23.4°C',
    freshness: 98,
    status: 'Tiba & Tervalidasi'
  },
  {
    id: 'sppg-bgr-1',
    regionId: 'jabar',
    type: 'sppg',
    name: 'SPPG 06 Bogor Pajajaran',
    cluster: 'Kota Bogor',
    lat: -6.5950,
    lng: 106.8060,
    capacity: '2.200 porsi/hari',
    temp: '23.3°C',
    activeSchools: 8,
    status: 'Beroperasi Optimal'
  },
  {
    id: 'sch-bgr-1',
    regionId: 'jabar',
    type: 'school',
    sppgId: 'sppg-bgr-1',
    name: 'SDN Polisi 1 Bogor',
    cluster: 'Kota Bogor',
    lat: -6.5980,
    lng: 106.7920,
    portions: 510,
    level: 'SD / MI',
    deliveryTime: '07:25 WIB',
    temp: '23.5°C',
    freshness: 97,
    status: 'Tiba & Tervalidasi'
  },

  // Jateng & DIY
  {
    id: 'sppg-diy-1',
    regionId: 'jateng_diy',
    type: 'sppg',
    name: 'SPPG 02 Sleman Mandiri',
    cluster: 'D.I. Yogyakarta',
    lat: -7.7550,
    lng: 110.3700,
    capacity: '2.100 porsi/hari',
    temp: '23.8°C',
    activeSchools: 7,
    status: 'Beroperasi Optimal'
  },
  {
    id: 'sch-diy-1',
    regionId: 'jateng_diy',
    type: 'school',
    sppgId: 'sppg-diy-1',
    name: 'SDN Percobaan 1 Sleman',
    cluster: 'D.I. Yogyakarta',
    lat: -7.7680,
    lng: 110.3850,
    portions: 410,
    level: 'SD / MI',
    deliveryTime: '07:25 WIB',
    temp: '24.1°C',
    freshness: 96,
    status: 'Tiba & Tervalidasi'
  },
  {
    id: 'sch-diy-2',
    regionId: 'jateng_diy',
    type: 'school',
    sppgId: 'sppg-diy-1',
    name: 'SMPN 5 Kota Yogyakarta',
    cluster: 'D.I. Yogyakarta',
    lat: -7.7870,
    lng: 110.3720,
    portions: 580,
    level: 'SMP / MTs',
    deliveryTime: '07:35 WIB',
    temp: '23.9°C',
    freshness: 96,
    status: 'Tiba & Tervalidasi'
  },
  {
    id: 'sppg-smg-1',
    regionId: 'jateng_diy',
    type: 'sppg',
    name: 'SPPG 07 Semarang Simpang Lima',
    cluster: 'Kota Semarang',
    lat: -6.9930,
    lng: 110.4200,
    capacity: '2.700 porsi/hari',
    temp: '23.7°C',
    activeSchools: 9,
    status: 'Beroperasi Optimal'
  },
  {
    id: 'sch-smg-1',
    regionId: 'jateng_diy',
    type: 'school',
    sppgId: 'sppg-smg-1',
    name: 'SDN Pekunden Semarang',
    cluster: 'Kota Semarang',
    lat: -6.9890,
    lng: 110.4150,
    portions: 470,
    level: 'SD / MI',
    deliveryTime: '07:28 WIB',
    temp: '23.7°C',
    freshness: 97,
    status: 'Tiba & Tervalidasi'
  },

  // Jawa Timur (Surabaya & Malang)
  {
    id: 'sppg-sby-1',
    regionId: 'jatim',
    type: 'sppg',
    name: 'SPPG 03 Gubeng Sentral',
    cluster: 'Kota Surabaya',
    lat: -7.2750,
    lng: 112.7520,
    capacity: '3.200 porsi/hari',
    temp: '23.5°C',
    activeSchools: 11,
    status: 'Beroperasi Optimal'
  },
  {
    id: 'sch-sby-1',
    regionId: 'jatim',
    type: 'school',
    sppgId: 'sppg-sby-1',
    name: 'SMPN 1 Surabaya Pusat',
    cluster: 'Kota Surabaya',
    lat: -7.2610,
    lng: 112.7430,
    portions: 550,
    level: 'SMP / MTs',
    deliveryTime: '07:35 WIB',
    temp: '23.6°C',
    freshness: 97,
    status: 'Tiba & Tervalidasi'
  },
  {
    id: 'sch-sby-2',
    regionId: 'jatim',
    type: 'school',
    sppgId: 'sppg-sby-1',
    name: 'SDN Kaliasin 1 Surabaya',
    cluster: 'Kota Surabaya',
    lat: -7.2650,
    lng: 112.7410,
    portions: 490,
    level: 'SD / MI',
    deliveryTime: '07:38 WIB',
    temp: '23.8°C',
    freshness: 96,
    status: 'Tiba & Tervalidasi'
  },

  // Sumatera (Medan)
  {
    id: 'sppg-mdn-1',
    regionId: 'sumatera',
    type: 'sppg',
    name: 'SPPG 10 Medan Maimun',
    cluster: 'Kota Medan',
    lat: 3.5850,
    lng: 98.6850,
    capacity: '2.400 porsi/hari',
    temp: '23.8°C',
    activeSchools: 8,
    status: 'Beroperasi Optimal'
  },
  {
    id: 'sch-mdn-1',
    regionId: 'sumatera',
    type: 'school',
    sppgId: 'sppg-mdn-1',
    name: 'SDN 060822 Medan Petisah',
    cluster: 'Kota Medan',
    lat: 3.5920,
    lng: 98.6710,
    portions: 460,
    level: 'SD / MI',
    deliveryTime: '07:30 WIB',
    temp: '24.1°C',
    freshness: 96,
    status: 'Tiba & Tervalidasi'
  },
  {
    id: 'sch-mdn-2',
    regionId: 'sumatera',
    type: 'school',
    sppgId: 'sppg-mdn-1',
    name: 'SMPN 1 Kota Medan',
    cluster: 'Kota Medan',
    lat: 3.5900,
    lng: 98.6750,
    portions: 600,
    level: 'SMP / MTs',
    deliveryTime: '07:34 WIB',
    temp: '23.9°C',
    freshness: 96,
    status: 'Tiba & Tervalidasi'
  },

  // Sulawesi (Makassar)
  {
    id: 'sppg-mks-1',
    regionId: 'sulawesi',
    type: 'sppg',
    name: 'SPPG 11 Tamalate Sentra',
    cluster: 'Kota Makassar',
    lat: -5.1650,
    lng: 119.4200,
    capacity: '2.200 porsi/hari',
    temp: '23.9°C',
    activeSchools: 7,
    status: 'Beroperasi Optimal'
  },
  {
    id: 'sch-mks-1',
    regionId: 'sulawesi',
    type: 'school',
    sppgId: 'sppg-mks-1',
    name: 'SDN Kompleks IKIP Makassar',
    cluster: 'Kota Makassar',
    lat: -5.1720,
    lng: 119.4320,
    portions: 390,
    level: 'SD / MI',
    deliveryTime: '07:40 WITA',
    temp: '24.0°C',
    freshness: 95,
    status: 'Tiba & Tervalidasi'
  },
  {
    id: 'sch-mks-2',
    regionId: 'sulawesi',
    type: 'school',
    sppgId: 'sppg-mks-1',
    name: 'SMPN 6 Kota Makassar',
    cluster: 'Kota Makassar',
    lat: -5.1480,
    lng: 119.4120,
    portions: 510,
    level: 'SMP / MTs',
    deliveryTime: '07:44 WITA',
    temp: '23.9°C',
    freshness: 96,
    status: 'Tiba & Tervalidasi'
  },

  // Papua (Jayapura)
  {
    id: 'sppg-jyp-1',
    regionId: 'papua',
    type: 'sppg',
    name: 'SPPG 13 Abepura Perintis',
    cluster: 'Kota Jayapura',
    lat: -2.5950,
    lng: 140.6720,
    capacity: '1.500 porsi/hari',
    temp: '24.1°C',
    activeSchools: 5,
    status: 'Beroperasi Optimal'
  },
  {
    id: 'sch-jyp-1',
    regionId: 'papua',
    type: 'school',
    sppgId: 'sppg-jyp-1',
    name: 'SD Inpres Kotaraja Jayapura',
    cluster: 'Kota Jayapura',
    lat: -2.5980,
    lng: 140.6650,
    portions: 320,
    level: 'SD / MI',
    deliveryTime: '07:45 WIT',
    temp: '24.3°C',
    freshness: 95,
    status: 'Tiba & Tervalidasi'
  }
]

export const OPERATIONAL_MATRIX = [
  {
    region: 'DKI Jakarta & Bodetabek',
    province: 'DKI Jakarta & Banten',
    hub: '42 Dapur Sentral',
    schools: '382 Titik Sekolah',
    portions: '168.200 porsi/hari',
    window: '06:45 – 07:30 WIB',
    status: 'Distribusi Terjadwal',
    tempRange: '23.4°C',
  },
  {
    region: 'Bandung Raya & Priangan',
    province: 'Jawa Barat',
    hub: '32 Dapur Sentral',
    schools: '296 Titik Sekolah',
    portions: '134.500 porsi/hari',
    window: '06:45 – 07:30 WIB',
    status: 'Distribusi Terjadwal',
    tempRange: '23.8°C',
  },
  {
    region: 'Semarang, Solo & Sleman',
    province: 'Jateng & D.I. Yogyakarta',
    hub: '28 Dapur Sentral',
    schools: '258 Titik Sekolah',
    portions: '112.400 porsi/hari',
    window: '06:45 – 07:30 WIB',
    status: 'Distribusi Terjadwal',
    tempRange: '23.7°C',
  },
  {
    region: 'Surabaya & Malang Raya',
    province: 'Jawa Timur',
    hub: '22 Dapur Sentral',
    schools: '212 Titik Sekolah',
    portions: '98.750 porsi/hari',
    window: '06:45 – 07:30 WIB',
    status: 'Distribusi Terjadwal',
    tempRange: '23.6°C',
  },
  {
    region: 'Sentra Kawasan Luar Jawa',
    province: 'Medan, Makassar & Jayapura',
    hub: '24 Dapur Sentral',
    schools: '200 Titik Sekolah',
    portions: '78.000 porsi/hari',
    window: '07:00 – 07:45 Waktu Lokal',
    status: 'Distribusi Terjadwal',
    tempRange: '24.1°C',
  },
]

