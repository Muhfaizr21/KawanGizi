import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Flame,
  PackageCheck,
  QrCode,
  Truck,
  Thermometer,
  Droplets,
  Clock,
  AlertTriangle,
  Printer,
  ShieldCheck,
  Radio,
  School,
  CheckCircle2,
  X,
  ChevronRight,
  TrendingUp,
  FileText,
  AlertOctagon,
  Sparkles,
  RefreshCw,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'

import { useAuth } from '../../context/AuthContext'
import {
  fetchSppgDashboardBundle,
  transitionSppgStage,
  triggerSppgEmergency,
  resolveSppgEmergency,
} from '../../lib/api'

import {
  SPPG_PROFILE,
  INITIAL_PIPELINE_STAGES,
  INITIAL_TELEMETRY,
  INITIAL_HACCP_TIMER,
  KITCHEN_DEVICES,
  ASSIGNED_SCHOOLS_MANIFEST,
  TODAY_MENU_RECIPE,
  SPPG_SCHOOL_DISTRIBUTION_DATA,
} from '../../data/sppgPortalData'
import { SppgOperationalAnalytics } from './SppgOperationalAnalytics'

const SPPG_SPACES = [
  { id: 'SPPG-01', name: 'SPPG 01 Menteng Jaya Mandiri' },
  { id: 'SPPG-02', name: 'SPPG 02 Kebayoran Baru Mandiri' },
  { id: 'SPPG-03', name: 'SPPG 03 Cikini Mitra Gizi' },
  { id: 'SPPG-04', name: 'SPPG 04 Sukajadi Bandung' },
]

