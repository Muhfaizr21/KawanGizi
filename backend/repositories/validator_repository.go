package repositories

import (
	"backend/database"
	"backend/models"
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Nama aksi yang dicatat pada audit_logs. Setiap aksi superadmin terhadap
// validator wajib meninggalkan jejak (SUPERADMIN.md Bab 2).
const (
	AuditValidatorStatus         = "validator.status"
	AuditValidatorDeviceReset    = "validator.device.reset"
	AuditValidatorWarn           = "validator.warning"
	AuditValidatorBackupAssigned = "validator.backup.assign"
	AuditValidatorCreated        = "validator.create"
	AuditValidatorUpdated        = "validator.update"
	AuditValidatorCredentials    = "validator.credentials.update"
	AuditValidatorDeleted        = "validator.delete"
)

// ErrEmailTaken menandai email yang sudah dipakai akun lain.
var ErrEmailTaken = errors.New("email sudah terdaftar")

// ErrInvalidReference menandai referensi (mis. NPSN) yang tidak dikenal.
var ErrInvalidReference = errors.New("referensi tidak valid")

// CreateValidatorParams adalah data mentah untuk membuat akun + profil validator.
// PasswordHash sudah di-hash di lapisan service.
type CreateValidatorParams struct {
	FullName      string
	Email         string
	PasswordHash  string
	NPSN          string
	SatgasID      string
	NIP           string
	Role          string
	Certification string
	Device        string
	SPPGID        string
}

// UpdateValidatorParams adalah identitas profil validator yang boleh diubah.
type UpdateValidatorParams struct {
	Name          string
	NPSN          string
	SatgasID      string
	NIP           string
	Role          string
	Certification string
	Reason        string
	SPPGID        string
}

// deviceUnbound adalah nilai device_id setelah tautan perangkat diputus.
const deviceUnbound = "unbound"

// ValidatorRepository adalah persistence untuk roster validator lapangan.
//
// Setiap operasi tulis sengaja dijalankan sebagai satu statement CTE: perubahan
// validator_profiles, efek sampingnya (users.status), dan audit_logs terjadi
// dalam satu round-trip. Dengan begitu mustahil meninggalkan profil masih aktif
// sementara akunnya sudah dibekukan — atau sebaliknya.
type ValidatorRepository interface {
	List(ctx context.Context) ([]models.ValidatorProfile, error)
	Get(ctx context.Context, id string) (*models.ValidatorProfile, error)
	SetStatus(ctx context.Context, id, status, actorID, reason string) (*models.ValidatorProfile, error)
	ResetDevice(ctx context.Context, id, actorID, reason string) (*models.ValidatorProfile, error)
	IssueWarning(ctx context.Context, id, actorID, note string) (*models.ValidatorProfile, error)
	AssignBackup(ctx context.Context, id, backupID, actorID, reason string) (*models.ValidatorProfile, error)
	Create(ctx context.Context, p CreateValidatorParams, actorID string) (*models.ValidatorProfile, error)
	Update(ctx context.Context, id string, p UpdateValidatorParams, actorID string) (*models.ValidatorProfile, error)
	UpdateCredentials(ctx context.Context, id, email, passwordHash, actorID, reason string) (*models.ValidatorProfile, error)
	Delete(ctx context.Context, id, actorID string) error
}

type pgValidatorRepository struct{}

// NewValidatorRepository returns the PostgreSQL-backed ValidatorRepository.
func NewValidatorRepository() ValidatorRepository {
	return &pgValidatorRepository{}
}

// validatorColumns memilih profil validator beserta lokasi sekolah, email akun
// yang tertaut, dan nama validator cadangan yang ditunjuk.
const validatorColumns = `
	v.id, COALESCE(v.user_id, ''), v.satgas_id, v.name, COALESCE(u.email, ''),
	v.nip, COALESCE(v.npsn, ''), COALESCE(s.name, ''), COALESCE(s.city, ''), v.role,
	v.device, v.device_id, v.certification, v.status,
	COALESCE(b.id, ''), COALESCE(b.name, ''),
	v.warning_count, v.last_warning_at, v.last_warning_note`

const validatorFrom = `
	FROM validator_profiles v
	LEFT JOIN users u              ON u.id = v.user_id
	LEFT JOIN schools s            ON s.npsn = v.npsn
	LEFT JOIN validator_profiles b ON b.id = v.backup_validator_id`

// List mengembalikan seluruh roster validator dengan statistik pindai hari ini.
//
// Statistik dihitung dari scan_logs, bukan dari kolom denormalisasi, sehingga
// angka yang tampil di layar selalu cocok dengan bukti pemindaian yang tercatat.
func (r *pgValidatorRepository) List(ctx context.Context) ([]models.ValidatorProfile, error) {
	rows, err := database.Pool().Query(ctx, `
		SELECT`+validatorColumns+`,
			COALESCE(today.scans_today, 0),
			COALESCE(today.avg_duration_sec, 0),
			COALESCE(today.anomalies, 0),
			today.last_scan_at,
			COALESCE(q.quota_today, 0)
		`+validatorFrom+`
		LEFT JOIN LATERAL (
			SELECT
				COUNT(*)                           AS scans_today,
				COALESCE(AVG(s.duration_ms), 0) / 1000.0 AS avg_duration_sec,
				COUNT(*) FILTER (WHERE s.duration_ms < $1) AS anomalies,
				MAX(s.created_at)                  AS last_scan_at
			FROM scan_logs s
			WHERE s.actor_id = v.user_id AND s.created_at::date = CURRENT_DATE
		) today ON TRUE
		LEFT JOIN LATERAL (
			SELECT registered_students AS quota_today
			FROM attendances
			WHERE school_npsn = v.npsn AND date = CURRENT_DATE
			LIMIT 1
		) q ON TRUE
		ORDER BY v.name ASC`, models.MinScanDurationMS)
	if err != nil {
		return nil, fmt.Errorf("query validator profiles: %w", err)
	}
	defer rows.Close()

	var list []models.ValidatorProfile
	ids := make([]string, 0, len(list))
	for rows.Next() {
		var v models.ValidatorProfile
		if err := rows.Scan(
			&v.ID, &v.UserID, &v.SatgasID, &v.Name, &v.Email,
			&v.NIP, &v.NPSN, &v.SchoolName, &v.SchoolCity, &v.Role,
			&v.Device, &v.DeviceID, &v.Certification, &v.Status,
			&v.BackupValidatorID, &v.BackupValidatorName,
			&v.WarningCount, &v.LastWarningAt, &v.LastWarningNote,
			&v.ScansToday, &v.AvgDurationSec, &v.Anomalies, &v.LastScanAt, &v.QuotaToday,
		); err != nil {
			return nil, fmt.Errorf("scan validator profile: %w", err)
		}
		normalizeProfile(&v)
		list = append(list, v)
		ids = append(ids, v.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	recent, err := r.recentScans(ctx, ids)
	if err != nil {
		return nil, err
	}
	if recent == nil {
		recent = map[string][]models.ScanLog{}
	}
	for i := range list {
		list[i].ScanLogs = recent[list[i].ID]
		if list[i].ScanLogs == nil {
			list[i].ScanLogs = []models.ScanLog{}
		}
	}
	return list, nil
}

// Get mengembalikan satu profil dengan statistik turunan yang sama seperti List.
func (r *pgValidatorRepository) Get(ctx context.Context, id string) (*models.ValidatorProfile, error) {
	row := database.Pool().QueryRow(ctx,
		`SELECT`+validatorColumns+validatorFrom+` WHERE v.id = $1`, id)

	var v models.ValidatorProfile
	err := row.Scan(
		&v.ID, &v.UserID, &v.SatgasID, &v.Name, &v.Email,
		&v.NIP, &v.NPSN, &v.SchoolName, &v.SchoolCity, &v.Role,
		&v.Device, &v.DeviceID, &v.Certification, &v.Status,
		&v.BackupValidatorID, &v.BackupValidatorName,
		&v.WarningCount, &v.LastWarningAt, &v.LastWarningNote,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("query validator: %w", err)
	}

	if err := database.Pool().QueryRow(ctx, `
		SELECT COUNT(*),
		       COALESCE(AVG(s.duration_ms), 0) / 1000.0,
		       COUNT(*) FILTER (WHERE s.duration_ms < $2),
		       MAX(s.created_at)
		FROM scan_logs s
		WHERE s.actor_id = $1 AND s.created_at::date = CURRENT_DATE`,
		v.UserID, models.MinScanDurationMS,
	).Scan(&v.ScansToday, &v.AvgDurationSec, &v.Anomalies, &v.LastScanAt); err != nil {
		return nil, fmt.Errorf("agregat scan validator: %w", err)
	}

	_ = database.Pool().QueryRow(ctx, `
		SELECT registered_students FROM attendances
		WHERE school_npsn = $1 AND date = CURRENT_DATE LIMIT 1`,
		v.NPSN).Scan(&v.QuotaToday)

	recent, err := r.recentScans(ctx, []string{id})
	if err != nil {
		return nil, err
	}
	normalizeProfile(&v)
	if recent[id] == nil {
		v.ScanLogs = []models.ScanLog{}
	} else {
		v.ScanLogs = recent[id]
	}
	return &v, nil
}

// recentScans memuat scan terakhir tiap validator untuk drawer detail.
// Satu query untuk seluruh roster agar tidak N+1.
func (r *pgValidatorRepository) recentScans(ctx context.Context, profileIDs []string) (map[string][]models.ScanLog, error) {
	if len(profileIDs) == 0 {
		return nil, nil
	}

	// LATERAL + LIMIT (bukan DISTINCT ON) karena setiap profil butuh beberapa
	// baris terakhir, bukan satu baris per profil.
	rows, err := database.Pool().Query(ctx, `
		SELECT v.id, s.id, s.box_id, s.qr_token, s.batch_id, s.image_ref,
		       s.ai_class, s.ai_confidence, s.visual_score,
		       s.holding_temp_c, s.release_temp_c, s.duration_ms,
		       s.verdict, s.reason, s.actor_id, s.created_at
		FROM validator_profiles v
		CROSS JOIN LATERAL (
			SELECT * FROM scan_logs
			WHERE actor_id = v.user_id
			ORDER BY created_at DESC
			LIMIT $2
		) s
		WHERE v.id = ANY($1)
		ORDER BY v.id, s.created_at DESC`, profileIDs, models.RecentScanLogLimit)
	if err != nil {
		return nil, fmt.Errorf("query scan logs validator: %w", err)
	}
	defer rows.Close()

	out := make(map[string][]models.ScanLog)
	for rows.Next() {
		var profileID string
		var s models.ScanLog
		if err := rows.Scan(
			&profileID, &s.ID, &s.BoxID, &s.QRToken, &s.BatchID, &s.ImageRef,
			&s.AIClass, &s.AIConfidence, &s.VisualScore,
			&s.HoldingTempC, &s.ReleaseTempC, &s.DurationMS,
			&s.Verdict, &s.Reason, &s.ActorID, &s.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan scan log: %w", err)
		}
		out[profileID] = append(out[profileID], s)
	}
	return out, rows.Err()
}

// SetStatus memindahkan status validator dan menyinkronkan users.status pada
// akun yang tertaut, dalam satu statement.
func (r *pgValidatorRepository) SetStatus(ctx context.Context, id, status, actorID, reason string) (*models.ValidatorProfile, error) {
	profile, err := r.run(ctx, mutationTemplateWithSync, mutation{
		statement: `
			UPDATE validator_profiles SET status = $7 WHERE id = $6
			RETURNING id, user_id`,
		actorID:        actorID,
		action:         AuditValidatorStatus,
		target:         id,
		detail:         auditDetail("status", status, reason),
		args:           []any{id, status},
		syncUserStatus: true,
		userStatus:     models.UserStatusFor(status),
	})
	if err != nil {
		return nil, err
	}
	return profile.(*models.ValidatorProfile), nil
}

// ResetDevice memutus device binding sehingga validator wajib registrasi ulang.
func (r *pgValidatorRepository) ResetDevice(ctx context.Context, id, actorID, reason string) (*models.ValidatorProfile, error) {
	profile, err := r.run(ctx, auditTemplate, mutation{
		statement: `
			UPDATE validator_profiles
			SET device = 'Belum Terikat', device_id = '` + deviceUnbound + `'
			WHERE id = $6
			RETURNING id`,
		actorID: actorID,
		action:  AuditValidatorDeviceReset,
		target:  id,
		detail:  reason,
		args:    []any{id},
	})
	if err != nil {
		return nil, err
	}
	return profile.(*models.ValidatorProfile), nil
}

// IssueWarning menaikkan hitungan peringatan, menyimpan surat peringatan
// terakhir, dan menandai profil flagged (akun tetap boleh login).
func (r *pgValidatorRepository) IssueWarning(ctx context.Context, id, actorID, note string) (*models.ValidatorProfile, error) {
	profile, err := r.run(ctx, auditTemplate, mutation{
		statement: `
			UPDATE validator_profiles
			SET warning_count = warning_count + 1,
			    last_warning_at = NOW(),
			    last_warning_note = $7,
			    status = CASE WHEN status = '` + models.ValidatorBlacklisted + `'
			                   THEN status ELSE '` + models.ValidatorFlagged + `' END
			WHERE id = $6
			RETURNING id`,
		actorID: actorID,
		action:  AuditValidatorWarn,
		target:  id,
		detail:  note,
		args:    []any{id, note},
	})
	if err != nil {
		return nil, err
	}
	return profile.(*models.ValidatorProfile), nil
}

// AssignBackup menunjuk guru piket cadangan untuk sekolah yang sama.
func (r *pgValidatorRepository) AssignBackup(ctx context.Context, id, backupID, actorID, reason string) (*models.ValidatorProfile, error) {
	profile, err := r.run(ctx, auditTemplate, mutation{
		statement: `UPDATE validator_profiles SET backup_validator_id = $7 WHERE id = $6 RETURNING id`,
		actorID:   actorID,
		action:    AuditValidatorBackupAssigned,
		target:    id,
		detail:    auditDetail("backupValidatorId", backupID, reason),
		args:      []any{id, backupID},
	})
	if err != nil {
		return nil, err
	}
	return profile.(*models.ValidatorProfile), nil
}

// Create membuat akun login (users) sekaligus profil roster (validator_profiles)
// dalam satu transaksi, lalu mencatat audit. Email wajib unik.
func (r *pgValidatorRepository) Create(ctx context.Context, p CreateValidatorParams, actorID string) (*models.ValidatorProfile, error) {
	tx, err := database.Pool().Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	userID := "usr-" + uuid.NewString()
	profileID := "VAL-" + uuid.NewString()

	if _, err := tx.Exec(ctx, `
		INSERT INTO users (id, full_name, email, password_hash, role, npsn, school_name, sppg_id, status)
		VALUES ($1, $2, $3, $4, 'validator', $5,
			COALESCE((SELECT name FROM schools WHERE npsn = $5), ''),
			COALESCE(NULLIF($6, ''), (SELECT sppg_id FROM schools WHERE npsn = $5), ''), 'active')`,
		userID, p.FullName, p.Email, p.PasswordHash, p.NPSN, p.SPPGID); err != nil {
		return nil, mapWriteError(err)
	}

	deviceName := p.Device
	if deviceName == "" {
		deviceName = "Belum Terikat"
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO validator_profiles
			(id, user_id, satgas_id, name, nip, npsn, role, device, device_id, certification, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')`,
		profileID, userID, p.SatgasID, p.FullName, p.NIP, p.NPSN, p.Role, deviceName, deviceUnbound, p.Certification); err != nil {
		return nil, mapWriteError(err)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, $3, $4, $5, NOW())`,
		"AUDIT-"+uuid.NewString()[:8], actorID, AuditValidatorCreated, profileID,
		auditDetail("email", p.Email, "akun validator dibuat")); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.Get(ctx, profileID)
}

// Update memperbarui identitas profil validator dan menyinkronkan nama, NPSN,
// serta nama sekolah pada akun login yang tertaut.
func (r *pgValidatorRepository) Update(ctx context.Context, id string, p UpdateValidatorParams, actorID string) (*models.ValidatorProfile, error) {
	tx, err := database.Pool().Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var userID string
	err = tx.QueryRow(ctx, `
		UPDATE validator_profiles
		SET name = $2, nip = $3, npsn = $4, satgas_id = $5, role = $6, certification = $7
		WHERE id = $1
		RETURNING COALESCE(user_id, '')`,
		id, p.Name, p.NIP, p.NPSN, p.SatgasID, p.Role, p.Certification).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, mapWriteError(err)
	}

	if userID != "" {
		if _, err := tx.Exec(ctx, `
			UPDATE users
			SET full_name = $2, npsn = $3,
			    school_name = COALESCE((SELECT name FROM schools WHERE npsn = $3), ''),
			    sppg_id = COALESCE(NULLIF($4, ''), (SELECT sppg_id FROM schools WHERE npsn = $3), sppg_id)
			WHERE id = $1`, userID, p.Name, p.NPSN, p.SPPGID); err != nil {
			return nil, mapWriteError(err)
		}
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, $3, $4, $5, NOW())`,
		"AUDIT-"+uuid.NewString()[:8], actorID, AuditValidatorUpdated, id,
		auditDetail("name", p.Name, p.Reason)); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.Get(ctx, id)
}

// UpdateCredentials mengganti email dan/atau kata sandi akun login. PasswordHash
// kosong berarti kata sandi lama dipertahankan.
func (r *pgValidatorRepository) UpdateCredentials(ctx context.Context, id, email, passwordHash, actorID, reason string) (*models.ValidatorProfile, error) {
	tx, err := database.Pool().Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var userID string
	err = tx.QueryRow(ctx, `SELECT COALESCE(user_id, '') FROM validator_profiles WHERE id = $1`, id).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if userID == "" {
		return nil, ErrInvalidReference
	}

	if _, err := tx.Exec(ctx, `
		UPDATE users
		SET email = $2,
		    password_hash = CASE WHEN $3 = '' THEN password_hash ELSE $3 END
		WHERE id = $1`, userID, email, passwordHash); err != nil {
		return nil, mapWriteError(err)
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, $3, $4, $5, NOW())`,
		"AUDIT-"+uuid.NewString()[:8], actorID, AuditValidatorCredentials, id,
		auditDetail("email", email, reason)); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.Get(ctx, id)
}

// Delete menghapus akun login validator; profil roster ikut terhapus lewat
// ON DELETE CASCADE. Jejak audit tetap dicatat.
func (r *pgValidatorRepository) Delete(ctx context.Context, id, actorID string) error {
	tx, err := database.Pool().Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var name, userID string
	err = tx.QueryRow(ctx, `SELECT name, COALESCE(user_id, '') FROM validator_profiles WHERE id = $1`, id).Scan(&name, &userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, $3, $4, $5, NOW())`,
		"AUDIT-"+uuid.NewString()[:8], actorID, AuditValidatorDeleted, id,
		auditDetail("name", name, "akun validator dihapus")); err != nil {
		return err
	}

	if userID != "" {
		if _, err := tx.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID); err != nil {
			return mapWriteError(err)
		}
	} else if _, err := tx.Exec(ctx, `DELETE FROM validator_profiles WHERE id = $1`, id); err != nil {
		return mapWriteError(err)
	}

	return tx.Commit(ctx)
}

// run adalah pembungkus bertipe untuk runAudited milik slice validator.
func (r *pgValidatorRepository) run(ctx context.Context, template string, m mutation) (any, error) {
	return runAudited(ctx, template, m, func(ctx context.Context, id string) (any, error) {
		return r.Get(ctx, id)
	})
}

// normalizeProfile merapikan nilai turunan sebelum dikirim ke presenter.
func normalizeProfile(v *models.ValidatorProfile) {
	v.AvgDurationSec = math.Round(v.AvgDurationSec*100) / 100
	v.DeviceBound = v.DeviceID != "" && v.DeviceID != deviceUnbound
}

// mapWriteError menerjemahkan pelanggaran constraint PostgreSQL menjadi error
// domain agar lapisan atas tidak perlu tahu kode SQLSTATE.
func mapWriteError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505": // unique_violation
			return ErrEmailTaken
		case "23503": // foreign_key_violation
			return ErrInvalidReference
		}
	}
	return err
}
