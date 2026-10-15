package config

import (
	"bufio"
	"errors"
	"log"
	"os"
	"strconv"
	"strings"
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

	// WebClientURL: alamat klien web (React) untuk ditampilkan pada landing page root.
	WebClientURL string

	// NutritionDataPath: path CSV dataset gizi (backend/data/dataset_nutrisi_kasar.csv).
	NutritionDataPath string
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
		CORSOrigins:         strings.Split(getEnv("CORS_ORIGINS", "http://localhost:5173,http://localhost:4173,http://localhost:8081,http://127.0.0.1:8081"), ","),

		AIBackendURL: getEnv("AI_BACKEND_URL", "http://127.0.0.1:8083"),

		WebClientURL: getEnv("WEB_CLIENT_URL", "http://localhost:5173"),

		NutritionDataPath: getEnv("NUTRITION_DATA_PATH", "data/dataset_nutrisi_kasar.csv"),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}
	return fallback
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

// Validate checks for critical security misconfigurations in production environments.
func (c *Config) Validate() error {
	if c.AppEnv == "production" {
		if c.JWTSecret == "kawangizi-dev-secret-ganti-di-produksi" || len(c.JWTSecret) < 32 {
			return errors.New("keamanan kritis: JWT_SECRET wajib diganti dengan string acak dengan entropi tinggi (minimal 32 karakter) di lingkungan produksi")
		}
		if c.DBSSLMode == "disable" {
			return errors.New("keamanan kritis: DB_SSLMODE tidak boleh 'disable' di lingkungan produksi; gunakan 'require' atau 'verify-full'")
		}
	}
	return nil
}
