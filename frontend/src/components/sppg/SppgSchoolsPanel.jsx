import { useState, useMemo, useEffect, useRef, Fragment, useCallback } from 'react'
import L from 'leaflet'
import {
  School,
  X,
  Printer,
  Phone,
  MapPin,
  ChevronDown,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Edit3,
  Send,
  Building2,
  MessageSquare,
  AlertCircle,
  Plus,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  fetchSppgSchoolsBundle,
  updateSppgSchoolAttendance,
  updateSppgSchoolDroppoint,
  sendSppgSchoolReminder,
  fetchSppgList,
  createOwnedSchool,
} from '../../lib/api'

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#23259C]'
const BTN = `inline-flex items-center gap-1.5 rounded-xl bg-[#23259C] px-4 py-2 text-xs font-bold text-white shadow-[0_10px_20px_-10px_rgba(27,29,125,0.7)] transition hover:bg-[#1b1d7d] active:scale-[0.98] ${FOCUS}`
const BTN_SECONDARY = `inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] ${FOCUS}`
const CARD = 'rounded-2xl border border-slate-200 bg-white shadow-[0_14px_30px_-22px_rgba(27,29,125,0.4)]'
const THEAD = 'border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600'
const GHOST = `rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-[0.97] ${FOCUS}`

function dot(color) {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

export function SppgSchoolsPanel() {
  const { user, isSuperadmin } = useAuth()
  const [kitchens, setKitchens] = useState([])
  const [activeSppgId, setActiveSppgId] = useState(user?.sppgId || 'SPPG-01')

  const [bundle, setBundle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Accordion & Modals
  const [openId, setOpenId] = useState('')
  const [guideId, setGuideId] = useState(null)
  const [contactId, setContactId] = useState(null)
  const [attendanceModalId, setAttendanceModalId] = useState(null)
  const [editDroppointId, setEditDroppointId] = useState(null)
  const [copied, setCopied] = useState(false)
  const [printGuide, setPrintGuide] = useState(null)

  // Attendance Form State
  const [attPresent, setAttPresent] = useState(0)
  const [attReduce, setAttReduce] = useState(0)
  const [attAbsenceNote, setAttAbsenceNote] = useState('')
  const [attUpdateTime, setAttUpdateTime] = useState('')
  const [attSpecials, setAttSpecials] = useState([])
  const [attSubmitting, setAttSubmitting] = useState(false)

  // Droppoint Form State
  const [dpLocation, setDpLocation] = useState('')
  const [dpValidator, setDpValidator] = useState('')
  const [dpPhone, setDpPhone] = useState('')
  const [dpPrincipal, setDpPrincipal] = useState('')
  const [dpSubmitting, setDpSubmitting] = useState(false)

  // Formulir pendaftaran sekolah Keenam (field sama dengan modul Superadmin)
  const [isOnboardOpen, setIsOnboardOpen] = useState(false)
  const [onboardSubmitting, setOnboardSubmitting] = useState(false)
  const [newSchoolForm, setNewSchoolForm] = useState({
    npsn: '',
    name: '',
    level: 'SD',
    city: 'Jakarta Pusat',
    district: '',
    address: '',
    principalName: '',
    principalPhone: '',
    uksName: '',
    uksPhone: '',
    clinicName: '',
    clinicPhone: '',
    lat: '-6.2088',
    lng: '106.8456',
    lowerGrade: 150,
    upperGrade: 180,
    smpGrade: 0,
  })

  const mapRef = useRef(null)
  const mapInstance = useRef(null)

  // 1. Load Kitchen list for Superadmin switcher
  useEffect(() => {
    let mounted = true
    async function loadKitchens() {
      try {
        const list = await fetchSppgList()
        if (mounted && Array.isArray(list) && list.length > 0) {
          setKitchens(list)
        }
      } catch (err) {
        console.warn('Gagal memuat daftar dapur SPPG:', err)
      }
    }
    loadKitchens()
    return () => {
      mounted = false
    }
  }, [])

  // 2. Load Schools Bundle from Database
  const loadBundle = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true)
      else setLoading(true)
      setError('')

      try {
        const data = await fetchSppgSchoolsBundle(activeSppgId)
        if (data) {
          setBundle(data)
          if (!openId && data.schools?.length > 0) {
            setOpenId(data.schools[0].id)
          }
        }
      } catch (err) {
        console.error('Gagal mengambil data sekolah binaan:', err)
        setError(err.message || 'Gagal terhubung ke database sekolah SPPG.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [activeSppgId, openId]
  )

  useEffect(() => {
    loadBundle()
  }, [loadBundle])

  const schools = useMemo(() => bundle?.schools || [], [bundle])
  const totals = useMemo(() => {
    if (bundle?.totals) return bundle.totals
    return {
      quota: 0,
      present: 0,
      updated: 0,
      total: schools.length,
      specials: 0,
    }
  }, [bundle, schools])

  const depot = useMemo(
    () =>
      bundle?.depot || {
        name: bundle?.kitchenName || 'Dapur SPPG',
        lat: -6.1983,
        lng: 106.845,
      },
    [bundle]
  )

  // 3. Leaflet Map Rendering
  useEffect(() => {
    if (!mapRef.current || loading) return

    if (mapInstance.current) {
      mapInstance.current.remove()
      mapInstance.current = null
    }

    const map = L.map(mapRef.current, {
      center: [depot.lat, depot.lng],
      zoom: 13,
      scrollWheelZoom: false,
      attributionControl: false,
    })

    L.control.attribution({ position: 'bottomright', prefix: 'Esri GIS & MBG Database' }).addTo(map)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 16 }
    ).addTo(map)

    const layers = L.layerGroup().addTo(map)

    // Marker Dapur SPPG
    L.marker([depot.lat, depot.lng], { icon: dot('#23259C') })
      .bindPopup(`<b>${depot.name}</b><br><span style="font-size:11px;color:#64748b">Depot Dapur Sentral</span>`)
      .addTo(layers)

    // Markers Sekolah
    schools.forEach((s) => {
      if (!s.lat || !s.lng) return
      const isOntime = s.status?.onTime
      const markerColor = isOntime ? '#059669' : '#D97706'

      L.marker([s.lat, s.lng], { icon: dot(markerColor) })
        .bindPopup(
          `<b>${s.name}</b><br><span style="font-size:11px;color:#475569">Kuota cetak: <b>${s.packingQuota} boks</b></span><br><span style="font-size:10px;color:#64748b">${s.status?.label || 'Presensi'}</span>`
        )
        .addTo(layers)
    })

    mapInstance.current = map
    const t = setTimeout(() => map.invalidateSize(), 200)

    return () => {
      clearTimeout(t)
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [schools, depot, loading])

  // Keydown escape for modals
  useEffect(() => {
    if (!guideId && !contactId && !attendanceModalId && !editDroppointId) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setGuideId(null)
        setContactId(null)
        setAttendanceModalId(null)
        setEditDroppointId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [guideId, contactId, attendanceModalId, editDroppointId])

  // Print Guide effect
  useEffect(() => {
    if (!printGuide) return
    const t = setTimeout(() => window.print(), 150)
    return () => clearTimeout(t)
  }, [printGuide])

  // Handlers for Modals
  const guideSchool = schools.find((s) => s.id === guideId) || null
  const contactSchool = schools.find((s) => s.id === contactId) || null
  const printed = schools.find((s) => s.id === printGuide) || null
  const attendanceSchool = schools.find((s) => s.id === attendanceModalId) || null
  const editDroppointSchool = schools.find((s) => s.id === editDroppointId) || null

  const openAttendanceModal = (s) => {
    setAttPresent(s.present || s.enrolled || 0)
    setAttReduce(s.reduceSpecial || 0)
    setAttAbsenceNote(s.absenceNote || '')
    setAttUpdateTime(s.presentUpdatedAt || '')
    setAttSpecials(Array.isArray(s.specials) ? JSON.parse(JSON.stringify(s.specials)) : [])
    setAttendanceModalId(s.id)
  }

  const handleSaveAttendance = async (e) => {
    e.preventDefault()
    if (!attendanceSchool) return
    setAttSubmitting(true)
    setError('')
    try {
      await updateSppgSchoolAttendance(
        attendanceSchool.id,
        {
          present: Number(attPresent),
          reduceSpecial: Number(attReduce),
          absenceNote: attAbsenceNote.trim(),
          presentUpdatedAt: attUpdateTime.trim(),
          specials: attSpecials,
        },
        activeSppgId
      )
      setAttendanceModalId(null)
      setNotice(`Presensi harian ${attendanceSchool.name} berhasil diperbarui di database.`)
      setTimeout(() => setNotice(''), 4000)
      await loadBundle(true)
    } catch (err) {
      setError(err.message || 'Gagal menyimpan pembaruan presensi sekolah.')
    } finally {
      setAttSubmitting(false)
    }
  }

  const openEditDroppointModal = (s) => {
    setDpLocation(s.droppoint || '')
    setDpValidator(s.validator || '')
    setDpPhone(s.validatorPhone || '')
    setDpPrincipal(s.principal || '')
    setEditDroppointId(s.id)
  }

  const handleSaveDroppoint = async (e) => {
    e.preventDefault()
    if (!editDroppointSchool) return
    setDpSubmitting(true)
    setError('')
    try {
      await updateSppgSchoolDroppoint(
        editDroppointSchool.id,
        {
          droppoint: dpLocation.trim(),
          validator: dpValidator.trim(),
          validatorPhone: dpPhone.trim(),
          principal: dpPrincipal.trim(),
        },
        activeSppgId
      )
      setEditDroppointId(null)
      setNotice(`Panduan drop-point & PIC ${editDroppointSchool.name} berhasil diperbarui.`)
      setTimeout(() => setNotice(''), 4000)
      await loadBundle(true)
    } catch (err) {
      setError(err.message || 'Gagal memperbarui panduan drop-point.')
    } finally {
      setDpSubmitting(false)
    }
  }

  const handleRemindValidator = async (school) => {
    try {
      await sendSppgSchoolReminder(
        school.id,
        {
          customMessage: `Peringatan: Presensi ${school.name} belum dimutakhirkan. Harap segera perbarui kehadiran siswa sebelum batas waktu ${bundle?.deadline || '05:00'} WIB.`,
        },
        activeSppgId
      )
      setNotice(`Peringatan penagihan presensi berhasil dicatat untuk ${school.name}.`)
      setTimeout(() => setNotice(''), 4000)
    } catch (err) {
      setError('Gagal mengirim peringatan: ' + err.message)
    }
  }

  const addSpecialRow = () => {
    setAttSpecials([...attSpecials, { type: '', count: 1, note: '' }])
  }

  const updateSpecialRow = (index, field, value) => {
    const updated = [...attSpecials]
    updated[index][field] = field === 'count' ? Number(value) : value
    setAttSpecials(updated)
  }

  const removeSpecialRow = (index) => {
    setAttSpecials(attSpecials.filter((_, i) => i !== index))
  }

  const resetSchoolForm = () => {
    setNewSchoolForm({
      npsn: '',
      name: '',
      level: 'SD',
      city: 'Jakarta Pusat',
      district: '',
      address: '',
      principalName: '',
      principalPhone: '',
      uksName: '',
      uksPhone: '',
      clinicName: '',
      clinicPhone: '',
      lat: '-6.2088',
      lng: '106.8456',
      lowerGrade: 150,
      upperGrade: 180,
      smpGrade: 0,
    })
  }

  // Mendaftarkan sekolah equipaje baru milik dapur ini (dapur diambil dari backend).
  const handleOnboardSubmit = async (e) => {
    e.preventDefault()
    if (!newSchoolForm.npsn.trim() || !newSchoolForm.name.trim()) {
      setError('NPSN dan Nama Resmi Sekolah wajib diisi.')
      return
    }

    setOnboardSubmitting(true)
    setError('')
    setNotice('')
    try {
      const created = await createOwnedSchool({
        npsn: newSchoolForm.npsn.trim(),
        name: newSchoolForm.name.trim(),
        level: newSchoolForm.level || 'SD',
        city: newSchoolForm.city || 'Jakarta Pusat',
        district: newSchoolForm.district || 'Kecamatan Terpadu',
        address: newSchoolForm.address || 'Alamat operasional sekolah binaan',
        lat: Number(newSchoolForm.lat) || -6.2,
        lng: Number(newSchoolForm.lng) || 106.8,
        principalName: newSchoolForm.principalName || 'Kepala Sekolah Terdaftar',
        principalPhone: newSchoolForm.principalPhone || '0812-0000-0000',
        uksName: newSchoolForm.uksName || 'Koordinator UKS',
        uksPhone: newSchoolForm.uksPhone || '0813-0000-0000',
        clinicName: newSchoolForm.clinicName || `Puskesmas ${newSchoolForm.city || 'Kecamatan'}`,
        clinicPhone: newSchoolForm.clinicPhone || '021-1234567',
        lowerGrade: Number(newSchoolForm.lowerGrade) || 0,
        upperGrade: Number(newSchoolForm.upperGrade) || 0,
        smpGrade: Number(newSchoolForm.smpGrade) || 0,
      })
      setNotice(
        `Sekolah ${created?.name || newSchoolForm.name} (NPSN: ${created?.npsn || newSchoolForm.npsn}) berhasil terdaftar pada dapur ${activeSppgId}.`
      )
      setIsOnboardOpen(false)
      resetSchoolForm()
      loadBundle(true)
    } catch (err) {
      setError(err?.message || 'Gagal mendaftarkan sekolah baru.')
    } finally {
      setOnboardSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <style>{`@page{size:A5;margin:8mm}.guide-print-sheet{display:none}@media print{body *{visibility:hidden}.guide-print-sheet,.guide-print-sheet *{visibility:visible}.guide-print-sheet{display:block !important;position:absolute;inset:0}}`}</style>

      {/* Superadmin Multi-Tenant Kitchen Switcher */}
      {isSuperadmin && (
        <section className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <Building2 className="h-5 w-5 text-amber-800 shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Superadmin Multi-Tenant Kitchen Switcher
              </p>
              <p className="text-[11px] text-amber-700">
                Pilih Dapur SPPG untuk menginspeksi alokasi sekolah binaan dan kepatuhan presensi di seluruh Indonesia.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="kitchen-select" className="text-xs font-semibold text-amber-900">
              Dapur:
            </label>
            <select
              id="kitchen-select"
              value={activeSppgId}
              onChange={(e) => setActiveSppgId(e.target.value)}
              className="rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm focus:border-[#23259C] focus:outline-none"
            >
              {kitchens.length > 0 ? (
                kitchens.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name} ({k.id})
                  </option>
                ))
              ) : (
                <>
                  <option value="SPPG-01">SPPG Sentral Menteng 01</option>
                  <option value="SPPG-02">SPPG Kebayoran Baru Mandiri</option>
                </>
              )}
            </select>
            <button
              type="button"
              onClick={() => loadBundle(true)}
              disabled={refreshing}
              className={`rounded-xl border border-amber-300 bg-white p-2 text-amber-900 shadow-sm hover:bg-amber-100 ${FOCUS}`}
              title="Segarkan data database"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </section>
      )}

      {/* Notifications / Errors */}
      {notice && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-semibold text-rose-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Hero Banner: Kuota Cetak & Batas Waktu Presensi */}
      <section className="overflow-hidden rounded-2xl bg-[#1B1D7D] text-white shadow-[0_18px_40px_-20px_rgba(27,29,125,0.65)]">
        <div className="flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-amber-300 border border-amber-300/30">
                {bundle?.kitchenCode || activeSppgId} · {schools.length} SEKOLAH BINAAN
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-300">
                <Clock className="h-3.5 w-3.5" /> Batas Presensi {bundle?.deadline || '05:00'} WIB
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Sekolah binaan dan kuota harian
            </h1>
            <p className="mt-2 max-w-lg text-xs leading-relaxed text-white/70">
              Alokasi porsi cetak MBG diproses secara presisi mengikuti kehadiran riil siswa yang dimutakhirkan sekolah
              pagi ini. Sekolah yang belum update memakai kuota terdaftar kemarin agar operasional dapur tidak terhenti.
            </p>
          </div>
          <div className="shrink-0 lg:text-right">
            <p className="text-[11px] font-bold tracking-[0.18em] text-white/60">KUOTA CETAK HARI INI</p>
            <p className="mt-1 text-5xl font-extrabold tabular-nums tracking-tight text-white">
              {loading ? '...' : totals.quota.toLocaleString('id-ID')}
            </p>
            <p className="mt-2 text-[11px] font-medium text-white/70">
              {totals.present.toLocaleString('id-ID')} siswa hadir · {totals.updated} dari {totals.total} sekolah update ·{' '}
              {totals.specials} porsi khusus
            </p>
          </div>
        </div>
      </section>

      {/* Toolbar: Tambah Sekolah Binaan milik dapur ini */}
      <div className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-white px-5 py-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-indigo-50 p-2 text-[#23259C]">
            <School className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Master Sekolah Binaan
            </p>
            <p className="text-[11px] text-slate-500">
              Daftarkan sekolah 신규 dengan NPSN resmi agar masuk ke alokasi porsi harian dapur ini.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOnboardOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#23259C] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#1b1d7d]"
        >
          <Plus className="h-4 w-4" />
          Tambah Sekolah
        </button>
      </div>

      {/* SLIP 01: Peta Drop-Point Serah Terima */}
      <div className={`overflow-hidden text-xs ${CARD}`}>
        <div className="px-5 pt-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-wide text-slate-500">SLIP 01 · TITIK SERAH TERIMA</p>
            <h2 className="mt-1 text-base font-extrabold tracking-tight text-slate-900">
              Peta drop-point sekolah binaan
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            Dapur: <b className="text-slate-800">{depot.name}</b>
          </span>
        </div>
        <div aria-hidden="true" className="mx-5 my-3 border-t border-dashed border-slate-300" />
        <div className="px-5 pb-2">
          <div
            ref={mapRef}
            className="h-[320px] w-full rounded-xl border border-slate-200"
            role="img"
            aria-label="Peta lokasi sekolah binaan"
          />
          <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 py-3 text-[11px] text-slate-600">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#23259C]" /> Dapur SPPG ({activeSppgId})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Presensi tepat waktu (≤ {bundle?.deadline || '05:00'})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-600" /> Telat atau belum update
              </span>
            </div>
            <button
              type="button"
              onClick={() => loadBundle(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#23259C] hover:underline"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} /> Sinkronkan Database
            </button>
          </div>
        </div>
      </div>

      {/* SLIP 02: Rekapitulasi Presensi & Kuota per Sekolah */}
      <div className={`overflow-hidden text-xs ${CARD}`}>
        <div className="px-5 pt-5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-wide text-slate-500">SLIP 02 · PRESENSI PAGI</p>
            <h2 className="mt-1 text-base font-extrabold tracking-tight text-slate-900">
              Kuota per sekolah binaan
            </h2>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-[#23259C]">
              <Users className="h-3.5 w-3.5" /> Total {schools.length} Sekolah
            </span>
          </div>
        </div>
        <div aria-hidden="true" className="mx-5 my-3 border-t border-dashed border-slate-300" />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className={THEAD}>
              <tr>
                <th scope="col" className="w-10 px-4 py-2.5 text-right">
                  No
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Sekolah Binaan
                </th>
                <th scope="col" className="px-3 py-2.5 text-right">
                  Terdaftar
                </th>
                <th scope="col" className="px-3 py-2.5 text-right">
                  Hadir
                </th>
                <th scope="col" className="px-3 py-2.5 text-right">
                  Kuota Cetak
                </th>
                <th scope="col" className="px-3 py-2.5 text-center">
                  Presensi Pagi
                </th>
                <th scope="col" className="px-4 py-2.5 text-center">
                  Aksi Operasional
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#23259C]" />
                    <p className="mt-2 font-semibold">Memuat data sekolah binaan dari database PostgreSQL...</p>
                  </td>
                </tr>
              ) : schools.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    Belum ada sekolah binaan yang terdaftar pada dapur ini di database.
                  </td>
                </tr>
              ) : (
                schools.map((s, i) => {
                  const open = openId === s.id
                  const isPending = !s.presentUpdatedAt
                  return (
                    <Fragment key={s.id}>
                      <tr className="transition hover:bg-[#23259C]/[0.03]">
                        <td className="px-4 py-3 text-right text-[11px] font-semibold tabular-nums text-slate-500">
                          {String(i + 1).padStart(2, '0')}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-bold text-slate-800">{s.name}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                            NPSN {s.npsn} · {s.level}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">
                          {s.enrolled?.toLocaleString('id-ID')}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">
                          {s.presentUpdatedAt ? s.present?.toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-[11px] font-bold tabular-nums text-[#23259C]">
                          {s.packingQuota?.toLocaleString('id-ID')}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${
                              s.status?.tone || 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {s.status?.label || 'Belum update'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setOpenId(open ? '' : s.id)}
                              aria-expanded={open}
                              className={GHOST}
                              title="Tampilkan rincian profil dan porsi khusus"
                            >
                              <span className="inline-flex items-center gap-1">
                                Detail
                                <ChevronDown className={`h-3 w-3 transition ${open ? 'rotate-180' : ''}`} />
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openAttendanceModal(s)}
                              className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition active:scale-[0.97]"
                              title="Perbarui presensi kehadiran siswa pagi ini"
                            >
                              Presensi
                            </button>
                            <button
                              type="button"
                              onClick={() => setGuideId(s.id)}
                              className={GHOST}
                              title="Lihat petunjuk lokasi drop-point"
                            >
                              Panduan
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setContactId(s.id)
                                setCopied(false)
                              }}
                              className={GHOST}
                              title="Hubungi PIC guru validator"
                            >
                              Hubungi
                            </button>
                            {isPending && (
                              <button
                                type="button"
                                onClick={() => handleRemindValidator(s)}
                                className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition"
                                title="Kirim peringatan penagihan presensi pagi"
                              >
                                Ingatkan
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={7} className="bg-slate-50/70 px-8 py-4 border-b border-slate-200">
                            <div className="grid gap-5 md:grid-cols-3">
                              <div>
                                <p className="text-[11px] font-bold tracking-wide text-slate-500">PROFIL & ARMADA</p>
                                <p className="mt-1 text-xs text-slate-700">{s.address}</p>
                                <p className="mt-1 font-mono text-[11px] text-slate-500">
                                  {s.lat && s.lng ? `${s.lat}, ${s.lng}` : 'Koordinat belum disetel'}
                                </p>
                                <p className="mt-1.5 text-[11px] font-medium text-slate-700">
                                  Armada Ditugaskan: <b className="text-slate-900">{s.fleet || 'Belum teralokasi'}</b>
                                </p>
                              </div>
                              <div>
                                <p className="text-[11px] font-bold tracking-wide text-slate-500">SELISIH PRESENSI</p>
                                <p className="mt-1 text-xs leading-relaxed text-slate-700">
                                  {s.absenceNote || 'Tidak ada catatan absensi khusus.'}
                                </p>
                                {(s.specials || []).length > 0 ? (
                                  <ul className="mt-2 space-y-1">
                                    {(s.specials || []).map((sp, idx) => (
                                      <li key={idx} className="text-[11px] text-slate-600">
                                        <span className="font-bold text-slate-800">
                                          {sp.count} porsi {sp.type}
                                        </span>
                                        {' · '}
                                        {sp.note}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mt-2 text-[11px] text-slate-500 italic">Tidak ada menu porsi khusus.</p>
                                )}
                              </div>
                              <div>
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-bold tracking-wide text-slate-500">KONTAK VALIDASI</p>
                                  <button
                                    type="button"
                                    onClick={() => openEditDroppointModal(s)}
                                    className="text-[11px] font-semibold text-[#23259C] hover:underline inline-flex items-center gap-1"
                                  >
                                    <Edit3 className="h-3 w-3" /> Edit Panduan/PIC
                                  </button>
                                </div>
                                <p className="mt-1 text-xs text-slate-700">Kepsek: <b>{s.principal || '-'}</b></p>
                                <p className="mt-1 text-xs text-slate-700">Validator: <b>{s.validator || '-'}</b></p>
                                <p className="mt-1 font-mono text-[11px] font-bold text-slate-900">{s.validatorPhone || '-'}</p>
                                <p className="mt-1.5 text-[11px] text-slate-500 line-clamp-2" title={s.droppoint}>
                                  Drop-point: {s.droppoint || 'Belum diatur'}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Panduan Drop-Point Modal */}
      {guideSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Panduan drop-point ${guideSchool.name}`}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between pb-1">
              <div>
                <p className="text-[11px] font-bold tracking-wide text-slate-500">PANDUAN DROP-POINT KURIR</p>
                <h2 className="mt-1 flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900">
                  <MapPin className="h-4 w-4 text-[#23259C]" />
                  {guideSchool.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setGuideId(null)}
                aria-label="Tutup panduan"
                className={`rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 ${FOCUS}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div aria-hidden="true" className="my-3 border-t border-dashed border-slate-300" />
            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
              <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                {guideSchool.droppoint || 'Lokasi drop-point belum ditentukan. Silakan hubungi pihak sekolah.'}
              </p>
            </div>
            <div className="mt-3 space-y-1.5 text-xs text-slate-600">
              <p>
                Alamat: <span className="font-semibold text-slate-800">{guideSchool.address}</span>
              </p>
              <p>
                Target Kuota Turun:{' '}
                <span className="font-mono font-bold text-[#23259C]">{guideSchool.packingQuota} boks</span>
              </p>
              <p>
                Armada Pengirim: <span className="font-semibold text-slate-800">{guideSchool.fleet}</span>
              </p>
              <p>
                PIC Lapangan:{' '}
                <span className="font-semibold text-slate-800">
                  {guideSchool.validator} ({guideSchool.validatorPhone})
                </span>
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setPrintGuide(guideSchool.id)
                  setGuideId(null)
                }}
                className={BTN}
              >
                <Printer className="h-4 w-4" />
                Cetak Lembar Panduan
              </button>
              <button
                type="button"
                onClick={() => {
                  setGuideId(null)
                  openEditDroppointModal(guideSchool)
                }}
                className={BTN_SECONDARY}
              >
                <Edit3 className="h-4 w-4" />
                Ubah Petunjuk
              </button>
              <button
                type="button"
                onClick={() => setGuideId(null)}
                className={`rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 ${FOCUS}`}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Hubungi Validator Modal */}
      {contactSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Hubungi ${contactSchool.name}`}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between pb-1">
              <div>
                <p className="text-[11px] font-bold tracking-wide text-slate-500">DIREKTORI KONTAK SEKOLAH</p>
                <h2 className="mt-1 flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900">
                  <Phone className="h-4 w-4 text-[#23259C]" />
                  {contactSchool.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setContactId(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div aria-hidden="true" className="my-3 border-t border-dashed border-slate-300" />
            <dl className="space-y-2.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Guru Validator / PIC</dt>
                <dd className="font-semibold text-slate-900">{contactSchool.validator || '-'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Nomor Telepon Piket</dt>
                <dd className="font-mono text-[11px] font-bold text-slate-900">
                  {contactSchool.validatorPhone || '-'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Kepala Sekolah</dt>
                <dd className="font-semibold text-slate-900">{contactSchool.principal || '-'}</dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              {contactSchool.validatorPhone && (
                <button
                  type="button"
                  onClick={() => {
                    const clean = contactSchool.validatorPhone.replace(/[^0-9]/g, '')
                    const waNum = clean.startsWith('0') ? '62' + clean.slice(1) : clean
                    window.open(`https://wa.me/${waNum}`, '_blank')
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
                >
                  <MessageSquare className="h-4 w-4" />
                  Chat WhatsApp
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${contactSchool.validator} (${contactSchool.name}): ${contactSchool.validatorPhone}`
                    )
                    setCopied(true)
                  } catch {
                    setCopied(false)
                  }
                }}
                className={BTN}
              >
                {copied ? 'Tersalin!' : 'Salin Kontak'}
              </button>
              <button
                type="button"
                onClick={() => setContactId(null)}
                className={`rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 ${FOCUS}`}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Update Presensi Pagi Modal */}
      {attendanceSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Update Presensi ${attendanceSchool.name}`}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between pb-1">
              <div>
                <p className="text-[11px] font-bold tracking-wide text-slate-500">MUTASI PRESENSI & KUOTA PAGI</p>
                <h2 className="mt-1 text-base font-extrabold tracking-tight text-slate-900">
                  {attendanceSchool.name}
                </h2>
                <p className="text-xs text-slate-500 font-mono">
                  Terdaftar di database: {attendanceSchool.enrolled} siswa
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAttendanceModalId(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div aria-hidden="true" className="my-3 border-t border-dashed border-slate-300" />

            <form onSubmit={handleSaveAttendance} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="att-present" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Siswa Hadir Riil
                  </label>
                  <input
                    id="att-present"
                    type="number"
                    min="0"
                    max={attendanceSchool.enrolled + 50}
                    value={attPresent}
                    onChange={(e) => setAttPresent(e.target.value)}
                    required
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#23259C] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="att-reduce" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Pengurangan Khusus
                  </label>
                  <input
                    id="att-reduce"
                    type="number"
                    min="0"
                    max={attPresent}
                    value={attReduce}
                    onChange={(e) => setAttReduce(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900 focus:border-[#23259C] focus:outline-none"
                  />
                  <p className="mt-0.5 text-[10px] text-slate-400">Misal porsi study tour / kegiatan luar</p>
                </div>
              </div>

              <div>
                <label htmlFor="att-time" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Waktu Pemutakhiran (HH:MM WIB)
                </label>
                <input
                  id="att-time"
                  type="text"
                  placeholder="Contoh: 04:50 (Kosong = waktu sekarang)"
                  value={attUpdateTime}
                  onChange={(e) => setAttUpdateTime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-[#23259C] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="att-note" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Catatan Selisih Absensi
                </label>
                <textarea
                  id="att-note"
                  rows="2"
                  value={attAbsenceNote}
                  onChange={(e) => setAttAbsenceNote(e.target.value)}
                  placeholder="Misal: 10 siswa sakit flu, 40 siswa kelas 2 study tour ke kebun binatang."
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#23259C] focus:outline-none"
                />
              </div>

              {/* Special Portions List */}
              <div className="border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Kebutuhan Porsi Khusus / Alergen
                  </p>
                  <button
                    type="button"
                    onClick={addSpecialRow}
                    className="text-[11px] font-semibold text-[#23259C] hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Tambah Diet
                  </button>
                </div>

                {attSpecials.length === 0 ? (
                  <p className="mt-1.5 text-[11px] text-slate-400 italic">Tidak ada rincian diet khusus.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {attSpecials.map((sp, idx) => (
                      <div key={idx} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2 border border-slate-200">
                        <input
                          type="text"
                          placeholder="Alergen (misal: Alergi kacang)"
                          value={sp.type}
                          onChange={(e) => updateSpecialRow(idx, 'type', e.target.value)}
                          className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px] focus:outline-none"
                        />
                        <input
                          type="number"
                          placeholder="Jml"
                          min="1"
                          value={sp.count}
                          onChange={(e) => updateSpecialRow(idx, 'count', e.target.value)}
                          className="w-14 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-bold text-center focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Catatan pengganti lauk"
                          value={sp.note}
                          onChange={(e) => updateSpecialRow(idx, 'note', e.target.value)}
                          className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeSpecialRow(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview Kuota Cetak */}
              <div className="rounded-xl bg-indigo-50/80 p-3 border border-indigo-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Preview Kuota Cetak</p>
                  <p className="text-[11px] text-indigo-900">
                    Siswa Hadir ({attPresent}) - Pengurangan ({attReduce})
                  </p>
                </div>
                <p className="text-xl font-extrabold text-[#23259C] tabular-nums">
                  {Math.max(0, Number(attPresent) - Number(attReduce))} boks
                </p>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAttendanceModalId(null)}
                  disabled={attSubmitting}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button type="submit" disabled={attSubmitting} className={BTN}>
                  {attSubmitting ? 'Menyimpan...' : 'Simpan Presensi ke Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Edit Panduan Drop-Point Modal */}
      {editDroppointSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Ubah Panduan ${editDroppointSchool.name}`}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between pb-1">
              <div>
                <p className="text-[11px] font-bold tracking-wide text-slate-500">PANDUAN DROP-POINT & PIC</p>
                <h2 className="mt-1 text-base font-extrabold tracking-tight text-slate-900">
                  {editDroppointSchool.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditDroppointId(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div aria-hidden="true" className="my-3 border-t border-dashed border-slate-300" />

            <form onSubmit={handleSaveDroppoint} className="space-y-3.5">
              <div>
                <label htmlFor="dp-location" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Instruksi Lokasi Drop-Point
                </label>
                <textarea
                  id="dp-location"
                  rows="3"
                  value={dpLocation}
                  onChange={(e) => setDpLocation(e.target.value)}
                  required
                  placeholder="Misal: Gerbang belakang dekat ruang UKS lantai 1. Kurir wajib lapor satpam pos 2."
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#23259C] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="dp-validator" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Nama Guru Validator / PIC
                </label>
                <input
                  id="dp-validator"
                  type="text"
                  value={dpValidator}
                  onChange={(e) => setDpValidator(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#23259C] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="dp-phone" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Nomor WhatsApp / Telepon Piket
                </label>
                <input
                  id="dp-phone"
                  type="text"
                  value={dpPhone}
                  onChange={(e) => setDpPhone(e.target.value)}
                  required
                  placeholder="0812-xxxx-xxxx"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-[#23259C] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="dp-principal" className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Nama Kepala Sekolah
                </label>
                <input
                  id="dp-principal"
                  type="text"
                  value={dpPrincipal}
                  onChange={(e) => setDpPrincipal(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#23259C] focus:outline-none"
                />
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditDroppointId(null)}
                  disabled={dpSubmitting}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button type="submit" disabled={dpSubmitting} className={BTN}>
                  {dpSubmitting ? 'Menyimpan...' : 'Perbarui Panduan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Pendaftaran Sekolah Binaan Baru (field sama dengan modul Superadmin) */}
      {isOnboardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-indigo-50 p-2 text-[#23259C]">
                  <School className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Pendaftaran Sekolah Binaan Baru
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    NPSN resmi, demografi siswa, dan kontak darurat sekolah {activeSppgId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOnboardOpen(false)}
                className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                title="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit} className="flex-1 space-y-4 overflow-y-auto p-6 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    NPSN (8 Digit) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={8}
                    placeholder="Contoh: 20109988"
                    value={newSchoolForm.npsn}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, npsn: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-[#23259C]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block font-semibold text-slate-700">
                    Nama Resmi Sekolah <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: SDN 03 Kramat Jati"
                    value={newSchoolForm.name}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#23259C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Jenjang Pendidikan</label>
                  <select
                    value={newSchoolForm.level}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, level: e.target.value })}
                    className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#23259C]"
                  >
                    <option value="SD">Sekolah Dasar (SD)</option>
                    <option value="MI">Madrasah Ibtidaiyah (MI)</option>
                    <option value="SMP">Sekolah Menengah Pertama (SMP)</option>
                    <option value="MTs">Madrasah Tsanawiyah (MTs)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Wilayah / Kota</label>
                  <input
                    type="text"
                    placeholder="Jakarta Pusat"
                    value={newSchoolForm.city}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, city: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#23259C]"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Kecamatan</label>
                  <input
                    type="text"
                    placeholder="Kecamatan Terpadu"
                    value={newSchoolForm.district}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, district: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#23259C]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">Alamat Lengkap Sekolah</label>
                <input
                  type="text"
                  placeholder="Jl. Merdeka Barat No. 20, RT 02/RW 04..."
                  value={newSchoolForm.address}
                  onChange={(e) => setNewSchoolForm({ ...newSchoolForm, address: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#23259C]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Latitude</label>
                  <input
                    type="text"
                    placeholder="-6.2088"
                    value={newSchoolForm.lat}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, lat: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-[#23259C]"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Longitude</label>
                  <input
                    type="text"
                    placeholder="106.8456"
                    value={newSchoolForm.lng}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, lng: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-[#23259C]"
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                  Demografi Siswa Sasaran (Kalkulasi Kalori Otomatis)
                </span>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      SD Bawah (7-9 thn / 480 kkal)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newSchoolForm.lowerGrade}
                      onChange={(e) => setNewSchoolForm({ ...newSchoolForm, lowerGrade: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      SD Atas (10-12 thn / 550 kkal)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newSchoolForm.upperGrade}
                      onChange={(e) => setNewSchoolForm({ ...newSchoolForm, upperGrade: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-600">
                      SMP (13-15 thn / 650 kkal)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newSchoolForm.smpGrade}
                      onChange={(e) => setNewSchoolForm({ ...newSchoolForm, smpGrade: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Nama Kepala Sekolah</label>
                  <input
                    type="text"
                    placeholder="Dra. Hj. Mulyani, M.Pd"
                    value={newSchoolForm.principalName}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, principalName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#23259C]"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    No. WhatsApp Kepala Sekolah
                  </label>
                  <input
                    type="text"
                    placeholder="0812-3456-7890"
                    value={newSchoolForm.principalPhone}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, principalPhone: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-[#23259C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Koordinator UKS</label>
                  <input
                    type="text"
                    placeholder="Ibu Ratna, S.Pd"
                    value={newSchoolForm.uksName}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, uksName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#23259C]"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    No. Kontak Koordinator UKS
                  </label>
                  <input
                    type="text"
                    placeholder="0813-0000-0000"
                    value={newSchoolForm.uksPhone}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, uksPhone: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-[#23259C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Puskesmas Rujukan Terdekat</label>
                  <input
                    type="text"
                    placeholder="Puskesmas Kecamatan Setempat"
                    value={newSchoolForm.clinicName}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, clinicName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#23259C]"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    No. Kontak Medis Puskesmas
                  </label>
                  <input
                    type="text"
                    placeholder="021-7654321 / 119"
                    value={newSchoolForm.clinicPhone}
                    onChange={(e) => setNewSchoolForm({ ...newSchoolForm, clinicPhone: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-[#23259C]"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3.5 py-3 text-[11px] leading-relaxed text-slate-600">
                Dapur penyuplai otomatis disetel ke <b className="text-slate-800">{activeSppgId}</b> sesuai akun yang
                sedang login, sehingga sekolah baru langsung masuk ke alokasi porsi dapur ini.
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => setIsOnboardOpen(false)}
                  className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={onboardSubmitting}
                  className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#23259C] px-5 py-2 font-semibold text-white shadow-sm transition hover:bg-[#1b1d7d] disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {onboardSubmitting ? 'Mendaftarkan...' : 'Daftarkan Sekolah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT SHEET: Lembar Panduan Drop-Point Driver Kurir */}
      <div className="guide-print-sheet" aria-hidden="true">
        {printed && (
          <div style={{ color: '#000', background: '#fff', padding: 20, fontFamily: 'sans-serif' }}>
            <div style={{ borderBottom: '2px solid #000', paddingBottom: 8, marginBottom: 12 }}>
              <p style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>LEMBAR PANDUAN DROP-POINT KURIR MBG</p>
              <p style={{ fontSize: 11, color: '#444', margin: '4px 0 0 0' }}>
                {bundle?.kitchenCode || activeSppgId} · {bundle?.kitchenName} · Dicetak:{' '}
                {new Date().toLocaleDateString('id-ID')}
              </p>
            </div>
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px 0' }}>{printed.name}</p>
              <p style={{ fontSize: 12, margin: '0 0 2px 0' }}>{printed.address}</p>
              <p style={{ fontSize: 11, color: '#555', margin: 0 }}>
                NPSN: {printed.npsn} · Jenjang: {printed.level}
              </p>
            </div>
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, margin: '0 0 4px 0', textTransform: 'uppercase' }}>
                Petunjuk Akses Drop-Point:
              </p>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{printed.droppoint}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div style={{ border: '1px solid #ddd', padding: 8, borderRadius: 4 }}>
                <p style={{ fontSize: 10, color: '#666', margin: 0 }}>KUOTA PENURUNAN</p>
                <p style={{ fontSize: 18, fontWeight: 800, margin: '2px 0 0 0' }}>{printed.packingQuota} BOKS</p>
              </div>
              <div style={{ border: '1px solid #ddd', padding: 8, borderRadius: 4 }}>
                <p style={{ fontSize: 10, color: '#666', margin: 0 }}>ARMADA DITUGASKAN</p>
                <p style={{ fontSize: 16, fontWeight: 700, margin: '2px 0 0 0' }}>{printed.fleet}</p>
              </div>
            </div>
            <div style={{ borderTop: '1px dashed #aaa', paddingTop: 8 }}>
              <p style={{ fontSize: 11, margin: '2px 0' }}>
                <b>PIC Validator:</b> {printed.validator} ({printed.validatorPhone})
              </p>
              <p style={{ fontSize: 11, margin: '2px 0' }}>
                <b>Kepala Sekolah:</b> {printed.principal}
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
        <School className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Data sekolah binaan, titik koordinat GPS, dan rekapitulasi kuota presensi disinkronkan secara langsung dari
        database PostgreSQL. Kuota cetak dihitung otomatis berdasarkan kehadiran siswa terhadap batas waktu{' '}
        {bundle?.deadline || '05:00'} WIB.
      </p>
    </div>
  )
}
