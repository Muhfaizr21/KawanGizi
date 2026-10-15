import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Clock,
  Truck,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  Search,
  Download,
  Printer,
  Plus,
  MoreVertical,
  Phone,
  Navigation,
  Thermometer,
  MapPin,
  RotateCcw,
  Send,
  Radio,
  Check,
  School
} from 'lucide-react'
import { ScheduleCharts } from './ScheduleCharts'
import { AVAILABLE_BACKUP_FLEETS } from '../../data/scheduleData'
import { StatusDot } from './tableKit'
import { toScheduleView } from './scheduleView'
import { rescheduleDelivery, sendDelayAlert, rerouteBackupFleet, fetchBackupFleets } from '../../lib/api'

export function SchedulePanel({
  schedulesList = [],
  onSuperadminAction = () => {},
  showToast = () => {},
  onReload = () => {}
}) {
  const [schedules, setSchedules] = useState(schedulesList)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'on_time' | 'arrived' | 'delayed_traffic' | 'fleet_breakdown' | 'rescheduled'
  const [cityFilter, setCityFilter] = useState('all')
  const [density, setDensity] = useState('normal') // 'normal' | 'compact'
  const [backupFleets, setBackupFleets] = useState(AVAILABLE_BACKUP_FLEETS)

  useEffect(() => {
    fetchBackupFleets()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setBackupFleets(data)
        }
      })
      .catch((err) => console.warn('Gagal memuat armada cadangan:', err))
  }, [])

  useEffect(() => {
    if (Array.isArray(schedulesList) && schedulesList.length > 0) {
      setSchedules(schedulesList)
    }
  }, [schedulesList])

  // Modals & Drawer State
  const [selectedSchedule, setSelectedSchedule] = useState(null)
  const [drawerTab, setDrawerTab] = useState('telemetry') // 'telemetry' | 'route' | 'contacts'
  const [openMenuId, setOpenMenuId] = useState(null)

  // Superadmin Action Modals
  const [rescheduleModalData, setRescheduleModalData] = useState(null) // { schedule, newTime, reason, effectiveDate }
  const [delayAlertModalData, setDelayAlertModalData] = useState(null) // { schedule, delayMinutes, customMessage }
  const [rerouteModalData, setRerouteModalData] = useState(null) // { schedule, backupFleetId, notes }

  const dropdownRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Unique cities list
  const uniqueCities = useMemo(() => {
    const set = new Set(schedules.map((s) => s.city))
    return Array.from(set)
  }, [schedules])

  // Filtered schedules
  const filtered = useMemo(() => {
    return schedules.filter((s) => {
      const matchSearch =
        s.schoolName.toLowerCase().includes(search.toLowerCase()) ||
        s.npsn.includes(search) ||
        s.city.toLowerCase().includes(search.toLowerCase()) ||
        s.fleet.driverName.toLowerCase().includes(search.toLowerCase()) ||
        s.fleet.plateNumber.toLowerCase().includes(search.toLowerCase()) ||
        s.sppgSupplier.name.toLowerCase().includes(search.toLowerCase())

      const matchStatus = statusFilter === 'all' || s.status === statusFilter
      const matchCity = cityFilter === 'all' || s.city === cityFilter

      return matchSearch && matchStatus && matchCity
    })
  }, [schedules, search, statusFilter, cityFilter])

  // Executive KPI stats
  const kpiStats = useMemo(() => {
    const total = schedules.length
    const arrivedCount = schedules.filter((s) => s.status === 'arrived').length
    const onTimeCount = schedules.filter((s) => s.status === 'on_time').length
    const delayedCount = schedules.filter((s) => s.status === 'delayed_traffic').length
    const breakdownCount = schedules.filter((s) => s.status === 'fleet_breakdown').length
    const rescheduledCount = schedules.filter((s) => s.status === 'rescheduled').length

    const onTimeCompliance = total
      ? Math.round(((arrivedCount + onTimeCount + rescheduledCount) / total) * 100)
      : 100

    return {
      total,
      arrivedCount,
      onTimeCount,
      delayedCount,
      breakdownCount,
      rescheduledCount,
      onTimeCompliance
    }
  }, [schedules])

  // Export to CSV
  const exportCsv = () => {
    const headers = [
      'ID Jadwal',
      'Nama Sekolah',
      'NPSN',
      'Kota',
      'Porsi',
      'Dapur SPPG',
      'Armada Logistik',
      'Nama Supir',
      'No Telp Supir',
      'Jam Masak Selesai',
      'Jam Berangkat',
      'Target Kedatangan',
      'Live ETA',
      'Suhu Kargo (°C)',
      'Status Operasional',
      'Keterangan Kendala'
    ]

    const rows = filtered.map((s) => [
      `"${s.id}"`,
      `"${s.schoolName}"`,
      `"${s.npsn}"`,
      `"${s.city}"`,
      s.portions,
      `"${s.sppgSupplier.name}"`,
      `"${s.fleet.plateNumber}"`,
      `"${s.fleet.driverName}"`,
      `"${s.fleet.driverPhone}"`,
      `"${s.timestamps.cookingDone}"`,
      `"${s.timestamps.departedAt}"`,
      `"${s.timestamps.targetArrival}"`,
      `"${s.timestamps.currentEta}"`,
      s.fleet.cargoTempCelsius,
      `"${s.statusLabel}"`,
      `"${s.statusReason}"`
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Jadwal_Distribusi_Armada_MBG_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Jadwal distribusi armada berhasil diekspor dalam format CSV!')
  }

  // Handle Reschedule Submit
  const handleRescheduleSubmit = async (e) => {
    if (onSuperadminAction?.('RESCHEDULE_DELIVERY')?.allowed === false) return
    e.preventDefault()
    if (!rescheduleModalData || isSubmitting) return

    const { schedule, newTime, reason, effectiveDate } = rescheduleModalData

    try {
      setIsSubmitting(true)
      const res = await rescheduleDelivery(schedule.id, { newTime, reason, effectiveDate })
      if (res) {
        setSchedules((prev) =>
          prev.map((s) => (s.id === schedule.id ? toScheduleView(res) : s))
        )
        onReload?.()
      } else {
        setSchedules((prev) =>
          prev.map((s) => {
            if (s.id === schedule.id) {
              return {
                ...s,
                status: 'rescheduled',
                statusLabel: `Jadwal Khusus (${newTime})`,
                statusReason: `Disetujui jadwal baru pukul ${newTime} (${reason}) efektif per ${effectiveDate}.`,
                timestamps: {
                  ...s.timestamps,
                  targetArrival: `${newTime} WIB`,
                  currentEta: `${newTime} WIB`,
                  delayMinutes: 0,
                  rescheduledReason: reason
                }
              }
            }
            return s
          })
        )
      }
      setRescheduleModalData(null)
      showToast(`Jadwal pengiriman untuk ${schedule.schoolName} berhasil disesuaikan ke ${newTime} WIB!`)
    } catch (err) {
      showToast(`Gagal menyesuaikan jadwal: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Delay Alert Submit
  const handleDelayAlertSubmit = async (e) => {
    e.preventDefault()
    if (!delayAlertModalData || isSubmitting) return

    const { schedule, delayMinutes, customMessage } = delayAlertModalData
    if (onSuperadminAction?.('SEND_DELAY_ALERT', { scheduleId: schedule.id, delayMinutes, customMessage })?.allowed === false) return

    try {
      setIsSubmitting(true)
      const res = await sendDelayAlert(schedule.id, { delayMinutes, customMessage })
      if (res) {
        setSchedules((prev) =>
          prev.map((s) => (s.id === schedule.id ? toScheduleView(res) : s))
        )
        onReload?.()
      }
      setDelayAlertModalData(null)
      showToast(`Peringatan keterlambatan (+${delayMinutes}m) berhasil disiarkan ke WhatsApp Kepala Sekolah & Guru Validator ${schedule.schoolName}!`)
    } catch (err) {
      showToast(`Gagal menyiarkan alert: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Reroute Submit
  const handleRerouteSubmit = async (e) => {
    if (onSuperadminAction?.('DISPATCH_BACKUP_FLEET')?.allowed === false) return
    e.preventDefault()
    if (!rerouteModalData || isSubmitting) return

    const { schedule, backupFleetId, notes } = rerouteModalData
    const backupObj = backupFleets.find((b) => b.vehicleId === backupFleetId) || backupFleets[0]

    try {
      setIsSubmitting(true)
      const res = await rerouteBackupFleet(schedule.id, { backupFleetId, notes })
      if (res) {
        setSchedules((prev) =>
          prev.map((s) => (s.id === schedule.id ? toScheduleView(res) : s))
        )
        onReload?.()
      } else {
        setSchedules((prev) =>
          prev.map((s) => {
            if (s.id === schedule.id) {
              return {
                ...s,
                status: 'on_time',
                statusLabel: 'Armada Pengganti Diterjunkan',
                statusReason: `Armada cadangan ${backupObj.plateNumber} mengambil alih muatan dari ${s.fleet?.plateNumber}. Catatan: ${notes}`,
                fleet: {
                  ...s.fleet,
                  vehicleId: backupObj.vehicleId,
                  plateNumber: backupObj.plateNumber,
                  driverName: backupObj.driverName,
                  driverPhone: backupObj.phone,
                  status: 'moving',
                  currentSpeed: '42 km/h (Mendekat)',
                  cargoTempCelsius: 64.0,
                  lastGpsPing: 'Baru saja',
                  gpsLocation: `Menuju lokasi evakuasi di ${s.fleet?.gpsLocation || 'titik insiden'}`
                },
                timestamps: {
                  ...s.timestamps,
                  currentEta: '07:28 WIB (Estimasi Cadangan)',
                  delayMinutes: 15
                }
              }
            }
            return s
          })
        )
      }
      setRerouteModalData(null)
      showToast(`Armada cadangan ${backupObj.plateNumber} (${backupObj.driverName}) berhasil ditugaskan untuk re-routing!`)
    } catch (err) {
      showToast(`Gagal menugaskan armada cadangan: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ====================================================================
          1. COMPACT TOP UTILITY & ACTION BAR (NO BLOATED CARDS, NO COUNTDOWN)
          ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-slate-500 font-medium">
          Manajemen Jendela Waktu Kirim &amp; Pelacak Armada Real-Time MBG
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition flex items-center gap-2 shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Ekspor Jadwal (CSV)</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition flex items-center gap-2 shadow-2xs cursor-pointer hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            <span>Cetak Rekap</span>
          </button>

          <button
            onClick={() => {
              if (schedules.length > 0) {
                setRescheduleModalData({
                  schedule: schedules[0],
                  newTime: '07:45',
                  reason: 'Kegiatan Senam Bersama / Hari Jumat',
                  effectiveDate: 'Hari Ini'
                })
              }
            }}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 shadow-2xs cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Atur Jadwal Khusus</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          2. EXECUTIVE KPI COMMAND RIBBON (4 METRICS)
          ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Armada Beroperasi */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Armada Beroperasi</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-800 border border-blue-100">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">{kpiStats.total}</span>
            <span className="text-xs font-medium text-slate-500">Unit Kendaraan</span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <span className="text-emerald-700 font-semibold">{kpiStats.arrivedCount} Tiba</span>
            <span>&bull;</span>
            <span className="text-blue-700 font-semibold">{kpiStats.onTimeCount} Di Jalan</span>
          </div>
        </div>

        {/* KPI 2: Kepatuhan Jendela Wajib */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Kepatuhan Jendela Wajib</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">{kpiStats.onTimeCompliance}%</span>
            <span className="text-xs font-medium text-slate-500">&le; 07:30 WIB</span>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <span className="text-emerald-700 font-semibold">Sebelum Bel Masuk Siswa</span>
          </div>
        </div>

        {/* KPI 3: Peringatan Kemacetan */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Peringatan Kemacetan</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-100">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">{kpiStats.delayedCount}</span>
            <span className="text-xs font-medium text-slate-500">Armada Tertahan</span>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            {kpiStats.delayedCount > 0 ? (
              <span className="text-amber-700 font-semibold">Prediksi terlambat &gt; 20 menit</span>
            ) : (
              <span className="text-emerald-700 font-semibold">Lalu lintas koridor lancar</span>
            )}
          </div>
        </div>

        {/* KPI 4: Armada Mogok / Re-routing */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Insiden Kendaraan</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-800 border border-rose-100">
              <RotateCcw className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">{kpiStats.breakdownCount}</span>
            <span className="text-xs font-medium text-slate-500">Butuh Re-route</span>
          </div>
          <div className="mt-2.5 flex items-center gap-2 text-[11px] border-t border-slate-100 pt-2">
            {kpiStats.breakdownCount > 0 ? (
              <span className="text-rose-700 font-semibold">Siaga armada cadangan aktif</span>
            ) : (
              <span className="text-emerald-700 font-semibold">Kondisi armada prima 100%</span>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================================
          3. VISUALIZATION CHARTS: WINDOWS & ETA COMPARISON
          ==================================================================== */}
      <ScheduleCharts schedules={schedules} />

      {/* ====================================================================
          4. SEARCH, FILTER & DENSITY TOOLBAR
          ==================================================================== */}
      <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari sekolah, NPSN, nomor plat, nama supir, SPPG, atau kota..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200/90 text-slate-900 placeholder:text-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* City Select */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-2 text-xs font-medium rounded-xl bg-slate-50 border border-slate-200/90 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              <option value="all">Semua Wilayah / Kota</option>
              {uniqueCities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Density Toggle */}
            <div className="flex items-center rounded-xl border border-slate-200/90 bg-slate-50 p-0.5 text-xs">
              <button
                onClick={() => setDensity('normal')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  density === 'normal'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Tampilan Normal"
              >
                Normal
              </button>
              <button
                onClick={() => setDensity('compact')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  density === 'compact'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Tampilan Rapat"
              >
                Rapat
              </button>
            </div>
          </div>
        </div>

        {/* Filter Chips: Status */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100 text-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">
            Status Armada:
          </span>
          {[
            { id: 'all', label: 'Semua Status' },
            { id: 'on_time', label: 'Tepat Waktu' },
            { id: 'arrived', label: 'Tiba di Sekolah' },
            { id: 'delayed_traffic', label: 'Peringatan Macet (>20m)' },
            { id: 'fleet_breakdown', label: 'Mogok / Re-route' },
            { id: 'rescheduled', label: 'Jadwal Khusus' }
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer text-xs ${
                statusFilter === st.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* ====================================================================
          5. MASTER SCHEDULE TABLE (TABLE-FIXED)
          ==================================================================== */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed min-w-[1050px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-2.5 px-4 w-[24%] text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Sekolah &amp; Porsi</th>
                <th className="py-2.5 px-4 w-[22%] text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Armada &amp; Kurir Logistik</th>
                <th className="py-2.5 px-4 w-[22%] text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Jendela Waktu &amp; ETA</th>
                <th className="py-2.5 px-4 w-[16%] text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Telemetri Suhu &amp; GPS</th>
                <th className="py-2.5 px-4 w-[10%] text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Status</th>
                <th className="py-2.5 px-4 w-[6%] text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Truck className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-600">Tidak ada jadwal armada yang cocok dengan filter</p>
                    <p className="text-[11px] text-slate-500 mt-1">Coba sesuaikan kata kunci pencarian</p>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isMenuOpen = openMenuId === item.id
                  const isCompact = density === 'compact'
                  const padClass = isCompact ? 'py-2.5 px-4' : 'py-3.5 px-4'

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/60 transition group cursor-pointer"
                      onClick={() => {
                        setSelectedSchedule(item)
                        setDrawerTab('telemetry')
                      }}
                    >
                      {/* Col 1: Sekolah & Porsi */}
                      <td className={padClass}>
                        <div className="space-y-1">
                          <div className="font-bold text-slate-900 text-sm group-hover:text-blue-800 transition truncate">
                            {item.schoolName}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                            <span>NPSN: <strong className="text-slate-700">{item.npsn}</strong></span>
                            <span>&bull;</span>
                            <span className="text-slate-600 font-sans">{item.city}</span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                            <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80">
                              {item.portions} Porsi
                            </span>
                            <span className="text-slate-500 truncate max-w-[130px]" title={item.sppgSupplier.name}>
                              dari {item.sppgSupplier.name}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Col 2: Armada & Kurir Logistik */}
                      <td className={padClass}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {item.fleet.plateNumber}
                            </span>
                            <span className="text-[11px] text-slate-700 font-semibold truncate">
                              {item.fleet.driverName}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 truncate" title={item.fleet.vehicleType}>
                            {item.fleet.vehicleType}
                          </p>

                          <div className="flex items-center gap-1 text-[11px] text-slate-600 font-mono">
                            <Phone className="h-3 w-3 text-slate-500 shrink-0" />
                            <span>{item.fleet.driverPhone}</span>
                          </div>
                        </div>
                      </td>

                      {/* Col 3: Jendela Waktu & ETA */}
                      <td className={padClass}>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Jadwal Target:</span>
                            <strong className="text-slate-800 font-mono">{item.timestamps.targetArrival}</strong>
                          </div>

                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">Live ETA:</span>
                            <span
                              className={`font-mono font-bold ${
                                item.status === 'delayed_traffic'
                                  ? 'text-amber-800'
                                  : item.status === 'fleet_breakdown'
                                  ? 'text-rose-800'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {item.timestamps.currentEta}
                            </span>
                          </div>

                          {item.timestamps.delayMinutes > 0 ? (
                            <div className="text-[10px] font-semibold text-amber-700 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              <span>Deviasi +{item.timestamps.delayMinutes} menit</span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 font-mono">
                              Berangkat: {item.timestamps.departedAt}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Col 4: Telemetri Suhu & GPS */}
                      <td className={padClass}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Thermometer className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {item.fleet.cargoTempCelsius}°C
                            </span>
                            <span className="text-[10px] text-emerald-700 font-medium bg-emerald-50 px-1 rounded">
                              Aman Termal
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-600 truncate" title={item.fleet.gpsLocation}>
                            {item.fleet.gpsLocation}
                          </p>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                            <span>{item.fleet.currentSpeed}</span>
                            <span>&bull;</span>
                            <span>Sisa {item.distanceRemainingKm} km</span>
                          </div>
                        </div>
                      </td>

                      {/* Col 5: Status */}
                      <td className={padClass}>
                        {item.status === 'arrived' && (
                          <StatusDot tone="ok">Tiba</StatusDot>
                        )}
                        {item.status === 'on_time' && (
                          <StatusDot tone="info">Di Jalan</StatusDot>
                        )}
                        {item.status === 'delayed_traffic' && (
                          <StatusDot tone="warn">Macet</StatusDot>
                        )}
                        {item.status === 'fleet_breakdown' && (
                          <StatusDot tone="critical">Mogok</StatusDot>
                        )}
                        {item.status === 'rescheduled' && (
                          <StatusDot tone="idle">Khusus</StatusDot>
                        )}
                      </td>

                      {/* Col 6: Aksi */}
                      <td className={`${padClass} text-right`} onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block text-left" ref={isMenuOpen ? dropdownRef : null}>
                          <button
                            onClick={() => setOpenMenuId(isMenuOpen ? null : item.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                            title="Menu Aksi Superadmin"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {isMenuOpen && (
                            <div className="absolute right-0 mt-1 w-56 rounded-xl bg-white border border-slate-200 shadow-xl z-30 py-1.5 text-xs text-slate-700 animate-in fade-in zoom-in-95">
                              <div className="px-3 py-1.5 border-b border-slate-100 font-semibold text-slate-500 text-[10px] uppercase tracking-wider">
                                Aksi Distribusi
                              </div>

                              <button
                                onClick={() => {
                                  setSelectedSchedule(item)
                                  setDrawerTab('telemetry')
                                  setOpenMenuId(null)
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Radio className="h-3.5 w-3.5 text-blue-800" />
                                <span>Pantau Telemetri GPS</span>
                              </button>

                              <button
                                onClick={() => {
                                  setRescheduleModalData({
                                    schedule: item,
                                    newTime: '07:45',
                                    reason: 'Senam Pagi Bersama / Hari Jumat Khusus',
                                    effectiveDate: 'Hari Ini'
                                  })
                                  setOpenMenuId(null)
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-blue-700 cursor-pointer"
                              >
                                <Clock className="h-3.5 w-3.5 text-blue-700" />
                                <span>Atur Ulang Jadwal (Reschedule)</span>
                              </button>

                              <button
                                onClick={() => {
                                  setDelayAlertModalData({
                                    schedule: item,
                                    delayMinutes: item.timestamps.delayMinutes || 25,
                                    customMessage: `Yth. Kepala Sekolah & Tim Validator ${item.schoolName}, armada pengiriman porsi MBG (${item.fleet.plateNumber}) tertahan kemacetan jalan raya. Estimasi kedatangan mundur menjadi ${item.timestamps.currentEta}. Mohon penyesuaian jadwal sarapan siswa.`
                                  })
                                  setOpenMenuId(null)
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-amber-800 cursor-pointer"
                              >
                                <Send className="h-3.5 w-3.5 text-amber-800" />
                                <span>Siarkan Notifikasi Terlambat</span>
                              </button>

                              <div className="border-t border-slate-100 my-1" />

                              <button
                                onClick={() => {
                                  setRerouteModalData({
                                    schedule: item,
                                    backupFleetId: (backupFleets[0] || {}).vehicleId || 'BKP-01',
                                    notes: 'Kerusakan mesin di jalan, evakuasi porsi ke armada cadangan pendingin.'
                                  })
                                  setOpenMenuId(null)
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-rose-700 cursor-pointer"
                              >
                                <RotateCcw className="h-3.5 w-3.5 text-rose-800" />
                                <span>Perutean Ulang (Armada Cadangan)</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Menampilkan <strong className="text-slate-900">{filtered.length}</strong> dari{' '}
            <strong className="text-slate-900">{schedules.length}</strong> jadwal armada logistik
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            JENDELA KEDATANGAN WAJIB: 06:45 – 07:30 WIB
          </span>
        </div>
      </div>

      {/* ====================================================================
          MODAL 1: PENGATURAN ULANG JADWAL (RESCHEDULING)
          ==================================================================== */}
      {rescheduleModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-slate-700">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Pengaturan Ulang Jadwal (Rescheduling)</h3>
                  <p className="text-xs text-slate-500">{rescheduleModalData.schedule.schoolName}</p>
                </div>
              </div>
              <button
                onClick={() => setRescheduleModalData(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-slate-500 text-[11px]">Jadwal Kedatangan Eksisting:</div>
                <div className="font-bold text-slate-900 text-sm">
                  {rescheduleModalData.schedule.timestamps.targetArrival} (Batas Wajib 07:30 WIB)
                </div>
                <div className="text-slate-600 text-[11px]">
                  Penyuplai: <strong className="text-slate-800">{rescheduleModalData.schedule.sppgSupplier.name}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jam Kedatangan Baru (WIB)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 07:45"
                    value={rescheduleModalData.newTime}
                    onChange={(e) =>
                      setRescheduleModalData({ ...rescheduleModalData, newTime: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tanggal Efektif
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Hari Ini / 02 Okt 2026"
                    value={rescheduleModalData.effectiveDate}
                    onChange={(e) =>
                      setRescheduleModalData({ ...rescheduleModalData, effectiveDate: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alasan Penyesuaian Jadwal
                </label>
                <select
                  value={rescheduleModalData.reason}
                  onChange={(e) =>
                    setRescheduleModalData({ ...rescheduleModalData, reason: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                >
                  <option value="Kegiatan Senam Pagi Bersama / SKJ Hari Jumat">
                    Kegiatan Senam Pagi Bersama / SKJ Hari Jumat
                  </option>
                  <option value="Upacara Hari Peringatan Nasional">Upacara Hari Peringatan Nasional</option>
                  <option value="Jadwal Khusus Ujian Asesmen Nasional">
                    Jadwal Khusus Ujian Asesmen Nasional
                  </option>
                  <option value="Kondisi Cuaca Ekstrem / Banjir Jalur Distribusi">
                    Kondisi Cuaca Ekstrem / Banjir Jalur Distribusi
                  </option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-600" />
                  <span>Sinkronisasi Dapur SPPG Otomatis</span>
                </span>
                <p>
                  Sistem akan menginstruksikan dapur penyuplai untuk menyesuaikan waktu start memasak subuh agar makanan tetap hangat saat tiba di sekolah.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRescheduleModalData(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan Jadwal'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: PEMBERITAHUAN KETERLAMBATAN ARMADA
          ==================================================================== */}
      {delayAlertModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                  <Send className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Pemberitahuan Keterlambatan Armada</h3>
                  <p className="text-xs text-slate-500">Siarkan SMS / WhatsApp langsung ke Guru Validator</p>
                </div>
              </div>
              <button
                onClick={() => setDelayAlertModalData(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleDelayAlertSubmit} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1">
                <div className="font-bold text-sm">Penerima Siaran:</div>
                <div className="text-[11px]">
                  Sekolah: <strong>{delayAlertModalData.schedule.schoolName}</strong>
                </div>
                <div className="text-[11px] font-mono">
                  Validator: {delayAlertModalData.schedule.validatorContact.name} ({delayAlertModalData.schedule.validatorContact.phone})
                </div>
                <div className="text-[11px]">
                  Armada: <strong className="font-mono">{delayAlertModalData.schedule.fleet.plateNumber}</strong> ({delayAlertModalData.schedule.fleet.driverName})
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Estimasi Keterlambatan Waktu
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={90}
                    value={delayAlertModalData.delayMinutes}
                    onChange={(e) =>
                      setDelayAlertModalData({
                        ...delayAlertModalData,
                        delayMinutes: Number(e.target.value)
                      })
                    }
                    className="w-24 px-3 py-2 rounded-xl border border-slate-200 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                  <span className="text-slate-600 font-medium">Menit dari jadwal semula</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Isi Pesan Siaran Resmi Satgas MBG
                </label>
                <textarea
                  rows={4}
                  required
                  value={delayAlertModalData.customMessage}
                  onChange={(e) =>
                    setDelayAlertModalData({
                      ...delayAlertModalData,
                      customMessage: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-600 leading-relaxed font-sans"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <span className="font-bold text-slate-800">Instruksi Khusus untuk Pihak Sekolah:</span>
                <p>
                  Siswa diarahkan untuk memulai kegiatan literasi kelas atau menyantap kudapan buah ringan yang tersedia di ruang UKS terlebih dahulu sebelum paket menu utama tiba.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDelayAlertModalData(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="h-4 w-4" />
                  <span>{isSubmitting ? 'Menyiarkan...' : 'Kirimkan Notifikasi Darurat'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: PERUTEAN ULANG ARMADA (RE-ROUTING)
          ==================================================================== */}
      {rerouteModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-800">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Perutean Ulang Armada (Re-routing)</h3>
                  <p className="text-xs text-slate-500">Tangani kendaraan katering yang mogok di jalan raya</p>
                </div>
              </div>
              <button
                onClick={() => setRerouteModalData(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRerouteSubmit} className="p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 space-y-1">
                <div className="font-bold text-sm">Kendaraan Mengalami Masalah Teknis:</div>
                <div className="text-[11px]">
                  Plat: <strong className="font-mono">{rerouteModalData.schedule.fleet.plateNumber}</strong> ({rerouteModalData.schedule.fleet.driverName})
                </div>
                <div className="text-[11px]">
                  Muatan: <strong className="font-mono text-rose-700">{rerouteModalData.schedule.portions} Porsi Siap Santap</strong> untuk {rerouteModalData.schedule.schoolName}
                </div>
                <div className="text-[11px] text-rose-900/90 flex items-center gap-1 pt-1 border-t border-rose-200">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span>Lokasi Insiden: {rerouteModalData.schedule.fleet.gpsLocation}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pilih Armada Logistik Cadangan Terdekat
                </label>
                <select
                  value={rerouteModalData.backupFleetId}
                  onChange={(e) =>
                    setRerouteModalData({ ...rerouteModalData, backupFleetId: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-600 cursor-pointer"
                >
                  {backupFleets.map((b) => (
                    <option key={b.vehicleId} value={b.vehicleId}>
                      {b.plateNumber} ({b.driverName}) - {b.depotLocation} [ETA Menuju TKP: {b.etaToScene}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan Instruksi Tim Lapangan
                </label>
                <textarea
                  rows={2}
                  required
                  value={rerouteModalData.notes}
                  onChange={(e) =>
                    setRerouteModalData({ ...rerouteModalData, notes: e.target.value })
                  }
                  placeholder="Instruksi perpindahan boks termal higienis dan pengawalan..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-600"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <span className="font-bold text-slate-800">Protokol Pemindahan Makanan (*Cold-Chain Safety*):</span>
                <p>
                  Pindahkan boks tertutup tanpa membuka segel termal untuk menjaga suhu makanan tetap di atas 60°C sampai tiba di sekolah.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRerouteModalData(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>{isSubmitting ? 'Mengalihkan...' : 'Otorisasi Penugasan Cadangan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          DRAWER: DETAIL PELACAK ARMADA & TELEMETRI GPS
          ==================================================================== */}
      {selectedSchedule && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300 overflow-hidden">
            {/* Drawer Header */}
            <div className="px-6 py-4.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">{selectedSchedule.fleet.plateNumber}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                      {selectedSchedule.fleet.driverName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    Tujuan: {selectedSchedule.schoolName} &bull; {selectedSchedule.city}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSchedule(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Navigation Tabs */}
            <div className="flex items-center gap-1 px-6 border-b border-slate-200 bg-white shrink-0 text-xs">
              {[
                { id: 'telemetry', label: 'Telemetri & GPS', icon: Radio },
                { id: 'route', label: 'Rute Koridor & ETA', icon: Navigation },
                { id: 'contacts', label: 'Kontak Kurir & Guru', icon: Phone }
              ].map((tab) => {
                const IconComponent = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setDrawerTab(tab.id)}
                    className={`py-3 px-3 font-semibold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                      drawerTab === tab.id
                        ? 'border-blue-600 text-blue-800'
                        : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <IconComponent className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {/* Tab 1: Telemetry & Live Status */}
              {drawerTab === 'telemetry' && (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div
                    className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                      selectedSchedule.status === 'arrived'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : selectedSchedule.status === 'delayed_traffic'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : selectedSchedule.status === 'fleet_breakdown'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-blue-50 border-blue-200 text-blue-900'
                    }`}
                  >
                    {selectedSchedule.status === 'arrived' && <CheckCircle2 className="h-4 w-4 text-emerald-800 shrink-0 mt-0.5" />}
                    {selectedSchedule.status === 'delayed_traffic' && <AlertTriangle className="h-4 w-4 text-amber-800 shrink-0 mt-0.5" />}
                    {selectedSchedule.status === 'fleet_breakdown' && <XCircle className="h-4 w-4 text-rose-800 shrink-0 mt-0.5" />}
                    {selectedSchedule.status === 'on_time' && <Truck className="h-4 w-4 text-blue-800 shrink-0 mt-0.5" />}
                    {selectedSchedule.status === 'rescheduled' && <Clock className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />}
                    <div>
                      <div className="font-bold text-xs">{selectedSchedule.statusLabel}</div>
                      <p className="text-[11px] mt-0.5 opacity-90 leading-relaxed">
                        {selectedSchedule.statusReason}
                      </p>
                    </div>
                  </div>

                  {/* Telemetry Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <span className="text-slate-500 text-[10px] uppercase tracking-wider block">Suhu Kargo Termal</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Thermometer className="h-4 w-4 text-rose-500" />
                        <span className="text-lg font-bold font-mono text-slate-900">{selectedSchedule.fleet.cargoTempCelsius}°C</span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">Higienis &gt; 60°C</span>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <span className="text-slate-500 text-[10px] uppercase tracking-wider block">Kecepatan Armada</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Truck className="h-4 w-4 text-blue-500" />
                        <span className="text-lg font-bold font-mono text-slate-900">{selectedSchedule.fleet.currentSpeed}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">GPS Update: {selectedSchedule.fleet.lastGpsPing}</span>
                    </div>
                  </div>

                  {/* GPS Position */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-blue-800" />
                      <span>Posisi GPS Terkini Armada</span>
                    </span>
                    <p className="text-slate-800 font-medium leading-relaxed">
                      {selectedSchedule.fleet.gpsLocation}
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-[11px] text-slate-600">
                      <span>Sisa Jarak ke Gerbang:</span>
                      <strong className="text-slate-900 font-mono text-sm">{selectedSchedule.distanceRemainingKm} km</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Route & Window Timestamps */}
              {drawerTab === 'route' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Navigation className="h-3.5 w-3.5 text-blue-700" />
                      <span>Koridor Rute Logistik</span>
                    </span>
                    <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-100 text-blue-950 font-medium text-xs">
                      {selectedSchedule.corridorName}
                    </div>

                    {/* Step by step timeline */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-start gap-3">
                        <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-xs font-bold">
                          1
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-900">Masak Dapur Selesai</span>
                            <span className="font-mono text-slate-600">{selectedSchedule.timestamps.cookingDone}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">Dapur: {selectedSchedule.sppgSupplier.name}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 text-xs font-bold">
                          2
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-900">Armada Berangkat</span>
                            <span className="font-mono text-slate-600">{selectedSchedule.timestamps.departedAt}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">Maksimal standar 06:30 WIB</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 text-xs font-bold">
                          3
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-900">Kedatangan di Sekolah</span>
                            <span className="font-mono font-bold text-slate-900">
                              {selectedSchedule.timestamps.actualArrival || selectedSchedule.timestamps.currentEta}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Target Wajib: {selectedSchedule.timestamps.targetArrival} (Sebelum bel sarapan)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Contacts */}
              {drawerTab === 'contacts' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-blue-800" />
                      <span>Kurir Pengemudi Armada</span>
                    </span>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="text-slate-500 text-[10px] block">Supir Terdaftar:</span>
                        <span className="font-bold text-slate-900">{selectedSchedule.fleet.driverName}</span>
                        <span className="text-[11px] text-slate-500 block">{selectedSchedule.fleet.plateNumber}</span>
                      </div>
                      <a
                        href={`tel:${selectedSchedule.fleet.driverPhone}`}
                        className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-mono font-bold text-xs hover:bg-blue-100 flex items-center gap-1"
                      >
                        <Phone className="h-3 w-3" />
                        <span>{selectedSchedule.fleet.driverPhone}</span>
                      </a>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <School className="h-3.5 w-3.5 text-emerald-800" />
                      <span>Validator Penerima Sekolah</span>
                    </span>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="text-slate-500 text-[10px] block">Guru Validator:</span>
                        <span className="font-bold text-slate-900">{selectedSchedule.validatorContact.name}</span>
                        <span className="text-[11px] text-slate-500 block">{selectedSchedule.schoolName}</span>
                      </div>
                      <a
                        href={`tel:${selectedSchedule.validatorContact.phone}`}
                        className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-mono font-bold text-xs hover:bg-emerald-100 flex items-center gap-1"
                      >
                        <Phone className="h-3 w-3" />
                        <span>{selectedSchedule.validatorContact.phone}</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2 shrink-0">
              <button
                onClick={() => {
                  setDelayAlertModalData({
                    schedule: selectedSchedule,
                    delayMinutes: selectedSchedule.timestamps.delayMinutes || 25,
                    customMessage: `Yth. Tim Validator ${selectedSchedule.schoolName}, armada ${selectedSchedule.fleet.plateNumber} diprediksi terlambat tiba (${selectedSchedule.timestamps.currentEta}). Mohon penyesuaian waktu kelas.`
                  })
                }}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition cursor-pointer"
              >
                Kirim Peringatan
              </button>

              <button
                onClick={() => {
                  setRerouteModalData({
                    schedule: selectedSchedule,
                    backupFleetId: (backupFleets[0] || {}).vehicleId || 'BKP-01',
                    notes: 'Kendala di rute, siagakan armada cadangan.'
                  })
                }}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Re-routing Cadangan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
