const FOOD_BENEFITS = {
  'nasi putih': { category: 'Karbohidrat', benefit: 'Sumber energi utama agar siswa fokus belajar dan beraktivitas.' },
  nasi: { category: 'Karbohidrat', benefit: 'Sumber energi utama untuk aktivitas harian siswa.' },
  'nasi kuning': { category: 'Karbohidrat', benefit: 'Sumber energi dari beras dan santan untuk aktivitas belajar.' },
  'nasi goreng': { category: 'Karbohidrat', benefit: 'Sumber energi dari nasi dan minyak, padat kalori untuk aktivitas.' },
  'nasi merah': { category: 'Karbohidrat', benefit: 'Karbohidrat kompleks dan serat untuk energi tahan lama.' },
  'nasi liwet': { category: 'Karbohidrat', benefit: 'Sumber energi utama untuk aktivitas harian siswa.' },
  'nasi uduk': { category: 'Karbohidrat', benefit: 'Sumber energi dari nasi dan santan untuk aktivitas belajar.' },
  mie: { category: 'Karbohidrat', benefit: 'Sumber energi cepat dari karbohidrat.' },
  'mie goreng': { category: 'Karbohidrat', benefit: 'Sumber energi dari karbohidrat untuk aktivitas siswa.' },
  spaghetti: { category: 'Karbohidrat', benefit: 'Sumber energi dari gandum serta sedikit protein.' },
  pasta: { category: 'Karbohidrat', benefit: 'Sumber energi dari gandum untuk aktivitas harian.' },
  bihun: { category: 'Karbohidrat', benefit: 'Sumber energi ringan dari karbohidrat.' },
  kwetiau: { category: 'Karbohidrat', benefit: 'Sumber energi ringan dari karbohidrat.' },
  kentang: { category: 'Karbohidrat', benefit: 'Sumber energi dan kalium untuk fungsi otot.' },
  'kentang goreng': { category: 'Karbohidrat', benefit: 'Sumber energi dari kentang; sebaiknya porsi dibatasi.' },
  jagung: { category: 'Karbohidrat', benefit: 'Sumber energi dan serat untuk pencernaan.' },
  ubi: { category: 'Karbohidrat', benefit: 'Karbohidrat kompleks, vitamin A, dan serat.' },
  singkong: { category: 'Karbohidrat', benefit: 'Sumber energi dan serat dari umbi.' },
  talas: { category: 'Karbohidrat', benefit: 'Sumber energi, serat, dan kalium.' },
  roti: { category: 'Karbohidrat', benefit: 'Sumber energi dari gandum untuk aktivitas.' },
  biskuit: { category: 'Karbohidrat', benefit: 'Sumber energi ringan; camilan selingan.' },
  'biskuit choco chips': { category: 'Karbohidrat', benefit: 'Sumber energi ringan sebagai camilan selingan.' },
  donat: { category: 'Karbohidrat', benefit: 'Sumber energi dari gula dan tepung; konsumsi secukupnya.' },
  pizza: { category: 'Karbohidrat', benefit: 'Sumber energi dari tepung dengan tambahan protein dan lemak.' },
  burger: { category: 'Karbohidrat', benefit: 'Sumber energi dan protein dari roti dan daging.' },
  bubur: { category: 'Karbohidrat', benefit: 'Sumber energi lembut yang mudah dicerna.' },

  ayam: { category: 'Lauk Protein Hewani', benefit: 'Protein hewani untuk pertumbuhan dan perbaikan jaringan tubuh.' },
  'ayam goreng': { category: 'Lauk Protein Hewani', benefit: 'Protein hewani untuk pertumbuhan dan perbaikan otot.' },
  'ayam panggang': { category: 'Lauk Protein Hewani', benefit: 'Protein hewani rendah lemak untuk pertumbuhan.' },
  'ayam bakar': { category: 'Lauk Protein Hewani', benefit: 'Protein hewani untuk pertumbuhan dan daya tahan tubuh.' },
  'rolade ayam': { category: 'Lauk Protein Hewani', benefit: 'Protein hewani olahan untuk pertumbuhan.' },
  'sayap ayam': { category: 'Lauk Protein Hewani', benefit: 'Protein hewani untuk pertumbuhan; lemaknya cukup tinggi.' },
  nugget: { category: 'Lauk Protein Hewani', benefit: 'Protein olahan untuk pertumbuhan; perhatikan kandungan garam.' },
  sate: { category: 'Lauk Protein Hewani', benefit: 'Protein hewani dan zat besi untuk pertumbuhan.' },
  'sate ayam': { category: 'Lauk Protein Hewani', benefit: 'Protein hewani dan zat besi untuk pembentukan darah.' },
  ikan: { category: 'Lauk Protein Hewani', benefit: 'Protein, omega-3, dan mineral untuk otak dan pertumbuhan.' },
  'ikan goreng': { category: 'Lauk Protein Hewani', benefit: 'Protein dan omega-3 untuk kecerdasan serta pertumbuhan.' },
  'ikan bakar': { category: 'Lauk Protein Hewani', benefit: 'Protein dan omega-3 rendah lemak untuk pertumbuhan.' },
  cakalang: { category: 'Lauk Protein Hewani', benefit: 'Protein laut dan omega-3 untuk otak.' },
  nila: { category: 'Lauk Protein Hewani', benefit: 'Protein dan fosfor untuk pertumbuhan.' },
  lele: { category: 'Lauk Protein Hewani', benefit: 'Protein dan kalsium untuk pertumbuhan.' },
  kembung: { category: 'Lauk Protein Hewani', benefit: 'Protein dan omega-3 untuk kecerdasan.' },
  tuna: { category: 'Lauk Protein Hewani', benefit: 'Protein tinggi dan omega-3 untuk pertumbuhan.' },
  salmon: { category: 'Lauk Protein Hewani', benefit: 'Protein dan omega-3 untuk otak dan daya tahan tubuh.' },
  daging: { category: 'Lauk Protein Hewani', benefit: 'Protein, zat besi, dan zink untuk pertumbuhan.' },
  'daging sapi': { category: 'Lauk Protein Hewani', benefit: 'Protein, zat besi, dan zink untuk pertumbuhan dan darah.' },
  sapi: { category: 'Lauk Protein Hewani', benefit: 'Protein dan zat besi untuk pembentukan darah anak.' },
  rendang: { category: 'Lauk Protein Hewani', benefit: 'Protein dan zat besi dari daging berbumbu rempah.' },
  'rendang sapi': { category: 'Lauk Protein Hewani', benefit: 'Protein, zat besi, dan rempah untuk daya tahan tubuh.' },
  steak: { category: 'Lauk Protein Hewani', benefit: 'Protein dan zat besi untuk pertumbuhan otot.' },
  empal: { category: 'Lauk Protein Hewani', benefit: 'Protein dan zat besi dari daging sapi berbumbu.' },
  bakso: { category: 'Lauk Protein Hewani', benefit: 'Protein olahan untuk pertumbuhan; perhatikan kandungan garam.' },
  pempek: { category: 'Lauk Protein Hewani', benefit: 'Protein dari ikan dan tepung untuk energi.' },
  telur: { category: 'Lauk Protein Hewani', benefit: 'Protein lengkap, kolin, dan vitamin untuk pertumbuhan otak.' },
  'telur goreng': { category: 'Lauk Protein Hewani', benefit: 'Protein lengkap dan kolin untuk pertumbuhan otak.' },
  'telur rebus': { category: 'Lauk Protein Hewani', benefit: 'Protein lengkap dan kolin tanpa tambahan minyak.' },
  'telur dadar': { category: 'Lauk Protein Hewani', benefit: 'Protein lengkap dan kolin untuk pertumbuhan otak.' },
  'telur isi': { category: 'Lauk Protein Hewani', benefit: 'Protein lengkap untuk pertumbuhan dan daya tahan tubuh.' },

  tahu: { category: 'Lauk Protein Nabati', benefit: 'Protein nabati dan kalsium untuk pertumbuhan.' },
  'tahu goreng': { category: 'Lauk Protein Nabati', benefit: 'Protein nabati dan kalsium untuk pertumbuhan.' },
  tempe: { category: 'Lauk Protein Nabati', benefit: 'Protein nabati, serat, dan fermentasi baik untuk pencernaan.' },
  'tempe goreng': { category: 'Lauk Protein Nabati', benefit: 'Protein nabati dan serat dari kedelai fermentasi.' },
  kacang: { category: 'Lauk Protein Nabati', benefit: 'Protein nabati, serat, dan lemak sehat.' },
  'kacang panjang': { category: 'Lauk Protein Nabati', benefit: 'Protein nabati, serat, dan vitamin.' },
  'kacang polong': { category: 'Lauk Protein Nabati', benefit: 'Protein nabati, serat, dan vitamin.' },
  edamame: { category: 'Lauk Protein Nabati', benefit: 'Protein nabati lengkap dan serat.' },
  'kacang merah': { category: 'Lauk Protein Nabati', benefit: 'Protein nabati, serat, dan zat besi.' },
  oncom: { category: 'Lauk Protein Nabati', benefit: 'Protein nabati fermentasi untuk pencernaan.' },

  sayur: { category: 'Sayur', benefit: 'Vitamin, mineral, dan serat untuk pencernaan dan daya tahan tubuh.' },
  'sayur lodeh': { category: 'Sayur', benefit: 'Serat dan vitamin dari aneka sayur bercampur santan.' },
  'sayur urap': { category: 'Sayur', benefit: 'Serat dan vitamin dari sayur dengan kelapa parut.' },
  'tumis kangkung': { category: 'Sayur', benefit: 'Serat, zat besi, dan vitamin untuk pencernaan serta darah.' },
  kangkung: { category: 'Sayur', benefit: 'Serat, zat besi, dan vitamin A untuk penglihatan.' },
  'tumis buncis': { category: 'Sayur', benefit: 'Serat dan vitamin dari buncis untuk pencernaan.' },
  buncis: { category: 'Sayur', benefit: 'Serat dan vitamin untuk pencernaan.' },
  capcay: { category: 'Sayur', benefit: 'Serat dan vitamin dari aneka sayur tumis.' },
  'capcay sayur': { category: 'Sayur', benefit: 'Serat dan vitamin dari aneka sayur tumis.' },
  terong: { category: 'Sayur', benefit: 'Serat dan antioksidan dari terong.' },
  'terong balado': { category: 'Sayur', benefit: 'Serat dan antioksidan terong dengan bumbu cabai.' },
  brokoli: { category: 'Sayur', benefit: 'Vitamin C, serat, dan antioksidan untuk daya tahan tubuh.' },
  wortel: { category: 'Sayur', benefit: 'Vitamin A (beta-karoten) untuk kesehatan mata.' },
  'kembang kol': { category: 'Sayur', benefit: 'Vitamin C dan serat untuk daya tahan tubuh.' },
  kubis: { category: 'Sayur', benefit: 'Vitamin C, serat, dan antioksidan.' },
  seledri: { category: 'Sayur', benefit: 'Antioksidan dan mineral pelengkap hidangan.' },
  timun: { category: 'Sayur', benefit: 'Kandungan air tinggi dan mineral untuk hidrasi.' },
  labu: { category: 'Sayur', benefit: 'Vitamin A dan serat untuk penglihatan dan pencernaan.' },
  'labu siam': { category: 'Sayur', benefit: 'Serat dan vitamin untuk pencernaan.' },
  'labu air': { category: 'Sayur', benefit: 'Kandungan air dan mineral untuk hidrasi.' },
  lobak: { category: 'Sayur', benefit: 'Vitamin C dan serat untuk pencernaan.' },
  bit: { category: 'Sayur', benefit: 'Serat, folat, dan zat besi untuk darah.' },
  salad: { category: 'Sayur', benefit: 'Serat dan vitamin dari aneka sayur segar.' },
  bayam: { category: 'Sayur', benefit: 'Zat besi, folat, dan vitamin A untuk darah dan mata.' },
  sawi: { category: 'Sayur', benefit: 'Serat dan vitamin untuk pencernaan.' },
  paprika: { category: 'Sayur', benefit: 'Vitamin C dan antioksidan untuk daya tahan tubuh.' },
  bawang: { category: 'Bumbu', benefit: 'Bumbu dengan antioksidan untuk cita rasa dan daya tahan tubuh.' },
  'bawang putih': { category: 'Bumbu', benefit: 'Antioksidan dan bumbu untuk daya tahan tubuh.' },
  'bawang bombai': { category: 'Bumbu', benefit: 'Antioksidan dan bumbu untuk cita rasa.' },

  buah: { category: 'Buah', benefit: 'Vitamin C, serat, dan air untuk daya tahan serta pencernaan.' },
  apel: { category: 'Buah', benefit: 'Serat pektin dan vitamin C untuk pencernaan dan daya tahan tubuh.' },
  jeruk: { category: 'Buah', benefit: 'Vitamin C tinggi untuk daya tahan tubuh dan penyerapan zat besi.' },
  pisang: { category: 'Buah', benefit: 'Kalium dan energi cepat untuk aktivitas dan otot.' },
  kiwi: { category: 'Buah', benefit: 'Vitamin C dan serat untuk daya tahan dan pencernaan.' },
  nanas: { category: 'Buah', benefit: 'Vitamin C dan enzim bromelain untuk pencernaan.' },
  stroberi: { category: 'Buah', benefit: 'Vitamin C dan antioksidan untuk daya tahan tubuh.' },
  semangka: { category: 'Buah', benefit: 'Kandungan air tinggi dan vitamin A untuk hidrasi.' },
  pepaya: { category: 'Buah', benefit: 'Vitamin A dan enzim papain untuk pencernaan.' },
  melon: { category: 'Buah', benefit: 'Vitamin C dan air untuk hidrasi.' },
  mangga: { category: 'Buah', benefit: 'Vitamin A dan C untuk mata serta daya tahan tubuh.' },
  alpukat: { category: 'Buah', benefit: 'Lemak sehat dan serat untuk energi dan pencernaan.' },
  anggur: { category: 'Buah', benefit: 'Antioksidan dan vitamin untuk daya tahan tubuh.' },

  susu: { category: 'Minuman', benefit: 'Kalsium dan protein untuk pertumbuhan tulang dan gigi.' },
  'susu sapi': { category: 'Minuman', benefit: 'Kalsium dan protein untuk pertumbuhan tulang.' },
  'susu kedelai': { category: 'Minuman', benefit: 'Protein nabati dan kalsium untuk pertumbuhan.' },
  yogurt: { category: 'Minuman', benefit: 'Probiotik dan kalsium untuk pencernaan serta tulang.' },
  'air mineral': { category: 'Minuman', benefit: 'Menjaga hidrasi dan kebugaran tubuh.' },
  air: { category: 'Minuman', benefit: 'Menjaga hidrasi tubuh.' },

  cabai: { category: 'Bumbu', benefit: 'Vitamin C dan capsaicin untuk cita rasa dan metabolisme.' },
  tomat: { category: 'Bumbu', benefit: 'Likopen dan vitamin C untuk antioksidan.' },
}

