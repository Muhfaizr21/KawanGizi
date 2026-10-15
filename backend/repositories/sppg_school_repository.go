package repositories

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"backend/database"
	"backend/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type SppgSchoolRepository interface {
	GetBundle(ctx context.Context, sppgID string) (*models.SppgSchoolBundle, error)
	ListSchools(ctx context.Context, sppgID string) ([]models.SppgSchoolQuota, error)
	GetSchool(ctx context.Context, idOrSchoolID, sppgID string) (*models.SppgSchoolQuota, error)
	UpdateAttendance(ctx context.Context, idOrSchoolID, sppgID string, payload *models.UpdateAttendancePayload) (*models.SppgSchoolQuota, error)
	UpdateDroppoint(ctx context.Context, idOrSchoolID, sppgID string, payload *models.UpdateDroppointPayload) (*models.SppgSchoolQuota, error)
	CreateReminder(ctx context.Context, sppgID, schoolID, message, actorName string) error
}

type pgSppgSchoolRepository struct{}

func NewSppgSchoolRepository() SppgSchoolRepository {
	return &pgSppgSchoolRepository{}
}

// schoolQuotaProjection menyatukan dua sumber data:
//
//   - schools            = sumber kebenaran membership. Sekolah terdaftar di dapurnya
//     SPPG selalu tampil, walaupun belum pernah ada cuota harian.
//   - sppg_school_quotas = overlay operasional per tanggal (presensi, porsi khusus,
//     drop-point, PIC). Opsional: sekolah tanpa baris hari ini tetap tampil dengan
//     status "Belum update" dan kuota cetak mengikuti jumlah siswa terdaftar.
//
// Sidecar LATERAL memastikan satu sekolah menghasilkan paling banyak satu baris,
// walau tabel kuota sempat berisi bari ganda untuk NPSN yang sama.
const schoolQuotaProjection = `
	SELECT
		COALESCE(q.id, 'q:' || s.npsn || ':' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD')) AS id,
		s.sppg_id                                                                   AS sppg_id,
		s.id                                                                        AS school_id,
		s.npsn                                                                      AS npsn,
		s.name                                                                      AS school_name,
		COALESCE(NULLIF(q.address, ''), s.address, '')                              AS address,
		COALESCE(NULLIF(q.level, ''), s.level, 'SD')                                AS level,
		s.lat,
		s.lng,
		COALESCE(NULLIF(q.enrolled, 0), s.total_students, 0)                        AS enrolled,
		COALESCE(q.present, 0)                                                      AS present,
		COALESCE(q.reduce_special, 0)                                               AS reduce_special,
		COALESCE(q.absence_note, '')                                                AS absence_note,
		COALESCE(q.present_updated_at, '')                                          AS present_updated_at,
		COALESCE(q.specials, '[]'::jsonb)                                           AS specials,
		COALESCE(NULLIF(q.principal_name, ''), s.principal_name, '')                AS principal_name,
		COALESCE(q.validator_name, '')                                              AS validator_name,
		COALESCE(q.validator_phone, '')                                             AS validator_phone,
		COALESCE(q.droppoint, '')                                                   AS droppoint,
		COALESCE(q.fleet_assigned, '')                                              AS fleet_assigned,
		TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')                                         AS date
	FROM schools s
	LEFT JOIN LATERAL (
		SELECT * FROM sppg_school_quotas q
		WHERE q.sppg_id = s.sppg_id AND q.npsn = s.npsn AND q.date = CURRENT_DATE
		ORDER BY q.updated_at DESC, q.id DESC
		LIMIT 1
	) q ON TRUE
`

