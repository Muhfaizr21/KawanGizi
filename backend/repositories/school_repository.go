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

// SchoolRepository menyediakan abstraksi akses database untuk data master sekolah binaan MBG.
type SchoolRepository interface {
	List(ctx context.Context, filter models.SchoolFilter) ([]models.School, error)
	GetByNPSN(ctx context.Context, npsn string) (*models.School, error)
	ResolveNPSNByRef(ctx context.Context, ref string) (string, error)
	Create(ctx context.Context, req models.CreateSchoolRequest, actor models.User) (*models.School, error)
	ReassignSPPG(ctx context.Context, npsn string, req models.ReassignSchoolSPPGRequest, actor models.User) (*models.School, error)
	UpdateContacts(ctx context.Context, npsn string, req models.UpdateSchoolContactsRequest, actor models.User) (*models.School, error)
	ToggleStatus(ctx context.Context, npsn string, req models.ToggleSchoolStatusRequest, actor models.User) (*models.School, error)
	CountLinkedValidatorAccounts(ctx context.Context, npsn string) (int, error)
	Delete(ctx context.Context, npsn string, actor models.User) error
}

type postgresSchoolRepository struct {
	pool *pgxpool.Pool
}

func NewSchoolRepository(pool *pgxpool.Pool) SchoolRepository {
	if pool == nil {
		pool = database.Pool()
	}
	return &postgresSchoolRepository{pool: pool}
}

const baseSchoolSelect = `
	SELECT 
		s.npsn, s.id, s.name, s.level, s.status, s.status_label, s.status_reason,
		s.address, s.city, s.district, s.lat, s.lng,
		s.principal_name, s.principal_nip, s.principal_phone, s.principal_email,
		s.total_students, s.total_calorie_target, s.dietary_notes,
		COALESCE(s.demographics, '{}'::jsonb),
		COALESCE(s.sppg_id, ''),
		COALESCE(k.name, 'SPPG Sentral BGN'),
		COALESCE(k.address, ''),
		COALESCE(s.emergency_contacts, '{}'::jsonb),
		COALESCE(s.transit_details, '{}'::jsonb),
		COALESCE(s.last_audit_date, '26 Sep 2026'),
		s.acceptance_rate, s.avg_arrival_time, s.created_at
	FROM schools s
	LEFT JOIN sppg_kitchens k ON s.sppg_id = k.id
`

