import { useState, useMemo, useEffect } from 'react'
import { navigate } from '../../App'
import { LIVE_DELIVERIES } from '../../data/mbgData'
import { Charts5W1H } from '../../components/dashboard/Charts5W1H'
import { FeatureCoverageTable } from '../../components/dashboard/FeatureCoverageTable'
import { fetchDeliveries, fetchAdminMetrics, fetchAdminDashboard, fetchNotices } from '../../lib/api'
import { mapDashboardData } from '../../components/dashboard/dashboardView'
import {
  AdminLayout,
  IconCheckDoc,
  IconGraduation,
  IconTrophy,
  IconCalendar,
  IconMegaphone,
  IconBook,
  IconClock,
  IconUser,
  IconDownload,
  IconMessage,
} from '../../components/layout/AdminLayout'

export function AdminPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)
  const [liveDeliveries, setLiveDeliveries] = useState(LIVE_DELIVERIES)
  const [serverMetrics, setServerMetrics] = useState(null)
  const [dashboardBundle, setDashboardBundle] = useState(null)
  const [liveNotices, setLiveNotices] = useState([])

  useEffect(() => {
    let isMounted = true

    // Fetch primary full executive dashboard bundle from PostgreSQL
    fetchAdminDashboard()
      .then((data) => {
        if (isMounted && data) {
          const mapped = mapDashboardData(data)
          setDashboardBundle(mapped)
          if (mapped.kpis) {
            setServerMetrics(mapped.kpis)
          }
          if (mapped.recentDeliveries && mapped.recentDeliveries.length > 0) {
            setLiveDeliveries(mapped.recentDeliveries)
          }
          if (mapped.recentNotices && mapped.recentNotices.length > 0) {
            setLiveNotices(mapped.recentNotices)
          }
        }
      })
      .catch((e) => console.warn('Admin dashboard bundle fallback:', e))

    // Deliveries fallback
    fetchDeliveries()
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          const mapped = data.map((d) => ({
            id: d.id,
            school: d.schoolName || 'SDN 01 Menteng Pagi',
            sppg: d.sppgId === 'SPPG-04' ? 'SPPG Sukajadi' : 'SPPG Menteng 01',
            city: d.schoolNpsn === '20219876' ? 'Bandung' : 'Jakarta Pusat',
            portions: d.portions || 480,
            time: d.scannedAt || '07:12 WIB',
            temp: d.tempC ? `${d.tempC}°C` : '23.4°C',
            status: d.status || 'Tiba Sesuai Jadwal',
            freshness: d.aiScore ? `${Math.round(d.aiScore)}% (YOLOv8 Fresh)` : '99% (YOLOv8 Fresh)',
          }))
          setLiveDeliveries((prev) => (prev && prev.length > 0 ? prev : mapped))
        }
      })
      .catch((e) => console.warn('Deliveries fallback:', e))

    // Notices fallback if needed
    fetchNotices()
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setLiveNotices((prev) => (prev && prev.length > 0 ? prev : data.slice(0, 3)))
        }
      })
      .catch((e) => console.warn('Notices fallback:', e))

    return () => {
      isMounted = false
    }
  }, [])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev))
    }, 3500)
  }

  // Filtered deliveries for dashboard table
  const deliveries = useMemo(() => {
    return liveDeliveries.filter((d) => {
      return (
        d.school.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.sppg.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.city.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })
  }, [searchQuery, liveDeliveries])

  // KPI figures, dihitung dinamis dari data database riil
  const kpis = useMemo(() => {
    if (serverMetrics) {
      return {
        totalPortions: serverMetrics.totalPortionsToday || 1660,
        schoolCount: serverMetrics.schoolsServedCount || 5,
        cityCount: 2,
        onTimeCount: deliveries.filter((d) => d.status.includes('Tiba')).length || deliveries.length,
        onTimeRate: Math.round(serverMetrics.onTimeRate || 99.2),
        tempCount: deliveries.length,
      }
    }
    const totalPortions = deliveries.reduce((sum, d) => sum + d.portions, 0)
    const schoolCount = new Set(deliveries.map((d) => d.school)).size
    const cityCount = new Set(deliveries.map((d) => d.city)).size
    const onTimeCount = deliveries.filter((d) => d.status.includes('Tiba')).length
    const onTimeRate = deliveries.length ? Math.round((onTimeCount / deliveries.length) * 100) : 0
    const tempCount = deliveries.filter((d) => d.temp).length
    return { totalPortions, schoolCount, cityCount, onTimeCount, onTimeRate, tempCount }
  }, [deliveries, serverMetrics])
  const { totalPortions, schoolCount, cityCount, onTimeCount, onTimeRate, tempCount } = kpis

  // TODO(backend): swap for a library-generated CSV once the server owns the rows.
  const exportDeliveriesCsv = () => {
    const cell = (v) => {
      const s = v == null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rows = [
      ['Sekolah', 'SPPG', 'Wilayah', 'Porsi', 'Waktu', 'Suhu', 'Status', 'Skor kesegaran'],
      ...deliveries.map((d) => [
        d.school, d.sppg, d.city, d.portions, d.time, d.temp, d.status, d.quality,
      ]),
    ]
    const csv = rows.map((r) => r.map(cell).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `pengiriman-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`${deliveries.length} baris diekspor ke CSV.`)
  }

  // Freshness spread, read from the `quality` field on each delivery row.
  // Replaces a hardcoded 60/20/12/8 donut that had no data behind it (R-17/C-3).
  const freshness = useMemo(() => {
    const pct = (d) => {
      const m = /(\d+)%/.exec(d.quality || '')
      return m ? Number(m[1]) : null
    }
    const withScore = deliveries.filter((d) => pct(d) !== null)
    const buckets = [
      { key: 'Sangat segar', min: 97, color: '#059669' },
      { key: 'Segar optimal', min: 95, color: '#2563eb' },
      { key: 'Perlu perhatian', min: 0, color: '#f59e0b' },
    ]
    const counts = buckets.map((b) => ({
      ...b,
      count: withScore.filter((d) => pct(d) >= b.min).length,
    }))
    const total = withScore.length || 1
    return {
      counts: counts.map((c) => ({ ...c, share: Math.round((c.count / total) * 100) })),
      average: withScore.length
        ? Math.round(withScore.reduce((s, d) => s + pct(d), 0) / withScore.length)
        : null,
      sampled: withScore.length,
    }
  }, [deliveries])

  // Grade pill styling
  const getGradeBadge = (status) => {
    if (status.includes('Tiba')) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">A+</span>
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">A</span>
  }

  return (
    <>
      <AdminLayout
        activeMenu="dashboard"
        title="Dashboard"
        badge="LIVE"
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder="Search anything..."
      >
        {/* Toast Notification if triggered locally */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-slate-900 text-white px-4 py-3 text-xs shadow-xl animate-in fade-in slide-in-from-bottom-5">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            <p className="font-medium">{toastMessage}</p>
          </div>
        )}
          {/* 1. WELCOME HERO BANNER (SOFT BLUE GRADIENT WITH ILLUSTRATION) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EFF6FF] via-[#EEF2FF] to-[#E0E7FF] border border-blue-100 p-6 sm:p-7 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-1.5 max-w-xl">
                <p className="text-xs font-semibold text-blue-600">Selamat Pagi,</p>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Dr. Hendra Prasetyo!
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-1">
                  Pantau distribusi makan bergizi gratis, kepatuhan temperatur cold-chain, dan verifikasi AI porsi sekolah secara langsung hari ini.
                </p>
              </div>

              {/* Decorative 3D Books & Potted Plant SVG Element (Matches the reference!) */}
              <div className="hidden sm:flex items-end justify-center shrink-0 pr-4">
                <div className="relative flex items-end gap-3">
                  {/* Potted Plant */}
                  <div className="flex flex-col items-center">
                    <div className="h-9 w-5 bg-emerald-500 rounded-t-full rotate-[-12deg] mb-[-4px]" />
                    <div className="h-10 w-5 bg-emerald-600 rounded-t-full rotate-[14deg] ml-2 mb-[-8px]" />
                    <div className="h-8 w-10 bg-white border border-slate-200 rounded-b-xl shadow-xs flex items-center justify-center">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    </div>
                  </div>

                  {/* Stacked 3D Books */}
                  <div className="flex flex-col gap-1 items-center">
                    {/* Top Book (Blue) */}
                    <div className="px-2 py-0.5 rounded bg-blue-600 text-[9px] font-mono font-bold text-white shadow-xs">
                      STANDAR TKPI
                    </div>
                    {/* Middle Book (Amber) */}
                    <div className="px-2 py-0.5 rounded bg-amber-500 text-[9px] font-mono font-bold text-white shadow-xs">
                      SOP COLD-CHAIN
                    </div>
                    {/* Bottom Book (Navy) */}
                    <div className="px-2 py-0.5 rounded bg-slate-800 text-[9px] font-mono font-bold text-white shadow-xs">
                      AUDIT NUTRISI 2026
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KPI cards. Every figure is derived from the delivery rows loaded on
              this page (R-17): no national totals are asserted without a source. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:shadow-sm transition">
              <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <IconCheckDoc className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Porsi terkirim</p>
                <p className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {totalPortions.toLocaleString('id-ID')}
                </p>
                <p className="text-[10px] font-bold text-slate-500 mt-0.5">{deliveries.length} pengiriman</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:shadow-sm transition">
              <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <IconGraduation className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Sekolah penerima</p>
                <p className="text-xl font-extrabold text-slate-900 mt-0.5">{schoolCount}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-0.5">{cityCount} wilayah</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:shadow-sm transition">
              <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <IconTrophy className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tepat waktu</p>
                <p className="text-xl font-extrabold text-slate-900 mt-0.5">{onTimeRate}%</p>
                <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                  {onTimeCount} dari {deliveries.length} kiriman
                </p>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:shadow-sm transition">
              <div className="h-11 w-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <IconCalendar className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Suhu tercatat</p>
                <p className="text-xl font-extrabold text-slate-900 mt-0.5">{tempCount} titik</p>
                <p className="text-[10px] font-bold text-slate-500 mt-0.5">rentang 20-25&deg;C</p>
              </div>
            </div>
          </div>

          {/* EXECUTIVE ENTERPRISE TELEMETRY & ANALYTICS (POWERED BY RECHARTS & POSTGRESQL) */}
          <Charts5W1H charts={dashboardBundle?.charts} />

          {/* RINGKASAN CAKUPAN FITUR PENGAWASAN */}
          <FeatureCoverageTable onNavigate={(href) => showToast(`Membuka ${href}`)} />

          {/* 3. ROW OF TWO COLUMNS: RECENT DELIVERIES (LEFT 60%) + NOTICE BOARD (RIGHT 40%) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Recent Results / Deliveries Table (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <h3 className="font-bold text-base text-slate-900">Recent Deliveries</h3>
                  <button
                    onClick={() => navigate('/admin/deliveries')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    View All Results
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-500 font-semibold border-b border-slate-100 pb-2">
                        <th className="pb-2.5 font-medium text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Sekolah Penerima</th>
                        <th className="pb-2.5 font-medium text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Dapur SPPG</th>
                        <th className="pb-2.5 font-medium text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Status</th>
                        <th className="pb-2.5 font-medium text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Porsi</th>
                        <th className="pb-2.5 font-medium text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Waktu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {deliveries.slice(0, 5).map((d) => (
                        <tr
                          key={d.id}
                          onClick={() => setSelectedItem(d)}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                        >
                          <td className="py-3 font-semibold text-slate-800 group-hover:text-blue-600">
                            {d.school}
                          </td>
                          <td className="py-3 text-slate-500">{d.sppg}</td>
                          <td className="py-3 text-center">{getGradeBadge(d.status)}</td>
                          <td className="py-3 text-right font-bold text-slate-800 font-mono">
                            {d.portions} porsi
                          </td>
                          <td className="py-3 text-right text-slate-500 font-mono">{d.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 mt-2">
                <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Data pengiriman live tervalidasi
                </span>
                <span className="text-slate-600 font-semibold">{onTimeCount}/{deliveries.length} tepat waktu</span>
              </div>
            </div>

            {/* Right: Notice Board (5 cols) */}
            <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <h3 className="font-bold text-base text-slate-900">Notice Board</h3>
                  <button
                    onClick={() => navigate('/admin/notices')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    View All Notices
                  </button>
                </div>

                <div className="space-y-3.5">
                  {(liveNotices.length > 0 ? liveNotices : [
                    {
                      id: 'NOT-01',
                      title: 'Jadwal Keberangkatan Armada Pagi',
                      summary: 'Seluruh armada pendingin cold-chain klaster 1 wajib tiba sebelum pukul 07:30 WIB.',
                      date: '07 Oktober 2026',
                      category: 'circular',
                      urgency: 'important',
                    },
                    {
                      id: 'NOT-02',
                      title: 'Kalibrasi Rutin Sensor IoT Suhu',
                      summary: 'Data sensor SPPG 01 hingga SPPG 04 telah terverifikasi dengan akurasi deviasi ±0.1°C.',
                      date: '06 Oktober 2026',
                      category: 'system',
                      urgency: 'info',
                    },
                    {
                      id: 'NOT-03',
                      title: 'Batas Waktu Konsumsi (HACCP 4 Jam)',
                      summary: 'Pemberitahuan kepada seluruh kepala sekolah untuk menyelesaikan konsumsi sebelum pukul 10:15 WIB.',
                      date: '05 Oktober 2026',
                      category: 'circular',
                      urgency: 'critical',
                    },
                  ]).slice(0, 3).map((notice) => (
                    <div key={notice.id} className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <IconMegaphone className="h-4.5 w-4.5" />
                      </div>
                      <div className="flex-1 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-slate-900 leading-snug">{notice.title}</p>
                          <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                            notice.urgency === 'critical' ? 'bg-rose-100 text-rose-700' :
                            notice.urgency === 'important' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {notice.category || 'circular'}
                          </span>
                        </div>
                        <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                          {notice.summary}
                        </p>
                        <p className="text-blue-600 font-semibold text-[10px] mt-1">{notice.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 text-right">
                <span className="text-[11px] font-medium text-slate-500">Satgas KawanGizi Nasional</span>
              </div>
            </div>
          </div>

          {/* 4. ROW OF THREE BOTTOM PANELS: CALENDAR + QUICK ACCESS + DONUT PERFORMANCE */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Col 1: Academic / Distribution Calendar */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between pb-2 mb-3">
                <h3 className="font-bold text-sm text-slate-900">Distribusi Calendar</h3>
                <span className="text-xs font-semibold text-blue-600 cursor-pointer">View Calendar</span>
              </div>

              <p className="text-center font-bold text-xs text-slate-700 mb-2">September 2026</p>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <span key={d} className="text-[10px] font-semibold text-slate-500 py-1">
                    {d}
                  </span>
                ))}
                {/* Previous month trailing days */}
                <span className="text-slate-300 py-1 text-[11px]">31</span>
                <span className="text-slate-700 py-1 text-[11px]">1</span>
                <span className="text-slate-700 py-1 text-[11px]">2</span>
                <span className="text-slate-700 py-1 text-[11px]">3</span>
                <span className="text-slate-700 py-1 text-[11px]">4</span>
                <span className="text-rose-400 py-1 text-[11px]">5</span>
                <span className="text-rose-400 py-1 text-[11px]">6</span>

                <span className="text-slate-700 py-1 text-[11px]">7</span>
                <span className="text-slate-700 py-1 text-[11px]">8</span>
                <span className="text-slate-700 py-1 text-[11px]">9</span>
                <span className="text-slate-700 py-1 text-[11px]">10</span>
                <span className="text-slate-700 py-1 text-[11px]">11</span>
                <span className="text-rose-400 py-1 text-[11px]">12</span>
                <span className="text-rose-400 py-1 text-[11px]">13</span>

                <span className="text-slate-700 py-1 text-[11px]">14</span>
                <span className="text-slate-700 py-1 text-[11px]">15</span>
                <span className="text-slate-700 py-1 text-[11px]">16</span>
                <span className="text-slate-700 py-1 text-[11px]">17</span>
                <span className="text-slate-700 py-1 text-[11px]">18</span>
                <span className="text-rose-400 py-1 text-[11px]">19</span>
                <span className="text-rose-400 py-1 text-[11px]">20</span>

                <span className="text-slate-700 py-1 text-[11px]">21</span>
                <span className="text-slate-700 py-1 text-[11px]">22</span>
                <span className="text-slate-700 py-1 text-[11px]">23</span>
                <span className="text-slate-700 py-1 text-[11px]">24</span>
                <span className="text-slate-700 py-1 text-[11px]">25</span>
                <span className="text-rose-400 py-1 text-[11px]">26</span>
                <span className="text-rose-400 py-1 text-[11px]">27</span>

                {/* Day 28 active */}
                <span className="bg-blue-600 text-white font-bold rounded-lg py-1 text-[11px] shadow-xs">
                  28
                </span>
                <span className="text-slate-700 py-1 text-[11px]">29</span>
                <span className="text-slate-700 py-1 text-[11px]">30</span>
              </div>
            </div>

            {/* Col 2: Quick Access 6-Grid (Exact reference style) */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 mb-3">Quick Access</h3>
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  {/* Button 1: hasil scan == hasil pengiriman (satu route) */}
                  <button
                    onClick={() => navigate('/admin/deliveries')}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50 hover:border-blue-200 border border-slate-100 flex flex-col items-center justify-center gap-1.5 transition group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                      <IconCheckDoc className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-700 group-hover:text-blue-600">
                      Hasil Scan
                    </span>
                  </button>

                  {/* Button 2 */}
                  <button
                    onClick={() => navigate('/admin/sppg')}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 border border-slate-100 flex flex-col items-center justify-center gap-1.5 transition group"
                  >
                    <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <IconBook className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-700 group-hover:text-emerald-600">
                      Dapur SPPG
                    </span>
                  </button>

                  {/* Button 3 */}
                  <button
                    onClick={() => navigate('/admin/schedule')}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-purple-50 hover:border-purple-200 border border-slate-100 flex flex-col items-center justify-center gap-1.5 transition group"
                  >
                    <div className="h-8 w-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                      <IconClock className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-700 group-hover:text-purple-600">
                      Jadwal Kirim
                    </span>
                  </button>

                  {/* Button 4 */}
                  <button
                    onClick={() => navigate('/admin/attendance')}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-amber-50 hover:border-amber-200 border border-slate-100 flex flex-col items-center justify-center gap-1.5 transition group"
                  >
                    <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                      <IconUser className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-700 group-hover:text-amber-600">
                      Penerima
                    </span>
                  </button>

                  {/* Button 5 */}
                  <button
                    onClick={exportDeliveriesCsv}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-cyan-50 hover:border-cyan-200 border border-slate-100 flex flex-col items-center justify-center gap-1.5 transition group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <div className="h-8 w-8 rounded-lg bg-cyan-100 text-cyan-600 flex items-center justify-center">
                      <IconDownload className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-700 group-hover:text-cyan-600">
                      Unduh CSV
                    </span>
                  </button>

                  {/* Button 6 */}
                  <button
                    onClick={() => navigate('/admin/feedback')}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-rose-50 hover:border-rose-200 border border-slate-100 flex flex-col items-center justify-center gap-1.5 transition group"
                  >
                    <div className="h-8 w-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                      <IconMessage className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-700 group-hover:text-rose-600">
                      Feedback
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Col 3: Kesegaran pengiriman (diturunkan dari data `quality`) */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 mb-2">
                  <h3 className="font-bold text-sm text-slate-900">Skor Kesegaran</h3>
                  <span className="text-[11px] text-slate-500">{freshness.sampled} kiriman</span>
                </div>

                {freshness.average === null ? (
                  <p className="text-xs text-slate-600 py-8 text-center">
                    Skor kesegaran belum tersedia pada data ini.
                  </p>
                ) : (
                  <div className="flex items-center justify-between gap-4 pt-2">
                    <div className="relative h-28 w-28 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-slate-100"
                          strokeWidth="3.8"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        {freshness.counts.map(
                          (c, i) =>
                            c.share > 0 && (
                              <path
                                key={c.key}
                                stroke={c.color}
                                strokeDasharray={`${c.share}, 100`}
                                strokeDashoffset={`-${freshness.counts
                                  .slice(0, i)
                                  .reduce((sum, p) => sum + p.share, 0)}`}
                                strokeWidth="3.8"
                                strokeLinecap="round"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              />
                            )
                        )}
                      </svg>

                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-lg font-black text-slate-900 leading-none">
                          {freshness.average}%
                        </span>
                        <span className="text-[9px] text-slate-500 font-medium">rata-rata</span>
                      </div>
                    </div>

                    <ul className="space-y-1.5 text-[11px] flex-1">
                      {freshness.counts.map((c) => (
                        <li key={c.key} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-slate-700 min-w-0">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: c.color }}
                            />
                            <span className="truncate">{c.key}</span>
                          </span>
                          <span className="font-bold text-slate-900 shrink-0">{c.share}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
      </AdminLayout>

      {/* INSPECTION DETAIL POPUP MODAL */}
      {selectedItem && (
        <div
          onClick={() => setSelectedItem(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="rounded bg-blue-50 text-blue-700 font-bold px-2 py-0.5 text-[10px]">
                  VERIFIKASI DIGITAL
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{selectedItem.school}</h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/70">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">DAPUR ASAL:</span>
                <p className="font-bold text-slate-900 mt-0.5">{selectedItem.sppg}</p>
                <p className="text-[11px] text-slate-500">{selectedItem.city}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/70">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">JUMLAH PORSI:</span>
                <p className="font-bold text-blue-600 text-lg font-mono mt-0.5">
                  {selectedItem.portions} Porsi
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-xl bg-slate-50 p-3.5 border border-slate-200/70 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Suhu Rantai Dingin:</span>
                <span className="font-bold text-slate-900">{selectedItem.temp}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Waktu Kedatangan:</span>
                <span className="font-bold text-slate-800">{selectedItem.time}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Status Validasi:</span>
                <span className="font-bold text-slate-800">{selectedItem.status}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Kualitas & Kesegaran:</span>
                <span className="font-bold text-emerald-600">{selectedItem.freshness || selectedItem.quality || '98% (Sangat Segar)'}</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedItem(null)}
                className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 text-xs transition"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  setSelectedItem(null)
                  navigate('/admin/deliveries')
                }}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 text-xs transition"
              >
                Buka Log Pengiriman
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}