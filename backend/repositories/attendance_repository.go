package repositories

import (
	"backend/database"
	"backend/models"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AttendanceRepository menyediakan abstraksi database untuk data presensi dan rekonsiliasi porsi MBG.
type AttendanceRepository interface {
	List(ctx context.Context, filter models.AttendanceFilter) ([]models.Attendance, error)
	GetByID(ctx context.Context, id string) (*models.Attendance, error)
	AdjustTomorrowQuota(ctx context.Context, id string, req models.AdjustQuotaRequest, actor models.User) (*models.Attendance, error)
	RedistributeSurplus(ctx context.Context, id string, req models.RedistributeSurplusRequest, actor models.User) (*models.Attendance, error)
	AuditDiscrepancy(ctx context.Context, id string, req models.AuditDiscrepancyRequest, actor models.User) (*models.Attendance, error)
}

type postgresAttendanceRepository struct {
	pool *pgxpool.Pool
}

func NewAttendanceRepository(pool *pgxpool.Pool) AttendanceRepository {
	if pool == nil {
		pool = database.Pool()
	}
	return &postgresAttendanceRepository{pool: pool}
}

const baseAttendanceSelect = `
	SELECT 
		a.id, a.school_npsn, COALESCE(s.name, ''), COALESCE(s.level, 'SD'),
		COALESCE(s.city, 'Jakarta Pusat'),
		CASE 
			WHEN s.city ILIKE '%%Bandung%%' THEN 'Jawa Barat'
			WHEN s.city ILIKE '%%Surabaya%%' THEN 'Jawa Timur'
			WHEN s.city ILIKE '%%Semarang%%' THEN 'Jawa Tengah'
			WHEN s.city ILIKE '%%Yogyakarta%%' OR s.city ILIKE '%%Sleman%%' THEN 'D.I. Yogyakarta'
			WHEN s.city ILIKE '%%Jayapura%%' THEN 'Papua'
			WHEN s.city ILIKE '%%Makassar%%' THEN 'Sulawesi Selatan'
			ELSE 'DKI Jakarta'
		END AS province,
		COALESCE(s.sppg_id, ''), COALESCE(k.name, 'SPPG 01 Menteng Sentral'), COALESCE(k.code, 'BGN-SPPG-001'),
		COALESCE(s.principal_name, 'Kepala Sekolah'), COALESCE(NULLIF(a.head_validator, ''), 'Dr. Hendra Prasetyo'),
		a.date::TEXT, a.registered_students, a.present_students,
		COALESCE(a.absent_details, '{"sick": 0, "permission": 0, "unexplained": 0}'::jsonb),
		a.delivered_portions, a.consumed_portions, a.surplus_portions, a.surplus_status,
		COALESCE(a.golden_window, '{"cookedAt": "05:45 WIB", "deliveredAt": "06:55 WIB", "lunchTime": "09:30 WIB", "safeUntil": "10:45 WIB", "minutesLeft": 45, "isSafeToRedistribute": true}'::jsonb),
		COALESCE(a.consumption_eval, '{"finishRate": 98.2, "riceWastePct": 1.0, "proteinWastePct": 0.2, "veggieWastePct": 1.8, "feedbackNotes": "Porsi gizi dihabiskan dengan baik."}'::jsonb),
		a.attendance_rate, a.finish_rate, a.reconciliation_status,
		a.discrepancy_count, a.target_tomorrow_quota,
		a.redistribution_log, a.notes, a.created_at
	FROM attendances a
	LEFT JOIN schools s ON a.school_npsn = s.npsn
	LEFT JOIN sppg_kitchens k ON s.sppg_id = k.id
`

func scanAttendance(row pgx.Row) (*models.Attendance, error) {
	var a models.Attendance
	var absentRaw, goldenRaw, evalRaw []byte
	var redistRaw []byte

	err := row.Scan(
		&a.ID, &a.SchoolNPSN, &a.SchoolName, &a.Level,
		&a.City, &a.Province,
		&a.SPPGID, &a.SPPGName, &a.SPPGCode,
		&a.Principal, &a.HeadValidator,
		&a.Date, &a.RegisteredStudents, &a.PresentStudents,
		&absentRaw,
		&a.DeliveredPortions, &a.ConsumedPortions, &a.SurplusPortions, &a.SurplusStatus,
		&goldenRaw,
		&evalRaw,
		&a.AttendanceRate, &a.FinishRate, &a.ReconciliationStatus,
		&a.DiscrepancyCount, &a.TargetTomorrowQuota,
		&redistRaw, &a.Notes, &a.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	if len(absentRaw) > 0 {
		_ = json.Unmarshal(absentRaw, &a.AbsentDetails)
	}
	if len(goldenRaw) > 0 {
		_ = json.Unmarshal(goldenRaw, &a.GoldenWindow)
	}
	if len(evalRaw) > 0 {
		_ = json.Unmarshal(evalRaw, &a.ConsumptionEvaluation)
	}
	if len(redistRaw) > 0 && string(redistRaw) != "null" {
		var r models.RedistributionLog
		if err := json.Unmarshal(redistRaw, &r); err == nil {
			a.RedistributionLog = &r
		}
	}

	return &a, nil
}

func (r *postgresAttendanceRepository) List(ctx context.Context, filter models.AttendanceFilter) ([]models.Attendance, error) {
	query := baseAttendanceSelect
	var conditions []string
	var args []any
	argIndex := 1

	if strings.TrimSpace(filter.Search) != "" {
		s := "%" + strings.TrimSpace(filter.Search) + "%"
		conditions = append(conditions, fmt.Sprintf("(s.name ILIKE $%d OR a.school_npsn ILIKE $%d OR k.name ILIKE $%d OR s.city ILIKE $%d OR s.principal_name ILIKE $%d OR a.head_validator ILIKE $%d)", argIndex, argIndex, argIndex, argIndex, argIndex, argIndex))
		args = append(args, s)
		argIndex++
	}

	if filter.Status != "" && filter.Status != "all" {
		conditions = append(conditions, fmt.Sprintf("a.reconciliation_status = $%d", argIndex))
		args = append(args, filter.Status)
		argIndex++
	}

	if filter.City != "" && filter.City != "all" {
		conditions = append(conditions, fmt.Sprintf("s.city = $%d", argIndex))
		args = append(args, filter.City)
		argIndex++
	}

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	query += " ORDER BY a.date DESC, a.created_at DESC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list attendances: %w", err)
	}
	defer rows.Close()

	var list []models.Attendance
	for rows.Next() {
		var a models.Attendance
		var absentRaw, goldenRaw, evalRaw []byte
		var redistRaw []byte

		if err := rows.Scan(
			&a.ID, &a.SchoolNPSN, &a.SchoolName, &a.Level,
			&a.City, &a.Province,
			&a.SPPGID, &a.SPPGName, &a.SPPGCode,
			&a.Principal, &a.HeadValidator,
			&a.Date, &a.RegisteredStudents, &a.PresentStudents,
			&absentRaw,
			&a.DeliveredPortions, &a.ConsumedPortions, &a.SurplusPortions, &a.SurplusStatus,
			&goldenRaw,
			&evalRaw,
			&a.AttendanceRate, &a.FinishRate, &a.ReconciliationStatus,
			&a.DiscrepancyCount, &a.TargetTomorrowQuota,
			&redistRaw, &a.Notes, &a.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan attendance list: %w", err)
		}

		if len(absentRaw) > 0 {
			_ = json.Unmarshal(absentRaw, &a.AbsentDetails)
		}
		if len(goldenRaw) > 0 {
			_ = json.Unmarshal(goldenRaw, &a.GoldenWindow)
		}
		if len(evalRaw) > 0 {
			_ = json.Unmarshal(evalRaw, &a.ConsumptionEvaluation)
		}
		if len(redistRaw) > 0 && string(redistRaw) != "null" {
			var rl models.RedistributionLog
			if err := json.Unmarshal(redistRaw, &rl); err == nil {
				a.RedistributionLog = &rl
			}
		}

		list = append(list, a)
	}

	return list, nil
}

