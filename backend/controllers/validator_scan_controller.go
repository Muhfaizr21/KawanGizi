package controllers

import (
	"backend/database"
	"backend/middlewares"
	"backend/models"
	"backend/services"
	"backend/utils"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

// ValidatorScanController menangani endpoint pemindaian mutu dan sinkronisasi Serah Terima (BAST)
type ValidatorScanController struct {
	svc services.ValidatorScanService
}

// NewValidatorScanController constructor DI untuk ValidatorScanController
func NewValidatorScanController(svc services.ValidatorScanService) *ValidatorScanController {
	return &ValidatorScanController{svc: svc}
}

// GetContext mengembalikan profil sekolah, dapur sentral, menu hari ini, jendela HACCP, dan daftar boks
func (c *ValidatorScanController) GetContext(w http.ResponseWriter, r *http.Request) {
	userRole := middlewares.Role(r.Context())
	userID := middlewares.UserID(r.Context())
	requestedNPSN := r.URL.Query().Get("npsn")
	requestedSPPGID := r.URL.Query().Get("sppgId")

	ctxData, err := c.svc.GetContext(r.Context(), userRole, userID, requestedNPSN, requestedSPPGID)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Gagal memuat konteks ruang pemindaian: "+err.Error())
		return
	}

	utils.Success(w, http.StatusOK, "Konteks pemindaian validator berhasil dimuat", ctxData)
}

// ConfirmDecision mencatat keputusan kelayakan porsi, tanda tangan BAST digital, dan memperbarui telemetri ke SPPG & Superadmin
func (c *ValidatorScanController) ConfirmDecision(w http.ResponseWriter, r *http.Request) {
	userRole := middlewares.Role(r.Context())
	userID := middlewares.UserID(r.Context())

	var payload models.ValidatorScanConfirmPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "Format payload konfirmasi tidak valid")
		return
	}

	actorName := payload.ValidatorName
	if actorName == "" {
		_ = database.Pool().QueryRow(r.Context(), `SELECT full_name FROM users WHERE id = $1`, userID).Scan(&actorName)
	}
	if actorName == "" {
		actorName = "Petugas Validator Lapangan"
	}

	result, err := c.svc.ConfirmDecision(r.Context(), &payload, userID, actorName, userRole)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Gagal memproses konfirmasi pemindaian: "+err.Error())
		return
	}

	utils.Success(w, http.StatusOK, result.Message, result)
}

// GetHandoverBundle mengembalikan bundle serah terima, daftar 13 master tote, dan status BAST
func (c *ValidatorScanController) GetHandoverBundle(w http.ResponseWriter, r *http.Request) {
	userRole := middlewares.Role(r.Context())
	userID := middlewares.UserID(r.Context())
	requestedNPSN := r.URL.Query().Get("npsn")
	requestedSPPGID := r.URL.Query().Get("sppgId")

	bundle, err := c.svc.GetHandoverBundle(r.Context(), userRole, userID, requestedNPSN, requestedSPPGID)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Gagal memuat data serah terima BAST: "+err.Error())
		return
	}

	utils.Success(w, http.StatusOK, "Data serah terima dan BAST berhasil dimuat", bundle)
}

// SubmitBast memproses penerbitan resmi BAST dari portal validator
func (c *ValidatorScanController) SubmitBast(w http.ResponseWriter, r *http.Request) {
	userRole := middlewares.Role(r.Context())
	userID := middlewares.UserID(r.Context())

	var payload models.ValidatorSubmitBastPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "Format payload BAST tidak valid")
		return
	}

	actorName := payload.ValidatorSign
	if actorName == "" {
		_ = database.Pool().QueryRow(r.Context(), `SELECT full_name FROM users WHERE id = $1`, userID).Scan(&actorName)
	}
	if actorName == "" {
		actorName = "Petugas Validator Lapangan"
	}

	result, err := c.svc.SubmitBast(r.Context(), &payload, userID, actorName, userRole)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Gagal menerbitkan BAST: "+err.Error())
		return
	}

	utils.Success(w, http.StatusOK, result.Message, result)
}

