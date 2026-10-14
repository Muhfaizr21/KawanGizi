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

// Aksi audit untuk pengelolaan akun login dapur SPPG.
const (
	AuditSppgAccountCreated     = "sppg.account.create"
	AuditSppgAccountUpdated     = "sppg.account.update"
	AuditSppgAccountCredentials = "sppg.account.credentials.update"
	AuditSppgAccountDeleted     = "sppg.account.delete"
)

// CreateSppgAccountParams adalah data yang sudah divalidasi service.
type CreateSppgAccountParams struct {
	FullName     string
	Email        string
	PasswordHash string
	SppgID       string
	Status       string
}

// UpdateSppgAccountParams adalah identitas akun yang boleh diubah superadmin.
type UpdateSppgAccountParams struct {
	FullName string
	SppgID   string
	Status   string
	Reason   string
}

// SppgAccountRepository mengelola akun login dapur (users.role = 'sppg').
type SppgAccountRepository interface {
	List(ctx context.Context) ([]models.SppgAccount, error)
	Get(ctx context.Context, id string) (*models.SppgAccount, error)
	Create(ctx context.Context, p CreateSppgAccountParams, actorID string) (*models.SppgAccount, error)
	Update(ctx context.Context, id string, p UpdateSppgAccountParams, actorID string) (*models.SppgAccount, error)
	UpdateCredentials(ctx context.Context, id, email, passwordHash, actorID, reason string) (*models.SppgAccount, error)
	Delete(ctx context.Context, id, actorID string) error
}

type pgSppgAccountRepository struct{}

// NewSppgAccountRepository returns the PostgreSQL-backed SppgAccountRepository.
func NewSppgAccountRepository() SppgAccountRepository {
	return &pgSppgAccountRepository{}
}

const sppgAccountColumns = `
	u.id, u.full_name, u.email, COALESCE(u.sppg_id, ''),
	COALESCE(k.name, ''), COALESCE(k.code, ''), u.status, u.created_at`

const sppgAccountFrom = `
	FROM users u
	LEFT JOIN sppg_kitchens k ON k.id = u.sppg_id
	WHERE u.role = 'sppg'`

func (r *pgSppgAccountRepository) scanAccount(row pgx.Row) (*models.SppgAccount, error) {
	a := &models.SppgAccount{}
	var created time.Time
	err := row.Scan(&a.ID, &a.FullName, &a.Email, &a.SppgID,
		&a.KitchenName, &a.KitchenCode, &a.Status, &created)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	a.CreatedAt = created.UTC().Format(time.RFC3339)
	return a, nil
}

func (r *pgSppgAccountRepository) List(ctx context.Context) ([]models.SppgAccount, error) {
	rows, err := database.Pool().Query(ctx,
		"SELECT "+sppgAccountColumns+sppgAccountFrom+" ORDER BY u.created_at ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.SppgAccount, 0)
	for rows.Next() {
		a, err := r.scanAccount(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *a)
	}
	return list, rows.Err()
}

func (r *pgSppgAccountRepository) Get(ctx context.Context, id string) (*models.SppgAccount, error) {
	return r.scanAccount(database.Pool().QueryRow(ctx,
		"SELECT "+sppgAccountColumns+sppgAccountFrom+" AND u.id = $1", id))
}

// Create membuat akun login dapur. SppgID wajib menunjuk dapur yang ada; bila
// tidak, INSERT ... SELECT tidak menghasilkan baris dan ErrInvalidReference
// dikembalikan — mencegah akun menggantung tanpa dapur.
func (r *pgSppgAccountRepository) Create(ctx context.Context, p CreateSppgAccountParams, actorID string) (*models.SppgAccount, error) {
	tx, err := database.Pool().Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	userID := "usr-" + uuid.NewString()
	tag, err := tx.Exec(ctx, `
		INSERT INTO users (id, full_name, email, password_hash, role, npsn, school_name, sppg_id, status)
		SELECT $1, $2, $3, $4, 'sppg', '', '', k.id, $6
		FROM sppg_kitchens k WHERE k.id = $5`,
		userID, p.FullName, p.Email, p.PasswordHash, p.SppgID, p.Status)
	if err != nil {
		return nil, mapWriteError(err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrInvalidReference
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, $3, $4, $5, NOW())`,
		"AUDIT-"+uuid.NewString()[:8], actorID, AuditSppgAccountCreated, userID,
		auditDetail("email", p.Email, "akun SPPG dibuat")); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.Get(ctx, userID)
}

func (r *pgSppgAccountRepository) Update(ctx context.Context, id string, p UpdateSppgAccountParams, actorID string) (*models.SppgAccount, error) {
	tx, err := database.Pool().Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var exists int
	err = tx.QueryRow(ctx, `SELECT 1 FROM users WHERE id = $1 AND role = 'sppg'`, id).Scan(&exists)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if p.SppgID != "" {
		var kit int
		err = tx.QueryRow(ctx, `SELECT 1 FROM sppg_kitchens WHERE id = $1`, p.SppgID).Scan(&kit)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidReference
		}
		if err != nil {
			return nil, err
		}
	}

	if _, err := tx.Exec(ctx, `
		UPDATE users
		SET full_name = $2, sppg_id = $3, status = $4
		WHERE id = $1 AND role = 'sppg'`, id, p.FullName, p.SppgID, p.Status); err != nil {
		return nil, mapWriteError(err)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, $3, $4, $5, NOW())`,
		"AUDIT-"+uuid.NewString()[:8], actorID, AuditSppgAccountUpdated, id,
		auditDetail("fullName", p.FullName, p.Reason)); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.Get(ctx, id)
}

// UpdateCredentials mengganti email dan/atau kata sandi akun. PasswordHash
// kosong berarti kata sandi lama dipertahankan.
func (r *pgSppgAccountRepository) UpdateCredentials(ctx context.Context, id, email, passwordHash, actorID, reason string) (*models.SppgAccount, error) {
	tx, err := database.Pool().Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		UPDATE users
		SET email = $2,
		    password_hash = CASE WHEN $3 = '' THEN password_hash ELSE $3 END
		WHERE id = $1 AND role = 'sppg'`, id, email, passwordHash)
	if err != nil {
		return nil, mapWriteError(err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, $3, $4, $5, NOW())`,
		"AUDIT-"+uuid.NewString()[:8], actorID, AuditSppgAccountCredentials, id,
		auditDetail("email", email, reason)); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.Get(ctx, id)
}

func (r *pgSppgAccountRepository) Delete(ctx context.Context, id, actorID string) error {
	tx, err := database.Pool().Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var name string
	err = tx.QueryRow(ctx, `SELECT full_name FROM users WHERE id = $1 AND role = 'sppg'`, id).Scan(&name)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, $3, $4, $5, NOW())`,
		"AUDIT-"+uuid.NewString()[:8], actorID, AuditSppgAccountDeleted, id,
		auditDetail("fullName", name, "akun SPPG dihapus")); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM users WHERE id = $1 AND role = 'sppg'`, id); err != nil {
		return mapWriteError(err)
	}

	return tx.Commit(ctx)
}
