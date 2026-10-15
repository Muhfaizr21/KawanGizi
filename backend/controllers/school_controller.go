package controllers

import (
	"backend/middlewares"
	"backend/models"
	"backend/services"
	"backend/utils"
	"errors"
	"log"
	"net/http"
	"strings"
)

// SchoolController menangani antarmuka HTTP untuk pangkalan data master sekolah penerima MBG.
type SchoolController struct {
	svc services.SchoolService
}

// NewSchoolController constructor untuk dependency injection.
func NewSchoolController(svc services.SchoolService) *SchoolController {
	return &SchoolController{svc: svc}
}

// List mengembalikan daftar seluruh sekolah binaan MBG sesuai filter query.
func (c *SchoolController) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	filter := models.SchoolFilter{
		Search: q.Get("search"),
		Level:  q.Get("level"),
		Status: q.Get("status"),
		City:   q.Get("city"),
		SPPGID: q.Get("sppgId"),
	}

	list, err := c.svc.List(r.Context(), filter)
	if err != nil {
		log.Printf("[ERROR] Failed to list schools: %v", err)
		utils.Error(w, http.StatusInternalServerError, "Gagal memuat pangkalan data sekolah")
		return
	}
	utils.Success(w, http.StatusOK, "Pangkalan data master sekolah berhasil dimuat", list)
}

// GetByNPSN mengembalikan profil sekolah tunggal berdasarkan NPSN.
func (c *SchoolController) GetByNPSN(w http.ResponseWriter, r *http.Request) {
	npsn := r.PathValue("npsn")
	sch, err := c.svc.GetByNPSN(r.Context(), npsn)
	if err != nil {
		writeSchoolError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Data profil sekolah berhasil dimuat", sch)
}

// Create mendaftarkan sekolah binaan baru ke dalam klaster distribusi last-mile MBG.
func (c *SchoolController) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateSchoolRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload pendaftaran sekolah tidak valid: "+err.Error())
		return
	}

	actorID := middlewares.UserID(r.Context())
	if actorID == "" {
		actorID = "superadmin-01"
	}
	actor := models.User{
		ID:       actorID,
		FullName: "Administrator Pengelola MBG",
		Role:     models.RoleSuperadmin,
	}

	created, err := c.svc.Create(r.Context(), req, actor)
	if err != nil {
		writeSchoolError(w, err)
		return
	}
	utils.Success(w, http.StatusCreated, "Sekolah binaan baru berhasil didaftarkan ke sistem MBG", created)
}

// CreateOwned mendaftarkan sekolah binaannya yang baru milik dapur SPPG
// yang sedang login. Dapur penyuplai selalu diambil dari klaim token sehingga
// SPPG tidak dapat mendaftarkan sekolah pada dapur lain.
func (c *SchoolController) CreateOwned(w http.ResponseWriter, r *http.Request) {
	ownerSppgID := strings.TrimSpace(middlewares.SppgID(r.Context()))
	if ownerSppgID == "" {
		utils.Error(w, http.StatusForbidden, "Akun ini tidak terikat pada dapur SPPG sehingga tidak dapat menambah sekolah")
		return
	}

	var req models.CreateSchoolRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload pendaftaran sekolah tidak valid: "+err.Error())
		return
	}
	req.SPPGID = ownerSppgID

	actor := models.User{
		ID:       middlewares.UserID(r.Context()),
		FullName: "Dapur SPPG",
		Role:     middlewares.Role(r.Context()),
	}

	created, err := c.svc.Create(r.Context(), req, actor)
	if err != nil {
		writeSchoolError(w, err)
		return
	}
	utils.Success(w, http.StatusCreated, "Sekolah binaannya berhasil didaftarkan", created)
}

// ReassignSPPG mengalihkan dapur penyedia/penyuplai makanan bergizi untuk sekolah ini.
func (c *SchoolController) ReassignSPPG(w http.ResponseWriter, r *http.Request) {
	npsn := r.PathValue("npsn")
	var req models.ReassignSchoolSPPGRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload pengalihan dapur SPPG tidak valid")
		return
	}

	actorID := middlewares.UserID(r.Context())
	if actorID == "" {
		actorID = "superadmin-01"
	}
	actor := models.User{
		ID:       actorID,
		FullName: "Administrator Pengelola MBG",
		Role:     models.RoleSuperadmin,
	}

	updated, err := c.svc.ReassignSPPG(r.Context(), npsn, req, actor)
	if err != nil {
		writeSchoolError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Dapur penyedia SPPG berhasil dialihkan", updated)
}

// UpdateContacts memperbarui kontak darurat kepala sekolah, UKS, dan Puskesmas rujukan.
func (c *SchoolController) UpdateContacts(w http.ResponseWriter, r *http.Request) {
	npsn := r.PathValue("npsn")
	var req models.UpdateSchoolContactsRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload kontak darurat sekolah tidak valid")
		return
	}

	actorID := middlewares.UserID(r.Context())
	if actorID == "" {
		actorID = "superadmin-01"
	}
	actor := models.User{
		ID:       actorID,
		FullName: "Administrator Pengelola MBG",
		Role:     models.RoleSuperadmin,
	}

	updated, err := c.svc.UpdateContacts(r.Context(), npsn, req, actor)
	if err != nil {
		writeSchoolError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Kontak darurat dan Puskesmas rujukan berhasil diperbarui", updated)
}

// ToggleStatus mengubah status operasional sekolah (aktif, nonaktif sementara, radius warning).
func (c *SchoolController) ToggleStatus(w http.ResponseWriter, r *http.Request) {
	npsn := r.PathValue("npsn")
	var req models.ToggleSchoolStatusRequest
	if err := decodeJSON(r, &req); err != nil {
		utils.Error(w, http.StatusBadRequest, "Payload status operasional tidak valid")
		return
	}

	actorID := middlewares.UserID(r.Context())
	if actorID == "" {
		actorID = "superadmin-01"
	}
	actor := models.User{
		ID:       actorID,
		FullName: "Administrator Pengelola MBG",
		Role:     models.RoleSuperadmin,
	}

	updated, err := c.svc.ToggleStatus(r.Context(), npsn, req, actor)
	if err != nil {
		writeSchoolError(w, err)
		return
	}
	utils.Success(w, http.StatusOK, "Status operasional sekolah berhasil diperbarui", updated)
}

func writeSchoolError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, services.ErrSchoolNotFound):
		utils.Error(w, http.StatusNotFound, err.Error())
	case errors.Is(err, services.ErrSchoolNPSNExists):
		utils.Error(w, http.StatusConflict, err.Error())
	case errors.Is(err, services.ErrInvalidNPSN),
		errors.Is(err, services.ErrSchoolNameRequired),
		errors.Is(err, services.ErrMissingSPPG),
		errors.Is(err, services.ErrInvalidReassignReason),
		errors.Is(err, services.ErrInvalidSchoolStatus),
		errors.Is(err, services.ErrMissingStatusReason),
		errors.Is(err, services.ErrMissingContact):
		utils.Error(w, http.StatusBadRequest, err.Error())
	default:
		log.Printf("[ERROR] School operation failed: %v", err)
		utils.Error(w, http.StatusInternalServerError, "Gagal memproses data master sekolah")
	}
}
