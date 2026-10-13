import { useState, useEffect, useMemo } from 'react'
import {
  Building2,
  Search,
  Check,
  X,
  MapPin,
  Users,
  Truck,
  Sparkles,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'
import { fetchSchools, fetchDeliveries } from '../../lib/api'
import { MASTER_SCHOOLS, getSelectedSchool, setSelectedSchool } from '../../lib/validatorSchool'

export function SchoolSwitcherModal({ isOpen, onClose, onSelect }) {
  const [schools, setSchools] = useState(MASTER_SCHOOLS)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [current, setCurrent] = useState(() => getSelectedSchool())

  useEffect(() => {
    if (!isOpen) return
    setCurrent(getSelectedSchool())
    setLoading(true)

    Promise.all([fetchSchools(), fetchDeliveries().catch(() => [])])
      .then(([schoolsData, deliveriesData]) => {
        const delivList = Array.isArray(deliveriesData) ? deliveriesData : []
        if (Array.isArray(schoolsData) && schoolsData.length > 0) {
          const list = schoolsData.map((apiSchool) => {
            const deliv = delivList.find((d) => d.schoolNpsn === apiSchool.npsn)
            const cleanSppgName = apiSchool.sppgSupplier?.name || apiSchool.sppgName || `Dapur Sentral ${apiSchool.sppgId || 'SPPG'}`
            const batchCode = deliv?.batchId || deliv?.qrToken || `MBG-2026-${(apiSchool.sppgId || 'SPPG01').replace('-', '')}-${(apiSchool.id || apiSchool.npsn).slice(-6)}-B01`
            const menuTitle = deliv?.menuName || 'Nasi & Lauk Pauk Bergizi MBG'

            return {
              npsn: apiSchool.npsn,
              id: apiSchool.id || apiSchool.npsn,
              name: apiSchool.name,
              level: apiSchool.level || 'SD',
              city: apiSchool.city || 'DKI Jakarta',
              district: apiSchool.district || '',
              sppgId: apiSchool.sppgId || 'SPPG-01',
              sppgName: cleanSppgName,
              students: apiSchool.totalStudents || apiSchool.demographics?.totalStudents || 500,
              dietaryNotes: apiSchool.dietaryNotes || apiSchool.demographics?.dietaryNotes || '',
              activeBatch: batchCode,
              menuName: menuTitle,
              eta: apiSchool.avgArrivalTime || deliv?.scannedAt || '07:00 WIB',
              acceptanceRate: apiSchool.acceptanceRate || 99,
            }
          })
          setSchools(list)
        }
      })
      .catch((err) => {
        console.error('Gagal sinkron data sekolah riil:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [isOpen])

  // SPPG filter dinamis dari data PostgreSQL
  const sppgFilterOptions = useMemo(() => {
    const map = new Map()
    schools.forEach((s) => {
      if (s.sppgId && !map.has(s.sppgId)) {
        // Nama ringkas untuk pill
        const shortName = s.sppgName.replace('Dapur Sentral ', '').replace('SPPG ', '')
        map.set(s.sppgId, `${s.sppgId} (${shortName.split(' ')[0]})`)
      }
    })
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
  }, [schools])

  const filteredSchools = useMemo(() => {
    const q = search.trim().toLowerCase()
    return schools.filter((s) => {
      const matchesSearch =
        !q ||
        [s.name, s.npsn, s.city, s.district, s.sppgName, s.level, s.dietaryNotes]
          .some((val) => String(val || '').toLowerCase().includes(q))

      const matchesFilter =
        selectedFilter === 'all' ? true : s.sppgId === selectedFilter

      return matchesSearch && matchesFilter
    })
  }, [schools, search, selectedFilter])

  const handleChoose = (school) => {
    setSelectedSchool(school)
    setCurrent(school)
    onSelect?.(school)
    onClose?.()
  }

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-hidden rounded-[26px] bg-white shadow-2xl border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#185338] text-white flex items-center justify-center shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Pilih Sekolah Pemantauan MBG
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Ganti sekolah aktif untuk memantau pengiriman armada, uji nampan, dan BAST.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            title="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3 bg-white">
          <div className="relative flex items-center w-full rounded-full border border-slate-200 bg-slate-50/80 px-4 py-2.5 focus-within:border-[#185338] focus-within:bg-white transition">
            <Search className="h-4 w-4 text-slate-400 mr-2.5 shrink-0" />
            <input
              type="text"
              placeholder="Cari nama sekolah, NPSN, atau kecamatan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 outline-none"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedFilter('all')}
              className={`rounded-full px-3 py-1 transition cursor-pointer shrink-0 ${
                selectedFilter === 'all'
                  ? 'bg-[#185338] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Sekolah ({schools.length})
            </button>
            {sppgFilterOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedFilter(opt.id)}
                className={`rounded-full px-3 py-1 transition cursor-pointer shrink-0 ${
                  selectedFilter === opt.id
                    ? 'bg-[#185338] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* List of Schools */}
        <div className="max-h-[380px] overflow-y-auto p-4 sm:p-5 space-y-2.5 divide-y divide-slate-100">
          {!filteredSchools.length ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Tidak ada sekolah yang cocok dengan pencarian &quot;{search}&quot;.
            </div>
          ) : (
            filteredSchools.map((school) => {
              const isSelected = current?.npsn === school.npsn

              return (
                <button
                  key={school.npsn}
                  type="button"
                  onClick={() => handleChoose(school)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 cursor-pointer group ${
                    isSelected
                      ? 'border-[#185338] bg-emerald-50/50 shadow-xs ring-2 ring-[#185338]/10'
                      : 'border-slate-200/80 hover:border-[#185338]/60 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? 'bg-[#185338] text-white border-[#185338]'
                          : 'bg-slate-100 text-slate-600 border-slate-200 group-hover:border-slate-300'
                      }`}
                    >
                      <Building2 className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black text-slate-900 truncate">
                          {school.name}
                        </h4>
                        {isSelected && (
                          <span className="shrink-0 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Aktif Dipantau
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-slate-500 font-medium">
                        <span className="font-mono text-slate-600">NPSN: {school.npsn}</span>
                        <span>&bull;</span>
                        <span>{school.city} {school.district ? `(${school.district})` : ''}</span>
                        <span>&bull;</span>
                        <span className="text-emerald-800 font-bold">{school.sppgName}</span>
                      </div>

                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1 font-semibold text-slate-600">
                          <Users className="h-3 w-3 text-slate-400" />
                          {school.students} Siswa
                        </span>
                        <span className="flex items-center gap-1 font-mono text-slate-500">
                          <Truck className="h-3 w-3 text-slate-400" />
                          {school.activeBatch}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 pl-2">
                    {isSelected ? (
                      <div className="h-7 w-7 rounded-full bg-[#185338] text-white flex items-center justify-center shadow-xs">
                        <Check className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="h-7 w-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 group-hover:border-[#185338] group-hover:text-[#185338] transition">
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-400">
          <span>Klik sekolah untuk langsung mengaktifkan sesi pemantauan.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

export default SchoolSwitcherModal
