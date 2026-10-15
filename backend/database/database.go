package database

import (
	"backend/config"
	"backend/models"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

var pool *pgxpool.Pool

// Connect opens the PostgreSQL connection pool using the given configuration.
func Connect(ctx context.Context, cfg *config.Config) error {
	dsn := cfg.DatabaseURL
	if dsn == "" {
		dsn = fmt.Sprintf(
			"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
			cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
		)
	}

	p, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return fmt.Errorf("membuat connection pool: %w", err)
	}
	if err := p.Ping(ctx); err != nil {
		return fmt.Errorf("koneksi database gagal: %w", err)
	}

	pool = p
	return nil
}

// Pool exposes the shared connection pool.
func Pool() *pgxpool.Pool {
	return pool
}

// Close shuts down the connection pool.
func Close() {
	if pool != nil {
		pool.Close()
	}
}

// RecordAuditLog inserts an audit event record into audit_logs table.
func RecordAuditLog(ctx context.Context, actorID, action, target, detail string) error {
	if pool == nil {
		return errors.New("database pool not initialized")
	}
	id := "AUDIT-" + uuid.New().String()[:8]
	_, err := pool.Exec(ctx, `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, $3, $4, $5, NOW())
	`, id, actorID, action, target, detail)
	return err
}

const schema = `
CREATE TABLE IF NOT EXISTS users (
	id            TEXT PRIMARY KEY,
	full_name     TEXT NOT NULL,
	email         TEXT UNIQUE NOT NULL,
	password_hash TEXT NOT NULL,
	role          TEXT NOT NULL CHECK (role IN ('superadmin','sppg','validator')),
	npsn          TEXT NOT NULL DEFAULT '',
	school_name   TEXT NOT NULL DEFAULT '',
	sppg_id       TEXT NOT NULL DEFAULT '',
	status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','blacklisted')),
	created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
	id         TEXT PRIMARY KEY,
	user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	token_hash TEXT NOT NULL UNIQUE,
	expires_at TIMESTAMPTZ NOT NULL,
	revoked    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS audit_logs (
	id       TEXT PRIMARY KEY,
	actor_id TEXT NOT NULL,
	action   TEXT NOT NULL,
	target   TEXT,
	detail   TEXT,
	at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scan_logs (
	id             TEXT PRIMARY KEY,
	box_id         TEXT NOT NULL DEFAULT '',
	qr_token       TEXT NOT NULL DEFAULT '',
	batch_id       TEXT NOT NULL DEFAULT '',
	image_ref      TEXT NOT NULL DEFAULT '',
	ai_class       TEXT NOT NULL DEFAULT '',
	ai_confidence  DOUBLE PRECISION NOT NULL DEFAULT 0,
	visual_score   DOUBLE PRECISION NOT NULL DEFAULT 0,
	holding_temp_c DOUBLE PRECISION,
	release_temp_c DOUBLE PRECISION,
	duration_ms    INT,
	verdict        TEXT NOT NULL CHECK (verdict IN ('layak','peringatan','tolak')),
	reason         TEXT NOT NULL DEFAULT '',
	menu_name      TEXT NOT NULL DEFAULT '',
	menu_class     TEXT NOT NULL DEFAULT '',
	menu_display   TEXT NOT NULL DEFAULT '',
	menu_confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
	actor_id       TEXT NOT NULL,
	created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nutrition_items (
	name         TEXT PRIMARY KEY,
	calories     DOUBLE PRECISION NOT NULL DEFAULT 0,
	protein      DOUBLE PRECISION NOT NULL DEFAULT 0,
	fat          DOUBLE PRECISION NOT NULL DEFAULT 0,
	carbohydrate DOUBLE PRECISION NOT NULL DEFAULT 0
);
`

// Migrate creates the schema (idempotent).
func Migrate(ctx context.Context) error {
	_, err := pool.Exec(ctx, schema)
	if err != nil {
		return fmt.Errorf("migrasi schema gagal: %w", err)
	}

	// Tambahkan kolom baru tanpa menghancurkan data
	_, _ = pool.Exec(ctx, "ALTER TABLE scan_logs ADD COLUMN IF NOT EXISTS rating INT DEFAULT 0;")
	_, _ = pool.Exec(ctx, "ALTER TABLE scan_logs ADD COLUMN IF NOT EXISTS feedback TEXT DEFAULT '';")

	return nil
}

type seedUser struct {
	ID, FullName, Email, Password, Role, NPSN, SchoolName, SppgID string
}