func scanSchool(row pgx.Row) (*models.School, error) {
	var s models.School
	var demoRaw, emergencyRaw, transitRaw []byte
	var sppgName, sppgAddr string

	err := row.Scan(
		&s.NPSN, &s.ID, &s.Name, &s.Level, &s.Status, &s.StatusLabel, &s.StatusReason,
		&s.Address, &s.City, &s.District, &s.Lat, &s.Lng,
		&s.PrincipalName, &s.PrincipalNIP, &s.PrincipalPhone, &s.PrincipalEmail,
		&s.TotalStudents, &s.TotalCalorieTarget, &s.DietaryNotes,
		&demoRaw,
		&s.SPPGID,
		&sppgName,
		&sppgAddr,
		&emergencyRaw,
		&transitRaw,
		&s.LastAuditDate,
		&s.AcceptanceRate, &s.AvgArrivalTime, &s.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	s.Coordinates = models.Coordinates{Lat: s.Lat, Lng: s.Lng}
	s.Principal = models.PrincipalInfo{
		Name:  s.PrincipalName,
		NIP:   s.PrincipalNIP,
		Phone: s.PrincipalPhone,
		Email: s.PrincipalEmail,
	}

	if len(demoRaw) > 0 {
		_ = json.Unmarshal(demoRaw, &s.Demographics)
	}
	if s.Demographics.TotalStudents == 0 && s.TotalStudents > 0 {
		s.Demographics.TotalStudents = s.TotalStudents
		s.Demographics.TotalCalorieTarget = s.TotalCalorieTarget
		s.Demographics.DietaryNotes = s.DietaryNotes
	}

	if len(emergencyRaw) > 0 {
		_ = json.Unmarshal(emergencyRaw, &s.EmergencyContacts)
	}
	if len(transitRaw) > 0 {
		_ = json.Unmarshal(transitRaw, &s.TransitDetails)
	}

	s.SPPGSupplier = models.SPPGSupplier{
		ID:             s.SPPGID,
		Name:           sppgName,
		Type:           "Dapur Sentral MBG Terverifikasi",
		Address:        sppgAddr,
		DistanceKm:     s.TransitDetails.DistanceKm,
		TransitMinutes: s.TransitDetails.TransitMinutes,
		TransitStatus:  s.TransitDetails.TransitStatus,
		CorridorRoute:  s.TransitDetails.CorridorRoute,
	}
	if s.SPPGSupplier.DistanceKm == 0 {
		s.SPPGSupplier.DistanceKm = 3.5
		s.SPPGSupplier.TransitMinutes = 20
		s.SPPGSupplier.TransitStatus = "safe"
		s.SPPGSupplier.CorridorRoute = fmt.Sprintf("Koridor Terpadu Klaster %s", s.City)
	}

	return &s, nil
}

func (r *postgresSchoolRepository) List(ctx context.Context, filter models.SchoolFilter) ([]models.School, error) {
	query := baseSchoolSelect
	var conditions []string
	var args []any
	argIndex := 1

	if strings.TrimSpace(filter.Search) != "" {
		s := "%" + strings.TrimSpace(filter.Search) + "%"
		conditions = append(conditions, fmt.Sprintf("(s.name ILIKE $%d OR s.npsn ILIKE $%d OR s.city ILIKE $%d OR s.principal_name ILIKE $%d OR k.name ILIKE $%d)", argIndex, argIndex, argIndex, argIndex, argIndex))
		args = append(args, s)
		argIndex++
	}

	if filter.Level != "" && filter.Level != "all" {
		conditions = append(conditions, fmt.Sprintf("s.level = $%d", argIndex))
		args = append(args, filter.Level)
		argIndex++
	}

	if filter.Status != "" && filter.Status != "all" {
		conditions = append(conditions, fmt.Sprintf("s.status = $%d", argIndex))
		args = append(args, filter.Status)
		argIndex++
	}

	if filter.City != "" && filter.City != "all" {
		conditions = append(conditions, fmt.Sprintf("s.city = $%d", argIndex))
		args = append(args, filter.City)
		argIndex++
	}

	if filter.SPPGID != "" && filter.SPPGID != "all" {
		conditions = append(conditions, fmt.Sprintf("s.sppg_id = $%d", argIndex))
		args = append(args, filter.SPPGID)
		argIndex++
	}

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	query += " ORDER BY s.name ASC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list schools: %w", err)
	}
	defer rows.Close()

	var list []models.School
	for rows.Next() {
		var s models.School
		var demoRaw, emergencyRaw, transitRaw []byte
		var sppgName, sppgAddr string

		if err := rows.Scan(
			&s.NPSN, &s.ID, &s.Name, &s.Level, &s.Status, &s.StatusLabel, &s.StatusReason,
			&s.Address, &s.City, &s.District, &s.Lat, &s.Lng,
			&s.PrincipalName, &s.PrincipalNIP, &s.PrincipalPhone, &s.PrincipalEmail,
			&s.TotalStudents, &s.TotalCalorieTarget, &s.DietaryNotes,
			&demoRaw,
			&s.SPPGID,
			&sppgName,
			&sppgAddr,
			&emergencyRaw,
			&transitRaw,
			&s.LastAuditDate,
			&s.AcceptanceRate, &s.AvgArrivalTime, &s.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan school item: %w", err)
		}

		s.Coordinates = models.Coordinates{Lat: s.Lat, Lng: s.Lng}
		s.Principal = models.PrincipalInfo{
			Name:  s.PrincipalName,
			NIP:   s.PrincipalNIP,
			Phone: s.PrincipalPhone,
			Email: s.PrincipalEmail,
		}

		if len(demoRaw) > 0 {
			_ = json.Unmarshal(demoRaw, &s.Demographics)
		}
		if s.Demographics.TotalStudents == 0 && s.TotalStudents > 0 {
			s.Demographics.TotalStudents = s.TotalStudents
			s.Demographics.TotalCalorieTarget = s.TotalCalorieTarget
			s.Demographics.DietaryNotes = s.DietaryNotes
		}

		if len(emergencyRaw) > 0 {
			_ = json.Unmarshal(emergencyRaw, &s.EmergencyContacts)
		}
		if len(transitRaw) > 0 {
			_ = json.Unmarshal(transitRaw, &s.TransitDetails)
		}

		s.SPPGSupplier = models.SPPGSupplier{
			ID:             s.SPPGID,
			Name:           sppgName,
			Type:           "Dapur Sentral MBG Terverifikasi",
			Address:        sppgAddr,
			DistanceKm:     s.TransitDetails.DistanceKm,
			TransitMinutes: s.TransitDetails.TransitMinutes,
			TransitStatus:  s.TransitDetails.TransitStatus,
			CorridorRoute:  s.TransitDetails.CorridorRoute,
		}
		if s.SPPGSupplier.DistanceKm == 0 {
			s.SPPGSupplier.DistanceKm = 3.5
			s.SPPGSupplier.TransitMinutes = 20
			s.SPPGSupplier.TransitStatus = "safe"
			s.SPPGSupplier.CorridorRoute = fmt.Sprintf("Koridor Terpadu Klaster %s", s.City)
		}

		list = append(list, s)
	}

	return list, nil
}

