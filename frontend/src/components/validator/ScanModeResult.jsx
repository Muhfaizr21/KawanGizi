import { ShieldCheck, Salad, AlertTriangle, CheckCircle2, Info } from 'lucide-react'

/**
 * Kartu hasil pemindaian yang menyesuaikan mode analisis.
 *
 * Mode kelayakan menampilkan status keamanan, skor kesegaran, indikator visual,
 * dan overlay sekat nampan. Mode nutrisi menampilkan estimasi porsi, makronutrisi,
 * rincian bahan, dan perbandingan dengan standar AKG. Tidak ada panel lagi di
 * luar kartu mode supaya tampilan tidak dobel.
 */

const STATUS_STYLE = {
  'Layak Konsumsi': {
    icon: CheckCircle2,
    card: 'border-emerald-200 bg-emerald-50',
    chip: 'bg-emerald-100 text-emerald-800',
    bar: 'bg-emerald-500',
  },
  Waspada: {
    icon: AlertTriangle,
    card: 'border-amber-200 bg-amber-50',
    chip: 'bg-amber-100 text-amber-800',
    bar: 'bg-amber-500',
  },
  'Tidak Layak Konsumsi': {
    icon: AlertTriangle,
    card: 'border-rose-200 bg-rose-50',
    chip: 'bg-rose-100 text-rose-800',
    bar: 'bg-rose-500',
  },
}

