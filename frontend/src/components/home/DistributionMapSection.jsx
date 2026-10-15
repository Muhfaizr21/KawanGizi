import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { GIS_REGIONS, GIS_NODES, REGIONAL_DEMOGRAPHICS, OPERATIONAL_MATRIX } from '../../data/mbgData'

// Bespoke, professional vector icons (No AI emojis, no cheesy sparkles)
function CompassIcon({ className = 'h-3.5 w-3.5 text-gray-700' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 19 21 12 17 5 21 12 2" />
    </svg>
  )
}

function BuildingHubIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M5 21V7l8-4 8 4v14M10 9h4M10 13h4M10 17h4" />
    </svg>
  )
}

function AcademicSchoolIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  )
}

function NetworkIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function RouteIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </svg>
  )
}

function TelemetryIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

export function DistributionMapSection() {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersLayerRef = useRef(null)
  const routesLayerRef = useRef(null)

  const [activeRegionId, setActiveRegionId] = useState('all')
  const [activeTypeFilter, setActiveTypeFilter] = useState('all') // 'all' | 'sppg' | 'school'
  const [selectedNode, setSelectedNode] = useState(null)

  const activeRegion =
    REGIONAL_DEMOGRAPHICS.find((r) => r.id === activeRegionId) ||
    REGIONAL_DEMOGRAPHICS[0]

  // Initialize Leaflet map with ESRI World Light Gray Cartography (No API Key, No Watermark)
  useEffect(() => {
    if (!mapContainerRef.current) return
    if (mapInstanceRef.current) return

    const initialRegion = GIS_REGIONS[0]

    const map = L.map(mapContainerRef.current, {
      center: initialRegion.center,
      zoom: initialRegion.zoom,
      minZoom: 4,
      maxZoom: 16,
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: false,
    })

    // Discrete official attribution
    L.control
      .attribution({
        position: 'bottomright',
        prefix:
          '<span class="text-[10px] text-gray-400 font-mono">Esri GIS &bull; Badan Gizi Nasional</span>',
      })
      .addTo(map)

    // Zoom control at top right
    L.control.zoom({ position: 'topright' }).addTo(map)

    // Base Layer: Esri World Light Gray Base (clean, minimal, official)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 16,
        attribution: 'Tiles &copy; Esri',
      }
    ).addTo(map)

    // Reference Layer: Clean boundaries and typography
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 16,
      }
    ).addTo(map)

    routesLayerRef.current = L.layerGroup().addTo(map)
    markersLayerRef.current = L.layerGroup().addTo(map)

    mapInstanceRef.current = map

    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 200)

    return () => {
      clearTimeout(timer)
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // Render Markers and Corridor Routes with Precision Vector Graphics
  useEffect(() => {
    const map = mapInstanceRef.current
    const markersLayer = markersLayerRef.current
    const routesLayer = routesLayerRef.current
    if (!map || !markersLayer || !routesLayer) return

    markersLayer.clearLayers()
    routesLayer.clearLayers()

    const visibleNodes = GIS_NODES.filter((node) => {
      if (activeTypeFilter === 'sppg') return node.type === 'sppg'
      if (activeTypeFilter === 'school') return node.type === 'school'
      return true
    })

    // Corridors connecting SPPG kitchens to schools
    if (activeTypeFilter === 'all' || activeTypeFilter === 'school') {
      visibleNodes.forEach((node) => {
        if (node.type === 'school' && node.sppgId) {
          const parentSppg = GIS_NODES.find((n) => n.id === node.sppgId)
          if (parentSppg) {
            L.polyline(
              [
                [parentSppg.lat, parentSppg.lng],
                [node.lat, node.lng],
              ],
              {
                color: '#059669',
                weight: 2,
                dashArray: '4, 6',
                opacity: 0.55,
              }
            ).addTo(routesLayer)
          }
        }
      })
    }

    // Precision Vector Markers
    visibleNodes.forEach((node) => {
      const isSppg = node.type === 'sppg'
      let iconHtml = ''
      let iconSize = [24, 24]
      let iconAnchor = [12, 12]

      if (isSppg) {
        iconSize = [30, 30]
        iconAnchor = [15, 15]
        iconHtml = `
          <div style="cursor: pointer;" class="relative flex items-center justify-center">
            <span style="position: absolute; width: 28px; height: 28px; border-radius: 9999px; background-color: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4);"></span>
            <div style="position: relative; width: 22px; height: 22px; border-radius: 9999px; background-color: #047857; border: 2px solid #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; color: #ffffff;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 21h18M5 21V7l8-4 8 4v14M10 9h4M10 13h4M10 17h4"/>
              </svg>
            </div>
          </div>
        `
      } else {
        iconSize = [22, 22]
        iconAnchor = [11, 11]
        iconHtml = `
          <div style="cursor: pointer;" class="relative flex items-center justify-center">
            <div style="position: relative; width: 18px; height: 18px; border-radius: 9999px; background-color: #2563EB; border: 2px solid #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.12); display: flex; align-items: center; justify-content: center; color: #ffffff;">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            </div>
          </div>
        `
      }

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: iconHtml,
        iconSize: iconSize,
        iconAnchor: iconAnchor,
      })

      const marker = L.marker([node.lat, node.lng], { icon: customIcon }).addTo(
        markersLayer
      )

      // Enterprise Data Popup
      const popupHtml = `
        <div style="min-width: 220px; font-family: inherit; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; background: ${isSppg ? '#ECFDF5' : '#EFF6FF'}; color: ${isSppg ? '#065F46' : '#1E40AF'}; border: 1px solid ${isSppg ? '#A7F3D0' : '#BFDBFE'}; padding: 2px 8px; border-radius: 6px;">
              ${isSppg ? 'Dapur Sentral SPPG' : 'Satuan Pendidikan'}
            </span>
            <span style="font-size: 10px; font-family: monospace; color: #059669; font-weight: 700;">
              ${node.status}
            </span>
          </div>
          <h4 style="font-size: 13.5px; font-weight: 800; color: #0F172A; margin: 0 0 3px 0; line-height: 1.25;">
            ${node.name}
          </h4>
          <p style="font-size: 11px; color: #64748B; margin: 0 0 10px 0;">
            ${node.cluster} &bull; <span style="font-weight: 600; color: #334155;">${isSppg ? node.capacity : `${node.portions} Porsi Siswa`}</span>
          </p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; background: #F8FAFC; border: 1px solid #E2E8F0; padding: 8px 10px; border-radius: 8px;">
            <div>
              <span style="color: #94A3B8; font-size: 9px; display: block; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Suhu Cold-Chain</span>
              <strong style="color: #0F172A; font-family: monospace; font-size: 12px;">${node.temp}</strong>
            </div>
            <div>
              <span style="color: #94A3B8; font-size: 9px; display: block; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">${isSppg ? 'Jaringan Sekolah' : 'Indeks Kepatuhan'}</span>
              <strong style="color: #047857; font-size: 12px;">${isSppg ? `${node.activeSchools} Sekolah` : `${node.freshness}% Standar`}</strong>
            </div>
          </div>
        </div>
      `

      marker.bindPopup(popupHtml, {
        maxWidth: 290,
        className: 'custom-mbg-popup',
      })

      marker.on('click', () => {
        setSelectedNode(node)
      })
    })
  }, [activeTypeFilter])

  // Camera flight animation between regional nodes
  const handleFlyToRegion = (regionId) => {
    setActiveRegionId(regionId)
    const target = GIS_REGIONS.find((r) => r.id === regionId)
    if (target && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(target.center, target.zoom, {
        duration: 1.2,
        easeLinearity: 0.25,
      })
    }
  }

  return (
    <section
      id="sebaran"
      aria-label="Peta Sebaran Sekolah & Jangkauan Distribusi Nasional"
      className="border-t border-gray-100 bg-gray-50/50 py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/90 bg-amber-50 px-3.5 py-1 text-xs font-semibold text-amber-800 shadow-sm">
            <CompassIcon />
            Data Simulasi: Purwarupa MVP
          </div>
          <h2 className="mt-3 text-3xl sm:text-5xl font-black tracking-tight text-gray-900">
            Peta Sebaran & Jangkauan{' '}
            <em className="font-serif italic font-normal text-gray-700">
              Distribusi Nasional
            </em>
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-500 leading-relaxed">
            Visualisasi data simulasi untuk demonstrasi purwarupa: jangkauan sekolah, SPPG, rute cold-chain, dan metrik kepatuhan suhu. Data bukan real-time nasional.
          </p>
        </div>

        {/* Regional Focus Filter Tabs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
          {GIS_REGIONS.map((region) => {
            const isSelected = activeRegionId === region.id
            return (
              <button
                key={region.id}
                type="button"
                onClick={() => handleFlyToRegion(region.id)}
                className={`rounded-full px-4 sm:px-5 py-2 sm:py-2.5 text-xs font-semibold tracking-wide transition-all ${
                  isSelected
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-900 hover:text-gray-900'
                }`}
              >
                {region.label}
              </button>
            )
          })}
        </div>

        {/* Main Geospatial Command Center Card */}
        <div className="mt-8 rounded-3xl border border-gray-200/90 bg-white p-5 sm:p-8 shadow-sm">
          {/* Card Top Sub-Header & Live Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-md">
                  {activeRegion.badge}
                </span>
              </div>
              <h3 className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-gray-900">
                Klaster Wilayah: {activeRegion.label}
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-gray-500">
                {activeRegion.description}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 sm:self-start">
              <span className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200/70 px-3 py-1.5">
                <BuildingHubIcon className="h-3.5 w-3.5 text-emerald-700" />
                <span><strong>{activeRegion.activeKitchens}</strong> SPPG Aktif</span>
              </span>
              <span className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200/70 px-3 py-1.5">
                <AcademicSchoolIcon className="h-3.5 w-3.5 text-blue-600" />
                <span><strong>{activeRegion.totalSchools}</strong> Sekolah</span>
              </span>
            </div>
          </div>

          {/* Interactive GIS Map Container with Professional Floating Controls */}
          <div className="relative mt-6 overflow-hidden rounded-2xl border border-gray-200/80 shadow-sm">
            {/* Real GIS Leaflet Map */}
            <div
              ref={mapContainerRef}
              className="h-[460px] sm:h-[540px] w-full bg-slate-100 outline-none"
              style={{ minHeight: '460px' }}
            />

            {/* Map Top Floating Segmented Controls */}
            <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-1 rounded-xl border border-gray-200/90 bg-white/95 p-1 shadow-md">
              <button
                type="button"
                onClick={() => setActiveTypeFilter('all')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeTypeFilter === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <NetworkIcon className="h-3.5 w-3.5" />
                <span>Semua Titik</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTypeFilter('sppg')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeTypeFilter === 'sppg'
                    ? 'bg-emerald-700 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <BuildingHubIcon className="h-3.5 w-3.5" />
                <span>Dapur SPPG</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTypeFilter('school')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeTypeFilter === 'school'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <AcademicSchoolIcon className="h-3.5 w-3.5" />
                <span>Sekolah</span>
              </button>
            </div>

            {/* Map Bottom-Left Clean Architectural Legend */}
            <div className="absolute bottom-4 left-4 z-20 hidden sm:flex items-center gap-4 rounded-xl border border-gray-200/80 bg-white/95 px-3.5 py-2 text-[11px] font-medium text-gray-700 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-700 text-white">
                  <BuildingHubIcon className="h-2.5 w-2.5" />
                </span>
                <span>Dapur SPPG</span>
              </div>
              <span className="text-gray-300">&bull;</span>
              <div className="flex items-center gap-1.5">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-white">
                  <AcademicSchoolIcon className="h-2.5 w-2.5" />
                </span>
                <span>Sekolah Penerima</span>
              </div>
              <span className="text-gray-300">&bull;</span>
              <div className="flex items-center gap-1.5">
                <RouteIcon className="h-3.5 w-3.5 text-emerald-600" />
                <span>Rute Cold-Chain</span>
              </div>
            </div>

            {/* Selected Node Floating Details Bar (if clicked) */}
            {selectedNode && (
              <div className="absolute top-4 right-14 z-20 max-w-xs rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-xl sm:block">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      selectedNode.type === 'sppg'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {selectedNode.type === 'sppg'
                      ? 'Dapur Sentral'
                      : 'Sekolah Penerima'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedNode(null)}
                    className="text-gray-400 hover:text-gray-900 text-sm font-bold"
                  >
                    &times;
                  </button>
                </div>
                <h4 className="mt-2 text-sm font-bold text-gray-900">
                  {selectedNode.name}
                </h4>
                <p className="text-xs text-gray-500">
                  {selectedNode.cluster} &bull;{' '}
                  {selectedNode.type === 'sppg'
                    ? selectedNode.capacity
                    : `${selectedNode.portions} Porsi`}
                </p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-gray-600">
                  <span>Suhu: <strong className="font-mono text-gray-900">{selectedNode.temp}</strong></span>
                  <span className="font-semibold text-emerald-600">
                    {selectedNode.status}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Key Operational Impact Metrics */}
          <div className="mt-8 grid gap-6 border-t border-gray-100 pt-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900">
                542.850+
              </p>
              <h4 className="mt-1 text-sm font-bold text-gray-900">
                Siswa Penerima Manfaat
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Asupan gizi harian siswa terverifikasi resmi pada basis data Dapodik & EMIS.
              </p>
            </div>

            <div>
              <p className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900">
                1.248
              </p>
              <h4 className="mt-1 text-sm font-bold text-gray-900">
                Satuan Pendidikan
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Menjangkau jenjang PAUD, SD/MI, hingga SMP/MTs di 8 klaster percontohan.
              </p>
            </div>

            <div>
              <p className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900">
                128
              </p>
              <h4 className="mt-1 text-sm font-bold text-gray-900">
                Dapur Sentral SPPG
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Fasilitas pengolahan pangan tersertifikasi higienitas & sanitasi standar mutu pangan.
              </p>
            </div>

            <div>
              <p className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900">
                &lt; 25 Menit
              </p>
              <h4 className="mt-1 text-sm font-bold text-gray-900">
                Radius Antar Maksimal
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Jaminan rantai dingin menjaga suhu aman boks (20°C–25°C) sebelum santap.
              </p>
            </div>
          </div>

          {/* Operational Reach & Distribution Schedule Table */}
          <div className="mt-10 border-t border-gray-100 pt-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4">
              <div>
                <h4 className="text-base font-bold text-gray-900">
                  Matriks Distribusi Wilayah Operasional
                </h4>
                <p className="text-xs text-gray-500">
                  Rekapitulasi sebaran dapur mandiri, satuan pendidikan, serta kapasitas penyaluran harian per klaster.
                </p>
              </div>
              <span className="text-[11px] font-mono text-gray-400">
                Jadwal Pengantaran Pagi (Shift 1)
              </span>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto rounded-2xl border border-gray-200/80 bg-white">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-5 py-3.5">Klaster Wilayah</th>
                    <th className="px-5 py-3.5">Dapur Sentral</th>
                    <th className="px-5 py-3.5">Sekolah Terdaftar</th>
                    <th className="px-5 py-3.5">Kapasitas Harian</th>
                    <th className="px-5 py-3.5">Jendela Kirim</th>
                    <th className="px-5 py-3.5 text-right">Kontrol Suhu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {OPERATIONAL_MATRIX.map((row, idx) => (
                    <tr
                      key={idx}
                      className="transition-colors hover:bg-gray-50/60"
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-gray-900 block">
                          {row.region}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {row.province}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-gray-700">
                        {row.hub}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">
                        {row.schools}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-gray-900 font-semibold">
                        {row.portions}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-gray-600">
                        {row.window}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-emerald-700 font-medium">
                        {row.tempRange}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-[11px] text-gray-400 leading-relaxed">
              * Seluruh pengantaran makanan bergizi menggunakan boks terisolasi termal dengan kontrol suhu cold-chain 20°–25°C sebelum jam istirahat pertama siswa.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}