// scanQuota memetakan satu baris hasil schoolQuotaProjection ke model.
func scanQuota(row pgx.Row) (*models.SppgSchoolQuota, error) {
	var s models.SppgSchoolQuota
	var specBytes []byte
	if err := row.Scan(
		&s.ID, &s.SppgID, &s.SchoolID, &s.Npsn, &s.Name, &s.Address, &s.Level, &s.Lat, &s.Lng,
		&s.Enrolled, &s.Present, &s.ReduceSpecial, &s.AbsenceNote, &s.PresentUpdatedAt,
		&specBytes, &s.Principal, &s.Validator, &s.ValidatorPhone, &s.Droppoint,
		&s.Fleet, &s.Date,
	); err != nil {
		return nil, err
	}
	if len(specBytes) > 0 {
		_ = json.Unmarshal(specBytes, &s.Specials)
	}
	if s.Specials == nil {
		s.Specials = []models.SpecialDietary{}
	}
	s.PackingQuota = calculatePackingQuota(s.Enrolled, s.Present, s.ReduceSpecial, s.PresentUpdatedAt)
	s.Status = calculateAttendanceStatus(s.PresentUpdatedAt)
	return &s, nil
}

// specJSON menyandikan daftar porsi khusus untuk kolom JSONB.
func specJSON(specials []models.SpecialDietary) []byte {
	if specials == nil {
		specials = []models.SpecialDietary{}
	}
	raw, _ := json.Marshal(specials)
	return raw
}

