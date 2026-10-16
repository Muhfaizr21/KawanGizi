package models

// APIResponse represents standard API payload
type APIResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Data    any    `json:"data,omitempty"`
	Error   string `json:"error,omitempty"`
}

// AIDependencyStatus adalah hasil probe cepat ke layanan AI (GET {AI_BACKEND_URL}/health).
// Dipakai /api/health supaya "scan tidak jalan" bisa dilihat tanpa harus menebak.
type AIDependencyStatus struct {
	// URL adalah alamat layanan AI yang dikonfigurasi (tanpa kredensial).
	URL string `json:"url"`
	// Reachable bernilai true bila endpoint /health menjawab HTTP 200.
	Reachable bool `json:"reachable"`
	// ModelsReady bernilai true bila layanan AI melaporkan model sudah termuat.
	ModelsReady bool `json:"modelsReady"`
	// LatencyMS mengukur waktu balas probe, berguna membedakan timeout dari connection refused.
	LatencyMS int64 `json:"latencyMs"`
	// Detail memuat pesan error singkat saat Reachable=false.
	Detail string `json:"detail,omitempty"`
}

// ScanReady menandai apakah pemindaian bisa dijalankan dari ujung ke ujung:
// backend hidup dan layanan AI bisa dihubungi.
func (a *AIDependencyStatus) ScanReady() bool {
	return a != nil && a.Reachable && a.ModelsReady
}

// HealthResponse represents health check status
type HealthResponse struct {
	Status    string `json:"status"`
	Service   string `json:"service"`
	Version   string `json:"version"`
	Timestamp string `json:"timestamp"`
	// ScanReady true berarti POST /api/scans akan sampai ke model AI, bukan 502.
	ScanReady bool `json:"scanReady"`
	// AI reports the AI dependency probe result. Nil when probing is disabled.
	AI *AIDependencyStatus `json:"ai,omitempty"`
}
