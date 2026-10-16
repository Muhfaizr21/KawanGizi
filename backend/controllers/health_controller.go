package controllers

import (
	"backend/models"
	"backend/utils"
	"context"
	"net/http"
	"sync"
	"time"
)

// aiHealthCacheTTL membatasi seberapa sering /api/health menyentuh layanan AI.
// Health check sering dipanggil monitor; model AI tidak perlu dicek tiap detik.
const aiHealthCacheTTL = 15 * time.Second

// AIHealthChecker menguji apakah layanan AI di belakang pemindaian bisa dihubungi.
type AIHealthChecker interface {
	CheckAIHealth(ctx context.Context) models.AIDependencyStatus
}

type HealthController struct {
	landing LandingPage
	ai      AIHealthChecker

	mu       sync.Mutex
	cachedAI models.AIDependencyStatus
	cachedAt time.Time
}

// NewHealthController menerima probe AI opsional. Saat probe tidak diinjeksikan
// (mis. pada test atau deployment yang memang tidak memakai AI), health check
// hanya melaporkan kesehatan backend.
func NewHealthController(landing LandingPage, ai AIHealthChecker) *HealthController {
	return &HealthController{landing: landing, ai: ai}
}

// HealthCheck godoc
// @Summary      Check service health
// @Description  Returns status and timestamp of the backend service, plus the AI dependency probe that decides whether POST /api/scans can succeed
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

	if status, ok := c.aiStatus(r.Context()); ok {
		resp.AI = &status
		resp.ScanReady = status.ScanReady()
	}

	utils.Success(w, http.StatusOK, "Service is healthy", resp)
}

// aiStatus mengembalikan hasil probe AI, memakai cache singkat supaya pemeriksaan
// rutin tidak membebani layanan AI maupun memperlambat health check.
func (c *HealthController) aiStatus(ctx context.Context) (models.AIDependencyStatus, bool) {
	if c.ai == nil {
		return models.AIDependencyStatus{}, false
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.cachedAt.IsZero() && time.Since(c.cachedAt) < aiHealthCacheTTL {
		return c.cachedAI, true
	}

	c.cachedAI = c.ai.CheckAIHealth(ctx)
	c.cachedAt = time.Now()
	return c.cachedAI, true
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