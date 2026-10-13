export const MASTER_SCHOOLS = [
  {
    npsn: '33.210.130',
    id: 'SCH-JKT-01',
    name: 'SDN 01 Menteng Pagi',
    city: 'Jakarta Pusat',
    district: 'Menteng',
    sppgId: 'SPPG-01',
    sppgName: 'Dapur Sentral SPPG-01 Menteng',
    students: 668,
    activeBatch: 'MBG-2026-SPPG01-SDN01P-B01',
    menuName: 'Nasi Pulen, Ayam Panggang Madu, Capcay Sayur & Susu',
    eta: '06:50 WIB',
  },
  {
    npsn: '20101455',
    id: 'SCH-JKT-02',
    name: 'SDN 02 Pegangsaan Timur',
    city: 'Jakarta Pusat',
    district: 'Menteng',
    sppgId: 'SPPG-01',
    sppgName: 'Dapur Sentral SPPG-01 Menteng',
    students: 590,
    activeBatch: 'MBG-2026-SPPG01-SDN02P-B01',
    menuName: 'Nasi Kuning Komplit, Telur Balado & Sayur Urap',
    eta: '07:05 WIB',
  },
  {
    npsn: '20101456',
    id: 'SCH-JKT-03',
    name: 'SMPN 3 Jakarta',
    city: 'Jakarta Pusat',
    district: 'Senen',
    sppgId: 'SPPG-01',
    sppgName: 'Dapur Sentral SPPG-01 Menteng',
    students: 771,
    activeBatch: 'MBG-2026-SPPG01-SMPN03-B01',
    menuName: 'Nasi Ayam Bumbu Rujak, Tempe Bacem & Sayur Sop',
    eta: '07:15 WIB',
  },
  {
    npsn: '20101457',
    id: 'SCH-JKT-04',
    name: 'SDN Cikini 01',
    city: 'Jakarta Pusat',
    district: 'Menteng',
    sppgId: 'SPPG-01',
    sppgName: 'Dapur Sentral SPPG-01 Menteng',
    students: 558,
    activeBatch: 'MBG-2026-SPPG01-SDN01C-B01',
    menuName: 'Nasi Putih, Daging Rendang Suwir, Sayur Buncis & Buah Pisang',
    eta: '06:40 WIB',
  },
  {
    npsn: '20104433',
    id: 'SCH-005',
    name: 'SDN Melawai 01 Pagi',
    city: 'Jakarta Selatan',
    district: 'Kebayoran Baru',
    sppgId: 'SPPG-02',
    sppgName: 'Dapur Sentral SPPG-02 Kebayoran',
    students: 420,
    activeBatch: 'MBG-2026-SPPG02-SDN01M-B01',
    menuName: 'Nasi Timbel, Ayam Goreng Lengkuas & Sayur Asem',
    eta: '07:10 WIB',
  },
  {
    npsn: '20104434',
    id: 'SCH-006',
    name: 'SMPN 11 Jakarta Selatan',
    city: 'Jakarta Selatan',
    district: 'Kebayoran Baru',
    sppgId: 'SPPG-02',
    sppgName: 'Dapur Sentral SPPG-02 Kebayoran',
    students: 580,
    activeBatch: 'MBG-2026-SPPG02-SMPN11-B01',
    menuName: 'Nasi Timbel, Rolade Daging Sapi & Tumis Buncis Jagung',
    eta: '07:20 WIB',
  },
]

export function getSelectedSchool(currentUser = null) {
  try {
    const rawData = localStorage.getItem('mbg_selected_school_data')
    if (rawData) {
      const parsed = JSON.parse(rawData)
      if (parsed && parsed.npsn) return parsed
    }
    const savedNpsn = localStorage.getItem('mbg_selected_npsn')
    const savedName = localStorage.getItem('mbg_selected_school_name')

    if (savedNpsn) {
      const match = MASTER_SCHOOLS.find((s) => s.npsn === savedNpsn)
      if (match) return match
      if (savedName) return { npsn: savedNpsn, name: savedName, students: 600, sppgId: 'SPPG-01', sppgName: 'SPPG Sentral' }
    }
    if (currentUser?.npsn) {
      const match = MASTER_SCHOOLS.find((s) => s.npsn === currentUser.npsn)
      if (match) return match
      return {
        npsn: currentUser.npsn,
        name: currentUser.schoolName || 'SDN 01 Menteng Pagi',
        students: 668,
        sppgId: currentUser.sppgId || 'SPPG-01',
        sppgName: 'SPPG Sentral Menteng 01',
      }
    }
  } catch {
    // localStorage not accessible
  }
  return MASTER_SCHOOLS[0]
}

export function setSelectedSchool(school) {
  if (!school) return
  try {
    localStorage.setItem('mbg_selected_npsn', school.npsn)
    localStorage.setItem('mbg_selected_school_name', school.name)
    localStorage.setItem('mbg_selected_school_data', JSON.stringify(school))
    window.dispatchEvent(new CustomEvent('mbg_school_changed', { detail: school }))
  } catch (err) {
    console.error('Failed to save selected school:', err)
  }
}