export function SppgDashboardPanel() {
  const { user, isSuperadmin } = useAuth()

  // Ruang SPPG aktif (multi-tenant)
  const [activeSppgId, setActiveSppgId] = useState(() => {
    if (user?.sppgId) return user.sppgId
    return 'SPPG-01'
  })

  // Bundle data terpadu dari backend
  const [bundle, setBundle] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Production pipeline state
  const [pipelineStages, setPipelineStages] = useState(INITIAL_PIPELINE_STAGES)
  const [currentActiveStageId, setCurrentActiveStageId] = useState('stage-2')

  // HACCP 4-Hour Countdown Timer State
  const [haccpTimer, setHaccpTimer] = useState(INITIAL_HACCP_TIMER)
  const [timerMode, setTimerMode] = useState('SAFE') // 'SAFE' | 'WARNING' | 'EXPIRED'

  // Emergency Alert Banner State
  const [activeAlert, setActiveAlert] = useState(null)

  // Modal States
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false)
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false)
  const [isRunSheetModalOpen, setIsRunSheetModalOpen] = useState(false)

  // Form states for modals
  const [transitionTargetStage, setTransitionTargetStage] = useState('stage-3')
  const [transitionChecks, setTransitionChecks] = useState({
    tempChecked: true,
    nutritionSigned: true,
    boxesReady: true,
  })
  const [emergencyReason, setEmergencyReason] = useState('kompor_gas')
  const [emergencySeverity, setEmergencySeverity] = useState('amber')
  const [emergencyNotes, setEmergencyNotes] = useState('')

  // 1. Fetch live bundle from database
  const loadBundle = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setIsLoading(true)
      const data = await fetchSppgDashboardBundle(activeSppgId)
      if (data) {
        setBundle(data)
        if (data.pipelineStages?.length) setPipelineStages(data.pipelineStages)
        if (data.activeStageId) setCurrentActiveStageId(data.activeStageId)
        if (data.haccpTimer) setHaccpTimer(data.haccpTimer)
        if (data.activeAlert) setActiveAlert(data.activeAlert)
        else setActiveAlert(null)
        if (isManualRefresh) showToast('Data cockpit operasional berhasil disinkronkan!')
      }
    } catch (err) {
      console.warn('Gagal memuat bundle cockpit dapur dari database, memakai cadangan lokal:', err)
      if (isManualRefresh) showToast('Gagal sinkron database, memakai data lokal.')
    } finally {
      setIsLoading(false)
    }
  }, [activeSppgId])

  useEffect(() => {
    loadBundle()
  }, [loadBundle])

  // Live timer tick simulation (countdown)
  useEffect(() => {
    const interval = setInterval(() => {
      setHaccpTimer((prev) => {
        if (prev.remainingMinutes <= 0) {
          return {
            ...prev,
            remainingMinutes: 0,
            freshnessPercent: 0,
            status: 'EXPIRED',
          }
        }
        const updatedRemaining = prev.remainingMinutes - 1
        const updatedFreshness = Math.max(0, (updatedRemaining / (prev.totalSafetyMinutes || 240)) * 100)
        let updatedStatus = 'SAFE'
        if (updatedRemaining <= 60 && updatedRemaining > 0) updatedStatus = 'WARNING'
        else if (updatedRemaining <= 0) updatedStatus = 'EXPIRED'

        return {
          ...prev,
          remainingMinutes: updatedRemaining,
          freshnessPercent: updatedFreshness,
          status: updatedStatus,
        }
      })
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  // Helper to switch timer simulation scenario
  const setTimerSimulation = (mode) => {
    setTimerMode(mode)
    if (mode === 'SAFE') {
      setHaccpTimer({
        ...INITIAL_HACCP_TIMER,
        remainingMinutes: 165,
        freshnessPercent: 68.8,
        status: 'SAFE',
      })
    } else if (mode === 'WARNING') {
      setHaccpTimer({
        ...INITIAL_HACCP_TIMER,
        remainingMinutes: 48,
        freshnessPercent: 20.0,
        status: 'WARNING',
      })
    } else if (mode === 'EXPIRED') {
      setHaccpTimer({
        ...INITIAL_HACCP_TIMER,
        remainingMinutes: 0,
        freshnessPercent: 0.0,
        status: 'EXPIRED',
      })
    }
  }

  // Handle stage transition with live backend persistence
  const handleConfirmTransition = async () => {
    setIsSubmitting(true)
    try {
      const updated = await transitionSppgStage(
        {
          targetStageId: transitionTargetStage,
          tempChecked: transitionChecks.tempChecked,
          nutritionSigned: transitionChecks.nutritionSigned,
          boxesReady: transitionChecks.boxesReady,
        },
        activeSppgId
      )

      if (updated) {
        setBundle(updated)
        if (updated.pipelineStages) setPipelineStages(updated.pipelineStages)
        if (updated.activeStageId) setCurrentActiveStageId(updated.activeStageId)
        showToast('Tahapan produksi berhasil diperbarui!')
      } else {
        // Fallback local update
        setPipelineStages((prev) =>
          prev.map((stg) => {
            if (stg.id === 'stage-2') {
              return { ...stg, status: 'completed', statusLabel: 'Selesai 100%', progress: 100 }
            }
            if (stg.id === transitionTargetStage) {
              return { ...stg, status: 'active', statusLabel: 'Sedang Berlangsung', progress: 35 }
            }
            return stg
          })
        )
        setCurrentActiveStageId(transitionTargetStage)
      }
    } catch (err) {
      console.error('Gagal memperbarui transisi tahap:', err)
      showToast('Gagal mengirim pembaruan tahap ke server.')
    } finally {
      setIsSubmitting(false)
      setIsTransitionModalOpen(false)
    }
  }

  // Handle emergency alert trigger with live ticket creation in sppg_incident_tickets
  const handleTriggerEmergency = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    const reasonsMap = {
      kompor_gas: 'Kompor Rusak / Pasokan Gas Terganggu (+20 Menit)',
      suhu_drop: 'Suhu Masak Inti Turun di Bawah Standar 75°C (Re-cooking)',
      keterlambatan_armada: 'Keterlambatan Penjemputan Armada Logistik > 15 Menit',
      kontaminasi_fisik: 'Temuan Anomali Fisik Bahan Baku Saat Pengemasan',
    }

    try {
      const alert = await triggerSppgEmergency(
        {
          reason: emergencyReason,
          severity: emergencySeverity,
          notes: emergencyNotes,
        },
        activeSppgId
      )

      if (alert) {
        setActiveAlert(alert)
        showToast('Sinyal darurat disiarkan & tiket insiden telah dibuka!')
      } else {
        setActiveAlert({
          id: String(Date.now()),
          title: reasonsMap[emergencyReason] || 'Peringatan Operasional Dapur',
          severity: emergencySeverity,
          notes: emergencyNotes || 'Petugas sedang melakukan mitigasi di lini masak.',
          timestamp: 'Baru saja',
        })
      }
    } catch (err) {
      console.error('Gagal mengirimkan darurat:', err)
      setActiveAlert({
        id: String(Date.now()),
        title: reasonsMap[emergencyReason] || 'Peringatan Operasional Dapur',
        severity: emergencySeverity,
        notes: emergencyNotes || 'Petugas sedang melakukan mitigasi di lini masak.',
        timestamp: 'Baru saja',
      })
    } finally {
      setIsSubmitting(false)
      setIsEmergencyModalOpen(false)
    }
  }

  // Handle resolving emergency alert (sync with DB)
  const handleResolveEmergency = async () => {
    try {
      if (activeAlert?.id) {
        await resolveSppgEmergency({ alertId: activeAlert.id }, activeSppgId)
      }
      setActiveAlert(null)
      showToast('Sinyal darurat diselesaikan dan tiket insiden ditutup.')
    } catch (err) {
      console.error('Gagal menyelesaikan darurat:', err)
      setActiveAlert(null)
    }
  }

  // Helper formatting for minutes into hours & mins
  const formatTimeRemaining = (mins) => {
    const hours = Math.floor(mins / 60)
    const minutes = mins % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  // Semua modal ditutup dengan Escape
  useEffect(() => {
    const anyOpen =
      isTransitionModalOpen || isEmergencyModalOpen || isRunSheetModalOpen
    if (!anyOpen) return

    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setIsTransitionModalOpen(false)
      setIsEmergencyModalOpen(false)
      setIsRunSheetModalOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isTransitionModalOpen, isEmergencyModalOpen, isRunSheetModalOpen])

  // Profile and active values
  const profile = bundle?.kitchenProfile || {
    id: activeSppgId,
    code: SPPG_PROFILE.code,
    name: SPPG_PROFILE.name,
    headChef: SPPG_PROFILE.headChef,
    nutritionist: SPPG_PROFILE.nutritionist,
    licenseNo: SPPG_PROFILE.licenseNo,
    halalId: SPPG_PROFILE.halalId,
    staffCount: 28,
    safetyScore: 99.4,
    grade: 'A',
  }

  const todayMenu = bundle?.todayMenu || TODAY_MENU_RECIPE
  const telemetry = bundle?.telemetry || INITIAL_TELEMETRY
  const devices = bundle?.devices
  const manifest = bundle?.manifest || ASSIGNED_SCHOOLS_MANIFEST
  const delivery = bundle?.delivery || {
    target: 2500,
    cooked: 2500,
    signedCount: 3,
    pendingCount: 1,
    signedPortions: 1850,
    pendingPortions: 650,
    signedPct: 74,
    avgFleetTemp: 63.4,
  }

  // Box range by school
  const boxRangeBySchool = useMemo(() => {
    const out = {}
    for (const sch of manifest) {
      const boxes = sch.boxes || Math.ceil(sch.quota / 25)
      out[sch.id] = { from: 1, to: boxes, boxes }
    }
    return out
  }, [manifest])

  return (
    <div className="space-y-5">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xl animate-in fade-in slide-in-from-bottom-3"
        >
          <Info className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ====================================================================
          TOP BAR: KITCHEN IDENTITY, MULTI-TENANT & REFRESH BUTTON
          ==================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-[#23259C] text-white flex items-center justify-center font-bold text-sm shrink-0">
            {profile.code?.slice(-3) || '01'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                {profile.name}
              </h1>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#23259C]/10 text-[#23259C]">
                {profile.code}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {profile.grade}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              SLHS: {profile.licenseNo} &bull; Halal: {profile.halalId} &bull; Skor Higiene: {profile.safetyScore}%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSuperadmin && (
            <select
              value={activeSppgId}
              onChange={(e) => setActiveSppgId(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#23259C]"
            >
              {SPPG_SPACES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => loadBundle(true)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-[#23259C]' : ''}`} />
            <span>Sinkron Data</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          1. EMERGENCY ALERT BANNER (IF TRIGGERED)
          ==================================================================== */}
      {activeAlert && (
        <div
          className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-3 shadow-sm ${
            activeAlert.severity === 'red'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg shrink-0 ${
                activeAlert.severity === 'red' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
              }`}
            >
              <AlertOctagon className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                    activeAlert.severity === 'red' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
                  }`}
                >
                  {activeAlert.severity === 'red' ? 'SIAGA 1' : 'SIAGA 2'}
                </span>
                <span className="text-xs font-bold text-slate-800">{activeAlert.title}</span>
                <span className="text-[11px] text-slate-500">&bull; {activeAlert.timestamp}</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">{activeAlert.notes}</p>
            </div>
          </div>

          <button
            onClick={handleResolveEmergency}
            className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition cursor-pointer self-end sm:self-center shrink-0 shadow-2xs"
          >
            Selesaikan
          </button>
        </div>
      )}

      {/* ====================================================================
          2. TOP ROW: LIVE PRODUCTION PIPELINE CARDS
          ==================================================================== */}
      <div>
        <div className="flex items-center justify-between pb-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-slate-500">
              Pipeline Produksi Masak
            </h2>
            <span className="text-[11px] text-slate-500 font-medium">
              &bull; Sesi Pagi 03:30 – 08:00 WIB
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsTransitionModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#23259C] text-white hover:bg-[#1c1d7e] shadow-xs transition cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Transisi Tahap</span>
          </button>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {pipelineStages.map((stage) => {
            const isActive = stage.id === currentActiveStageId
            const isCompleted = stage.status === 'completed'

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => {
                  if (!isActive) {
                    setTransitionTargetStage(stage.id)
                    setIsTransitionModalOpen(true)
                  }
                }}
                disabled={isActive}
                aria-current={isActive ? 'step' : undefined}
                className={`relative rounded-xl p-4 text-left flex flex-col justify-between transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                  isActive
                    ? 'bg-[#23259C] text-white cursor-default'
                    : 'bg-white text-slate-900 border border-slate-200 hover:border-slate-300 cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{stage.title}</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : isCompleted
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {stage.timeWindow?.split(' ')[0] || ''}
                  </span>
                </div>

                <p className={`text-[11px] mt-0.5 truncate ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                  {stage.subtitle}
                </p>

                <div className="mt-3 flex items-center justify-between">
                  <div
                    className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-white text-[#23259C]' : 'bg-slate-50 text-slate-600'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : stage.icon === 'Flame' ? (
                      <Flame className="h-5 w-5" />
                    ) : stage.icon === 'QrCode' ? (
                      <QrCode className="h-5 w-5" />
                    ) : stage.icon === 'Truck' ? (
                      <Truck className="h-5 w-5" />
                    ) : (
                      <PackageCheck className="h-5 w-5" />
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="relative h-9 w-9 flex items-center justify-center">
                      <svg className="h-9 w-9 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                        <path
                          className={isActive ? 'text-white/25' : 'text-slate-100'}
                          stroke="currentColor"
                          strokeWidth="3.5"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className={
                            isCompleted ? 'text-emerald-600' : isActive ? 'text-white' : 'text-slate-500'
                          }
                          stroke="currentColor"
                          strokeDasharray={`${stage.progress}, 100`}
                          strokeLinecap="round"
                          strokeWidth="3.5"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <span
                        className={`absolute text-[11px] font-semibold tabular-nums ${
                          isActive ? 'text-white' : 'text-slate-700'
                        }`}
                      >
                        {stage.progress}%
                      </span>
                    </div>

                    <div className="text-right">
                      <p
                        className={`text-base font-semibold leading-none ${
                          isActive ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {stage.metricValue}
                      </p>
                      <p
                        className={`text-[11px] mt-0.5 ${
                          isActive ? 'text-white/75' : 'text-slate-500'
                        }`}
                      >
                        {stage.metricUnit}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className={`mt-2.5 pt-2 border-t flex items-center justify-between text-[11px] ${
                    isActive ? 'border-white/15 text-white/85' : 'border-slate-100 text-slate-600'
                  }`}
                >
                  <span className="font-medium">{stage.statusLabel}</span>
                  <span className={isActive ? 'text-white/75' : 'text-slate-500'}>{stage.timeWindow}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ====================================================================
          3. MIDDLE SECTION: SENSORS + HACCP DIAL + RIGHT COLUMN (DEVICES & CHEF)
          ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT COLUMN: TELEMETRY SENSORS (4 COLS) */}
        <div className="lg:col-span-4 flex flex-col gap-3.5">
          {/* SENSOR 1: SUHU INTI MASAK (HACCP CCP-1) */}
          <div className="bg-white rounded-2xl p-4 sm:p-4.5 border border-slate-200/70 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-slate-500">
                  HACCP CCP-1
                </p>
                <h3 className="text-xs font-bold text-slate-800">
                  Suhu Masak Inti Hidangan
                </h3>
              </div>
            </div>

            <div className="my-3 flex items-center justify-between">
              <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shadow-inner">
                <Thermometer className="h-5 w-5" />
              </div>

              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                  +{telemetry.coreCookingTemp}°C
                </div>
                <div className="mt-0.5 flex items-center justify-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold text-emerald-700">
                    Suhu Steril (&gt;75°C)
                  </span>
                </div>
              </div>

              <div className="w-24 shrink-0">
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full"
                    style={{ width: `${Math.min(100, (telemetry.coreCookingTemp / 100) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">ambang 75&deg;C</p>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-100 text-[10px] text-emerald-900 flex items-center justify-between">
              <span className="font-medium">Bebas Salmonella / E.Coli</span>
              <span className="font-bold">Lolos CCP-1</span>
            </div>
          </div>

          {/* SENSOR 2: SUHU HOLDING & KELEMBABAN */}
          <div className="bg-white rounded-2xl p-4 sm:p-4.5 border border-slate-200/70 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-slate-500">
                  Insulasi Termal Boks
                </p>
                <h3 className="text-xs font-bold text-slate-800">
                  Suhu Holding & Kelembaban
                </h3>
              </div>
            </div>

            <div className="my-3 flex items-center justify-between">
              <div className="h-11 w-11 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-200 shadow-inner">
                <Droplets className="h-5 w-5" />
              </div>

              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                  +{telemetry.holdingTemp}°C
                </div>
                <div className="mt-0.5 flex items-center justify-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span className="text-[11px] font-semibold text-slate-700">
                    Boks Hangat (&gt;60°C)
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-0.5">
                <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs font-mono font-bold text-slate-600">
                  {telemetry.ambientKitchenHumidity}%
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
              </div>
            </div>

            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-[10px] text-slate-600 flex items-center justify-between">
              <span>Kelembaban Dapur</span>
              <span className="font-bold text-slate-800">48% RH (Optimal)</span>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: HACCP 4-HOUR CRITICAL TIMER DIAL (4 COLS) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 sm:p-4.5 border border-slate-200/70 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#23259C]" />
              <h3 className="text-xs font-bold text-slate-800">
                Batas Waktu Aman 4 Jam (HACCP)
              </h3>
            </div>
          </div>

          {/* CIRCULAR DIAL / GAUGE */}
          <div className="my-2 flex flex-col items-center justify-center">
            <div className="relative w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r="74"
                  fill="none"
                  stroke="#F1F5F9"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray="360 120"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="74"
                  fill="none"
                  stroke={
                    haccpTimer.status === 'EXPIRED'
                      ? '#E11D48'
                      : haccpTimer.status === 'WARNING'
                      ? '#F59E0B'
                      : 'url(#gaugeGradient)'
                  }
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${((haccpTimer.freshnessPercent || 0) / 100) * 360} 480`}
                  className="transition-all duration-700"
                />
                <defs>
                  <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="50%" stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold mb-0.5 ${
                    haccpTimer.status === 'EXPIRED'
                      ? 'bg-rose-100 text-rose-800'
                      : haccpTimer.status === 'WARNING'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-emerald-50 text-emerald-800'
                  }`}
                >
                  {haccpTimer.status === 'EXPIRED'
                    ? 'Terkunci'
                    : haccpTimer.status === 'WARNING'
                    ? 'Kurang dari 60 menit'
                    : 'Dalam batas aman'}
                </span>

                <div className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight tabular-nums">
                  {formatTimeRemaining(haccpTimer.remainingMinutes || 0)}
                </div>

                <p className="text-[11px] text-slate-500 mt-0.5">
                  {haccpTimer.remainingMinutes || 0} menit tersisa
                </p>

                <p className="text-[11px] text-slate-500">
                  Batas: {haccpTimer.mustConsumeBefore || '10:00'}
                </p>
              </div>
            </div>

            <div className="w-full flex items-center justify-between text-[11px] text-slate-500 px-3">
              <span>Habis</span>
              <span className="text-slate-900 font-semibold tabular-nums">
                {(haccpTimer.freshnessPercent || 0).toFixed(0)}% batas tersisa
              </span>
              <span>4 jam</span>
            </div>
          </div>

          {/* Compact Simulator Segmented Pill */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[10px]">
            <span className="text-slate-500 font-medium">Uji Skenario:</span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 font-bold">
              <button
                type="button"
                onClick={() => setTimerSimulation('SAFE')}
                className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                  timerMode === 'SAFE' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Aman
              </button>
              <button
                type="button"
                onClick={() => setTimerSimulation('WARNING')}
                className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                  timerMode === 'WARNING' ? 'bg-amber-500 text-white shadow-2xs' : 'text-slate-500'
                }`}
              >
                Waspada
              </button>
              <button
                type="button"
                onClick={() => setTimerSimulation('EXPIRED')}
                className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                  timerMode === 'EXPIRED' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-500'
                }`}
              >
                Lockout
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CHEF PROFILE + IOT TILES + ACTION BUTTONS (4 COLS) */}
        <div className="lg:col-span-4 flex flex-col gap-3.5">
          {/* Welcome Card & Staff Profile */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/70 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-semibold text-sm">
                  {profile.headChef
                    .replace(/[^A-Za-z\s]/g, '')
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase() || 'KD'}
                </div>
                <div>
                  <h3 className="font-extrabold text-xs text-slate-800">
                    {profile.headChef}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Ahli Gizi: {profile.nutritionist.split(',')[0]}
                  </p>
                </div>
              </div>
              <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
            </div>

            <div className="mt-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <Sparkles className="h-3.5 w-3.5 text-[#23259C] shrink-0" />
                <span className="font-semibold text-slate-700 truncate">{todayMenu.name}</span>
              </div>
              <span className="font-bold text-[#23259C] shrink-0">{todayMenu.calories} kkal</span>
            </div>
          </div>

          {/* MY DEVICES GRID */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/70 shadow-xs flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2">
              <h3 className="text-xs font-bold text-slate-800">Perangkat Dapur Pintar</h3>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                4 Terkoneksi
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 my-1.5">
              {/* Device 1 */}
              <div className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Thermometer className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-800 truncate">Sensor Suhu</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {devices?.tempSensor?.value || `${telemetry.coreCookingTemp}°C`}
                  </p>
                </div>
              </div>

              {/* Device 2 */}
              <div className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Printer className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-800 truncate">Printer QR</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {devices?.qrPrinter?.value || '92% Kertas'}
                  </p>
                </div>
              </div>

              {/* Device 3 */}
              <div className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-800 truncate">Segel RFID</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {devices?.rfidSeal?.value || '4/4 Boks'}
                  </p>
                </div>
              </div>

              {/* Device 4 */}
              <div className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Radio className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-800 truncate">GPS Armada</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {devices?.gpsArmada?.value || '4 Aktif'}
                  </p>
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => setIsRunSheetModalOpen(true)}
                className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold transition cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5 text-slate-600" />
                <span>Run-Sheet</span>
              </button>

              <button
                type="button"
                onClick={() => setIsEmergencyModalOpen(true)}
                className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition cursor-pointer"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                <span>Darurat</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          4. KONSOL ANALITIK & METRIK OPERASIONAL DAPUR
          ==================================================================== */}
      <div className="space-y-4">
        {/* CHART TERPADU DENGAN DATA LIVE */}
        <SppgOperationalAnalytics data={bundle?.analytics} />

        {/* Ringkasan Porsi & Pengiriman */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-4 rounded-xl bg-white border border-slate-200">
            <p className="text-[11px] font-medium text-slate-500">Target hari ini</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
              {delivery.target.toLocaleString('id-ID')}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {manifest.length} sekolah penerima
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200">
            <p className="text-[11px] font-medium text-slate-500">Dimasak dan dikemas</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
              {delivery.cooked.toLocaleString('id-ID')}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">Porsi, tahap 2 selesai</p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200">
            <p className="text-[11px] font-medium text-slate-500">BAST sudah ditandatangani</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-800">
              {delivery.signedPortions.toLocaleString('id-ID')}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {delivery.signedPct}% dari {delivery.signedCount} sekolah
            </p>
          </div>

          <div
            className={`p-4 rounded-xl border ${
              delivery.pendingCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'
            }`}
          >
            <p className="text-[11px] font-medium text-slate-500">Belum tanda tangan BAST</p>
            <p
              className={`mt-1 text-2xl font-semibold tabular-nums ${
                delivery.pendingCount > 0 ? 'text-amber-900' : 'text-slate-900'
              }`}
            >
              {delivery.pendingPortions.toLocaleString('id-ID')}
            </p>
            <p className="mt-1 text-[11px] text-slate-600">
              {delivery.pendingCount > 0
                ? `${delivery.pendingCount} sekolah masih dalam transit`
                : 'Semua sekolah sudah menandatangani'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#23259C] text-white col-span-2 sm:col-span-1">
            <p className="text-[11px] font-medium text-white/75">Suhu rata-rata armada</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {typeof delivery.avgFleetTemp === 'number' ? delivery.avgFleetTemp.toFixed(1) : '63.4'}&deg;C
            </p>
            <p className="mt-1 text-[11px] text-white/75">Di atas ambang 60&deg;C</p>
          </div>
        </div>

        {/* LOGISTICS MANIFEST & SCHOOL DROP-OFF STATUS */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4.5 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                Manifest Distribusi Armada & Titik Serah Terima
              </h3>
              <p className="text-[11px] text-slate-500">
                Pengawasan langsung rute logistik, supir bertugas, dan kontak PIC guru penerima
              </p>
            </div>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
              {devices?.gpsArmada?.value || '4 Armada Terhubung GPS'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            {manifest.map((sch) => {
              const isDone = sch.bastSigned || sch.status === 'Tiba & BAST'
              return (
                <div
                  key={sch.id}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200 transition flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <School className="h-3.5 w-3.5 text-[#23259C] shrink-0" />
                        <h4 className="font-bold text-xs text-slate-800 truncate">{sch.name}</h4>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] font-bold border shrink-0 ${
                          isDone
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {sch.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {sch.quota} Porsi &bull; <span className="font-mono text-slate-500">{sch.distance}</span>
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 text-[10px] text-slate-500 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="truncate">{sch.fleet}</span>
                      <span className="font-mono text-slate-700 font-bold shrink-0">{sch.driver?.split(' ')[0] || ''}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="truncate">PIC: {sch.picTeacher}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ====================================================================
          MODAL 1: GANTI STATUS SESI MASAK (TRANSISI TAHAPAN)
          ==================================================================== */}
      {isTransitionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" role="presentation">
          <div role="dialog" aria-modal="true" aria-label="Transisi Tahap Produksi" className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-[#23259C] text-white flex items-center justify-center font-bold">
                  <RefreshCw className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Transisi Tahap Produksi</h3>
                  <p className="text-[11px] text-slate-500">Validasi Gerbang Mutu Operasional Dapur</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTransitionModalOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs text-slate-700">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                <div className="font-bold text-xs">
                  Tahap Saat Ini: Tahap 2 (Pengolahan & Memasak)
                </div>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Akan ditransisikan ke: <strong>Tahap 3 (Pengemasan & Segel QR Termal)</strong>.
                </p>
              </div>

              {/* Quality Checklist verification */}
              <div className="space-y-2">
                <p className="font-bold text-slate-900 text-xs">
                  Prasyarat Gerbang Keamanan Pangan (Wajib Centang):
                </p>

                <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={transitionChecks.tempChecked}
                    onChange={(e) =>
                      setTransitionChecks((prev) => ({ ...prev, tempChecked: e.target.checked }))
                    }
                    className="mt-0.5 rounded text-[#23259C] focus:ring-[#23259C]"
                  />
                  <div>
                    <p className="font-bold text-slate-900 text-[11px]">
                      Suhu Masak Inti Hidangan Memenuhi Syarat &ge; 75.0°C
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Probe IoT terukur {telemetry.coreCookingTemp}°C, di atas ambang 75°C.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={transitionChecks.nutritionSigned}
                    onChange={(e) =>
                      setTransitionChecks((prev) => ({ ...prev, nutritionSigned: e.target.checked }))
                    }
                    className="mt-0.5 rounded text-[#23259C] focus:ring-[#23259C]"
                  />
                  <div>
                    <p className="font-bold text-slate-900 text-[11px]">
                      Uji Organoleptik (Rasa, Aroma, Tekstur) Ditandatangani
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Ahli gizi ({profile.nutritionist}) telah menyetujui sampel batch ini.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={transitionChecks.boxesReady}
                    onChange={(e) =>
                      setTransitionChecks((prev) => ({ ...prev, boxesReady: e.target.checked }))
                    }
                    className="mt-0.5 rounded text-[#23259C] focus:ring-[#23259C]"
                  />
                  <div>
                    <p className="font-bold text-slate-900 text-[11px]">
                      50 Boks Termal Master & Label QR Telah Siap di Meja Packing
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Kondisi boks bersih, higienis, dan segel tamper-evident aktif.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsTransitionModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={
                  isSubmitting ||
                  !transitionChecks.tempChecked ||
                  !transitionChecks.nutritionSigned ||
                  !transitionChecks.boxesReady
                }
                onClick={handleConfirmTransition}
                className="px-4 py-1.5 text-xs font-bold rounded-xl bg-[#23259C] text-white hover:bg-[#1a1c7c] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition cursor-pointer flex items-center gap-1.5"
              >
                {isSubmitting && <RefreshCw className="h-3 w-3 animate-spin" />}
                <span>Selesaikan Memasak & Buka Sesi Pengemasan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: PEMICU PERINGATAN DARURAT DAPUR (EMERGENCY TRIGGER)
          ==================================================================== */}
      {isEmergencyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" role="presentation">
          <div role="dialog" aria-modal="true" aria-label="Peringatan Operasional Dapur" className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-rose-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold">
                  <AlertOctagon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Pemicu Peringatan Darurat Dapur</h3>
                  <p className="text-[11px] text-slate-500">Notifikasi Prioritas Tinggi ke Satgas & Sekolah</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEmergencyModalOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleTriggerEmergency} className="py-3 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Kategori Hambatan Dapur:
                </label>
                <select
                  value={emergencyReason}
                  onChange={(e) => setEmergencyReason(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                >
                  <option value="kompor_gas">
                    Kompor Rusak / Pasokan Gas Terganggu (+20 Mnt)
                  </option>
                  <option value="suhu_drop">
                    Suhu Masak Inti Turun di Bawah Standar 75°C (Re-cooking)
                  </option>
                  <option value="keterlambatan_armada">
                    Keterlambatan Armada Logistik &gt; 15 Menit
                  </option>
                  <option value="kontaminasi_fisik">
                    Temuan Anomali Fisik Bahan Baku
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Tingkat Keparahan:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEmergencySeverity('amber')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                      emergencySeverity === 'amber'
                        ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="text-[11px]">Siaga 2 · Peringatan</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Potensi delay 10-20 mnt</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEmergencySeverity('red')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                      emergencySeverity === 'red'
                        ? 'bg-rose-50 border-rose-500 text-rose-900 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-600" />
                      <span className="text-[11px]">Siaga 1 · Kritis</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Dapur berhenti sementara</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Catatan Mitigasi Manajer Dapur:
                </label>
                <textarea
                  rows={2}
                  value={emergencyNotes}
                  onChange={(e) => setEmergencyNotes(e.target.value)}
                  placeholder="Misal: Kompor nomor 3 mati, dialihkan ke kompor cadangan unit B."
                  className="w-full p-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEmergencyModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-bold rounded-xl bg-rose-600 text-white hover:bg-rose-700 shadow-sm transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting && <RefreshCw className="h-3 w-3 animate-spin" />}
                  <span>Kirim Sinyal Darurat</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: CETAK LEMBAR KONTROL DAPUR (KITCHEN RUN-SHEET)
          ==================================================================== */}
      {isRunSheetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" role="presentation">
          <div role="dialog" aria-modal="true" aria-label="Run-Sheet Harian Dapur" className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-[#23259C] text-white flex items-center justify-center font-bold">
                  <Printer className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    Lembar Kontrol Dapur (Kitchen Run-Sheet)
                  </h3>
                  <p className="text-[11px] text-slate-500">Dokumen Fisik Tempel Papan Dapur & BAST</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRunSheetModalOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Printable Document Preview Paper */}
            <div className="my-3 p-5 bg-slate-50 rounded-2xl border border-slate-300 font-mono text-xs text-slate-800 space-y-3">
              <div className="text-center pb-2.5 border-b-2 border-slate-800">
                <p className="font-black text-xs uppercase">BADAN GIZI NASIONAL (BGN) REPUBLIK INDONESIA</p>
                <p className="font-bold text-[11px] uppercase">{profile.name}</p>
                <p className="text-[11px] text-slate-500">
                  SLHS: {profile.licenseNo} &bull; Halal ID: {profile.halalId}
                </p>
                <p className="font-extrabold text-xs mt-1 text-[#23259C] underline">
                  LEMBAR KONTROL PRODUKSI & DISTRIBUSI HARIAN
                </p>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-2 gap-2 text-[10px] pb-2 border-b border-slate-300">
                <div>
                  <p><strong>No. Run-Sheet:</strong> RS-2026/10/08-001</p>
                  <p><strong>Menu:</strong> {todayMenu.code} - {todayMenu.name}</p>
                  <p><strong>Target:</strong> {delivery.target.toLocaleString('id-ID')} Porsi ({Math.ceil(delivery.target / 50)} Boks Termal)</p>
                </div>
                <div>
                  <p><strong>Selesai Masak:</strong> {haccpTimer.startTime} WIB</p>
                  <p><strong>Batas HACCP:</strong> {haccpTimer.mustConsumeBefore} WIB (Maks. 4 Jam)</p>
                  <p><strong>Suhu Inti Kuali:</strong> {telemetry.coreCookingTemp}°C (&gt;75°C Lolos)</p>
                </div>
              </div>

              {/* Menu Details */}
              <div>
                <p className="font-bold text-[11px] mb-0.5">Komposisi Menu:</p>
                <p className="text-[10px] text-slate-700 bg-white p-2 rounded border border-slate-200">
                  {todayMenu.name} ({todayMenu.calories} kkal &bull; {todayMenu.protein}g Protein &bull; {todayMenu.carbs}g Karbo &bull; {todayMenu.fat}g Lemak)
                </p>
              </div>

              {/* Alokasi per sekolah */}
              <div>
                <p className="text-[11px] font-semibold text-slate-900 mb-1">
                  Alokasi sekolah dan boks termal
                </p>
                <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <caption className="sr-only">
                      Alokasi porsi, jumlah boks termal, armada, dan status BAST per sekolah
                    </caption>
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th scope="col" className="px-2 py-2 font-semibold">Sekolah</th>
                        <th scope="col" className="px-2 py-2 text-right font-semibold">Porsi</th>
                        <th scope="col" className="px-2 py-2 text-right font-semibold">Boks</th>
                        <th scope="col" className="px-2 py-2 font-semibold">Armada</th>
                        <th scope="col" className="px-2 py-2 font-semibold">Status BAST</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {manifest.map((s) => {
                        const signed = s.bastSigned || s.status === 'Tiba & BAST'
                        return (
                          <tr key={s.id}>
                            <td className="px-2 py-2 font-medium text-slate-900">{s.name}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-slate-700">
                              {s.quota.toLocaleString('id-ID')}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums text-slate-700">
                              {boxRangeBySchool[s.id]?.boxes ?? Math.ceil(s.quota / 25)}
                            </td>
                            <td className="px-2 py-2 text-slate-600">{s.fleet}</td>
                            <td className={`px-2 py-2 font-medium ${signed ? 'text-emerald-800' : 'text-amber-800'}`}>
                              {signed ? 'Tertandatangani' : 'Belum turun'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signature Line */}
              <div className="grid grid-cols-2 gap-4 pt-2 text-center text-[11px]">
                <div>
                  <p className="text-slate-500">Penanggung Jawab Lini Masak</p>
                  <p className="font-bold border-t border-slate-400 mt-6 pt-1">{profile.headChef}</p>
                  <p className="text-slate-500">Head Chef {profile.code}</p>
                </div>
                <div>
                  <p className="text-slate-500">Verifikator Mutu & Gizi</p>
                  <p className="font-bold border-t border-slate-400 mt-6 pt-1">{profile.nutritionist}</p>
                  <p className="text-slate-500">Ahli Gizi Dapur Sentral</p>
                </div>
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsRunSheetModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print()
                }}
                className="px-4 py-1.5 text-xs font-bold rounded-xl bg-[#23259C] text-white hover:bg-[#1a1c7c] shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Cetak Run-Sheet</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
