// API client: Bearer access token (in-memory) + httpOnly refresh cookie.
// On a 401 it attempts a single silent refresh, then retries the request.

const API_BASE = import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:8080`

let accessToken = localStorage.getItem('mbg_access_token') || null
let refreshPromise = null

export function setAccessToken(token) {
  accessToken = token
  if (token) {
    localStorage.setItem('mbg_access_token', token)
  } else {
    localStorage.removeItem('mbg_access_token')
  }
}

export function getAccessToken() {
  return accessToken
}

async function tryRefresh() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) return null
      const body = await res.json()
      if (!body.success) return null
      accessToken = body.data.accessToken
      return body.data
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

// Endpoint auth yang tidak boleh memicu refresh otomatis: justru endpoint ini
// yang MEMBAWAKAN sesi kembali setelah reload. Exclude hanya endpoint yang
// memang soal token itu sendiri.
const NO_REFRESH_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout']

export async function api(path, options = {}) {
  // FormData: jangan set Content-Type manual, biar browser menentukan boundary.
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData

  const doFetch = () =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(options.headers || {}),
      },
    })

  let res = await doFetch()
  if (res.status === 401 && !NO_REFRESH_PATHS.includes(path)) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      res = await doFetch()
    }
  }

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(body?.error || body?.message || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return body
}

export async function loginRequest(email, password) {
  const body = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setAccessToken(body.data.accessToken)
  return body.data
}

/** Daftar akun baru (hanya validator; email wajib unik). */
export async function registerRequest({ fullName, email, password, role = 'validator', npsn, schoolName, sppgId }) {
  return api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ fullName, email, password, role, npsn, schoolName, sppgId }),
  })
}

export async function meRequest() {
  const body = await api('/api/auth/me')
  return body.data
}

export async function logoutRequest() {
  try {
    await api('/api/auth/logout', { method: 'POST' })
  } finally {
    setAccessToken(null)
  }
}

/** Ganti kata sandi akun yang sedang login (verifikasi kata sandi lama). */
export async function changePassword(currentPassword, newPassword) {
  const body = await api('/api/auth/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  return body
}

/** Perbarui nama tampilan akun yang sedang login (self-service). */
export async function updateProfile(fullName) {
  const body = await api('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify({ fullName }),
  })
  return body?.data
}

/**
 * Kirim pemindaian boks (multipart): foto + token QR + sinyal suhu + daftar bahan menu.
 * `items` berformat "Nama:gram,Nama2:gram" — gateway menghitung makro dari dataset gizi.
 * `durationMs` = lama inspeksi visual (ms); dipakai audit ketelitian Pasal 14.
 */
export async function scanRequest({
  image,
  qrToken = '',
  boxId = '',
  batchId = '',
  holdingTempC,
  releaseTempC,
  items = '',
  persist = true,
  rating,
  feedback,
  durationMs,
} = {}) {
  const body = new FormData()
  body.append('image', image)
  if (qrToken) body.append('qrToken', qrToken)
  if (boxId) body.append('boxId', boxId)
  if (batchId) body.append('batchId', batchId)
  if (holdingTempC !== undefined && holdingTempC !== null && holdingTempC !== '') {
    body.append('holdingTempC', String(holdingTempC))
  }
  if (releaseTempC !== undefined && releaseTempC !== null && releaseTempC !== '') {
    body.append('releaseTempC', String(releaseTempC))
  }
  if (durationMs !== undefined && durationMs !== null && durationMs !== '') {
    body.append('durationMs', String(Math.round(durationMs)))
  }
  if (items) body.append('items', items)
  if (persist === false) body.append('persist', 'false')
  if (rating) body.append('rating', String(rating))
  if (feedback) body.append('feedback', String(feedback))
  return api('/api/scans', { method: 'POST', body })
}

export async function updateScanFeedback(id, payload) {
  return api(`/api/scans/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteScan(id) {
  return api(`/api/scans/${id}`, { method: 'DELETE' })
}

export async function deleteAllScans() {
  return api('/api/scans/all', { method: 'DELETE' })
}

