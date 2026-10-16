package config

import (
	"strings"
	"testing"
	"time"
)

func TestValidateRequiresAIBackendURLInProduction(t *testing.T) {
	// Kegagalan yang mencederai user hosting: AI_BACKEND_URL tidak diisi, backend
	// memakai default loopback, lalu setiap pemindaian berakhir 502 tanpa jejak.
	cfg := &Config{
		AppEnv:       "production",
		JWTSecret:    strings.Repeat("a", 32),
		DBSSLMode:    "require",
		AIBackendURL: "http://127.0.0.1:8083",
	}

	if err := cfg.Validate(); err == nil {
		t.Fatal("produksi tanpa AI_BACKEND_URL eksplisit harus ditolak")
	} else if !strings.Contains(err.Error(), "AI_BACKEND_URL") {
		t.Fatalf("pesan galat harus menyebut AI_BACKEND_URL, dapat %v", err)
	}

	cfg.aiBackendURLConfigured = true
	if err := cfg.Validate(); err != nil {
		t.Fatalf("produksi dengan AI_BACKEND_URL eksplisit harus lolos, dapat %v", err)
	}
}

func TestValidateReportsAllProblemsAtOnce(t *testing.T) {
	cfg := &Config{AppEnv: "production", JWTSecret: "pendek", DBSSLMode: "disable"}

	err := cfg.Validate()
	if err == nil {
		t.Fatal("konfigurasi produksi yang rapuh harus ditolak")
	}
	for _, want := range []string{"JWT_SECRET", "DB_SSLMODE", "AI_BACKEND_URL"} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("galat harus sekaligus menyebut %s, dapat %q", want, err.Error())
		}
	}
}

func TestValidateSkipsProductionRulesOutsideProduction(t *testing.T) {
	cfg := &Config{AppEnv: "development"}

	if err := cfg.Validate(); err != nil {
		t.Fatalf("lingkungan pengembangan tidak boleh kena aturan produksi, dapat %v", err)
	}
}

func TestGetEnvSecondsFallsBackOnGarbage(t *testing.T) {
	t.Setenv("AI_TEST_SECONDS", "")
	if got := getEnvSeconds("AI_TEST_SECONDS", 42); got != 42*time.Second {
		t.Fatalf("kosong -> %v, ingin 42s", got)
	}

	t.Setenv("AI_TEST_SECONDS", "bukan-angka")
	if got := getEnvSeconds("AI_TEST_SECONDS", 42); got != 42*time.Second {
		t.Fatalf("nilai rusak -> %v, ingin 42s", got)
	}

	t.Setenv("AI_TEST_SECONDS", "0")
	if got := getEnvSeconds("AI_TEST_SECONDS", 42); got != 42*time.Second {
		t.Fatalf("nol -> %v, ingin 42s", got)
	}

	t.Setenv("AI_TEST_SECONDS", "7")
	if got := getEnvSeconds("AI_TEST_SECONDS", 42); got != 7*time.Second {
		t.Fatalf("nilai valid -> %v, ingin 7s", got)
	}
}

func TestLoadConfigKeepsWriteTimeoutAboveAITimeout(t *testing.T) {
	// Write timeout yang lebih kecil daripada panggilan AI membuat koneksi
	// diputus tepat saat model selesai, sehingga pengguna tidak pernah tahu
	// apa pun terjadi selain "network error".
	t.Setenv("AI_REQUEST_TIMEOUT_SECONDS", "45")
	t.Setenv("SERVER_WRITE_TIMEOUT_SECONDS", "20")

	cfg := LoadConfig()
	if cfg.AIRequestTimeout != 45*time.Second {
		t.Fatalf("AIRequestTimeout = %v, ingin 45s", cfg.AIRequestTimeout)
	}
	if cfg.ServerWriteTimeout <= cfg.AIRequestTimeout {
		t.Fatalf("ServerWriteTimeout (%v) harus lebih besar dari AIRequestTimeout (%v)", cfg.ServerWriteTimeout, cfg.AIRequestTimeout)
	}
}