func (r *postgresSchoolRepository) GetByNPSN(ctx context.Context, npsn string) (*models.School, error) {
	query := baseSchoolSelect + " WHERE s.npsn = $1"
	row := r.pool.QueryRow(ctx, query, npsn)
	sch, err := scanSchool(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get school by npsn: %w", err)
	}
	return sch, nil
}

// ResolveNPSNByRef menormalkan berbagai bentuk referensi sekolah menjadi NPSN.
//
// Panel SPPG mengirim id baris dari daftar, yang bisa berupa NPSN, schools.id,
// atau id baris kuota harian (mis. "q:20776543:20261015"). Semua bentuk itu harus
// bisa dipetakan ke sekolah yang sama supaya delete/mutasi tidak ditolak tipis.
func (r *postgresSchoolRepository) ResolveNPSNByRef(ctx context.Context, ref string) (string, error) {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return "", ErrNotFound
	}

	var npsn string
	err := r.pool.QueryRow(ctx, `
		SELECT npsn FROM schools WHERE npsn = $1 OR id = $1
		UNION ALL
		SELECT s.npsn FROM schools s
		JOIN sppg_school_quotas q ON q.npsn = s.npsn
		WHERE q.id = $1
		LIMIT 1
	`, ref).Scan(&npsn)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", fmt.Errorf("resolve school npsn: %w", err)
	}
	return npsn, nil
}

func (r *postgresSchoolRepository) Create(ctx context.Context, req models.CreateSchoolRequest, actor models.User) (*models.School, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin create school: %w", err)
	}
	defer tx.Rollback(ctx)

	id := fmt.Sprintf("SCH-NEW-%s", req.NPSN)
	lower := req.LowerGrade
	upper := req.UpperGrade
	smp := req.SMPGrade
	total := lower + upper + smp
	if total == 0 {
		total = 300
	}
	totalCal := (lower * 480) + (upper * 550) + (smp * 650)
	if totalCal == 0 {
		totalCal = total * 520
	}

	demoObj := models.Demographics{
		LowerGrade:           lower,
		UpperGrade:           upper,
		SMPGrade:             smp,
		TotalStudents:        total,
		TotalCalorieTarget:   totalCal,
		AvgCaloriePerPortion: totalCal / total,
		AllergiesCount:       0,
		DietaryNotes:         "Verifikasi lanjutan skrining awal BGN",
	}
	demoBytes, _ := json.Marshal(demoObj)

	emergObj := models.EmergencyContacts{
		PrincipalPhone:     req.PrincipalPhone,
		UKSCoordinatorName: req.UKSName,
		UKSPhone:           req.UKSPhone,
		ReferralClinic:     req.ClinicName,
		ClinicAddress:      fmt.Sprintf("Wilayah Binaan %s", req.City),
		ClinicPhone:        req.ClinicPhone,
		AmbulanceHotline:   "119",
	}
	emergBytes, _ := json.Marshal(emergObj)

	transitObj := models.TransitDetails{
		DistanceKm:     3.8,
		TransitMinutes: 18,
		TransitStatus:  "safe",
		CorridorRoute:  fmt.Sprintf("Koridor Klaster %s", req.City),
	}
	transitBytes, _ := json.Marshal(transitObj)

	_, err = tx.Exec(ctx, `
		INSERT INTO schools (
			npsn, id, name, level, status, status_label, status_reason,
			address, city, district, lat, lng,
			principal_name, principal_nip, principal_phone, principal_email,
			total_students, total_calorie_target, dietary_notes,
			sppg_id, acceptance_rate, avg_arrival_time,
			demographics, emergency_contacts, transit_details, last_audit_date, created_at
		) VALUES (
			$1, $2, $3, $4, 'active', 'Aktif Penuh', 'Sekolah baru berhasil terdaftar di klaster distribusi MBG.',
			$5, $6, $7, $8, $9,
			$10, '19750101 200001 1 001', $11, $12,
			$13, $14, 'Standar AKG terpenuhi',
			$15, 100, '07:00 WIB',
			$16, $17, $18, 'Hari Ini', NOW()
		)`,
		req.NPSN, id, req.Name, req.Level,
		req.Address, req.City, req.District, req.Lat, req.Lng,
		req.PrincipalName, req.PrincipalPhone, fmt.Sprintf("info@%s.sch.id", req.NPSN),
		total, totalCal,
		req.SPPGID,
		demoBytes, emergBytes, transitBytes,
	)
	if err != nil {
		return nil, fmt.Errorf("insert school: %w", err)
	}

	// Audit Log
	auditID := uuid.NewString()
	auditDetail := fmt.Sprintf("npsn=%s; name=%s; level=%s; city=%s; sppg_id=%s", req.NPSN, req.Name, req.Level, req.City, req.SPPGID)
	_, err = tx.Exec(ctx, `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, 'school.create', $3, $4, NOW())`,
		auditID, actor.ID, req.NPSN, auditDetail,
	)
	if err != nil {
		return nil, fmt.Errorf("insert audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit create school: %w", err)
	}

	return r.GetByNPSN(ctx, req.NPSN)
}