const CATEGORY_FALLBACK = {
  karbohidrat: { category: 'Karbohidrat', benefit: 'Sumber energi untuk aktivitas belajar siswa.' },
  protein: { category: 'Lauk Protein', benefit: 'Protein untuk pertumbuhan dan perbaikan jaringan tubuh.' },
  sayur: { category: 'Sayur', benefit: 'Vitamin, mineral, dan serat untuk kesehatan.' },
  buah: { category: 'Buah', benefit: 'Vitamin dan serat untuk daya tahan serta pencernaan.' },
  minuman: { category: 'Minuman', benefit: 'Cairan dan zat gizi untuk hidrasi tubuh.' },
}

const GENERIC = { category: 'Komponen Menu', benefit: 'Melengkapi asupan zat gizi harian siswa.' }

export function normalizeFoodName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function foodBenefit(name) {
  const key = normalizeFoodName(name)
  if (!key) return { ...GENERIC }
  if (FOOD_BENEFITS[key]) return { ...FOOD_BENEFITS[key] }

  let best = ''
  for (const candidate of Object.keys(FOOD_BENEFITS)) {
    const isWord = new RegExp(`(^|\\s)${candidate}(\\s|$)`)
    if (candidate.length > best.length && isWord.test(key)) best = candidate
  }
  if (best) return { ...FOOD_BENEFITS[best] }

  for (const token of Object.keys(CATEGORY_FALLBACK)) {
    if (key.includes(token)) return { ...CATEGORY_FALLBACK[token] }
  }
  return { ...GENERIC }
}