/** URL absolut foto hasil scan yang disimpan backend (folder uploads/). */
export function uploadUrl(imageRef) {
  if (!imageRef) return ''
  return `${API_BASE}/uploads/${encodeURIComponent(imageRef)}`
}

/** Riwayat scan terbaru (butuh izin scan.submit — role validator). */
export async function fetchRecentScans(limit = 10) {
  const res = await api(`/api/scans/recent?limit=${limit}`)
  return res?.data || []
}

// Role → home portal mapping used after login and inside RequireRole.
export const ROLE_HOME = {
  superadmin: '/admin',
  sppg: '/sppg/dashboard',
  validator: '/validator',
}

export function homeForRole(role) {
  return ROLE_HOME[role] || '/'
}

// -----------------------------------------------------------------------------
// EKOSISTEM DATA MBG (REAL DATABASE QUERIES VIA POSTGRESQL & BACKEND API)
// -----------------------------------------------------------------------------

export async function fetchSchools() {
  const res = await api('/api/schools')
  return res?.data || []
}

export async function fetchSchool(npsn) {
  const res = await api(`/api/schools/${npsn}`)
  return res?.data || null
}

export async function createSchool(payload) {
  const res = await api('/api/schools', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

// Mendaftarkan sekolah baru milik dapur SPPG yang sedang login.
// Dapur penyuplai ditentukan di backend dari klaim token.
export async function createOwnedSchool(payload) {
  const res = await api('/api/sppg/schools', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function reassignSchoolSPPG(npsn, { targetSppgId, reason }) {
  const res = await api(`/api/schools/${npsn}/sppg`, {
    method: 'PUT',
    body: JSON.stringify({ targetSppgId, reason }),
  })
  return res?.data || null
}

export async function updateSchoolContacts(npsn, payload) {
  const res = await api(`/api/schools/${npsn}/contacts`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function toggleSchoolStatus(npsn, { status, statusReason, returnDate }) {
  const res = await api(`/api/schools/${npsn}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, statusReason, returnDate }),
  })
  return res?.data || null
}

/** Hapus sekolah (Superadmin) beserta seluruh data operasionalnya. */
export async function deleteSchool(npsn, reason = '') {
  const res = await api(`/api/schools/${npsn}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  })
  return res || null
}

/**
 * Hapus sekolah armar SPPG. `id` boleh schools.id atau NPSN — backend memverifikasi
 * sekolah itu memang milik dapur dari klaim token, bukan dari parameter.
 */
export async function deleteOwnedSchool(id, reason = '', sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/schools/${encodeURIComponent(id)}${query}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  })
  return res || null
}

export async function fetchSppgList() {
  const res = await api('/api/sppg')
  return res?.data || []
}

export async function fetchSppg(id) {
  const res = await api(`/api/sppg/${id}`)
  return res?.data || null
}

/** Profil dapur milik akun SPPG yang sedang login (self-service). */
export async function fetchSppgProfile() {
  const res = await api('/api/sppg/profile')
  return res?.data || null
}

/** Ganti nama dapur milik akun SPPG yang sedang login. */
export async function updateSppgProfile(name) {
  const res = await api('/api/sppg/profile', {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
  return res?.data || null
}

/**
 * Aksi superadmin terhadap dapur SPPG.
 *
 * Surat teguran & pembekuan hanya superadmin (kitchen tidak boleh menegur
 * dirinya sendiri); kuota & audit resep memakai izin sppg.manage sehingga
 * dapur juga bisa mengisi datanya sendiri.
 */
export async function issueSppgWarning(id, { letterType, letterNumber, reason, deadlineLabel }) {
  const res = await api(`/api/sppg/${id}/warnings`, {
    method: 'POST',
    body: JSON.stringify({ letterType, letterNumber, reason, deadlineLabel }),
  })
  return res?.data || null
}

export async function suspendSppgKitchen(id, { reason, alternativeSppgId }) {
  const res = await api(`/api/sppg/${id}/suspension`, {
    method: 'POST',
    body: JSON.stringify({ reason, alternativeSppgId }),
  })
  return res?.data || null
}

export async function reinstateSppgKitchen(id, { reason, initialQuota }) {
  const res = await api(`/api/sppg/${id}/reinstate`, {
    method: 'POST',
    body: JSON.stringify({ reason, initialQuota }),
  })
  return res?.data || null
}

export async function updateSppgQuota(id, quota, reason) {
  const res = await api(`/api/sppg/${id}/quota`, {
    method: 'PUT',
    body: JSON.stringify({ quota, reason }),
  })
  return res?.data || null
}

export async function recordSppgRecipeAudit(id, { tkpiStatus, avgDeviationPct, auditor, notes }) {
  const res = await api(`/api/sppg/${id}/recipe-audit`, {
    method: 'POST',
    body: JSON.stringify({ tkpiStatus, avgDeviationPct, auditor, notes }),
  })
  return res?.data || null
}

export async function fetchDeliveries() {
  const res = await api('/api/deliveries')
  return res?.data || []
}

export async function fetchDelivery(id) {
  const res = await api(`/api/deliveries/${id}`)
  return res?.data || null
}

export async function overrideDeliveryAI(id, { reason, auditorName }) {
  const res = await api(`/api/deliveries/${id}/override`, {
    method: 'POST',
    body: JSON.stringify({ reason, auditorName }),
  })
  return res?.data || null
}

export async function orderDeliveryLabTest(id, { labTarget, dinkesOffice, notes }) {
  const res = await api(`/api/deliveries/${id}/lab-audit`, {
    method: 'POST',
    body: JSON.stringify({ labTarget, dinkesOffice, notes }),
  })
  return res?.data || null
}

export async function fetchCalendarDays(monthYear = '') {
  const qs = monthYear ? `?monthYear=${encodeURIComponent(monthYear)}` : ''
  const res = await api(`/api/calendar${qs}`)
  return res?.data || []
}

export async function fetchMenuPackages() {
  const res = await api('/api/menu-packages')
  return res?.data || []
}

export async function fetchSubstitutions() {
  const res = await api('/api/calendar/substitutions')
  return res?.data || []
}

export async function lockMonthCycle(monthYear) {
  const res = await api('/api/calendar/lock-month', {
    method: 'POST',
    body: JSON.stringify({ monthYear }),
  })
  return res?.data || null
}

export async function toggleDayLock(date) {
  const res = await api(`/api/calendar/days/${date}/lock`, {
    method: 'PUT',
  })
  return res?.data || null
}

export async function setBlackoutDate(date, { title, reason, isSettingBlackout }) {
  const res = await api(`/api/calendar/days/${date}/blackout`, {
    method: 'POST',
    body: JSON.stringify({ title, reason, isSettingBlackout }),
  })
  return res?.data || null
}

export async function createSubstitution(data) {
  const res = await api('/api/calendar/substitutions', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res?.data || null
}

export async function reviewSubstitution(id, action) {
  const res = await api(`/api/calendar/substitutions/${id}/review`, {
    method: 'PUT',
    body: JSON.stringify({ action }),
  })
  return res?.data || null
}

export async function scheduleInspection(date, data) {
  const res = await api(`/api/calendar/days/${date}/inspection`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res?.data || null
}

export async function fetchSchedules(params = {}) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.status && params.status !== 'all') query.set('status', params.status)
  if (params.city && params.city !== 'all') query.set('city', params.city)
  if (params.sppgId) query.set('sppgId', params.sppgId)

  const qs = query.toString() ? `?${query.toString()}` : ''
  const res = await api(`/api/schedules${qs}`)
  return res?.data || []
}

export async function fetchBackupFleets() {
  const res = await api('/api/schedules/backup-fleets')
  return res?.data || []
}

export async function rescheduleDelivery(id, { newTime, reason, effectiveDate }) {
  const res = await api(`/api/schedules/${id}/reschedule`, {
    method: 'PUT',
    body: JSON.stringify({ newTime, reason, effectiveDate }),
  })
  return res?.data || null
}

export async function sendDelayAlert(id, { delayMinutes, customMessage }) {
  const res = await api(`/api/schedules/${id}/delay-alert`, {
    method: 'POST',
    body: JSON.stringify({ delayMinutes, customMessage }),
  })
  return res?.data || null
}

export async function rerouteBackupFleet(id, { backupFleetId, notes }) {
  const res = await api(`/api/schedules/${id}/reroute`, {
    method: 'POST',
    body: JSON.stringify({ backupFleetId, notes }),
  })
  return res?.data || null
}

export async function fetchAttendances() {
  const res = await api('/api/attendance')
  return res?.data || []
}

export async function adjustAttendanceQuota(id, { newQuota, reason }) {
  const res = await api(`/api/attendance/${id}/quota`, {
    method: 'PUT',
    body: JSON.stringify({ newQuota, reason }),
  })
  return res?.data || null
}

export async function redistributeAttendanceSurplus(id, { targetFacility, portionsAllocated, courierName, authorizedBy }) {
  const res = await api(`/api/attendance/${id}/redistribute`, {
    method: 'POST',
    body: JSON.stringify({ targetFacility, portionsAllocated, courierName, authorizedBy }),
  })
  return res?.data || null
}

export async function auditAttendanceDiscrepancy(id, { investigator, notes }) {
  const res = await api(`/api/attendance/${id}/audit`, {
    method: 'POST',
    body: JSON.stringify({ investigator, notes }),
  })
  return res?.data || null
}

export async function fetchNotices(params = {}) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.category && params.category !== 'all') query.set('category', params.category)
  if (params.urgency && params.urgency !== 'all') query.set('urgency', params.urgency)
  if (params.targetAudience && params.targetAudience !== 'all') query.set('targetAudience', params.targetAudience)
  if (params.status && params.status !== 'all') query.set('status', params.status)

  const qs = query.toString() ? `?${query.toString()}` : ''
  const res = await api(`/api/notices${qs}`)
  return res?.data || []
}

export async function createNotice(payload) {
  const res = await api('/api/notices', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function broadcastFlashAlert(id) {
  const res = await api(`/api/notices/${id}/flash-alert`, {
    method: 'POST',
  })
  return res?.data || null
}

export async function toggleArchiveNotice(id, isArchiving = true) {
  const res = await api(`/api/notices/${id}/archive`, {
    method: 'PUT',
    body: JSON.stringify({ isArchiving }),
  })
  return res?.data || null
}

export async function deleteNotice(id) {
  const res = await api(`/api/notices/${id}`, {
    method: 'DELETE',
  })
  return res?.data || null
}

export async function acknowledgeNotice(id) {
  const res = await api(`/api/notices/${id}/ack`, {
    method: 'POST',
  })
  return res?.data || null
}

export async function fetchFeedbacks() {
  const res = await api('/api/feedback')
  return res?.data || []
}

export async function submitFeedback(payload) {
  const res = await api('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function fetchFeedbackBundle() {
  const res = await api('/api/feedback/bundle')
  return res?.data || null
}

export async function fetchFeedbackStats() {
  const res = await api('/api/feedback/stats')
  return res?.data || null
}

export async function executeEmergencyKillSwitch(id, payload = {}) {
  const res = await api(`/api/feedback/${id}/kill-switch`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function escalateMedicalClinic(id, payload = {}) {
  const res = await api(`/api/feedback/${id}/medical`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function closeFeedbackTicket(id, payload = {}) {
  const res = await api(`/api/feedback/${id}/close`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function createFeedbackTicket(payload) {
  const res = await api('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function fetchReportsBundle() {
  const res = await api('/api/reports/bundle')
  return res?.data || null
}

export async function fetchReports(params = {}) {
  const q = new URLSearchParams()
  if (params.category && params.category !== 'all') q.set('category', params.category)
  if (params.search) q.set('search', params.search)
  const qs = q.toString()
  const res = await api(`/api/reports${qs ? `?${qs}` : ''}`)
  return res?.data || []
}

export async function createReport(payload) {
  const res = await api('/api/reports', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function fetchDigitalBasts(params = {}) {
  const q = new URLSearchParams()
  if (params.search) q.set('search', params.search)
  const qs = q.toString()
  const res = await api(`/api/reports/basts${qs ? `?${qs}` : ''}`)
  return res?.data || []
}

export async function fetchDigitalBast(id) {
  const res = await api(`/api/reports/basts/${id}`)
  return res?.data || null
}

export async function fetchVendorInvoices(params = {}) {
  const q = new URLSearchParams()
  if (params.search) q.set('search', params.search)
  const qs = q.toString()
  const res = await api(`/api/reports/invoices${qs ? `?${qs}` : ''}`)
  return res?.data || []
}

export async function authorizePayment(id, payload) {
  const res = await api(`/api/reports/invoices/${id}/clearance`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function fetchForensicFindings(params = {}) {
  const q = new URLSearchParams()
  if (params.search) q.set('search', params.search)
  const qs = q.toString()
  const res = await api(`/api/reports/forensic${qs ? `?${qs}` : ''}`)
  return res?.data || []
}

export async function fetchReportStats() {
  const res = await api('/api/reports/stats')
  return res?.data || null
}

export async function fetchValidators() {
  const res = await api('/api/validators')
  return res?.data || []
}

export async function fetchValidator(id) {
  const res = await api(`/api/validators/${id}`)
  return res?.data || null
}

/**
 * Aksi superadmin atas validator lapangan (RBAC: validators.manage, superadmin).
 * Setiap aksi menulis jejak audit di backend — yang dikembalikan adalah profil
 * terbaru, jadi UI bisa menggantikan baris lama dengan hasil yang benar.
 */
export async function setValidatorStatus(id, status, reason = '') {
  const res = await api(`/api/validators/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  })
  return res?.data || null
}

export async function resetValidatorDevice(id, reason = '') {
  const res = await api(`/api/validators/${id}/device/reset`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
  return res?.data || null
}

export async function warnValidator(id, note) {
  const res = await api(`/api/validators/${id}/warnings`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })
  return res?.data || null
}

export async function assignBackupValidator(id, backupValidatorId, reason = '') {
  const res = await api(`/api/validators/${id}/backup`, {
    method: 'PUT',
    body: JSON.stringify({ backupValidatorId, reason }),
  })
  return res?.data || null
}

/** Buat akun validator baru (akun login + profil roster). RBAC: validators.manage. */
export async function createValidator(payload) {
  const res = await api('/api/validators', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

/** Perbarui identitas profil validator (nama, NPSN, NIP, peran, sertifikasi). */
export async function updateValidator(id, payload) {
  const res = await api(`/api/validators/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

/** Ganti email dan/atau kata sandi login validator. newPassword kosong = tetap. */
export async function updateValidatorCredentials(id, { email, newPassword = '', reason = '' }) {
  const res = await api(`/api/validators/${id}/credentials`, {
    method: 'PATCH',
    body: JSON.stringify({ email, newPassword, reason }),
  })
  return res?.data || null
}

/** Hapus akun login & profil roster validator. */
export async function deleteValidator(id) {
  const res = await api(`/api/validators/${id}`, { method: 'DELETE' })
  return res?.data || null
}

/** Daftar akun login dapur SPPG (superadmin). */
export async function fetchSppgAccounts() {
  const res = await api('/api/sppg/accounts')
  return res?.data || []
}

/** Buat akun login dapur SPPG. Memerlukan sppgId dapur induk. */
export async function createSppgAccount(payload) {
  const res = await api('/api/sppg/accounts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

/** Perbarui identitas akun SPPG (nama, dapur induk, status). */
export async function updateSppgAccount(id, payload) {
  const res = await api(`/api/sppg/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

/** Ganti email dan/atau kata sandi akun SPPG. newPassword kosong = tetap. */
export async function updateSppgAccountCredentials(id, { email, newPassword = '', reason = '' }) {
  const res = await api(`/api/sppg/accounts/${id}/credentials`, {
    method: 'PATCH',
    body: JSON.stringify({ email, newPassword, reason }),
  })
  return res?.data || null
}

/** Hapus akun login dapur SPPG. */
export async function deleteSppgAccount(id) {
  const res = await api(`/api/sppg/accounts/${id}`, { method: 'DELETE' })
  return res?.data || null
}

export async function fetchAdminMetrics() {
  const res = await api('/api/admin/metrics')
  return res?.data || null
}

/** Cari bahan makanan pada dataset gizi (dipakai pemindai porsi). */
export async function fetchNutritionItems(q = '', limit = 20) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (limit) params.set('limit', String(limit))
  const qs = params.toString()
  const res = await api(`/api/nutrition/items${qs ? `?${qs}` : ''}`)
  return res?.data || []
}

export async function fetchAdminDashboard() {
  const res = await api('/api/admin/dashboard')
  return res?.data || null
}

/* ============================================================================
 * SPPG RECIPES & MULTI-TENANT KITCHEN SPACE APIS
 * ============================================================================ */

export async function fetchSppgRecipeBundle(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/recipes/bundle${query}`)
  return res?.data || null
}

export async function fetchSppgMenuPackages(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/recipes/packages${query}`)
  return res?.data || []
}

export async function fetchSppgMenuPackage(id) {
  const res = await api(`/api/sppg/recipes/packages/${id}`)
  return res?.data || null
}

export async function createSppgMenuPackage(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/recipes/packages${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function fetchSppgDailyRecipeState(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/recipes/state${query}`)
  return res?.data || null
}

export async function updateSppgDailyRecipeState(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/recipes/state${query}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function toggleSppgMenuLock(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/recipes/lock${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function fetchSppgSubstitutions(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/recipes/substitutions${query}`)
  return res?.data || []
}

export async function submitSppgSubstitution(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/recipes/substitutions${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function fetchSppgBatchLogs(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/recipes/batches${query}`)
  return res?.data || []
}

export async function createSppgBatchLog(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/recipes/batches${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

/**
 * =========================================================================
 * SPPG BATCHES & THERMAL QR PRINTING (Multi-tenant & Superadmin Connected)
 * =========================================================================
 */

export async function fetchSppgBatchesBundle(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/batches/bundle${query}`)
  return res?.data || null
}

export async function fetchSppgBatches(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/batches${query}`)
  return res?.data || []
}

export async function createSppgBatch(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/batches${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function updateSppgBatchStatus(id, status, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/batches/${encodeURIComponent(id)}/status${query}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
  return res?.data || null
}

export async function verifySppgBatchToken(token, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/batches/verify${query}`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
  return res?.data || null
}

export async function quarantineSppgBatch(id, reason) {
  const res = await api(`/api/sppg/batches/${encodeURIComponent(id)}/quarantine`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
  return res?.data || null
}

export async function deleteSppgBatch(id, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/batches/${encodeURIComponent(id)}${query}`, {
    method: 'DELETE',
  })
  return res?.data || null
}

/**
 * =========================================================================
 * SPPG QUALITY HACCP & SENSORY EVALUATION (Multi-tenant & Superadmin Connected)
 * =========================================================================
 */

export async function fetchSppgQualityBundle(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/quality/bundle${query}`)
  return res?.data || null
}

export async function createSppgTempLog(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/quality/temp-logs${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function createSppgSignoff(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/quality/signoffs${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function createSppgSample(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/quality/samples${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function updateSppgSampleStatus(id, status, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/quality/samples/${encodeURIComponent(id)}/status${query}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
  return res?.data || null
}

export async function submitSppgQualityIntervention(payload) {
  const res = await api('/api/sppg/quality/intervention', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

// -----------------------------------------------------------------------------
// Modul SPPG Logistik & Manajemen Armada Pengantaran
// -----------------------------------------------------------------------------

export async function fetchSppgLogisticsBundle(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/logistics/bundle${query}`)
  return res?.data || null
}

export async function fetchSppgFleets(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/logistics/fleets${query}`)
  return res?.data || []
}

export async function createSppgFleet(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/logistics/fleets${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function updateSppgFleetTelemetry(fleetId, payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/logistics/fleets/${encodeURIComponent(fleetId)}/telemetry${query}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function dispatchSppgBackupFleet(troubledFleetId, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/logistics/fleets/${encodeURIComponent(troubledFleetId)}/dispatch-backup${query}`, {
    method: 'POST',
  })
  return res?.data || null
}

export async function sendSppgDeliveryNotification(fleetId, payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/logistics/fleets/${encodeURIComponent(fleetId)}/notify${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function submitSppgLogisticsIntervention(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/logistics/intervention${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

/**
 * =========================================================================
 * SPPG SCHOOLS BINAAN & DAILY QUOTAS (Multi-tenant & Superadmin Connected)
 * =========================================================================
 */

export async function fetchSppgSchoolsBundle(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/schools/bundle${query}`)
  return res?.data || null
}

export async function fetchSppgSchoolsList(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/schools${query}`)
  return res?.data || []
}

export async function fetchSppgSchoolDetail(id, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/schools/${encodeURIComponent(id)}${query}`)
  return res?.data || null
}

export async function updateSppgSchoolAttendance(id, payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/schools/${encodeURIComponent(id)}/attendance${query}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function updateSppgSchoolDroppoint(id, payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/schools/${encodeURIComponent(id)}/droppoint${query}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function sendSppgSchoolReminder(id, payload = {}, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/schools/${encodeURIComponent(id)}/remind${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res || null
}

/**
 * =========================================================================
 * SPPG HANDOVER & BAST DIGITAL (SPPG.md Bab 7 - Strictly Database-Driven)
 * =========================================================================
 */

export async function fetchSppgHandoverBundle(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/handover/bundle${query}`)
  return res?.data || null
}

export async function fetchSppgHandoverList(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/handover${query}`)
  return res?.data || []
}

export async function fetchSppgHandoverDetail(id, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/handover/${encodeURIComponent(id)}${query}`)
  return res?.data || null
}

export async function advanceSppgHandoverStage(id, payload = {}, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/handover/${encodeURIComponent(id)}/stage${query}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function finishSppgHandoverScan(id, payload = { perfect: true }, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/handover/${encodeURIComponent(id)}/finish-scan${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function rejectSppgHandoverBoxes(id, payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/handover/${encodeURIComponent(id)}/reject${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function replaceSppgHandoverRejected(id, rejectIndex, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/handover/${encodeURIComponent(id)}/replace${query}`, {
    method: 'POST',
    body: JSON.stringify({ rejectIndex }),
  })
  return res?.data || null
}

export async function signSppgHandoverBast(id, payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/handover/${encodeURIComponent(id)}/sign-bast${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

/**
 * =========================================================================
 * SPPG INCIDENTS & TICKET RESPONSE (SPPG.md Bab 8 - Strictly Database-Driven)
 * =========================================================================
 */

export async function fetchSppgIncidentsBundle(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/incidents/bundle${query}`)
  return res?.data || null
}

export async function fetchSppgIncidentTickets(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/incidents${query}`)
  return res?.data || []
}

export async function fetchSppgIncidentTicketDetail(id, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/incidents/${encodeURIComponent(id)}${query}`)
  return res?.data || null
}

export async function createSppgIncidentTicket(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/incidents${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function replySppgIncidentTicket(id, payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/incidents/${encodeURIComponent(id)}/reply${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function replaceSppgIncidentPortions(id, payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/incidents/${encodeURIComponent(id)}/replace${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function recallSppgIncidentBatch(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/incidents/recall${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function closeSppgIncidentTicket(id, payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/incidents/${encodeURIComponent(id)}/close${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

/**
 * =========================================================================
 * SPPG COMPLIANCE & SANITATION (SPPG.md Bab 10 - Strictly Database-Driven)
 * =========================================================================
 */

export async function fetchSppgComplianceBundle(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/compliance/bundle${query}`)
  return res?.data || null
}

export async function fetchSppgComplianceDocs(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/compliance/docs${query}`)
  return res?.data || []
}

export async function renewSppgComplianceDoc(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/compliance/docs/renew${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function fetchSppgComplianceHandlers(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/compliance/handlers${query}`)
  return res?.data || []
}

export async function createSppgComplianceHandler(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/compliance/handlers${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function fetchSppgComplianceLabs(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/compliance/labs${query}`)
  return res?.data || []
}

export async function createSppgComplianceLab(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/compliance/labs${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function fetchSppgComplianceAudits(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/compliance/audits${query}`)
  return res?.data || []
}

export async function requestSppgComplianceAudit(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/compliance/audits${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

/* ============================================================================
 * SPPG COCKPIT DASHBOARD APIS
 * ============================================================================ */

export async function fetchSppgDashboardBundle(sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/dashboard/bundle${query}`)
  return res?.data || null
}

export async function transitionSppgStage(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/dashboard/transition${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function triggerSppgEmergency(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/dashboard/emergency${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function resolveSppgEmergency(payload, sppgId = '') {
  const query = sppgId ? `?sppgId=${encodeURIComponent(sppgId)}` : ''
  const res = await api(`/api/sppg/dashboard/emergency/resolve${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function fetchValidatorScanContext(params = {}) {
  const q = new URLSearchParams()
  if (params.npsn) q.set('npsn', params.npsn)
  if (params.sppgId) q.set('sppgId', params.sppgId)
  const qs = q.toString() ? `?${q.toString()}` : ''
  const res = await api(`/api/validator/scan/context${qs}`)
  return res?.data || null
}

export async function confirmValidatorScanDecision(payload) {
  const res = await api('/api/validator/scan/confirm', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function fetchValidatorHandoverBundle(params = {}) {
  const q = new URLSearchParams()
  if (params.npsn) q.set('npsn', params.npsn)
  if (params.sppgId) q.set('sppgId', params.sppgId)
  const qs = q.toString() ? `?${q.toString()}` : ''
  const res = await api(`/api/validator/handover/bundle${qs}`)
  return res?.data || null
}

export async function submitValidatorBast(payload) {
  const res = await api('/api/validator/handover/submit-bast', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function resetValidatorHandover(payload = {}) {
  const res = await api('/api/validator/handover/reset', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function fetchValidatorIncidents(params = {}) {
  const q = new URLSearchParams()
  if (params.npsn) q.set('npsn', params.npsn)
  if (params.sppgId) q.set('sppgId', params.sppgId)
  const qs = q.toString() ? `?${q.toString()}` : ''
  const res = await api(`/api/validator/incidents${qs}`)
  return res?.data || null
}

export async function submitValidatorIncident(payload) {
  const res = await api('/api/validator/incidents', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function fetchValidatorHistoryBundle(params = {}) {
  const q = new URLSearchParams()
  if (params.npsn) q.set('npsn', params.npsn)
  if (params.sppgId) q.set('sppgId', params.sppgId)
  if (params.limit) q.set('limit', String(params.limit))
  const qs = q.toString() ? `?${q.toString()}` : ''
  const res = await api(`/api/validator/history/bundle${qs}`)
  return res?.data || null
}

export async function allocateValidatorSurplus(payload) {
  const res = await api('/api/validator/history/surplus', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function fetchValidatorDashboardBundle(params = {}) {
  const q = new URLSearchParams()
  if (params.npsn) q.set('npsn', params.npsn)
  if (params.sppgId) q.set('sppgId', params.sppgId)
  const qs = q.toString() ? `?${q.toString()}` : ''
  const res = await api(`/api/validator/dashboard${qs}`)
  return res?.data || null
}

// ============================================================================
// FORUM KOMUNITAS / COMMUNITY POSTS API
// ============================================================================

export async function fetchPosts({ page = 1, limit = 10, tag = '', search = '' } = {}) {
  const q = new URLSearchParams()
  if (page) q.set('page', String(page))
  if (limit) q.set('limit', String(limit))
  if (tag && tag !== 'Semua') q.set('tag', tag)
  if (search) q.set('search', search)
  const qs = q.toString() ? `?${q.toString()}` : ''
  const res = await api(`/api/v1/posts${qs}`)
  return res?.data || { items: [], total: 0, page, limit, totalPages: 0, hasMore: false }
}

export async function fetchPostByID(id) {
  const res = await api(`/api/v1/posts/${id}`)
  return res?.data || null
}

export async function createPost(payload) {
  const res = await api('/api/v1/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}

export async function deletePost(id) {
  const res = await api(`/api/v1/posts/${id}`, {
    method: 'DELETE',
  })
  return res?.data || null
}

export async function toggleLikePost(id) {
  const res = await api(`/api/v1/posts/${id}/like`, {
    method: 'POST',
  })
  return res?.data || null
}

export async function fetchComments(postId) {
  const res = await api(`/api/v1/posts/${postId}/comments`)
  return res?.data || []
}

export async function createComment(postId, payload) {
  const res = await api(`/api/v1/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res?.data || null
}