// CountLinkedValidatorAccounts menghitung akun login validator yang masih terikat
// ke sekolah ini. Dipakai sebelum penghapusan supaya akun login tidak ikut yatim.
func (r *postgresSchoolRepository) CountLinkedValidatorAccounts(ctx context.Context, npsn string) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM users WHERE npsn = $1 AND role = 'validator'
	`, npsn).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count linked validator accounts: %w", err)
	}
	return n, nil
}

// Delete menghapus sekolah beserta seluruh data operasionalnya.
//
// attendances, deliveries, feedbacks, dan validator_profiles sudah punya FK ke
// schools sehingga ikut terhapus (SET NULL untuk feedbacks). Tabel lain hanya
// menyimpan NPSN/school_id sebagai kolom denormalisasi tanpa FK, jadi harus
// dibersihkan eksplisit supaya tidak ada sisa data sekolah yang sudah dihapus.
func (r *postgresSchoolRepository) Delete(ctx context.Context, npsn string, actor models.User) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin delete school: %w", err)
	}
	defer tx.Rollback(ctx)

	schoolID := ""
	if err := tx.QueryRow(ctx, `SELECT id FROM schools WHERE npsn = $1`, npsn).Scan(&schoolID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("resolve school id: %w", err)
	}

	// Tiap statement hanya menerima parameter yang benar-benar dipakainya; mengirim
	// $1 dan $2 ke statement yang hanya memakai satu placeholder membuat PostgreSQL
	// gagal menebak tipe parameter yang tidak terpakai.
	cleanups := []struct {
		stmt string
		args []any
	}{
		{`DELETE FROM sppg_school_quotas              WHERE npsn = $1 OR school_id = $2`, []any{npsn, schoolID}},
		{`DELETE FROM sppg_handovers                 WHERE school_npsn = $1 OR school_id = $2`, []any{npsn, schoolID}},
		{`DELETE FROM sppg_incident_tickets          WHERE school_id = $1`, []any{schoolID}},
		{`DELETE FROM sppg_batches                   WHERE school_id = $1`, []any{schoolID}},
		{`DELETE FROM sppg_billing_rows              WHERE school_id = $1`, []any{schoolID}},
		{`DELETE FROM sppg_delivery_notifications    WHERE school_id = $1`, []any{schoolID}},
		{`DELETE FROM schedules                      WHERE npsn = $1 OR school_id = $2`, []any{npsn, schoolID}},
		{`DELETE FROM scan_logs                      WHERE school_npsn = $1`, []any{npsn}},
		{`DELETE FROM digital_basts                  WHERE npsn = $1`, []any{npsn}},
		{`DELETE FROM validator_class_reconciliation WHERE school_npsn = $1`, []any{npsn}},
	}
	for _, c := range cleanups {
		if _, err := tx.Exec(ctx, c.stmt, c.args...); err != nil {
			return fmt.Errorf("clean school data: %w", err)
		}
	}

	if _, err := tx.Exec(ctx, `DELETE FROM schools WHERE npsn = $1`, npsn); err != nil {
		return fmt.Errorf("delete school: %w", err)
	}

	auditDetail := fmt.Sprintf("npsn=%s; school_id=%s; deleted_by=%s; role=%s", npsn, schoolID, actor.ID, actor.Role)
	if _, err := tx.Exec(ctx, `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, 'school.delete', $3, $4, NOW())`,
		uuid.NewString(), actor.ID, npsn, auditDetail,
	); err != nil {
		return fmt.Errorf("insert audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit delete school: %w", err)
	}
	return nil
}

func (r *postgresSchoolRepository) ReassignSPPG(ctx context.Context, npsn string, req models.ReassignSchoolSPPGRequest, actor models.User) (*models.School, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin reassign sppg: %w", err)
	}
	defer tx.Rollback(ctx)

	statusReason := fmt.Sprintf("Alokasi dialihkan ke dapur SPPG %s karena: %s", req.TargetSPPGID, req.Reason)
	res, err := tx.Exec(ctx, `
		UPDATE schools 
		SET sppg_id = $1,
		    status = 'active',
		    status_label = 'Aktif Penuh',
		    status_reason = $2
		WHERE npsn = $3`,
		req.TargetSPPGID, statusReason, npsn,
	)
	if err != nil {
		return nil, fmt.Errorf("update school sppg: %w", err)
	}
	if res.RowsAffected() == 0 {
		return nil, ErrNotFound
	}

	// Audit Log
	auditID := uuid.NewString()
	auditDetail := fmt.Sprintf("target_sppg_id=%s; reason=%s", req.TargetSPPGID, req.Reason)
	_, err = tx.Exec(ctx, `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, 'school.sppg.reassign', $3, $4, NOW())`,
		auditID, actor.ID, npsn, auditDetail,
	)
	if err != nil {
		return nil, fmt.Errorf("insert audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit reassign sppg: %w", err)
	}

	return r.GetByNPSN(ctx, npsn)
}

func (r *postgresSchoolRepository) UpdateContacts(ctx context.Context, npsn string, req models.UpdateSchoolContactsRequest, actor models.User) (*models.School, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin update contacts: %w", err)
	}
	defer tx.Rollback(ctx)

	emergObj := models.EmergencyContacts{
		PrincipalPhone:     req.PrincipalPhone,
		UKSCoordinatorName: req.UKSCoordinatorName,
		UKSPhone:           req.UKSPhone,
		ReferralClinic:     req.ReferralClinic,
		ClinicAddress:      req.ClinicAddress,
		ClinicPhone:        req.ClinicPhone,
		AmbulanceHotline:   req.AmbulanceHotline,
	}
	emergBytes, _ := json.Marshal(emergObj)

	res, err := tx.Exec(ctx, `
		UPDATE schools 
		SET principal_name = $1,
		    principal_phone = $2,
		    emergency_contacts = $3
		WHERE npsn = $4`,
		req.PrincipalName, req.PrincipalPhone, emergBytes, npsn,
	)
	if err != nil {
		return nil, fmt.Errorf("update school contacts: %w", err)
	}
	if res.RowsAffected() == 0 {
		return nil, ErrNotFound
	}

	// Audit Log
	auditID := uuid.NewString()
	auditDetail := fmt.Sprintf("principal=%s; phone=%s; clinic=%s", req.PrincipalName, req.PrincipalPhone, req.ReferralClinic)
	_, err = tx.Exec(ctx, `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, 'school.contacts.update', $3, $4, NOW())`,
		auditID, actor.ID, npsn, auditDetail,
	)
	if err != nil {
		return nil, fmt.Errorf("insert audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit update contacts: %w", err)
	}

	return r.GetByNPSN(ctx, npsn)
}

func (r *postgresSchoolRepository) ToggleStatus(ctx context.Context, npsn string, req models.ToggleSchoolStatusRequest, actor models.User) (*models.School, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin toggle status: %w", err)
	}
	defer tx.Rollback(ctx)

	statusLabel := req.StatusLabel
	if statusLabel == "" {
		switch req.Status {
		case "active":
			statusLabel = "Aktif Penuh"
		case "temp_inactive":
			statusLabel = "Nonaktif Sementara"
		case "radius_warning":
			statusLabel = "Peringatan Radius Jauh"
		default:
			statusLabel = req.Status
		}
	}

	res, err := tx.Exec(ctx, `
		UPDATE schools 
		SET status = $1,
		    status_label = $2,
		    status_reason = $3
		WHERE npsn = $4`,
		req.Status, statusLabel, req.StatusReason, npsn,
	)
	if err != nil {
		return nil, fmt.Errorf("update school status: %w", err)
	}
	if res.RowsAffected() == 0 {
		return nil, ErrNotFound
	}

	// Audit Log
	auditID := uuid.NewString()
	auditDetail := fmt.Sprintf("status=%s; reason=%s; return_date=%s", req.Status, req.StatusReason, req.ReturnDate)
	_, err = tx.Exec(ctx, `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, 'school.status.toggle', $3, $4, NOW())`,
		auditID, actor.ID, npsn, auditDetail,
	)
	if err != nil {
		return nil, fmt.Errorf("insert audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit toggle status: %w", err)
	}

	return r.GetByNPSN(ctx, npsn)
}
