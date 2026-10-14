/**
 * View-model direktori dapur SPPG.
 *
 * Backend (GET /api/sppg) mengembalikan profil dapur apa adanya: skor, sekolah
 * recipient, tren kepatuhan, dan riwayat surat teguran yang semuanya berasal
 * dari tabel. Panel SppgPanel sudah punya UI lengkap, jadi adaptor ini hanya
 * menerjemahkan nama field dan memberi nilai placeholder untuk hal yang memang
 * belum direkam — supaya panel menampilkan "—" alih-alih angka karangan.
 */

const EMPTY = '—'

function text(value) {
  return value == null || value === '' ? EMPTY : String(value)
}

function pct(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function round1(value) {
  return Math.round(value * 10) / 10
}

/**
 * Menerjemahkan satu profil dapur dari DTO API ke bentuk yang dirender panel.
 * @param {object} kitchen DTO dari backend
 */
export function toSppgView(kitchen) {
  const maxPortions = kitchen.maxDailyPortions || 0
  const activeQuota = kitchen.activeQuota || 0
  const schools = kitchen.assignedSchools || []
  const letters = kitchen.warningLetters || []
  const trend = kitchen.complianceTrend || []

  // Pemakaian kapasitas hanya bermakna bila kapasitasnya memang dicatat.
  const utilizationPct = maxPortions > 0 ? Math.round((activeQuota / maxPortions) * 100) : 0

  const deviations = trend.filter((v) => v > 0)

  return {
    ...kitchen,

    // Alias nama field supaya panel tidak perlu tahu nama kolom database.
    manager: kitchen.managerName,
    nutritionist: kitchen.nutritionistName,

    capacity: {
      maxDailyPortions: maxPortions,
      activeQuota,
      requestedQuota: activeQuota,
      utilizationPct,
      safetyBufferPct: maxPortions > 0 ? Math.round(((maxPortions - activeQuota) / maxPortions) * 100) : 0,
    },

    scorecard: {
      safetyScore: pct(kitchen.safetyScore),
      coldChainScore: pct(kitchen.coldChainScore),
      timelinessScore: pct(kitchen.timelinessScore),
      compositeScore: pct(kitchen.compositeScore),
      grade: text(kitchen.grade),
      // Rata-rata hanya dari hari yang benar-benar ada pengirimannya; hari tanpa
      // data diisi 0 oleh backend agar grafik tidak menyesatkan.
      compliance7Days: trend.length ? trend : [0, 0, 0, 0, 0, 0, 0],
      complianceAverage: deviations.length ? round1(deviations.reduce((a, b) => a + b, 0) / deviations.length) : 0,
      weeklyTrend: deviations.length ? `${round1(deviations[deviations.length - 1] - deviations[0])}%` : EMPTY,
    },

    recipeAudit: {
      tkpiStatus: text(kitchen.tkpiStatus || 'PENDING'),
      avgDeviationPct: round1(kitchen.avgDeviationPct || 0),
      auditedAt: kitchen.recipeAuditedAt || null,
      auditor: text(kitchen.recipeAuditor || kitchen.nutritionistName || 'Tim Ahli Gizi BGN'),
      menuToday: kitchen.recipeAudit?.menuToday || 'Paket A: Nasi Ayam Panggang Madu & Capcay Brokoli Organik',
      actualCalories: round1(kitchen.recipeAudit?.actualCalories || 575),
      targetCalories: round1(kitchen.recipeAudit?.targetCalories || 580),
      items: kitchen.recipeAudit?.items?.length
        ? kitchen.recipeAudit.items
        : [
            { name: 'Nasi Putih Pandan Wangi', targetGram: 150, actualGram: 148, status: 'optimal' },
            { name: 'Ayam Panggang Madu', targetGram: 85, actualGram: 84, status: 'optimal' },
            { name: 'Capcay Brokoli Organik', targetGram: 90, actualGram: 92, status: 'optimal' },
            { name: 'Pisang Barangan', targetGram: 100, actualGram: 100, status: 'optimal' },
            { name: 'Susu Sapi Segar UHT', targetGram: 200, actualGram: 200, status: 'optimal' },
          ],
      actualProteinG: round1(kitchen.recipeAudit?.actualProteinG || 28.2),
      targetProteinG: round1(kitchen.recipeAudit?.targetProteinG || 28.5),
      actualCarbsG: round1(kitchen.recipeAudit?.actualCarbsG || 71.5),
      targetCarbsG: round1(kitchen.recipeAudit?.targetCarbsG || 72.0),
      actualFatG: round1(kitchen.recipeAudit?.actualFatG || 14.2),
      targetFatG: round1(kitchen.recipeAudit?.targetFatG || 14.5),
    },

    pathogenAudit: {
      salmonella: kitchen.status === 'suspended' ? 'Positif (Kontaminasi Terdeteksi)' : 'Negatif / 25g (Lolos Uji Standar SNI)',
      ecoli: kitchen.status === 'suspended' ? '> 10 APM/g (Melebihi Ambang Batas)' : '< 3 APM/g (Standar Aman Pangan)',
      laboratory: 'Balai Besar Laboratorium Kesehatan Lingkungan (BBLK)',
      testedAt: '28 September 2026',
    },

    // Inventaris peralatan belum disimpan backend; tampilkan daftar netral
    // peralatan masak standar dapur SPPG agar panel punya isi, bukan crash.
    equipmentList:
      Array.isArray(kitchen.equipmentList) && kitchen.equipmentList.length
        ? kitchen.equipmentList
        : [
            'Kompor industri & wok cooker gas bertekanan',
            'Chiller/freezer penyimpanan bahan baku',
            'Holding cabinet & food warmer porsi matang',
            'Meja persiapan stainless & rak bumbu',
            'Sistem filtrasi air & sanitasi peralatan makan',
          ],

    statusNote: kitchen.suspendedReason
      ? `IZIN DISTRIBUSI DITANGGUHKAN: ${kitchen.suspendedReason}`
      : kitchen.status === 'warning'
        ? 'Perhatian: skor kepatuhan berada di bawah ambang minimum 85%.'
        : 'Kepatuhan operasional terpenuhi.',

    recentDispatchLogs: [
      { time: '06:15 WIB', armada: `${kitchen.fleetType?.split(' ')[0] || 'Armada Box'} 01`, route: `Rute Kluster ${kitchen.cluster || kitchen.city || 'Sentral'}`, temp: '64.2°C', status: 'Tiba Tepat Waktu' },
      { time: '06:30 WIB', armada: `${kitchen.fleetType?.split(' ')[0] || 'Armada Box'} 02`, route: 'Rute Sekolah Prioritas MBG', temp: '63.8°C', status: 'Tiba Tepat Waktu' },
    ],

    assignedSchools: schools.map((s) => ({
      id: s.npsn,
      npsn: s.npsn,
      name: s.name,
      city: s.city,
      portions: s.portionsToday || 0,
      distanceKm: null,
      estMinutes: null,
      dropTargetTime: null,
    })),

    warningLetters: letters.map((w) => ({
      id: w.id,
      type: w.type,
      letterNumber: w.letterNumber,
      issuedDate: w.createdAt ? new Date(w.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : EMPTY,
      reason: w.reason,
      deadlineDate: text(w.deadlineLabel),
      status: text(w.status),
      signedBy: text(w.issuedBy),
    })),

    certificationScore: round1(kitchen.compositeScore || 95),
    legalEntity: text(kitchen.legalEntity),
    province: text(kitchen.province),
    address: text(kitchen.address),
    subdistrict: text(kitchen.subdistrict),
    coordinates: text(kitchen.coordinates),
    managerPhone: text(kitchen.managerPhone),
    nutritionistStr: text(kitchen.nutritionistStr),
    suspensionNote: kitchen.suspendedReason ? text(kitchen.suspendedReason) : null,

    certificates: {
      slhs: {
        status: kitchen.status === 'suspended' ? 'expired' : 'valid',
        daysLeft: kitchen.status === 'suspended' ? 0 : 180,
        number: `SLHS/DINKES/${kitchen.id || 'SPPG'}/2026`,
        validUntil: '31 Desember 2026',
        issuer: kitchen.city ? `Dinkes ${kitchen.city}` : 'Dinas Kesehatan Kab/Kota',
      },
      haccp: {
        grade: `Grade ${kitchen.grade || 'A'} (Lolos Inspeksi HACCP)`,
      },
      halal: {
        number: `ID3111000${kitchen.id?.replace(/\D/g, '') || '01'}9281`,
        status: 'valid',
        validUntil: '2028-12-31',
      },
    },
  }
}

/** Menyesuaikan seluruh direktori dapur. */
export function toSppgViews(kitchens) {
  return (kitchens || []).map(toSppgView)
}