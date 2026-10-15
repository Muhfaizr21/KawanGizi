package controllers

import (
	"backend/middlewares"
	"backend/models"
	"backend/services"
	"backend/utils"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
)

// maxImageBytes membatasi unggahan gambar pemindaian (8 MB).
const maxImageBytes = 8 << 20

// ScanController handles scan submission (QR + visual AI) and recent history.
type ScanController struct {
	scanSvc services.ScanService
}

// NewScanController wires the scan controller with its service (Constructor DI).
func NewScanController(scanSvc services.ScanService) *ScanController {
	return &ScanController{scanSvc: scanSvc}
}

// Submit godoc
// @Summary Submit a box scan (QR token + food photo) for AI quality analysis
// @Accept multipart/form-data
// @Produce json
// @Param image formData file true "foto isi boks (jpg/png, maks 8MB)"
// @Param qrToken formData string false "token QR boks berformat MBG-..."
// @Param boxId formData string false "id boks (diturunkan dari token QR bila kosong)"
// @Param batchId formData string false "id batch"
// @Param holdingTempC formData number false "suhu holding boks (°C)"
// @Param releaseTempC formData number false "suhu masak inti saat lepas dapur (°C)"
// @Param durationMs formData int false "lama inspeksi visual dalam milidetik (audit ketelitian Pasal 14)"
// @Param items formData string false "daftar bahan menu (format 'Nama:gram' dipisah koma, mis. 'Nasi:120,Ayam goreng paha:60')"
// @Success 200 {object} models.ScanResult
// @Failure 400 {object} models.APIResponse
// @Failure 502 {object} models.APIResponse
// @Router /api/scans [post]
func (c *ScanController) Submit(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(maxImageBytes); err != nil {
		utils.Error(w, http.StatusBadRequest, "payload multipart tidak valid")
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "file gambar wajib diunggah (field image)")
		return
	}
	defer file.Close()

	image, err := io.ReadAll(io.LimitReader(file, maxImageBytes+1))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "gagal membaca file gambar")
		return
	}
	if len(image) > maxImageBytes {
		utils.Error(w, http.StatusBadRequest, "ukuran gambar maksimal 8MB")
		return
	}
	if len(image) == 0 {
		utils.Error(w, http.StatusBadRequest, "file gambar kosong")
		return
	}

	holdingTempC, err := parseOptionalFloat(r.FormValue("holdingTempC"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "holdingTempC harus berupa angka")
		return
	}
	releaseTempC, err := parseOptionalFloat(r.FormValue("releaseTempC"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "releaseTempC harus berupa angka")
		return
	}

	durationMS, err := parseOptionalInt(r.FormValue("durationMs"))
	if err != nil {
		utils.Error(w, http.StatusBadRequest, "durationMs harus berupa bilangan bulat")
		return
	}

	persist := r.FormValue("persist") != "false" && r.FormValue("preview") != "true"
	rating, _ := strconv.Atoi(r.FormValue("rating"))
	feedback := r.FormValue("feedback")

	// Mode analisis yang dipilih pengguna. Absen berarti kelayakan, supaya klien
	// lama (mobile, klien pihak ketiga) tetap mendapat laporan yang berguna.
	mode := strings.ToLower(strings.TrimSpace(r.FormValue("mode")))
	if mode == "" {
		mode = models.ScanModeKelayakan
	}
	if !models.ValidScanMode(mode) {
		utils.Error(w, http.StatusBadRequest, "mode harus 'kelayakan' atau 'nutrisi'")
		return
	}

	result, err := c.scanSvc.SubmitScan(r.Context(), services.ScanSubmission{
		ActorID:      middlewares.UserID(r.Context()),
		Image:        image,
		FileName:     header.Filename,
		QRToken:      r.FormValue("qrToken"),
		BoxID:        r.FormValue("boxId"),
		BatchID:      r.FormValue("batchId"),
		Items:        r.FormValue("items"),
		HoldingTempC: holdingTempC,
		ReleaseTempC: releaseTempC,
		DurationMS:   durationMS,
		Persist:      persist,
		Rating:       rating,
		Feedback:     feedback,
		Mode:         mode,
	})
	if err != nil {
		switch {
		case errors.Is(err, services.ErrImageRequired):
			utils.Error(w, http.StatusBadRequest, err.Error())
		case errors.Is(err, services.ErrAIUnavailable):
			utils.Error(w, http.StatusBadGateway, "AI service tidak dapat dihubungi, coba lagi")
		default:
			utils.Error(w, http.StatusInternalServerError, "gagal memproses pemindaian")
		}
		return
	}

	utils.Success(w, http.StatusOK, "scan berhasil dianalisis", result)
}

// Recent godoc
// @Summary List the most recent scan logs
// @Produce json
// @Success 200 {object} models.APIResponse
// @Router /api/scans/recent [get]
func (c *ScanController) Recent(w http.ResponseWriter, r *http.Request) {
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil {
		limit = 20
	}

	logs, err := c.scanSvc.ListRecent(r.Context(), middlewares.UserID(r.Context()), limit)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "gagal mengambil riwayat scan")
		return
	}
	utils.Success(w, http.StatusOK, "riwayat scan terbaru", logs)
}

type UpdateFeedbackReq struct {
	Rating   int      `json:"rating"`
	Feedback string   `json:"feedback"`
	TempC    *float64 `json:"tempC"`
}

func (c *ScanController) UpdateFeedback(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		parts := strings.Split(r.URL.Path, "/")
		id = parts[len(parts)-1]
	}

	var req UpdateFeedbackReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.Error(w, http.StatusBadRequest, "format JSON tidak valid")
		return
	}

	if err := c.scanSvc.UpdateFeedback(r.Context(), id, req.Rating, req.Feedback, req.TempC); err != nil {
		utils.Error(w, http.StatusInternalServerError, "gagal menyimpan umpan balik scan")
		return
	}

	utils.Success(w, http.StatusOK, "catatan berhasil disimpan", nil)
}

func (c *ScanController) DeleteScan(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		parts := strings.Split(r.URL.Path, "/")
		id = parts[len(parts)-1]
	}
	if id == "all" {
		c.DeleteAllScans(w, r)
		return
	}
	actorID := middlewares.UserID(r.Context())

	if err := c.scanSvc.DeleteScan(r.Context(), actorID, id); err != nil {
		utils.Error(w, http.StatusInternalServerError, "gagal menghapus scan")
		return
	}
	utils.Success(w, http.StatusOK, "scan berhasil dihapus", nil)
}

func (c *ScanController) DeleteAllScans(w http.ResponseWriter, r *http.Request) {
	actorID := middlewares.UserID(r.Context())
	if err := c.scanSvc.DeleteAllScans(r.Context(), actorID); err != nil {
		utils.Error(w, http.StatusInternalServerError, "gagal menghapus semua scan")
		return
	}
	utils.Success(w, http.StatusOK, "semua riwayat scan berhasil dihapus", nil)
}

// parseOptionalFloat parses a form value into *float64; empty input yields nil.
func parseOptionalFloat(value string) (*float64, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, nil
	}
	parsed, err := strconv.ParseFloat(trimmed, 64)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

// parseOptionalInt parses a form value into *int; empty input yields nil.
func parseOptionalInt(value string) (*int, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, nil
	}
	parsed, err := strconv.Atoi(trimmed)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}
