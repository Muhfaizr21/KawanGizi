import { ShieldCheck, Salad } from 'lucide-react'

/**
 * Badge mode pindai.
 *
 * Menandai baris riwayat dengan fokus analisis yang dipakai saat foto itu
 * dipindai, supaya pengguna bisa langsung tahu hasil mana yang relevan untuk
 * dibuka lagi: kelayakan (kesegaran & keamanan) atau nutrisi (makronutrisi).
 */

const MODE_META = {
  kelayakan: {
    label: 'Kelayakan',
    Icon: ShieldCheck,
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  nutrisi: {
    label: 'Makronutrisi',
    Icon: Salad,
    chip: 'border-amber-200 bg-amber-50 text-amber-800',
  },
}

export function ModeBadge({ mode, size = 'sm' }) {
  const meta = MODE_META[mode] || {
    label: 'Mode tidak dikenal',
    Icon: ShieldCheck,
    chip: 'border-slate-200 bg-slate-50 text-slate-500',
  }
  const Icon = meta.Icon
  const pad = size === 'md' ? 'px-3 py-1 text-[11px]' : 'px-2 py-0.5 text-[10px]'
  const icon = size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-extrabold whitespace-nowrap ${meta.chip} ${pad}`}
    >
      <Icon className={icon} />
      {meta.label}
    </span>
  )
}

export default ModeBadge