// Seed inserts the demo accounts when the users table is empty.
func Seed(ctx context.Context) error {
	var count int
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		return fmt.Errorf("menghitung users: %w", err)
	}
	if count > 0 {
		return nil
	}

	seeds := []seedUser{
		{ID: "usr-superadmin-001", FullName: "Bambang Soediro", Email: "superadmin@kawangizi.id", Password: "SuperAdmin123!", Role: models.RoleSuperadmin},
		{ID: "usr-sppg-001", FullName: "SPPG 01 Menteng Jaya Mandiri", Email: "dapur@sppg01.id", Password: "Sppg123!", Role: models.RoleSppg, SppgID: "SPPG-01"},
		{ID: "usr-validator-001", FullName: "Ibu Siti Aminah, S.Pd.", Email: "validator@sdn01menteng.sch.id", Password: "Validator123!", Role: models.RoleValidator, NPSN: "33.210.130", SchoolName: "SDN Menteng 01 Pagi", SppgID: "SPPG-01"},
	}

	for _, s := range seeds {
		hash, err := bcrypt.GenerateFromPassword([]byte(s.Password), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("hash password %s: %w", s.Email, err)
		}
		_, err = pool.Exec(ctx, `
			INSERT INTO users (id, full_name, email, password_hash, role, npsn, school_name, sppg_id, status)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')`,
			s.ID, s.FullName, s.Email, string(hash), s.Role, s.NPSN, s.SchoolName, s.SppgID,
		)
		if err != nil {
			return fmt.Errorf("seed user %s: %w", s.Email, err)
		}
	}

	log.Printf("✅ Seed %d akun demo selesai\n", len(seeds))
	return nil
}

// SeedNutrition menyinkronkan nutrition_items dari CSV dataset gizi.
// Tabel ini adalah salinan dataset sumber; setiap boot memperbarui data agar
// web dan mobile selalu menghitung makro dari versi dataset yang sama.
func SeedNutrition(ctx context.Context, path string) error {
	file, err := os.Open(path)
	if err != nil {
		log.Printf("⚠️ Dataset gizi %q tidak ditemukan — tabel nutrition_items kosong\n", path)
		return nil
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1

	records, err := reader.ReadAll()
	if err != nil {
		return fmt.Errorf("membaca %s: %w", path, err)
	}

	// Baris pertama adalah header (Calories,Proteins,Fat,Carbohydrate,Name).
	var items []models.NutritionItem
	skipped := 0
	for i, row := range records {
		if i == 0 {
			continue
		}
		if len(row) < 5 {
			skipped++
			continue
		}
		item := models.NutritionItem{Name: strings.TrimSpace(row[4])}
		item.Calories, err = strconv.ParseFloat(strings.TrimSpace(row[0]), 64)
		if err != nil {
			skipped++
			continue
		}
		item.Protein, err = strconv.ParseFloat(strings.TrimSpace(row[1]), 64)
		if err != nil {
			skipped++
			continue
		}
		item.Fat, err = strconv.ParseFloat(strings.TrimSpace(row[2]), 64)
		if err != nil {
			skipped++
			continue
		}
		item.Carbohydrate, err = strconv.ParseFloat(strings.TrimSpace(row[3]), 64)
		if err != nil {
			skipped++
			continue
		}
		if item.Name == "" {
			skipped++
			continue
		}
		items = append(items, item)
	}

	if len(items) == 0 {
		log.Printf("⚠️ Tidak ada baris valid di %s — tabel nutrition_items kosong\n", path)
		return nil
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("memulai transaksi seed gizi: %w", err)
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `DELETE FROM nutrition_items`); err != nil {
		return fmt.Errorf("mengosongkan salinan dataset gizi: %w", err)
	}

	for _, item := range items {
		if _, err := tx.Exec(ctx, `
			INSERT INTO nutrition_items (name, calories, protein, fat, carbohydrate)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (name) DO UPDATE SET
				calories = EXCLUDED.calories,
				protein = EXCLUDED.protein,
				fat = EXCLUDED.fat,
				carbohydrate = EXCLUDED.carbohydrate`,
			item.Name, item.Calories, item.Protein, item.Fat, item.Carbohydrate); err != nil {
			return fmt.Errorf("seed gizi %q: %w", item.Name, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("menutup transaksi seed gizi: %w", err)
	}
	log.Printf("✅ Seed %d item gizi dari %s (%d baris dilewati)\n", len(items), path, skipped)
	return nil
}
