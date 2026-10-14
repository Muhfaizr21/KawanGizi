package controllers

import (
	"backend/middlewares"
	"backend/models"
	"backend/services"
	"backend/utils"
	"encoding/json"
	"errors"
	"log"
	"net/http"
)

// ValidatorController melayani endpoint roster validator lapangan untuk portal
// superadmin (/admin/validators).
//
// Controller hanya mengurus transpor HTTP: decode payload, ambil id aktor dari
// context middleware, dan memetakan error domain ke status HTTP. Seluruh aturan
// bisnis berada di services.ValidatorService.
type ValidatorController struct {
	svc services.ValidatorService
}

// NewValidatorController wires the validator controller (Constructor DI).
func NewValidatorController(svc services.ValidatorService) *ValidatorController {
	return &ValidatorController{svc: svc}
}

// List mengembalikan roster validator beserta statistik pindai hari ini.
func (c *ValidatorController) List(w http.ResponseWriter, r *http.Request) {
	list, err := c.svc.List(r.Context())
	if err != nil {
		log.Printf("[ERROR] Failed to list validators: %v", err)
		utils.Error(w, http.StatusInternalServerError, "Gagal memuat data validator")
		return
	}
	utils.Success(w, http.StatusOK, "Daftar validator lapangan berhasil dimuat", list)
}

// Get returns one validator profile.
func (c *ValidatorController) Get(w http.ResponseWriter, r *http.Request) {
	v, err := c.svc.Get(r.Context(), r.PathValue("id"))
	if err != nil {
		writeValidatorError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Profil validator berhasil dimuat", v)
}

// SetStatus mengubah status validator: whitelist, pembekuan, atau blacklist.
//
//	@Summary		Ubah status validator lapangan
//	@Description	Superadmin saja. Menyelaraskan validator_profiles.status dengan users.status dan mencatat audit.
//	@Tags			validators
//	@Accept			json
//	@Produce		json
//	@Param			id	path		string						true	"Validator ID"	Example(VAL-001)
//	@Param			payload	body		models.SetValidatorStatusRequest	true	"Status baru + alasan"
//	@Success		200		{object}	models.APIResponse{data=models.ValidatorProfile}
//	@Failure		400		{object}	models.APIResponse
//	@Failure		404		{object}	models.APIResponse
//	@Router			/validators/{id}/status [PATCH]
func (c *ValidatorController) SetStatus(w http.ResponseWriter, r *http.Request) {
	var req models.SetValidatorStatusRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload tidak valid")
		return
	}

	v, err := c.svc.SetStatus(r.Context(), middlewares.UserID(r.Context()), r.PathValue("id"), req.Status, req.Reason)
	if err != nil {
		writeValidatorError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Status validator diperbarui dan tercatat pada audit log", v)
}

// ResetDevice memutus device binding validator.
//
//	@Summary		Reset device binding validator
//	@Description	Memutus tautan kriptografis perangkat; validator wajib registrasi ulang.
//	@Tags			validators
//	@Accept			json
//	@Produce		json
//	@Param			id		path	string									true	"Validator ID"	Example(VAL-001)
//	@Param			payload	body	models.ResetValidatorDeviceRequest	false	"Alasan reset"
//	@Success		200		{object}	models.APIResponse{data=models.ValidatorProfile}
//	@Failure		404		{object}	models.APIResponse
//	@Router			/validators/{id}/device/reset [POST]
func (c *ValidatorController) ResetDevice(w http.ResponseWriter, r *http.Request) {
	// Body opsional: reset tanpa alasan tetap sah, alasan hanya memperkaya audit.
	var req models.ResetValidatorDeviceRequest
	if r.ContentLength > 0 {
		if err := decodeJSON(r, &req); err != nil {
			utils.Error(w, http.StatusBadRequest, "Payload tidak valid")
			return
		}
	}

	v, err := c.svc.ResetDevice(r.Context(), middlewares.UserID(r.Context()), r.PathValue("id"), req.Reason)
	if err != nil {
		writeValidatorError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Device validator diputus; registrasi ulang diwajibkan", v)
}

// IssueWarning menerbitkan surat peringatan digital ke validator.
//
//	@Summary		Kirim surat peringatan digital
//	@Description	Menandai profil sebagai flagged dan menambah hitungan peringatan.
//	@Tags			validators
//	@Accept			json
//	@Produce		json
//	@Param			id		path	string							true	"Validator ID"	Example(VAL-001)
//	@Param			payload	body	models.WarnValidatorRequest	true	"Isi surat peringatan"
//	@Success		200		{object}	models.APIResponse{data=models.ValidatorProfile}
//	@Failure		400		{object}	models.APIResponse
//	@Failure		404		{object}	models.APIResponse
//	@Router			/validators/{id}/warnings [POST]
func (c *ValidatorController) IssueWarning(w http.ResponseWriter, r *http.Request) {
	var req models.WarnValidatorRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload tidak valid")
		return
	}

	v, err := c.svc.IssueWarning(r.Context(), middlewares.UserID(r.Context()), r.PathValue("id"), req.Note)
	if err != nil {
		writeValidatorError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Surat peringatan digital berhasil diterbitkan", v)
}

// AssignBackup menunjuk guru piket cadangan untuk validator bermasalah.
//
//	@Summary		Tugaskan guru piket cadangan
//	@Description	Cadangan wajib validator aktif pada sekolah yang sama.
//	@Tags			validators
//	@Accept			json
//	@Produce		json
//	@Param			id		path	string									true	"Validator ID"	Example(VAL-001)
//	@Param			payload	body	models.AssignBackupValidatorRequest	true	"ID cadangan + alasan"
//	@Success		200		{object}	models.APIResponse{data=models.ValidatorProfile}
//	@Failure		400		{object}	models.APIResponse
//	@Failure		404		{object}	models.APIResponse
//	@Router			/validators/{id}/backup [PUT]
func (c *ValidatorController) AssignBackup(w http.ResponseWriter, r *http.Request) {
	var req models.AssignBackupValidatorRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload tidak valid")
		return
	}

	v, err := c.svc.AssignBackup(r.Context(), middlewares.UserID(r.Context()), r.PathValue("id"), req.BackupValidatorID, req.Reason)
	if err != nil {
		writeValidatorError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Guru piket cadangan berhasil ditugaskan", v)
}

// Create membuat akun validator baru (akun login + profil roster).
//
//	@Summary		Tambah akun validator
//	@Description	Superadmin saja. Membuat akun login dan profil roster sekaligus.
//	@Tags			validators
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		models.CreateValidatorRequest	true	"Data akun + profil validator"
//	@Success		201		{object}	models.APIResponse{data=models.ValidatorProfile}
//	@Failure		400		{object}	models.APIResponse
//	@Failure		409		{object}	models.APIResponse
//	@Router			/validators [POST]
func (c *ValidatorController) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateValidatorRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload tidak valid")
		return
	}

	v, err := c.svc.Create(r.Context(), middlewares.UserID(r.Context()), req)
	if err != nil {
		writeValidatorError(w, err)
		return
	}
	utils.Success(w, http.StatusCreated, "Akun validator berhasil dibuat", v)
}

