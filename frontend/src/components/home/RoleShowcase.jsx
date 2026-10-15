import { useState } from 'react'
import { ROLES_DATA } from '../../data/mbgData'

export function RoleShowcase() {
  const [activeRoleId, setActiveRoleId] = useState('sppg')
  const activeRole = ROLES_DATA.find((r) => r.id === activeRoleId) || ROLES_DATA[0]

  return (
    <section id="roles" aria-label="Tiga Aktor" className="border-t border-gray-100 bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center max-w-2xl mx-auto">
          <p className="font-serif text-sm italic text-gray-500">Tiga Peran, Satu Ekosistem Terpadu</p>
          <h2 className="mt-2 text-3xl sm:text-5xl font-black tracking-tight text-gray-900">
            Solusi Spesifik untuk <em className="font-serif italic font-normal text-gray-700">Setiap Aktor</em>
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-500 leading-relaxed">
            Validator memeriksa porsi di sekolah, petugas SPPG mengelola dapur, dan Super Admin mengawasi seluruh operasional.
          </p>
        </div>

        {/* Role Tabs */}
        <div className="mt-12 flex justify-center">
          <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-1.5">
            {ROLES_DATA.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveRoleId(r.id)}
                className={`rounded-full px-5 py-2 text-xs font-bold tracking-wide transition-all ${
                  activeRoleId === r.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {r.role}
              </button>
            ))}
          </div>
        </div>

        {/* Active Role Showcase Card */}
        <div className="mt-10 rounded-3xl border border-gray-200/80 bg-gray-50/40 p-8 sm:p-12">
          <div className="grid gap-8 md:grid-cols-12 md:items-center">
            <div className="md:col-span-7 space-y-4">
              <span className="inline-flex rounded-full bg-gray-900 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                {activeRole.tag}
              </span>
              <h3 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 leading-tight">
                {activeRole.title}
              </h3>
              <p className="text-sm sm:text-base leading-relaxed text-gray-600">
                {activeRole.desc}
              </p>
              <ul className="mt-6 space-y-3 pt-2">
                {activeRole.points.map((pt, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-800">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800 mt-0.5">
                      ✓
                    </span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Ringkasan Dampak</p>
              <p className="mt-3 text-base sm:text-lg font-medium leading-relaxed text-gray-900">
                &ldquo;{activeRole.highlight}&rdquo;
              </p>
              <div className="mt-6 border-t border-gray-100 pt-4 flex items-center justify-between text-xs text-gray-500">
                <span>Status Ekosistem KawanGizi</span>
                <span className="font-bold text-emerald-700">Purwarupa MVP</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