const COMPARTMENT_STYLE = {
  match: {
    stroke: '#185338',
    fill: 'rgba(24,83,56,0.20)',
    label: 'Sesuai Standar',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  review: {
    stroke: '#d97706',
    fill: 'rgba(217,119,6,0.18)',
    label: 'Perlu Verifikasi',
    badge: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  mismatch: {
    stroke: '#e11d48',
    fill: 'rgba(225,29,72,0.18)',
    label: 'Tidak Sesuai',
    badge: 'border-rose-200 bg-rose-50 text-rose-800',
  },
  empty: {
    stroke: '#94a3b8',
    fill: 'rgba(148,163,184,0.14)',
    label: 'Sekat Kosong',
    badge: 'border-slate-200 bg-slate-100 text-slate-600',
  },
}

// Standar AKG per porsi siswa (Permenkes No. 2 Tahun 2025).
const AKG_TARGETS = [
  { key: 'energy', label: 'Energi Total', unit: 'kkal', target: '550' },
  { key: 'protein', label: 'Protein', unit: 'g', target: '25-35' },
  { key: 'carbs', label: 'Karbohidrat', unit: 'g', target: '65-75' },
  { key: 'fat', label: 'Lemak Sehat', unit: 'g', target: '12-18' },
]

function clampUnit(value) {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return 0
  return Math.max(0, Math.min(1, numeric))
}

function compartmentQuad(compartment) {
  const quad = compartment?.bboxQuadNorm
  if (Array.isArray(quad) && quad.length === 4) return quad
  const box = compartment?.bboxNorm
  if (Array.isArray(box) && box.length === 4) {
    const [x1, y1, x2, y2] = box
    return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
  }
  return null
}

function TrayOverlay({ src, compartments }) {
  if (!src || !compartments?.length) return null
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-xs">
      <img
        src={src}
        alt="Foto hidangan dengan analisis sekat nampan"
        className="block w-full h-auto max-h-[340px] object-cover"
      />
      <svg
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {compartments.map((compartment) => {
          const quad = compartmentQuad(compartment)
          if (!quad) return null
          const style = COMPARTMENT_STYLE[compartment.status] || COMPARTMENT_STYLE.review
          const points = quad.map(([x, y]) => `${clampUnit(x) * 1000},${clampUnit(y) * 1000}`).join(' ')
          return (
            <polygon
              key={compartment.cell}
              points={points}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth="3.5"
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0">
        {compartments.map((compartment) => {
          const quad = compartmentQuad(compartment)
          if (!quad) return null
          const center = quad.reduce((sum, [x, y]) => [sum[0] + x / 4, sum[1] + y / 4], [0, 0])
          const style = COMPARTMENT_STYLE[compartment.status] || COMPARTMENT_STYLE.review
          return (
            <span
              key={`label-${compartment.cell}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border bg-white/95 px-2 py-0.5 font-mono text-[9px] font-extrabold shadow-md"
              style={{
                left: `${clampUnit(center[0]) * 100}%`,
                top: `${clampUnit(center[1]) * 100}%`,
                borderColor: style.stroke,
                color: style.stroke,
              }}
            >
              {compartment.cell}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function CompartmentList({ compartments }) {
  if (!compartments?.length) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-500">
        Pemeriksaan visual sekat nampan sedang disinkronkan dengan modul inspeksi mutu.
      </p>
    )
  }
  return (
    <ul className="space-y-1.5">
      {compartments.map((compartment) => {
        const style = COMPARTMENT_STYLE[compartment.status] || COMPARTMENT_STYLE.review
        const predicted = String(compartment.predictedDisplay || compartment.predicted || '').replaceAll('_', ' ')
        return (
          <li
            key={compartment.cell}
            className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5"
          >
            <span
              className="mt-0.5 shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-extrabold bg-white shadow-2xs"
              style={{ borderColor: style.stroke, color: style.stroke }}
            >
              {compartment.cell}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${style.badge}`}>
                  {style.label}
                </span>
                {predicted && <span className="truncate text-[11px] font-extrabold text-slate-900">{predicted}</span>}
                {predicted && compartment.confidence > 0 && (
                  <span className="font-mono text-[10px] font-semibold text-slate-400">
                    {Math.round(compartment.confidence * 100)}%
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                {compartment.note}
                {compartment.component ? ` · komponen: ${compartment.component}` : ''}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function KelayakanCard({ report, compartments, preview }) {
  if (!report) return null
  const style = STATUS_STYLE[report.status_kelayakan] || STATUS_STYLE.Waspada
  const StatusIcon = style.icon
  const score = Math.max(0, Math.min(100, Number(report.skor_kesegaran) || 0))
  const indicators = Array.isArray(report.indikator_visual) ? report.indikator_visual : []

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <header className="flex items-center gap-2.5 bg-[#123624] px-5 py-3.5 text-white">
        <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-300" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
            Mode Kelayakan
          </p>
          <h2 className="text-sm font-extrabold tracking-tight">
            {report.nama_hidfangan || 'Hidangan tidak teridentifikasi'}
          </h2>
        </div>
      </header>

      <div className="space-y-4 p-5">
        <div className={`rounded-2xl border p-4 ${style.card}`}>
          <div className="flex items-center justify-between gap-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${style.chip}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {report.status_kelayakan}
            </span>
            <span className="text-2xl font-black tabular-nums tracking-tight text-slate-900">
              {Math.round(score)}
              <span className="text-xs font-bold text-slate-400">/100</span>
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/70">
            <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${score}%` }} />
          </div>
          <p className="mt-2 text-[11px] font-semibold text-slate-600">Skor kesegaran visual</p>
        </div>

        {report.peringatan_keamanan ? (
          <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-rose-700">
                Peringatan Keamanan
              </p>
              <p className="mt-1 text-xs leading-relaxed text-rose-800">{report.peringatan_keamanan}</p>
            </div>
          </div>
        ) : null}

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Indikator Visual
          </p>
          {indicators.length ? (
            <ul className="mt-2 space-y-1.5">
              {indicators.map((text, i) => (
                <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-slate-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-xs italic text-slate-400">Tidak ada indikator tambahan.</p>
          )}
        </div>

        {/* Overlay sekat nampan: satu-satunya informasi yang tidak ada di teks ringkasan. */}
        {compartments?.length ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Pemeriksaan Visual Sekat Nampan
              </p>
              <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                {compartments.length} Sekat
              </span>
            </div>
            <TrayOverlay src={preview} compartments={compartments} />
            <CompartmentList compartments={compartments} />
          </div>
        ) : null}

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
            Rekomendasi
          </p>
          <p className="mt-1 text-xs leading-relaxed text-emerald-900">{report.rekomendasi}</p>
        </div>
      </div>
    </section>
  )
}

const MACRO_ITEMS = [
  { key: 'kalori_total', label: 'Kalori', unit: 'kcal', accent: 'text-amber-600' },
  { key: 'protein', label: 'Protein', unit: 'g', accent: 'text-emerald-600' },
  { key: 'karbohidrat', label: 'Karbohidrat', unit: 'g', accent: 'text-sky-600' },
  { key: 'lemak', label: 'Lemak', unit: 'g', accent: 'text-rose-600' },
  { key: 'serat', label: 'Serat', unit: 'g', accent: 'text-violet-600' },
]

export function NutrisiCard({ report, macros }) {
  if (!report) return null
  const bahan = Array.isArray(report.rincian_bahan) ? report.rincian_bahan : []
  const makro = report.makronutrisi || {}

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <header className="flex items-center gap-2.5 bg-amber-600 px-5 py-3.5 text-white">
        <Salad className="h-5 w-5 shrink-0 text-amber-100" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-100">
            Mode Makronutrisi
          </p>
          <h2 className="text-sm font-extrabold tracking-tight">
            {report.nama_hidfangan || 'Hidangan tidak teridentifikasi'}
          </h2>
        </div>
      </header>

      <div className="space-y-4 p-5">
        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
            Estimasi Berat Porsi
          </p>
          <p className="mt-0.5 text-xl font-black tabular-nums tracking-tight text-slate-900">
            {report.estimasi_berat_porsi || 'tidak tersedia'}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Makronutrisi
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {MACRO_ITEMS.map(({ key, label, unit, accent }) => {
              const value = Number(makro[key])
              const has = Number.isFinite(value) && value > 0
              return (
                <div
                  key={key}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2.5 text-center"
                >
                  <p className={`text-lg font-black tabular-nums tracking-tight ${has ? accent : 'text-slate-300'}`}>
                    {has ? Math.round(value) : '-'}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-500">
                    {label}
                    <span className="text-slate-400">/{unit}</span>
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Perbandingan dengan standar AKG: hanya bermakna di mode nutrisi. */}
        {macros ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
              Standar AKG Per Porsi Siswa
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {AKG_TARGETS.map((target) => {
                const value = Number(macros[target.key])
                const has = Number.isFinite(value) && value > 0
                return (
                  <div key={target.key} className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-semibold text-slate-400">{target.label}</span>
                      <span className="text-[9px] font-bold text-slate-400">Target: {target.target}</span>
                    </div>
                    <p className="font-mono text-xs font-extrabold text-slate-900 mt-0.5">
                      {has ? Math.round(value) : '-'}
                      <span className="ml-1 text-[10px] font-semibold text-slate-400">{target.unit}</span>
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Rincian Bahan
          </p>
          {bahan.length ? (
            <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
              {bahan.map((b, i) => (
                <li
                  key={`${b.bahan}-${i}`}
                  className="flex items-center justify-between gap-3 bg-white px-3.5 py-2.5"
                >
                  <span className="text-xs font-semibold text-slate-800">{b.bahan}</span>
                  <span className="shrink-0 font-mono text-[11px] font-bold text-amber-700">
                    {b.porsi_estimasi || '-'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-xs italic text-slate-400">
              Rincian bahan tidak tersedia. Pastikan resep atau komposisi tercatat pada batch.
            </p>
          )}
        </div>

        <div className="flex items-start gap-2.5 rounded-2xl border border-sky-100 bg-sky-50/60 p-3.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700">
              Ringkasan Gizi
            </p>
            <p className="mt-1 text-xs leading-relaxed text-sky-900">
              {report.ringkasan_gizi || 'Ringkasan gizi tidak tersedia.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export function ScanModeResult({ mode, result, preview, macros }) {
  if (!result) return null
  if (mode === 'nutrisi') return <NutrisiCard report={result.nutrisi} macros={macros} />
  return (
    <KelayakanCard
      report={result.kelayakan}
      compartments={result.compartments}
      preview={preview}
    />
  )
}