// Update memperbarui identitas profil validator.
//
//	@Summary		Perbarui identitas validator
//	@Description	Superadmin saja. Mengubah nama, NPSN, NIP, satgas ID, peran, dan sertifikasi.
//	@Tags			validators
//	@Accept			json
//	@Param			id		path	string						true	"Validator ID"
//	@Param			payload	body	models.UpdateValidatorRequest	true	"Identitas baru"
//	@Success		200		{object}	models.APIResponse{data=models.ValidatorProfile}
//	@Failure		400		{object}	models.APIResponse
//	@Failure		404		{object}	models.APIResponse
//	@Router			/validators/{id} [PATCH]
func (c *ValidatorController) Update(w http.ResponseWriter, r *http.Request) {
	var req models.UpdateValidatorRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload tidak valid")
		return
	}

	v, err := c.svc.Update(r.Context(), middlewares.UserID(r.Context()), r.PathValue("id"), req)
	if err != nil {
		writeValidatorError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Identitas validator berhasil diperbarui", v)
}

// UpdateCredentials mengganti email dan/atau kata sandi akun validator.
//
//	@Summary		Perbarui email & kata sandi validator
//	@Description	Superadmin saja. NewPassword boleh kosong untuk hanya mengganti email.
//	@Tags			validators
//	@Accept			json
//	@Param			id		path	string									true	"Validator ID"
//	@Param			payload	body	models.UpdateValidatorCredentialsRequest	true	"Email & kata sandi baru"
//	@Success		200		{object}	models.APIResponse{data=models.ValidatorProfile}
//	@Failure		400		{object}	models.APIResponse
//	@Failure		404		{object}	models.APIResponse
//	@Failure		409		{object}	models.APIResponse
//	@Router			/validators/{id}/credentials [PATCH]
func (c *ValidatorController) UpdateCredentials(w http.ResponseWriter, r *http.Request) {
	var req models.UpdateValidatorCredentialsRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload tidak valid")
		return
	}

	v, err := c.svc.UpdateCredentials(r.Context(), middlewares.UserID(r.Context()), r.PathValue("id"), req)
	if err != nil {
		writeValidatorError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Kredensial validator berhasil diperbarui", v)
}

// Delete menghapus akun login dan profil roster validator.
//
//	@Summary		Hapus akun validator
//	@Description	Superadmin saja. Menghapus akun login beserta profil rosternya.
//	@Tags			validators
//	@Param			id	path	string	true	"Validator ID"
//	@Success		200	{object}	models.APIResponse
//	@Failure		404	{object}	models.APIResponse
//	@Router			/validators/{id} [DELETE]
func (c *ValidatorController) Delete(w http.ResponseWriter, r *http.Request) {
	if err := c.svc.Delete(r.Context(), middlewares.UserID(r.Context()), r.PathValue("id")); err != nil {
		writeValidatorError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Akun validator berhasil dihapus", nil)
}

// decodeJSON mendekode body dengan batas ukuran wajar agar request abnormally
// besar tidak menahan handler.
func decodeJSON(r *http.Request, dst any) error {
	defer r.Body.Close()
	return json.NewDecoder(http.MaxBytesReader(nil, r.Body, maxValidatorBodyBytes)).Decode(dst)
}

const maxValidatorBodyBytes = 64 << 10

// writeValidatorError memetakan error domain service ke status HTTP.
func writeValidatorError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, services.ErrValidatorInvalid):
		utils.Error(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, services.ErrValidatorNotFound):
		utils.Error(w, http.StatusNotFound, "Validator tidak ditemukan")
	case errors.Is(err, services.ErrValidatorNoBackup):
		utils.Error(w, http.StatusUnprocessableEntity, err.Error())
	case errors.Is(err, services.ErrValidatorEmailTaken):
		utils.Error(w, http.StatusConflict, err.Error())
	default:
		log.Printf("[ERROR] Validator action failed: %v", err)
		utils.Error(w, http.StatusInternalServerError, "Gagal memproses aksi validator")
	}
}
