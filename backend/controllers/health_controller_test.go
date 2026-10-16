package controllers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"backend/models"
)

// aiHealthStubStub adalah probe AI palsu untuk menguji how health check
// memetakan hasil probe ke respons publik.
type aiHealthStubStub struct {
	status models.AIDependencyStatus
	calls  int32
}

func (s *aiHealthStubStub) CheckAIHealth(context.Context) models.AIDependencyStatus {
	atomic.AddInt32(&s.calls, 1)
	return s.status
}

func healthResponseBody(t *testing.T, ctrl *HealthController) models.HealthResponse {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	ctrl.HealthCheck(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var envelope struct {
		Success bool                  `json:"success"`
		Data    models.HealthResponse `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("respons health tidak bisa diurai: %v", err)
	}
	return envelope.Data
}

func TestHealthCheckMarksScanNotReadyWhenAIIsUnreachable(t *testing.T) {
	// Inilah kondisi produksi yang membuat semua pemindaian berakhir 502: backend
	// hidup, layanan AI tidak ada di alamat yang dikonfigurasi.
	stub := &aiHealthStubStub{status: models.AIDependencyStatus{
		URL:       "http://127.0.0.1:8083",
		Reachable: false,
		Detail:    "tidak dapat menghubungi layanan AI",
	}}
	ctrl := NewHealthController(LandingPage{AppEnv: "production"}, stub)

	data := healthResponseBody(t, ctrl)
	if data.ScanReady {
		t.Fatal("scanReady harus false saat layanan AI tidak terjangkau")
	}
	if data.Status != "ok" {
		t.Fatalf("backend sendiri masih hidup, status = %q", data.Status)
	}
	if data.AI == nil {
		t.Fatal("rincian AI harus disertakan supaya penyebab 502 terlihat langsung")
	}
	if !strings.Contains(data.AI.Detail, "tidak dapat menghubungi") {
		t.Fatalf("detail AI hilang: %+v", data.AI)
	}
}

func TestHealthCheckMarksScanReadyWhenAIIsHealthy(t *testing.T) {
	stub := &aiHealthStubStub{status: models.AIDependencyStatus{
		URL:         "http://127.0.0.1:8083",
		Reachable:   true,
		ModelsReady: true,
		LatencyMS:   12,
	}}
	ctrl := NewHealthController(LandingPage{AppEnv: "production"}, stub)

	data := healthResponseBody(t, ctrl)
	if !data.ScanReady {
		t.Fatalf("scanReady harus true saat layanan AI siap, dapat %+v", data.AI)
	}
}

func TestHealthCheckCachesAIProbe(t *testing.T) {
	// /api/health dipanggil monitor berkali-kali; setiap panggilan tidak boleh
	// membebani layanan AI dengan request baru.
	stub := &aiHealthStubStub{status: models.AIDependencyStatus{Reachable: true, ModelsReady: true}}
	ctrl := NewHealthController(LandingPage{AppEnv: "production"}, stub)

	for i := 0; i < 5; i++ {
		healthResponseBody(t, ctrl)
	}
	if got := atomic.LoadInt32(&stub.calls); got != 1 {
		t.Fatalf("probe AI harus di-cache, dapat %d panggilan", got)
	}
}

func TestHealthCheckWorksWithoutAIDependency(t *testing.T) {
	ctrl := NewHealthController(LandingPage{AppEnv: "development"}, nil)

	data := healthResponseBody(t, ctrl)
	if data.ScanReady {
		t.Fatal("tanpa probe AI, scanReady harus default false")
	}
	if data.AI != nil {
		t.Fatalf("rincian AI harus dikosongkan saat probe tidak dikonfigurasi, dapat %+v", data.AI)
	}
}
