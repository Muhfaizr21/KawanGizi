package controllers

import (
	"backend/middlewares"
	"backend/models"
	"backend/services"
	"backend/utils"
	"errors"
	"log"
	"net/http"
)

// SppgController melayani direktori dapur SPPG untuk portal admin/superadmin.
//
// Controller hanya mengurus transpor HTTP; seluruh aturan bisnis ada di
// services.SppgService.
type SppgController struct {
	svc services.SppgService
}

// NewSppgController wires the SPPG controller (Constructor DI).
func NewSppgController(svc services.SppgService) *SppgController {
	return &SppgController{svc: svc}
}

// List mengembalikan direktori dapur beserta skor dan riwayat teguran.
//
//	@Summary		Direktori dapur SPPG
//	@Tags			sppg
//	@Produce		json
//	@Success		200	{object}	models.APIResponse{data=[]models.SPPGKitchen}
//	@Failure		403	{object}	models.APIResponse
//	@Router			/sppg [get]
func (c *SppgController) List(w http.ResponseWriter, r *http.Request) {
	list, err := c.svc.List(r.Context())
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Gagal memuat direktori dapur")
		return
	}
	utils.Success(w, http.StatusOK, "Direktori dapur SPPG berhasil dimuat", list)
}

// Get mengembalikan satu dapur.
//
//	@Summary		Detail satu dapur SPPG
//	@Tags			sppg
//	@Produce		json
//	@Param			id	path	string	true	"SPPG ID"	Example(SPPG-01)
//	@Success		200	{object}	models.APIResponse{data=models.SPPGKitchen}
//	@Failure		404	{object}	models.APIResponse
//	@Router			/sppg/{id} [get]
func (c *SppgController) Get(w http.ResponseWriter, r *http.Request) {
	k, err := c.svc.Get(r.Context(), r.PathValue("id"))
	if err != nil {
		writeSppgError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Detail dapur berhasil dimuat", k)
}

// IssueWarning menerbitkan surat teguran SP-1/SP-2.
//
//	@Summary		Terbitkan surat peringatan SP-1/SP-2
//	@Description	Superadmin saja. SP-2 hanya sah bila SP-1 sebelumnya sudah terbit.
//	@Tags			sppg
//	@Accept			json
//	@Produce		json
//	@Param			id		path	string							true	"SPPG ID"
//	@Param			payload	body	models.IssueWarningRequest	true	"Jenis, nomor, alasan, tenggat"
//	@Success		200		{object}	models.APIResponse{data=models.SPPGKitchen}
//	@Failure		400		{object}	models.APIResponse
//	@Router			/sppg/{id}/warnings [post]
func (c *SppgController) IssueWarning(w http.ResponseWriter, r *http.Request) {
	var req models.IssueWarningRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload tidak valid")
		return
	}

	k, err := c.svc.IssueWarning(r.Context(), middlewares.UserID(r.Context()), r.PathValue("id"), req)
	if err != nil {
		writeSppgError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Surat peringatan berhasil diterbitkan", k)
}

// Suspend membekukan hak masak & distribusi dapur.
//
//	@Summary		Bekukan dapur SPPG
//	@Description	Superadmin saja. Wajib menunjuk dapur alternatif yang aktif dan mampu.
//	@Tags			sppg
//	@Accept			json
//	@Produce		json
//	@Param			id		path	string							true	"SPPG ID"
//	@Param			payload	body	models.SuspendKitchenRequest	true	"Alasan + dapur alternatif"
//	@Success		200		{object}	models.APIResponse{data=models.SPPGKitchen}
//	@Failure		400		{object}	models.APIResponse
//	@Router			/sppg/{id}/suspension [post]
func (c *SppgController) Suspend(w http.ResponseWriter, r *http.Request) {
	var req models.SuspendKitchenRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload tidak valid")
		return
	}

	k, err := c.svc.Suspend(r.Context(), middlewares.UserID(r.Context()), r.PathValue("id"), req)
	if err != nil {
		writeSppgError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Izin distribusi dapur telah dibekukan", k)
}

// Reinstate memulihkan hak masak & distribusi dapur yang sebelumnya dibekukan.
//
//	@Summary		Pulihkan hak operasional dapur SPPG
//	@Description	Superadmin saja. Mengembalikan status dapur menjadi active dan menetapkan kuota awal.
//	@Tags			sppg
//	@Accept			json
//	@Produce		json
//	@Param			id		path	string							true	"SPPG ID"
//	@Param			payload	body	models.ReinstateKitchenRequest	true	"Alasan pemulihan + kuota awal"
//	@Success		200		{object}	models.APIResponse{data=models.SPPGKitchen}
//	@Failure		400		{object}	models.APIResponse
//	@Router			/sppg/{id}/reinstate [post]
func (c *SppgController) Reinstate(w http.ResponseWriter, r *http.Request) {
	var req models.ReinstateKitchenRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload tidak valid")
		return
	}

	k, err := c.svc.Reinstate(r.Context(), middlewares.UserID(r.Context()), r.PathValue("id"), req)
	if err != nil {
		writeSppgError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Hak operasional dan distribusi dapur telah dipulihkan", k)
}

// UpdateQuota menetapkan kuota produksi harian.
//
//	@Summary		Perbarui kuota produksi
//	@Description	Superadmin saja. Kuota tidak boleh melebihi maxDailyPortions.
//	@Tags			sppg
//	@Accept			json
//	@Produce		json
//	@Param			id		path	string						true	"SPPG ID"
//	@Param			payload	body	models.UpdateQuotaRequest	true	"Kuota baru + alasan"
//	@Success		200		{object}	models.APIResponse{data=models.SPPGKitchen}
//	@Failure		400		{object}	models.APIResponse
//	@Router			/sppg/{id}/quota [put]
func (c *SppgController) UpdateQuota(w http.ResponseWriter, r *http.Request) {
	targetID := r.PathValue("id")
	role := middlewares.Role(r.Context())
	callerSppg := middlewares.SppgID(r.Context())
	if role == models.RoleSppg && callerSppg != "" && callerSppg != targetID {
		utils.Error(w, http.StatusForbidden, "Akses ditolak: Dapur SPPG hanya diizinkan mengelola fasilitasnya sendiri")
		return
	}

	var req models.UpdateQuotaRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload tidak valid")
		return
	}

	k, err := c.svc.UpdateQuota(r.Context(), middlewares.UserID(r.Context()), targetID, req)
	if err != nil {
		writeSppgError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Kuota produksi harian diperbarui", k)
}

// RecordRecipeAudit menyimpan hasil audit gramatur resep TKPI.
//
//	@Summary		Audit gramatur resep TKPI
//	@Tags			sppg
//	@Accept			json
//	@Produce		json
//	@Param			id		path	string								true	"SPPG ID"
//	@Param			payload	body	models.RecordRecipeAuditRequest	true	"Hasil audit"
//	@Success		200		{object}	models.APIResponse{data=models.SPPGKitchen}
//	@Failure		400		{object}	models.APIResponse
//	@Router			/sppg/{id}/recipe-audit [post]
func (c *SppgController) RecordRecipeAudit(w http.ResponseWriter, r *http.Request) {
	targetID := r.PathValue("id")
	role := middlewares.Role(r.Context())
	callerSppg := middlewares.SppgID(r.Context())
	if role == models.RoleSppg && callerSppg != "" && callerSppg != targetID {
		utils.Error(w, http.StatusForbidden, "Akses ditolak: Dapur SPPG hanya diizinkan mengelola fasilitasnya sendiri")
		return
	}

	var req models.RecordRecipeAuditRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload tidak valid")
		return
	}

	k, err := c.svc.RecordRecipeAudit(r.Context(), middlewares.UserID(r.Context()), targetID, req)
	if err != nil {
		writeSppgError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Hasil audit resep tersimpan", k)
}

// GetProfile mengembalikan dapur milik akun SPPG yang sedang login.
//
//	@Summary		Profil dapur akun SPPG
//	@Tags			sppg
//	@Produce		json
//	@Success		200	{object}	models.APIResponse{data=models.SPPGKitchen}
//	@Failure		400	{object}	models.APIResponse
//	@Router			/sppg/profile [get]
func (c *SppgController) GetProfile(w http.ResponseWriter, r *http.Request) {
	k, err := c.svc.Get(r.Context(), middlewares.SppgID(r.Context()))
	if err != nil {
		writeSppgError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Profil dapur berhasil dimuat", k)
}

// UpdateProfile mengganti nama dapur milik akun SPPG sendiri.
//
//	@Summary		Perbarui identitas dapur akun SPPG
//	@Description	Self-service: dapur hanya boleh mengubah namanya sendiri.
//	@Tags			sppg
//	@Accept			json
//	@Produce		json
//	@Param			payload	body	models.UpdateSppgProfileRequest	true	"Nama dapur baru"
//	@Success		200		{object}	models.APIResponse{data=models.SPPGKitchen}
//	@Failure		400		{object}	models.APIResponse
//	@Router			/sppg/profile [patch]
func (c *SppgController) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	var req models.UpdateSppgProfileRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload tidak valid")
		return
	}

	k, err := c.svc.UpdateProfile(r.Context(), middlewares.UserID(r.Context()), middlewares.SppgID(r.Context()), req)
	if err != nil {
		writeSppgError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Nama dapur berhasil diperbarui", k)
}

// writeSppgError memetakan error domain service ke status HTTP.
func writeSppgError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, services.ErrSppgInvalid):
		utils.Error(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, services.ErrSppgQuotaTooHigh):
		utils.Error(w, http.StatusUnprocessableEntity, err.Error())
	case errors.Is(err, services.ErrSppgSuspended):
		utils.Error(w, http.StatusConflict, err.Error())
	case errors.Is(err, services.ErrSppgNotFound):
		utils.Error(w, http.StatusNotFound, "Dapur SPPG tidak ditemukan")
	default:
		log.Printf("[ERROR] SPPG operation failed: %v", err)
		utils.Error(w, http.StatusInternalServerError, "Gagal memproses tindakan dapur")
	}
}
