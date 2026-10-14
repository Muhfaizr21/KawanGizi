package repositories

import (
	"backend/database"
	"backend/models"
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ErrNotFound is returned when a record does not exist.
var ErrNotFound = errors.New("data tidak ditemukan")

// UserRepository defines persistence operations for auth-related data.
type UserRepository interface {
	GetByEmail(ctx context.Context, email string) (*models.User, error)
	GetByID(ctx context.Context, id string) (*models.User, error)
	Create(ctx context.Context, user *models.User) error
	UpdatePasswordHash(ctx context.Context, userID, passwordHash string) error
	UpdateFullName(ctx context.Context, userID, fullName string) error
	SaveRefreshToken(ctx context.Context, userID, tokenHash string, expiresAt time.Time) error
	FindRefreshToken(ctx context.Context, tokenHash string) (userID string, expiresAt time.Time, revoked bool, err error)
	RevokeRefreshToken(ctx context.Context, tokenHash string) error
}

type pgUserRepository struct{}

// NewUserRepository returns the PostgreSQL-backed UserRepository.
func NewUserRepository() UserRepository {
	return &pgUserRepository{}
}

func (r *pgUserRepository) scanUser(row pgx.Row) (*models.User, error) {
	u := &models.User{}
	var created time.Time
	err := row.Scan(&u.ID, &u.FullName, &u.Email, &u.PasswordHash, &u.Role,
		&u.NPSN, &u.SchoolName, &u.SppgID, &u.Status, &created)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	u.CreatedAt = created.UTC().Format(time.RFC3339)
	return u, nil
}

const userColumns = `id, full_name, email, password_hash, role, npsn, school_name, sppg_id, status, created_at`

func (r *pgUserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	return r.scanUser(database.Pool().QueryRow(ctx,
		"SELECT "+userColumns+" FROM users WHERE email = $1", email))
}

func (r *pgUserRepository) GetByID(ctx context.Context, id string) (*models.User, error) {
	return r.scanUser(database.Pool().QueryRow(ctx,
		"SELECT "+userColumns+" FROM users WHERE id = $1", id))
}

func (r *pgUserRepository) Create(ctx context.Context, user *models.User) error {
	_, err := database.Pool().Exec(ctx, `
		INSERT INTO users (id, full_name, email, password_hash, role, npsn, school_name, sppg_id, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		user.ID, user.FullName, user.Email, user.PasswordHash, user.Role,
		user.NPSN, user.SchoolName, user.SppgID, user.Status)
	return err
}

// UpdatePasswordHash menimpa hash kata sandi milik akun.
func (r *pgUserRepository) UpdatePasswordHash(ctx context.Context, userID, passwordHash string) error {
	_, err := database.Pool().Exec(ctx,
		"UPDATE users SET password_hash = $2 WHERE id = $1", userID, passwordHash)
	return err
}

// UpdateFullName menimpa nama tampilan akun. Untuk akun validator, nama pada
// validator_profiles juga disinkronkan agar daftar di panel admin tetap konsisten.
func (r *pgUserRepository) UpdateFullName(ctx context.Context, userID, fullName string) error {
	var id string
	err := database.Pool().QueryRow(ctx, `
		WITH updated AS (
			UPDATE users SET full_name = $2 WHERE id = $1 RETURNING id, role
		), synced AS (
			UPDATE validator_profiles SET name = $2
			WHERE user_id = (SELECT id FROM updated WHERE role = 'validator')
		)
		SELECT id FROM updated`, userID, fullName).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

func (r *pgUserRepository) SaveRefreshToken(ctx context.Context, userID, tokenHash string, expiresAt time.Time) error {	_, err := database.Pool().Exec(ctx, `
		INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
		VALUES ($1, $2, $3, $4)`,
		uuid.NewString(), userID, tokenHash, expiresAt)
	return err
}

func (r *pgUserRepository) FindRefreshToken(ctx context.Context, tokenHash string) (string, time.Time, bool, error) {
	var userID string
	var expiresAt time.Time
	var revoked bool
	err := database.Pool().QueryRow(ctx, `
		SELECT user_id, expires_at, revoked FROM refresh_tokens WHERE token_hash = $1`,
		tokenHash).Scan(&userID, &expiresAt, &revoked)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", time.Time{}, false, ErrNotFound
	}
	return userID, expiresAt, revoked, err
}

func (r *pgUserRepository) RevokeRefreshToken(ctx context.Context, tokenHash string) error {
	_, err := database.Pool().Exec(ctx,
		"UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1", tokenHash)
	return err
}
