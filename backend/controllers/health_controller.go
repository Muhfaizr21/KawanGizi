package controllers

import (
	"backend/models"
	"backend/utils"
	"net/http"
	"time"
)

type HealthController struct {
	landing LandingPage
}

func NewHealthController(landing LandingPage) *HealthController {
	return &HealthController{landing: landing}
}

// HealthCheck godoc
// @Summary      Check service health
// @Description  Returns status and timestamp of the backend service
// @Tags         health
// @Produce      json
// @Success      200  {object}  models.APIResponse{data=models.HealthResponse}
// @Router       /api/health [get]
func (c *HealthController) HealthCheck(w http.ResponseWriter, r *http.Request) {
	resp := models.HealthResponse{
		Status:    "ok",
		Service:   "MBG Backend API (Golang Clean MVC)",
		Version:   "1.0.0",
		Timestamp: time.Now().Format(time.RFC3339),
	}
	utils.Success(w, http.StatusOK, "Service is healthy", resp)
}

// Root godoc
// @Summary      Landing page of the service
// @Description  Serves the branded KawanGizi landing page with a welcome popup for browsers, and the JSON service banner for API clients.
// @Tags         health
// @Produce      json
// @Produce      html
// @Success      200  {object}  models.APIResponse
// @Router       / [get]
func (c *HealthController) Root(w http.ResponseWriter, r *http.Request) {
	if wantsHTML(r.Header.Get("Accept")) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Vary", "Accept")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(c.landing.Render())
		return
	}

	utils.Success(w, http.StatusOK, "KawanGizi Backend API aktif", map[string]string{
		"service": "MBG Backend API (Golang Clean MVC)",
		"env":     c.landing.AppEnv,
		"docs":    "/swagger/index.html",
		"health":  "/api/health",
	})
}
