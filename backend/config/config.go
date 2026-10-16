package config

import (
	"bufio"
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port   string
	AppEnv string

	DatabaseURL string

	DBHost     string
	DBPort     int
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	JWTSecret           string
	JWTAccessTTLMinutes int
	JWTRefreshTTLHours  int
	CORSOrigins         []string

	AIBackendURL string

	// AIRequestTimeout: batas waktu satu panggilan ke layanan AI. Harus lebih
	// besar dari AIHealthCheckTimeout dan tetap di bawah ServerWriteTimeout
	// supaya respons AI sempat sampai ke pengguna sebelum soket ditutup.
	AIRequestTimeout time.Duration

	// AIHealthCheckTimeout: batas waktuprobe cepat ke /health milik layanan AI
	// yang dipanggil dari /api/health.
	AIHealthCheckTimeout time.Duration

	// ServerReadTimeout dan ServerWriteTimeout dipakai server HTTP. WriteTimeout
	// tidak boleh lebih kecil dari AIRequestTimeout, karena pemindaian menunggu
	// inferensi model yang bisa memakan puluhan detik.
	ServerReadTimeout  time.Duration
	ServerWriteTimeout time.Duration

	// WebClientURL: alamat klien web (React) untuk ditampilkan pada landing page root.
	WebClientURL string

	// NutritionDataPath: path CSV dataset gizi (backend/data/dataset_nutrisi_kasar.csv).
	NutritionDataPath string

	// aiBackendURLConfigured mencatat apakah AI_BACKEND_URL benar-benar diisi
	// lewat environment. Tanpa penanda ini, produksi diam-diam memakai default
	// loopback dan layanan AI di container lain tidak pernah dihubungi.
	aiBackendURLConfigured bool
}

// LoadConfig initializes application configurations from environment variables with sensible defaults
func LoadConfig() *Config {
	loadEnvFile(".env.local")
	loadEnvFile(".env")

	port := getEnv("PORT", "8080")
	appEnv := getEnv("APP_ENV", "development")

	dbPort, err := strconv.Atoi(getEnv("DB_PORT", "5432"))
	if err != nil {
		dbPort = 5432
	}

	accessTTL, err := strconv.Atoi(getEnv("JWT_ACCESS_TTL_MINUTES", "15"))
	if err != nil {
		accessTTL = 15
	}

	refreshTTL, err := strconv.Atoi(getEnv("JWT_REFRESH_TTL_HOURS", "168"))
	if err != nil {
		refreshTTL = 168
	}

	aiRequestTimeout := getEnvSeconds("AI_REQUEST_TIMEOUT_SECONDS", 60)
	aiHealthTimeout := getEnvSeconds("AI_HEALTH_CHECK_TIMEOUT_SECONDS", 3)
	writeTimeout := getEnvSeconds("SERVER_WRITE_TIMEOUT_SECONDS", 90)
	readTimeout := getEnvSeconds("SERVER_READ_TIMEOUT_SECONDS", 15)

	// Write timeout harus selalu lebih longgar daripada panggilan AI, kalau tidak
	// koneksi diputus tepat saat model selesai inferensi dan pengguna hanya melihat
	// "network error" alih-alih hasil pindai.
	if writeTimeout <= aiRequestTimeout {
		writeTimeout = aiRequestTimeout + 30*time.Second
	}

	return &Config{
		Port:   port,
		AppEnv: appEnv,

		DatabaseURL: getEnv("DATABASE_URL", ""),

		DBHost:     getEnv("DB_HOST", "127.0.0.1"),
		DBPort:     dbPort,
		DBUser:     getEnv("DB_USER", "kawangizi"),
		DBPassword: getEnv("DB_PASSWORD", "kawangizi123"),
		DBName:     getEnv("DB_NAME", "kawangizi"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),

		JWTSecret:           getEnv("JWT_SECRET", "kawangizi-dev-secret-ganti-di-produksi"),
		JWTAccessTTLMinutes: accessTTL,
		JWTRefreshTTLHours:  refreshTTL,
		CORSOrigins:         strings.Split(getEnv("CORS_ORIGINS", "https://kawangizi.rentgoindonesia.com,http://localhost:5173,http://localhost:4173,http://localhost:8081,http://127.0.0.1:8081,http://localhost:8084"), ","),

		AIBackendURL:         getEnv("AI_BACKEND_URL", "http://127.0.0.1:8083"),
		AIRequestTimeout:     aiRequestTimeout,
		AIHealthCheckTimeout: aiHealthTimeout,
		ServerReadTimeout:    readTimeout,
		ServerWriteTimeout:   writeTimeout,

		WebClientURL: getEnv("WEB_CLIENT_URL", "http://localhost:5173"),

		NutritionDataPath: getEnv("NUTRITION_DATA_PATH", "data/dataset_nutrisi_kasar.csv"),

		aiBackendURLConfigured: strings.TrimSpace(os.Getenv("AI_BACKEND_URL")) != "",
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}
	return fallback
}

// getEnvSeconds membaca durasi dalam detik dari environment. Nilai rusak atau
// non-positif tidak boleh menjatuhkan konfigurasi ke angka yang membuat timeout.
func getEnvSeconds(key string, fallback int) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return time.Duration(fallback) * time.Second
	}
	seconds, err := strconv.Atoi(raw)
	if err != nil || seconds <= 0 {
		return time.Duration(fallback) * time.Second
	}
	return time.Duration(seconds) * time.Second
}

// loadEnvFile reads a dotenv-style file without overriding existing environment variables.
// A missing file is ignored so the application still runs with defaults.
func loadEnvFile(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, found := strings.Cut(line, "=")
		if !found {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		value = strings.Trim(value, `"'`)
		if key == "" {
			continue
		}
		if _, exists := os.LookupEnv(key); !exists {
			os.Setenv(key, value)
		}
	}
	if err := scanner.Err(); err != nil {
		log.Printf("[CONFIG] Peringatan membaca berkas env %s: %v", path, err)
	}
}

// Validate collects every critical misconfiguration instead of failing on the
// first one, so one deploy run surfaces the whole list of problems to fix.
func (c *Config) Validate() error {
	if c.AppEnv != "production" {
		return nil
	}

	var problems []string
	if c.JWTSecret == "kawangizi-dev-secret-ganti-di-produksi" || len(c.JWTSecret) < 32 {
		problems = append(problems, "keamanan kritis: JWT_SECRET wajib diganti dengan string acak dengan entropi tinggi (minimal 32 karakter) di lingkungan produksi")
	}
	if c.DBSSLMode == "disable" {
		problems = append(problems, "keamanan kritis: DB_SSLMODE tidak boleh 'disable' di lingkungan produksi; gunakan 'require' atau 'verify-full'")
	}
	if !c.aiBackendURLConfigured || strings.TrimSpace(c.AIBackendURL) == "" {
		problems = append(problems, fmt.Sprintf("konfigurasi kritis: AI_BACKEND_URL wajib diisi di lingkungan produksi (sekarang %q); tanpa itu layanan AI tidak pernah dihubungi dan setiap pemindaian berakhir 502", c.AIBackendURL))
	}
	if len(problems) == 0 {
		return nil
	}
	return errors.New(strings.Join(problems, "; "))
}