// ResetHandover mengembalikan status serah terima untuk pengujian ulang
func (c *ValidatorScanController) ResetHandover(w http.ResponseWriter, r *http.Request) {
	var body struct {
		NPSN   string `json:"npsn"`
		SPPGID string `json:"sppgId"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	if body.NPSN == "" {
		body.NPSN = r.URL.Query().Get("npsn")
	}
	if body.SPPGID == "" {
		body.SPPGID = r.URL.Query().Get("sppgId")
	}

	if err := c.svc.ResetHandover(r.Context(), body.NPSN, body.SPPGID); err != nil {
		utils.Error(w, http.StatusInternalServerError, "Gagal reset serah terima: "+err.Error())
		return
	}

	utils.Success(w, http.StatusOK, "Sesi serah terima berhasil di-reset untuk pengujian ulang", nil)
}

// GetIncidents mengembalikan bundel data insiden aktif dan riwayat penanganan untuk validator sekolah
func (c *ValidatorScanController) GetIncidents(w http.ResponseWriter, r *http.Request) {
	userRole := middlewares.Role(r.Context())
	userID := middlewares.UserID(r.Context())
	requestedNPSN := r.URL.Query().Get("npsn")
	requestedSPPGID := r.URL.Query().Get("sppgId")

	bundle, err := c.svc.GetIncidentBundle(r.Context(), userRole, userID, requestedNPSN, requestedSPPGID)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Gagal memuat data eskalasi insiden: "+err.Error())
		return
	}

	utils.Success(w, http.StatusOK, "Data insiden validator berhasil dimuat", bundle)
}

// CreateIncident mencatat laporan insiden kritis/darurat baru dan mendistribusikan ke SPPG serta Satgas MBG
func (c *ValidatorScanController) CreateIncident(w http.ResponseWriter, r *http.Request) {
	userRole := middlewares.Role(r.Context())
	userID := middlewares.UserID(r.Context())

	var payload models.ValidatorCreateIncidentPayload

	ct := r.Header.Get("Content-Type")
	if strings.HasPrefix(ct, "multipart/form-data") {
		_ = r.ParseMultipartForm(10 << 20)
		payload.Category = r.FormValue("category")
		payload.Severity = r.FormValue("severity")
		if payload.Severity == "" {
			payload.Severity = r.FormValue("severityLevel")
		}
		payload.Description = r.FormValue("description")
		payload.NPSN = r.FormValue("npsn")
		payload.SPPGID = r.FormValue("sppgId")
		payload.BatchToken = r.FormValue("batchToken")
		payload.ReporterName = r.FormValue("reporterName")
	} else {
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			utils.Error(w, http.StatusBadRequest, "Format payload laporan insiden tidak valid")
			return
		}
	}

	if payload.Severity == "" {
		payload.Severity = "medium"
	}
	if payload.Category == "" {
		payload.Category = "organoleptic"
	}

	actorName := payload.ReporterName
	if actorName == "" {
		_ = database.Pool().QueryRow(r.Context(), `SELECT full_name FROM users WHERE id = $1`, userID).Scan(&actorName)
	}
	if actorName == "" {
		actorName = "Petugas Validator Lapangan"
	}

	item, err := c.svc.CreateIncident(r.Context(), &payload, userID, actorName, userRole)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Gagal mengirimkan laporan insiden: "+err.Error())
		return
	}

	utils.Success(w, http.StatusCreated, "Laporan insiden berhasil dikirimkan ke SPPG & Satgas MBG", item)
}

// GetHistory mengembalikan bundel riwayat presensi harian, rekonsiliasi porsi sisa, dan log AI classifier
func (c *ValidatorScanController) GetHistory(w http.ResponseWriter, r *http.Request) {
	userRole := middlewares.Role(r.Context())
	userID := middlewares.UserID(r.Context())
	requestedNPSN := r.URL.Query().Get("npsn")
	requestedSPPGID := r.URL.Query().Get("sppgId")
	limitStr := r.URL.Query().Get("limit")

	limit := 100
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	bundle, err := c.svc.GetHistoryBundle(r.Context(), userRole, userID, requestedNPSN, requestedSPPGID, limit)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Gagal memuat bundel riwayat rekonsiliasi: "+err.Error())
		return
	}

	utils.Success(w, http.StatusOK, "Data riwayat dan rekonsiliasi berhasil dimuat", bundle)
}

// GetHistorySummary mengembalikan statistik ringkasan eksekutif untuk 4 kartu metrik riwayat
func (c *ValidatorScanController) GetHistorySummary(w http.ResponseWriter, r *http.Request) {
	userRole := middlewares.Role(r.Context())
	userID := middlewares.UserID(r.Context())
	requestedNPSN := r.URL.Query().Get("npsn")
	requestedSPPGID := r.URL.Query().Get("sppgId")

	bundle, err := c.svc.GetHistoryBundle(r.Context(), userRole, userID, requestedNPSN, requestedSPPGID, 1)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Gagal memuat ringkasan riwayat: "+err.Error())
		return
	}

	summary := map[string]any{
		"totalScans":    bundle.Totals.BoxesScanned,
		"boxesScanned":  bundle.Totals.BoxesScanned,
		"present":       bundle.Totals.Present,
		"quota":         bundle.Totals.Quota,
		"handed":        bundle.Totals.Handed,
		"leftover":      bundle.Totals.Leftover,
		"attendancePct": bundle.Totals.AttendancePct,
		"reviewRate":    bundle.Totals.ReviewRate,
	}

	utils.Success(w, http.StatusOK, "Ringkasan riwayat berhasil dimuat", summary)
}

// AllocateSurplus menyimpan opsi alokasi porsi sisa per kelas dan sinkron ke tabel attendances & audit log
func (c *ValidatorScanController) AllocateSurplus(w http.ResponseWriter, r *http.Request) {
	userRole := middlewares.Role(r.Context())
	userID := middlewares.UserID(r.Context())

	var payload models.ValidatorAllocateSurplusPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "Format payload alokasi porsi sisa tidak valid")
		return
	}

	actorName := ""
	_ = database.Pool().QueryRow(r.Context(), `SELECT full_name FROM users WHERE id = $1`, userID).Scan(&actorName)
	if actorName == "" {
		actorName = "Petugas Validator Lapangan"
	}

	result, err := c.svc.AllocateSurplus(r.Context(), &payload, userID, actorName, userRole)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Gagal menyimpan alokasi porsi sisa: "+err.Error())
		return
	}

	utils.Success(w, http.StatusOK, result.Message, result)
}

// GetDashboard mengembalikan bundel data lengkap untuk beranda & kuota validator (Bab 1 VALIDATOR.md)
func (c *ValidatorScanController) GetDashboard(w http.ResponseWriter, r *http.Request) {
	userRole := middlewares.Role(r.Context())
	userID := middlewares.UserID(r.Context())

	requestedNPSN := r.URL.Query().Get("npsn")
	requestedSPPGID := r.URL.Query().Get("sppgId")

	bundle, err := c.svc.GetDashboardBundle(r.Context(), userRole, userID, requestedNPSN, requestedSPPGID)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Gagal memuat bundel beranda validator: "+err.Error())
		return
	}

	utils.Success(w, http.StatusOK, "Data beranda validator berhasil dimuat", bundle)
}