func (r *postgresAttendanceRepository) GetByID(ctx context.Context, id string) (*models.Attendance, error) {
	query := baseAttendanceSelect + " WHERE a.id = $1"
	row := r.pool.QueryRow(ctx, query, id)
	att, err := scanAttendance(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get attendance by id: %w", err)
	}
	return att, nil
}

func (r *postgresAttendanceRepository) AdjustTomorrowQuota(ctx context.Context, id string, req models.AdjustQuotaRequest, actor models.User) (*models.Attendance, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin adjust quota: %w", err)
	}
	defer tx.Rollback(ctx)

	noteAppend := fmt.Sprintf("Penyesuaian kuota esok menjadi %d porsi: %s", req.NewQuota, req.Reason)
	res, err := tx.Exec(ctx, `
		UPDATE attendances 
		SET target_tomorrow_quota = $1,
		    notes = CASE WHEN notes = '' THEN $2 ELSE notes || '; ' || $2 END
		WHERE id = $3`,
		req.NewQuota, noteAppend, id,
	)
	if err != nil {
		return nil, fmt.Errorf("update quota: %w", err)
	}
	if res.RowsAffected() == 0 {
		return nil, ErrNotFound
	}

	// Sinkronisasi otomatis ke kuota dapur SPPG
	_, _ = tx.Exec(ctx, `
		UPDATE sppg_school_quotas
		SET present = $1, updated_at = NOW()
		WHERE npsn = (SELECT school_npsn FROM attendances WHERE id = $2)
	`, req.NewQuota, id)

	// Audit Log
	auditID := uuid.NewString()
	auditDetail := fmt.Sprintf("target_tomorrow_quota=%d; reason=%s", req.NewQuota, req.Reason)
	_, err = tx.Exec(ctx, `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, 'attendance.quota.adjust', $3, $4, NOW())`,
		auditID, actor.ID, id, auditDetail,
	)
	if err != nil {
		return nil, fmt.Errorf("insert audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit adjust quota: %w", err)
	}

	return r.GetByID(ctx, id)
}

