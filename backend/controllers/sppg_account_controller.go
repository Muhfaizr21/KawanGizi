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

// SppgAccountController melayani pengelolaan akun login dapur SPPG untuk portal
// superadmin (/admin/sppg). Akun ini adalah baris users.role = 'sppg' yang
// terikat pada satu dapur.
type SppgAccountController struct {
	svc services.SppgAccountService
}

// NewSppgAccountController wires the SPPG account controller (Constructor DI).
func NewSppgAccountController(svc services.SppgAccountService) *SppgAccountController {
	return &SppgAccountController{svc: svc}
}

// List mengembalikan seluruh akun login dapur beserta dapur induknya.
//
//	@Summary		Daftar akun SPPG
//	@Description	Superadmin saja. Menampilkan akun login dapur (role sppg) beserta dapur induknya.
//	@Tags			sppg-accounts
//	@Produce		json
//	@Success		200	{object}	models.APIResponse{data=[]models.SppgAccount}
//	@Router			/sppg/accounts [get]
func (c *SppgAccountController) List(w http.ResponseWriter, r *http.Request) {
	list, err := c.svc.List(r.Context())
	if err != nil {
		writeSppgAccountError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Daftar akun SPPG berhasil dimuat", list)
}

// Create membuat akun login dapur baru.
//
//	@Summary		Tambah akun SPPG
//	@Description	Superadmin saja. Membuat akun login yang terikat pada satu dapur.
//	@Tags			sppg-accounts
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		models.CreateSppgAccountRequest	true	"Data akun + dapur"
//	@Success		201		{object}	models.APIResponse{data=models.SppgAccount}
//	@Failure		400		{object}	models.APIResponse
//	@Failure		409		{object}	models.APIResponse
//	@Router			/sppg/accounts [post]
func (c *SppgAccountController) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateSppgAccountRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload tidak valid")
		return
	}

	a, err := c.svc.Create(r.Context(), middlewares.UserID(r.Context()), req)
	if err != nil {
		writeSppgAccountError(w, err)
		return
	}
	utils.Success(w, http.StatusCreated, "Akun SPPG berhasil dibuat", a)
}

// Update memperbarui identitas akun (nama, dapur, status).
//
//	@Summary		Perbarui identitas akun SPPG
//	@Description	Superadmin saja. Mengubah nama, dapur induk, dan status akun.
//	@Tags			sppg-accounts
//	@Accept			json
//	@Param			id		path	string							true	"Akun ID"
//	@Param			payload	body	models.UpdateSppgAccountRequest	true	"Identitas baru"
//	@Success		200		{object}	models.APIResponse{data=models.SppgAccount}
//	@Failure		400		{object}	models.APIResponse
//	@Failure		404		{object}	models.APIResponse
//	@Router			/sppg/accounts/{id} [patch]
func (c *SppgAccountController) Update(w http.ResponseWriter, r *http.Request) {
	var req models.UpdateSppgAccountRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload tidak valid")
		return
	}

	a, err := c.svc.Update(r.Context(), middlewares.UserID(r.Context()), r.PathValue("id"), req)
	if err != nil {
		writeSppgAccountError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Akun SPPG berhasil diperbarui", a)
}

// UpdateCredentials mengganti email dan/atau kata sandi akun dapur.
//
//	@Summary		Perbarui kredensial akun SPPG
//	@Description	Superadmin saja. NewPassword boleh kosong untuk hanya mengganti email.
//	@Tags			sppg-accounts
//	@Accept			json
//	@Param			id		path	string											true	"Akun ID"
//	@Param			payload	body	models.UpdateSppgAccountCredentialsRequest	true	"Email & kata sandi baru"
//	@Success		200		{object}	models.APIResponse{data=models.SppgAccount}
//	@Failure		400		{object}	models.APIResponse
//	@Failure		404		{object}	models.APIResponse
//	@Failure		409		{object}	models.APIResponse
//	@Router			/sppg/accounts/{id}/credentials [patch]
func (c *SppgAccountController) UpdateCredentials(w http.ResponseWriter, r *http.Request) {
	var req models.UpdateSppgAccountCredentialsRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload tidak valid")
		return
	}

	a, err := c.svc.UpdateCredentials(r.Context(), middlewares.UserID(r.Context()), r.PathValue("id"), req)
	if err != nil {
		writeSppgAccountError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Kredensial akun SPPG berhasil diperbarui", a)
}

// Delete menghapus akun login dapur.
//
//	@Summary		Hapus akun SPPG
//	@Description	Superadmin saja. Menghapus akun login dapur.
//	@Tags			sppg-accounts
//	@Param			id	path	string	true	"Akun ID"
//	@Success		200	{object}	models.APIResponse
//	@Failure		404	{object}	models.APIResponse
//	@Router			/sppg/accounts/{id} [delete]
func (c *SppgAccountController) Delete(w http.ResponseWriter, r *http.Request) {
	if err := c.svc.Delete(r.Context(), middlewares.UserID(r.Context()), r.PathValue("id")); err != nil {
		writeSppgAccountError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Akun SPPG berhasil dihapus", nil)
}

// writeSppgAccountError memetakan error domain service ke status HTTP.
func writeSppgAccountError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, services.ErrSppgAccountInvalid):
		utils.Error(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, services.ErrSppgAccountNotFound):
		utils.Error(w, http.StatusNotFound, "Akun SPPG tidak ditemukan")
	case errors.Is(err, services.ErrSppgAccountEmailTaken):
		utils.Error(w, http.StatusConflict, err.Error())
	default:
		log.Printf("[ERROR] SPPG account action failed: %v", err)
		utils.Error(w, http.StatusInternalServerError, "Gagal memproses aksi akun SPPG")
	}
}
