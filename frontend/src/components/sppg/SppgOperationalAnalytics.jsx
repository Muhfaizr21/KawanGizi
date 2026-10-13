import { useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts'
import {
  Clock,
  Utensils,
  School,
  Users,
  ShieldCheck,
  Award,
  Download,
  Info,
} from 'lucide-react'

import {
  SPPG_FLOW_TIMELINE_DATA,
  SPPG_NUTRITION_ACCURACY_DATA,
  SPPG_SCHOOL_DISTRIBUTION_DATA,
  SPPG_TEAM_ALLOCATION_DATA,
  SPPG_QUALITY_CONTROL_DATA,
  SPPG_SLA_RADAR_DATA,
  SPPG_CCP_SUMMARY,
} from '../../data/sppgPortalData'

// Custom tooltip renderer for high precision and sleek aesthetics
function OperationalTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 p-3 text-xs shadow-xl text-white min-w-[190px] z-50 pointer-events-none select-none backdrop-blur-md">
      {label && (
        <p className="mb-2 border-b border-slate-700 pb-1.5 font-bold text-slate-100 flex items-center justify-between">
          <span>{label}</span>
          <span className="text-[11px] text-slate-500">Data Operasional</span>
        </p>
      )}
      <div className="space-y-1.5">
        {payload.map((entry, idx) => (
          <div key={`entry-${idx}`} className="flex items-center justify-between gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span
                className="h-2 w-2 rounded-xs shrink-0"
                style={{ backgroundColor: entry.color || entry.fill }}
              />
              <span>{entry.name || entry.dataKey}</span>
            </span>
            <span className="tabular-nums font-mono font-bold text-white">
              {typeof entry.value === 'number' ? entry.value.toLocaleString('id-ID') : entry.value}
              {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Modular chart card container
function OperationalChartCard({
  title,
  subtitle,
  badgeText,
  badgeColor = 'blue',
  legend,
  footer,
  children,
}) {
  const badgeClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    brand: 'bg-[#23259C]/10 text-[#23259C] border-[#23259C]/25',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
  }

  return (
    <section className="flex flex-col justify-between rounded-2xl border border-slate-200/70 bg-white p-4.5 sm:p-5 shadow-xs transition hover:border-slate-300 hover:shadow-sm">
      <div>
        <header className="mb-3 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold leading-snug text-slate-800">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 truncate">
                {subtitle}
              </p>
            )}
          </div>
          {badgeText && (
            <span
              className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold ${badgeClasses[badgeColor] || badgeClasses.blue
                }`}
            >
              {badgeText}
            </span>
          )}
        </header>

        <div className="w-full">
          {children}
          {legend}
        </div>
      </div>

      {footer && (
        <footer className="mt-3.5 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500 flex items-center justify-between">
          {footer}
        </footer>
      )}
    </section>
  )
}

export function SppgOperationalAnalytics({ data }) {
  const [activeTab, setActiveTab] = useState('all')
  const [sessionFilter, setSessionFilter] = useState('today_am')
  const [toastMessage, setToastMessage] = useState(null)

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const TABS = [
    { id: 'all', label: 'Semua Dimensi' },
    { id: 'flow', label: 'Aliran Waktu & HACCP', icon: Clock },
    { id: 'nutrition', label: 'Komposisi Nutrisi', icon: Utensils },
    { id: 'distribution', label: 'Distribusi Sekolah', icon: School },
    { id: 'team', label: 'Penugasan Tim', icon: Users },
    { id: 'quality', label: 'Kendali Mutu CCP', icon: ShieldCheck },
    { id: 'sla', label: 'Indeks Kepatuhan SLA', icon: Award },
  ]

  const SESSION_FILTERS = [
    { id: 'today_am', label: 'Sesi Pagi (03:30–08:00)' },
    { id: '7d', label: '7 Hari Terakhir' },
    { id: 'menu_a', label: 'Siklus Menu A' },
  ]

  const flowTimeline = data?.flowTimeline?.length ? data.flowTimeline : SPPG_FLOW_TIMELINE_DATA
  const nutritionAccuracy = data?.nutritionAccuracy?.length ? data.nutritionAccuracy : SPPG_NUTRITION_ACCURACY_DATA
  const schoolDistribution = data?.schoolDistribution?.length ? data.schoolDistribution : SPPG_SCHOOL_DISTRIBUTION_DATA
  const teamAllocation = data?.teamAllocation?.length ? data.teamAllocation : SPPG_TEAM_ALLOCATION_DATA
  const qualityControl = data?.qualityControl?.length ? data.qualityControl : SPPG_QUALITY_CONTROL_DATA
  const slaRadar = data?.slaRadar?.length ? data.slaRadar : SPPG_SLA_RADAR_DATA
  const ccpSummary = data?.ccpSummary || SPPG_CCP_SUMMARY

  const totalStaff = teamAllocation.reduce((sum, d) => sum + d.count, 0)
  const totalAllocatedPortions = schoolDistribution.reduce(
    (sum, d) => sum + d.quota,
    0
  )

  return (
    <div className="space-y-4">
      {/* Toast notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xl animate-in fade-in slide-in-from-bottom-3"
        >
          <Info className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}



      {/* Grid of Analytical Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* ==================================================================
            1. DIMENSI WAKTU & HACCP (WHEN)
            ================================================================== */}
        {(activeTab === 'all' || activeTab === 'flow') && (
          <OperationalChartCard
            title="Kurva Aliran Waktu & Batas Kritis HACCP"
            subtitle="Akumulasi porsi matang & kirim sepanjang lini waktu"
            badgeText="Cutoff: 10:00 WIB"
            badgeColor="rose"
            legend={
              <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-50 pt-2">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-[#23259C]" />
                  <span>Porsi Dimasak</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-[#10B981]" />
                  <span>Porsi Dikemas</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-[#3B82F6]" />
                  <span>Porsi Terkirim</span>
                </span>
              </div>
            }
            footer={
              <>
                <span className="flex items-center gap-1 text-slate-500">
                  <Clock className="h-3 w-3 text-slate-500" />
                  Selesai masak 06:00 WIB
                </span>
                <span className="font-bold text-rose-600 font-mono">Batas Konsumsi 10:00</span>
              </>
            }
          >
            <div className="h-52 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={flowTimeline}
                  margin={{ top: 10, right: 10, left: -22, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorMasak" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#23259C" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#23259C" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorKirim" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="time"
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${val}`}
                  />
                  <Tooltip
                    content={
                      <OperationalTooltip unit=" Porsi" />
                    }
                  />
                  {/* Critical Reference line for 10:00 WIB cutoff */}
                  <ReferenceLine
                    x="10:00"
                    stroke="#E11D48"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Batas 4 Jam',
                      fill: '#E11D48',
                      fontSize: 9,
                      position: 'insideTopRight',
                      fontWeight: 'bold',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="porsiMasak"
                    name="Porsi Dimasak"
                    stroke="#23259C"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorMasak)"
                  />
                  <Area
                    type="monotone"
                    dataKey="porsiKirim"
                    name="Porsi Terkirim"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorKirim)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </OperationalChartCard>
        )}

        {/* ==================================================================
            2. DIMENSI MAKRONUTRIEN & PORSI HIDANGAN (WHAT)
            ================================================================== */}
        {(activeTab === 'all' || activeTab === 'nutrition') && (
          <OperationalChartCard
            title="Kesesuaian Makronutrien vs Standar AKG"
            subtitle="Hasil uji takaran gramatur laboratorium dapur hari ini"
            badgeText="Ayam Panggang Madu"
            badgeColor="brand"
            legend={
              <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-50 pt-2">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-[#23259C]" />
                  <span>Realisasi Dapur</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-slate-300" />
                  <span>Standar AKG BGN</span>
                </span>
                <span className="font-bold text-emerald-600">Presisi 99.1%</span>
              </div>
            }
            footer={
              <>
                <span className="text-slate-500">Toleransi batas aman: ±5%</span>
                <span className="font-bold text-emerald-600 font-mono">545 / 550 kkal (Optimal)</span>
              </>
            }
          >
            <div className="h-52 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={nutritionAccuracy}
                  margin={{ top: 10, right: 10, left: -22, bottom: 0 }}
                  barGap={4}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="nutrient"
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<OperationalTooltip />} />
                  <Bar
                    dataKey="target"
                    name="Standar AKG"
                    fill="#E2E8F0"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={16}
                  />
                  <Bar
                    dataKey="actual"
                    name="Realisasi Dapur"
                    fill="#23259C"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={16}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </OperationalChartCard>
        )}

        {/* ==================================================================
            3. DIMENSI SEBARAN SEKOLAH & RUTE (WHERE)
            ================================================================== */}
        {(activeTab === 'all' || activeTab === 'distribution') && (
          <OperationalChartCard
            title="Alokasi Kuota & Distribusi Sekolah Binaan"
            subtitle="Sebaran 2.500 porsi ke 4 sekolah titik drop-point"
            badgeText="Radius < 5 km"
            badgeColor="emerald"
            legend={
              <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-50 pt-2">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-[#23259C]" />
                  <span>Alokasi Porsi</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-slate-200" />
                  <span>Kapasitas Boks</span>
                </span>
                <span className="font-bold text-slate-700">50 Kontainer</span>
              </div>
            }
            footer={
              <>
                <span className="text-slate-500">Total alokasi 4 sekolah:</span>
                <span className="font-bold text-slate-800 font-mono">
                  {totalAllocatedPortions.toLocaleString('id-ID')} Porsi (100%)
                </span>
              </>
            }
          >
            <div className="h-52 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={schoolDistribution}
                  margin={{ top: 5, right: 15, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                  <XAxis
                    type="number"
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                  />
                  <YAxis
                    dataKey="school"
                    type="category"
                    stroke="#475569"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={105}
                  />
                  <Tooltip
                    content={
                      <OperationalTooltip unit=" Porsi" />
                    }
                  />
                  <Bar
                    dataKey="capacity"
                    name="Kapasitas Kontainer"
                    fill="#F1F5F9"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={14}
                  />
                  <Bar
                    dataKey="quota"
                    name="Porsi Teralokasi"
                    fill="#23259C"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={14}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </OperationalChartCard>
        )}

        {/* ==================================================================
            4. DIMENSI PENUGASAN TIM & PERSONIL LINI (WHO)
            ================================================================== */}
        {(activeTab === 'all' || activeTab === 'team') && (
          <OperationalChartCard
            title="Penugasan Tim & Penanggung Jawab Lini"
            subtitle="Distribusi 28 staf bersertifikat penjamah pangan"
            badgeText={`${totalStaff} Personil Siaga`}
            badgeColor="amber"
            legend={
              <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[10px] text-slate-500 border-t border-slate-50 pt-2">
                {teamAllocation.map((tm) => (
                  <div key={tm.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-slate-600 truncate">
                      <span className="h-2 w-2 rounded-xs shrink-0" style={{ backgroundColor: tm.color }} />
                      <span className="truncate">{tm.name.split(' ')[0]}</span>
                    </span>
                    <span className="font-mono font-bold text-slate-800">{tm.count} staf</span>
                  </div>
                ))}
              </div>
            }
            footer={
              <>
                <span className="text-slate-500">Sertifikasi Higiene Dinkes:</span>
                <span className="font-bold text-emerald-600 font-mono">100% Terverifikasi</span>
              </>
            }
          >
            <div className="relative flex h-52 items-center justify-center pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={<OperationalTooltip unit=" Staf" />}
                  />
                  <Pie
                    data={teamAllocation}
                    innerRadius="58%"
                    outerRadius="82%"
                    paddingAngle={3}
                    dataKey="count"
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {teamAllocation.map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-slate-800 tracking-tight font-mono">
                  {totalStaff}
                </span>
                <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500">
                  Staf Aktif
                </span>
              </div>
            </div>
          </OperationalChartCard>
        )}

        {/* ==================================================================
            5. DIMENSI KENDALI MUTU & TITIK KRITIS (WHY)
            ================================================================== */}
        {(activeTab === 'all' || activeTab === 'quality') && (
          <OperationalChartCard
            title="Audit Titik Kendali Kritis (HACCP CCP)"
            subtitle="Kepatuhan parameter termal & mikrobiologis di dapur"
            badgeText={`${ccpSummary.passing}/${ccpSummary.total} lolos ambang`}
            badgeColor="emerald"
            legend={
              <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-50 pt-2">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-[#10B981]" />
                  <span>Kepatuhan Aktual</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-rose-400" />
                  <span>Ambang Batas (95%)</span>
                </span>
                <span className="font-bold text-emerald-600">CCP Lolos 100%</span>
              </div>
            }
            footer={
              <>
                <span className="text-slate-500">Indeks keamanan biologis:</span>
                <span className="font-bold text-emerald-600 font-mono">Steril Salmonella & E.Coli</span>
              </>
            }
          >
            <div className="h-52 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={qualityControl}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="ccp"
                    stroke="#94A3B8"
                    fontSize={9}
                    tickLine={false}
                    axisLine={{ stroke: '#E2E8F0' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis
                    domain={[85, 102]}
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip content={<OperationalTooltip unit="%" />} />
                  <ReferenceLine
                    y={95}
                    stroke="#F43F5E"
                    strokeDasharray="3 3"
                    label={{
                      value: 'Min 95%',
                      fill: '#F43F5E',
                      fontSize: 8,
                      position: 'insideTopLeft',
                      fontWeight: 'bold',
                    }}
                  />
                  <Bar
                    dataKey="score"
                    name="Tingkat Kepatuhan"
                    fill="#10B981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={22}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </OperationalChartCard>
        )}

        {/* ==================================================================
            6. DIMENSI INDEKS KEPATUHAN SLA OPERASIONAL (HOW)
            ================================================================== */}
        {(activeTab === 'all' || activeTab === 'sla') && (
          <OperationalChartCard
            title="Indeks Kepatuhan SLA & Kinerja Mutu"
            subtitle="Radar evaluasi 6 pilar standar pelayanan operasional"
            badgeText="Grade A · 99.3%"
            badgeColor="brand"
            legend={
              <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-50 pt-2">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-[#23259C]" />
                  <span>Kinerja SPPG 01</span>
                </span>
                <span className="text-slate-500">Baseline BGN: 95.0%</span>
                <span className="font-bold text-[#23259C]">Grade A</span>
              </div>
            }
            footer={
              <>
                <span className="text-slate-500">Status pencairan SP2D:</span>
                <span className="font-bold text-[#23259C] font-mono">Siap Klaim 100% Insentif</span>
              </>
            }
          >
            <div className="h-52 w-full flex items-center justify-center pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  cx="50%"
                  cy="50%"
                  outerRadius="72%"
                  data={slaRadar}
                >
                  <PolarGrid stroke="#E2E8F0" />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fill: '#475569', fontSize: 9, fontWeight: 'bold' }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[80, 100]}
                    stroke="#CBD5E1"
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    name="Skor Kepatuhan"
                    dataKey="score"
                    stroke="#23259C"
                    strokeWidth={2}
                    fill="#23259C"
                    fillOpacity={0.3}
                  />
                  <Tooltip content={<OperationalTooltip unit="%" />} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </OperationalChartCard>
        )}
      </div>
    </div>
  )
}