func (r *postgresAttendanceRepository) RedistributeSurplus(ctx context.Context, id string, req models.RedistributeSurplusRequest, actor models.User) (*models.Attendance, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin redistribute surplus: %w", err)
	}
	defer tx.Rollback(ctx)

	redistLog := models.RedistributionLog{
		DispatchID:         fmt.Sprintf("REDIST-%s", uuid.NewString()[:8]),
		AuthorizedBy:       req.AuthorizedBy,
		TargetFacility:     req.TargetFacility,
		PortionsAllocated:  req.PortionsAllocated,
		CourierName:        req.CourierName,
		DispatchedAt:       "Baru Saja Diberangkatkan",
		RecipientSignature: "Menunggu Konfirmasi Serah Terima",
	}
	redistBytes, err := json.Marshal(redistLog)
	if err != nil {
		return nil, fmt.Errorf("marshal redistribution log: %w", err)
	}

	res, err := tx.Exec(ctx, `
		UPDATE attendances 
		SET surplus_status = 'redistributed',
		    reconciliation_status = 'surplus_redistributed',
		    redistribution_log = $1
		WHERE id = $2`,
		redistBytes, id,
	)
	if err != nil {
		return nil, fmt.Errorf("update attendance surplus: %w", err)
	}
	if res.RowsAffected() == 0 {
		return nil, ErrNotFound
	}

	// Audit Log
	auditID := uuid.NewString()
	auditDetail := fmt.Sprintf("target=%s; portions=%d; courier=%s; authorized_by=%s", req.TargetFacility, req.PortionsAllocated, req.CourierName, req.AuthorizedBy)
	_, err = tx.Exec(ctx, `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, 'attendance.surplus.redistribute', $3, $4, NOW())`,
		auditID, actor.ID, id, auditDetail,
	)
	if err != nil {
		return nil, fmt.Errorf("insert audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit redistribute surplus: %w", err)
	}

	return r.GetByID(ctx, id)
}

func (r *postgresAttendanceRepository) AuditDiscrepancy(ctx context.Context, id string, req models.AuditDiscrepancyRequest, actor models.User) (*models.Attendance, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin audit discrepancy: %w", err)
	}
	defer tx.Rollback(ctx)

	noteAppend := fmt.Sprintf("[INVESTIGASI SELISIH - %s]: %s", req.Investigator, req.Notes)
	res, err := tx.Exec(ctx, `
		UPDATE attendances 
		SET head_validator = $1,
		    notes = CASE WHEN notes = '' THEN $2 ELSE notes || '; ' || $2 END
		WHERE id = $3`,
		req.Investigator, noteAppend, id,
	)
	if err != nil {
		return nil, fmt.Errorf("update attendance discrepancy audit: %w", err)
	}
	if res.RowsAffected() == 0 {
		return nil, ErrNotFound
	}

	// Audit Log
	auditID := uuid.NewString()
	auditDetail := fmt.Sprintf("investigator=%s; notes=%s", req.Investigator, req.Notes)
	_, err = tx.Exec(ctx, `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, 'attendance.discrepancy.audit', $3, $4, NOW())`,
		auditID, actor.ID, id, auditDetail,
	)
	if err != nil {
		return nil, fmt.Errorf("insert audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit audit discrepancy: %w", err)
	}

	return r.GetByID(ctx, id)
}