func (r *pgSppgSchoolRepository) ListSchools(ctx context.Context, sppgID string) ([]models.SppgSchoolQuota, error) {
	query := schoolQuotaProjection + `
		WHERE s.sppg_id = $1
		ORDER BY s.name ASC
	`

	rows, err := database.Pool().Query(ctx, query, sppgID)
	if err != nil {
		return nil, fmt.Errorf("list schools failed: %w", err)
	}
	defer rows.Close()

	list := []models.SppgSchoolQuota{}
	for rows.Next() {
		s, err := scanQuota(rows)
		if err != nil {
			return nil, fmt.Errorf("scan school quota failed: %w", err)
		}
		list = append(list, *s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate school quota failed: %w", err)
	}
	return list, nil
}

func (r *pgSppgSchoolRepository) GetSchool(ctx context.Context, idOrSchoolID, sppgID string) (*models.SppgSchoolQuota, error) {
	query := schoolQuotaProjection + `
		WHERE s.sppg_id = $1
		  AND (
			s.id = $2 OR s.npsn = $2
			OR COALESCE(q.id, 'q:' || s.npsn || ':' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD')) = $2
			OR EXISTS (
				SELECT 1 FROM sppg_school_quotas z
				WHERE z.id = $2 AND z.sppg_id = s.sppg_id AND z.npsn = s.npsn
			)
		  )
		LIMIT 1
	`

	s, err := scanQuota(database.Pool().QueryRow(ctx, query, sppgID, idOrSchoolID))
	if err != nil {
		return nil, errors.New("sekolah binaan tidak ditemukan")
	}
	return s, nil
}

func (r *pgSppgSchoolRepository) UpdateAttendance(ctx context.Context, idOrSchoolID, sppgID string, payload *models.UpdateAttendancePayload) (*models.SppgSchoolQuota, error) {
	target, err := r.GetSchool(ctx, idOrSchoolID, sppgID)
	if err != nil {
		return nil, err
	}

	presentTime := payload.PresentUpdatedAt
	if presentTime == "" {
		presentTime = time.Now().Format("15:04")
	}

	specials := payload.Specials
	if specials == nil {
		specials = target.Specials
	}
	specJSON, _ := json.Marshal(specials)

	// Upsert: sekolah binaaan yang belum pernah punya baris kuota hari ini
	// tetap bisa dimutakhirkan — baris overlay-nya dibuat saat pertama kali disimpan.
	query := `
		INSERT INTO sppg_school_quotas (
			id, sppg_id, school_id, npsn, school_name, address, level, lat, lng,
			enrolled, present, reduce_special, absence_note, present_updated_at,
			specials, principal_name, validator_name, validator_phone, droppoint,
			fleet_assigned, date
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9,
			$10, $11, $12, $13, $14,
			$15, $16, $17, $18, $19,
			$20, CURRENT_DATE
		)
		ON CONFLICT (id) DO UPDATE SET
			enrolled = EXCLUDED.enrolled,
			present = EXCLUDED.present,
			reduce_special = EXCLUDED.reduce_special,
			absence_note = EXCLUDED.absence_note,
			present_updated_at = EXCLUDED.present_updated_at,
			specials = EXCLUDED.specials,
			updated_at = NOW()
	`
	_, err = database.Pool().Exec(
		ctx, query,
		target.ID, sppgID, target.SchoolID, target.Npsn, target.Name, target.Address, target.Level,
		target.Lat, target.Lng,
		target.Enrolled, payload.Present, payload.ReduceSpecial, payload.AbsenceNote,
		presentTime, specJSON, target.Principal, target.Validator, target.ValidatorPhone,
		target.Droppoint, target.Fleet,
	)
	if err != nil {
		return nil, fmt.Errorf("update attendance failed: %w", err)
	}

	// Update juga riwayat kehadiran di tabel attendances bila ada record
	_ = updateLinkedAttendanceRecord(ctx, target.Npsn, payload.Present, target.Enrolled, payload.AbsenceNote)

	return r.GetSchool(ctx, target.ID, sppgID)
}

func (r *pgSppgSchoolRepository) UpdateDroppoint(ctx context.Context, idOrSchoolID, sppgID string, payload *models.UpdateDroppointPayload) (*models.SppgSchoolQuota, error) {
	target, err := r.GetSchool(ctx, idOrSchoolID, sppgID)
	if err != nil {
		return nil, err
	}

	principal := payload.Principal
	if principal == "" {
		principal = target.Principal
	}

	query := `
		INSERT INTO sppg_school_quotas (
			id, sppg_id, school_id, npsn, school_name, address, level, lat, lng,
			enrolled, present, reduce_special, absence_note, present_updated_at,
			specials, principal_name, validator_name, validator_phone, droppoint,
			fleet_assigned, date
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9,
			$10, $11, $12, $13, $14,
			$15, $16, $17, $18, $19,
			$20, CURRENT_DATE
		)
		ON CONFLICT (id) DO UPDATE SET
			principal_name = EXCLUDED.principal_name,
			validator_name = EXCLUDED.validator_name,
			validator_phone = EXCLUDED.validator_phone,
			droppoint = EXCLUDED.droppoint,
			updated_at = NOW()
	`
	_, err = database.Pool().Exec(
		ctx, query,
		target.ID, sppgID, target.SchoolID, target.Npsn, target.Name, target.Address, target.Level,
		target.Lat, target.Lng,
		target.Enrolled, target.Present, target.ReduceSpecial, target.AbsenceNote,
		target.PresentUpdatedAt, specJSON(target.Specials), principal,
		payload.Validator, payload.ValidatorPhone, payload.Droppoint, target.Fleet,
	)
	if err != nil {
		return nil, fmt.Errorf("update droppoint failed: %w", err)
	}

	return r.GetSchool(ctx, target.ID, sppgID)
}

func (r *pgSppgSchoolRepository) CreateReminder(ctx context.Context, sppgID, schoolID, message, actorName string) error {
	school, err := r.GetSchool(ctx, schoolID, sppgID)
	if err != nil {
		return err
	}

	auditID := "aud-" + uuid.NewString()[:12]
	detailJSON, _ := json.Marshal(map[string]any{
		"module":     "schools_attendance",
		"action":     "attendance.remind",
		"schoolId":   school.SchoolID,
		"schoolName": school.Name,
		"validator":  school.Validator,
		"phone":      school.ValidatorPhone,
		"message":    message,
		"sentBy":     actorName,
	})

	_, err = database.Pool().Exec(ctx, `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, 'schools.remind_attendance', $3, $4, NOW())
	`, auditID, sppgID, school.Name, string(detailJSON))

	return err
}

func (r *pgSppgSchoolRepository) GetBundle(ctx context.Context, sppgID string) (*models.SppgSchoolBundle, error) {
	// 1. Info Dapur SPPG & Titik Depot
	var kitchenCode, kitchenName, coordinates string
	err := database.Pool().QueryRow(ctx, `
		SELECT code, name, coordinates FROM sppg_kitchens WHERE id = $1
	`, sppgID).Scan(&kitchenCode, &kitchenName, &coordinates)
	if err != nil {
		kitchenCode = sppgID
		kitchenName = "Dapur Sentral " + sppgID
		coordinates = "-6.1955, 106.8305"
	}

	depotLat := -6.1955
	depotLng := 106.8305
	coordsParts := strings.Split(coordinates, ",")
	if len(coordsParts) == 2 {
		if lat, err := strconv.ParseFloat(strings.TrimSpace(coordsParts[0]), 64); err == nil {
			depotLat = lat
		}
		if lng, err := strconv.ParseFloat(strings.TrimSpace(coordsParts[1]), 64); err == nil {
			depotLng = lng
		}
	}

	depot := models.DepotInfo{
		ID:   sppgID,
		Name: kitchenName,
		Lat:  depotLat,
		Lng:  depotLng,
	}

	// 2. Daftar Sekolah Binaan Dapur Ini
	schools, err := r.ListSchools(ctx, sppgID)
	if err != nil {
		return nil, err
	}

	// 3. Hitung Agregasi Totals
	totalPresent := 0
	totalQuota := 0
	updatedCount := 0
	totalSpecials := 0

	for _, s := range schools {
		totalQuota += s.PackingQuota
		if s.PresentUpdatedAt != "" {
			totalPresent += s.Present
			updatedCount++
		}
		for _, sp := range s.Specials {
			totalSpecials += sp.Count
		}
	}

	totals := models.SppgSchoolTotals{
		Quota:    totalQuota,
		Present:  totalPresent,
		Updated:  updatedCount,
		Total:    len(schools),
		Specials: totalSpecials,
	}

	return &models.SppgSchoolBundle{
		SppgID:      sppgID,
		KitchenName: kitchenName,
		KitchenCode: kitchenCode,
		Depot:       depot,
		Deadline:    "05:00",
		Totals:      totals,
		Schools:     schools,
	}, nil
}

// Helpers
func calculatePackingQuota(enrolled, present, reduceSpecial int, updatedAt string) int {
	if updatedAt == "" {
		return enrolled
	}
	q := present - reduceSpecial
	if q < 0 {
		return 0
	}
	return q
}

func calculateAttendanceStatus(updatedAt string) models.AttendanceStatusInfo {
	if updatedAt == "" {
		return models.AttendanceStatusInfo{
			Label:  "Belum update",
			Tone:   "bg-slate-100 text-slate-600",
			OnTime: false,
		}
	}

	// Format "HH:MM"
	parts := strings.Split(updatedAt, ":")
	if len(parts) == 2 {
		h, _ := strconv.Atoi(parts[0])
		m, _ := strconv.Atoi(parts[1])
		if (h < 5) || (h == 5 && m == 0) {
			return models.AttendanceStatusInfo{
				Label:  fmt.Sprintf("Update %s", updatedAt),
				Tone:   "bg-emerald-50 text-emerald-800",
				OnTime: true,
			}
		}
	}

	return models.AttendanceStatusInfo{
		Label:  fmt.Sprintf("Telat %s", updatedAt),
		Tone:   "bg-amber-50 text-amber-900",
		OnTime: false,
	}
}

func updateLinkedAttendanceRecord(ctx context.Context, npsn string, present, registered int, notes string) error {
	_, err := database.Pool().Exec(ctx, `
		UPDATE attendances
		SET present_students = $1,
		    registered_students = $2,
		    notes = $3
		WHERE school_npsn = $4 AND date = CURRENT_DATE
	`, present, registered, notes, npsn)
	return err
}
