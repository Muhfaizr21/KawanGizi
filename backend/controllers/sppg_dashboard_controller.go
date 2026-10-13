package controllers

import (
	"backend/middlewares"
	"backend/models"
	"backend/services"
	"backend/utils"
	"encoding/json"
	"net/http"
	"strings"
)

type SppgDashboardController struct {
	svc services.SppgDashboardService
}

func NewSppgDashboardController(svc services.SppgDashboardService) *SppgDashboardController {
	return &SppgDashboardController{svc: svc}
}

func (c *SppgDashboardController) resolveSppgID(r *http.Request) string {
	role := middlewares.Role(r.Context())
	callerSppg := middlewares.SppgID(r.Context())

	if role == models.RoleSuperadmin {
		if querySppg := strings.TrimSpace(r.URL.Query().Get("sppgId")); querySppg != "" {
			return querySppg
		}
	}

	if callerSppg != "" {
		return callerSppg
	}

	if querySppg := strings.TrimSpace(r.URL.Query().Get("sppgId")); querySppg != "" {
		return querySppg
	}

	return "SPPG-01"
}

// GetBundle mengambil data rangkuman cockpit operasional dapur terintegrasi
func (c *SppgDashboardController) GetBundle(w http.ResponseWriter, r *http.Request) {
	sppgID := c.resolveSppgID(r)
	bundle, err := c.svc.GetDashboardBundle(r.Context(), sppgID)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Gagal memuat bundle cockpit dapur: "+err.Error())
		return
	}
	utils.Success(w, http.StatusOK, "Bundle cockpit dapur SPPG berhasil dimuat", bundle)
}

// TransitionStage memproses transisi tahapan produksi masak
func (c *SppgDashboardController) TransitionStage(w http.ResponseWriter, r *http.Request) {
	sppgID := c.resolveSppgID(r)
	var payload models.SppgStageTransitionPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "Format payload transisi tahap tidak valid")
		return
	}

	bundle, err := c.svc.TransitionStage(r.Context(), sppgID, &payload)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Gagal memproses transisi tahap: "+err.Error())
		return
	}
	utils.Success(w, http.StatusOK, "Transisi tahapan produksi berhasil diperbarui", bundle)
}

// TriggerEmergency memicu sinyal darurat operasional dapur dan otomatis membuat tiket insiden
func (c *SppgDashboardController) TriggerEmergency(w http.ResponseWriter, r *http.Request) {
	sppgID := c.resolveSppgID(r)
	var payload models.SppgEmergencyTriggerPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		utils.Error(w, http.StatusBadRequest, "Format payload darurat tidak valid")
		return
	}

	actorName := middlewares.UserID(r.Context())
	if actorName == "" {
		actorName = "Petugas Dapur"
	}

	alert, err := c.svc.TriggerEmergency(r.Context(), sppgID, &payload, actorName)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "Gagal memicu sinyal darurat dapur: "+err.Error())
		return
	}
	utils.Success(w, http.StatusCreated, "Sinyal darurat berhasil dikirimkan ke Satgas & Sekolah", alert)
}

// ResolveEmergency menyelesaikan sinyal darurat operasional dapur
func (c *SppgDashboardController) ResolveEmergency(w http.ResponseWriter, r *http.Request) {
	sppgID := c.resolveSppgID(r)
	var payload models.SppgEmergencyResolvePayload
	_ = json.NewDecoder(r.Body).Decode(&payload)

	actorName := middlewares.UserID(r.Context())
	if actorName == "" {
		actorName = "Petugas Dapur"
	}

	if err := c.svc.ResolveEmergency(r.Context(), sppgID, payload.AlertID, actorName); err != nil {
		utils.Error(w, http.StatusInternalServerError, "Gagal menyelesaikan sinyal darurat: "+err.Error())
		return
	}
	utils.Success(w, http.StatusOK, "Sinyal darurat dapur berhasil diselesaikan", nil)
}