export function buildDecisionLog({ detected = [], registeredMenu = '', verdict = '' } = {}) {
  const seen = new Set()
  const items = []
  for (const raw of detected) {
    const entry = typeof raw === 'string' ? { name: raw } : raw || {}
    const name = String(entry.name || '').trim()
    const key = normalizeFoodName(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    const benefit = foodBenefit(name)
    items.push({ name, status: entry.status || '', ...benefit })
  }

  const matchCount = items.filter((item) => item.status === 'match').length
  const mismatchCount = items.filter((item) => item.status === 'mismatch').length
  const reviewCount = items.filter((item) => item.status === 'review').length

  let matchSummary = 'Komponen hidangan belum dapat diidentifikasi dari foto.'
  if (items.length) {
    const parts = [`${items.length} komponen dikenali`]
    if (matchCount) parts.push(`${matchCount} sesuai menu batch`)
    if (mismatchCount) parts.push(`${mismatchCount} tidak sesuai`)
    if (reviewCount) parts.push(`${reviewCount} perlu ditelaah`)
    matchSummary = parts.join(', ') + '.'
  }

  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))]
  let conclusion
  if (!items.length) {
    conclusion = 'Model belum mengenali komponen hidangan dengan keyakinan memadai; lakukan pemeriksaan fisik sesuai SOP.'
  } else if (verdict === 'tolak') {
    conclusion = `Hidangan (${items.map((item) => item.name).join(', ')}) ditahan untuk pemeriksaan karena ada indikator mutu yang belum memenuhi standar.`
  } else {
    const menu = registeredMenu ? ` Menu terdaftar: ${registeredMenu}.` : ''
    conclusion = `Nampan memuat ${items.map((item) => item.name).join(', ')} yang mencakup ${categories.join(', ').toLowerCase()} untuk melengkapi kebutuhan gizi harian siswa.${menu}`
  }

  return { items, matchSummary, conclusion }
}
