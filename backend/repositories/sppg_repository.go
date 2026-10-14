package repositories

import (
	"backend/database"
	"backend/models"
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/jackc/pgx/v5"
)

// Aksi superadmin terhadap dapur SPPG yang wajib diaudit (SUPERADMIN.md Bab 3).
const (
	AuditSppgWarning     = "sppg.warning"
	AuditSppgSuspend     = "sppg.suspend"
	AuditSppgReinstate   = "sppg.reinstate"
	AuditSppgQuota       = "sppg.quota"
	AuditSppgRecipeAudit = "sppg.recipe.audit"
	AuditSppgProfile     = "sppg.profile.update"
)

// SppgRepository adalah persistence untuk direktori dapur SPPG.
//
// Skor akreditasi tidak disimpan sebagai angka final yang bisa basi: seluruhnya
// dihitung ulang dari tabel deliveries (hasil pindai AI dan suhu boks) setiap
// kali roster dibaca.
type SppgRepository interface {
	List(ctx context.Context) ([]models.SPPGKitchen, error)
	Get(ctx context.Context, id string) (*models.SPPGKitchen, error)
	IssueWarning(ctx context.Context, id, letterType, letterNumber, reason, deadline, actorID string) (*models.SPPGKitchen, error)
	Suspend(ctx context.Context, id, reason, alternativeID, actorID string) (*models.SPPGKitchen, error)
	Reinstate(ctx context.Context, id, reason string, initialQuota int, actorID string) (*models.SPPGKitchen, error)
	UpdateQuota(ctx context.Context, id string, quota int, reason, actorID string) (*models.SPPGKitchen, error)
	UpdateName(ctx context.Context, id, name, actorID string) (*models.SPPGKitchen, error)
	RecordRecipeAudit(ctx context.Context, id, tkpiStatus, auditor, notes string, deviation float64, actorID string) (*models.SPPGKitchen, error)
}

type pgSppgRepository struct{}

// NewSppgRepository returns the PostgreSQL-backed SppgRepository.
func NewSppgRepository() SppgRepository { return &pgSppgRepository{} }

// sppgColumns memilih profil dapurnya beserta audit resep dan status teguran.
const sppgColumns = `
	k.id, k.code, k.name, k.legal_entity, k.type, k.type_label, k.address, k.subdistrict,
	k.city, k.province, k.cluster, k.coordinates, k.manager_name, k.manager_nip, k.manager_phone,
	k.nutritionist_name, k.nutritionist_str, k.staff_count, k.kitchen_area, k.fleet_count,
	k.fleet_type, k.max_daily_portions, k.active_quota, k.safety_score, k.cold_chain_score,
	k.timeliness_score, k.composite_score, k.grade, k.status,
	COALESCE(k.tkpi_status, 'PENDING'), COALESCE(k.avg_deviation_pct, 0),
	k.recipe_audited_at, k.recipe_auditor, k.suspended_reason, k.suspended_at,
	k.quota_updated_at, k.quota_updated_by, k.created_at, k.updated_at`

func scanSppg(row interface{ Scan(...any) error }) (*models.SPPGKitchen, error) {
	k := &models.SPPGKitchen{}
	if err := row.Scan(
		&k.ID, &k.Code, &k.Name, &k.LegalEntity, &k.Type, &k.TypeLabel, &k.Address,
		&k.Subdistrict, &k.City, &k.Province, &k.Cluster, &k.Coordinates, &k.ManagerName,
		&k.ManagerNIP, &k.ManagerPhone, &k.NutritionistName, &k.NutritionistSTR, &k.StaffCount,
		&k.KitchenArea, &k.FleetCount, &k.FleetType, &k.MaxDailyPortions, &k.ActiveQuota,
		&k.SafetyScore, &k.ColdChainScore, &k.TimelinessScore, &k.CompositeScore, &k.Grade,
		&k.Status, &k.TkpiStatus, &k.AvgDeviationPct, &k.RecipeAuditedAt, &k.RecipeAuditor,
		&k.SuspendedReason, &k.SuspendedAt, &k.QuotaUpdatedAt, &k.QuotaUpdatedBy,
		&k.CreatedAt, &k.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return k, nil
}

// List mengembalikan seluruh dapurnya lengkap dengan sekolah binaan,
// skor nyata, dan riwayat surat peringatan.
func (r *pgSppgRepository) List(ctx context.Context) ([]models.SPPGKitchen, error) {
	rows, err := database.Pool().Query(ctx,
		`SELECT`+sppgColumns+` FROM sppg_kitchens k ORDER BY k.name ASC`)
	if err != nil {
		return nil, fmt.Errorf("query sppg: %w", err)
	}
	defer rows.Close()

	var list []models.SPPGKitchen
	for rows.Next() {
		k, err := scanSppg(rows)
		if err != nil {
			return nil, fmt.Errorf("scan sppg: %w", err)
		}
		list = append(list, *k)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return r.enrichAll(ctx, list)
}

// Get mengembalikan satu dapur dengan pengayaan yang sama seperti List.
func (r *pgSppgRepository) Get(ctx context.Context, id string) (*models.SPPGKitchen, error) {
	k, err := scanSppg(database.Pool().QueryRow(ctx,
		`SELECT`+sppgColumns+` FROM sppg_kitchens k WHERE k.id = $1`, id))
	if err != nil {
		return nil, err
	}
	list, err := r.enrichAll(ctx, []models.SPPGKitchen{*k})
	if err != nil {
		return nil, err
	}
	return &list[0], nil
}

// enrichAll mengisi data turunan setiap dapur dalam satu lintasan query per
// sumber data, bukan per dapurnya (menghindari N+1).
func (r *pgSppgRepository) enrichAll(ctx context.Context, list []models.SPPGKitchen) ([]models.SPPGKitchen, error) {
	ids := make([]string, len(list))
	for i, k := range list {
		ids[i] = k.ID
	}

	schools, err := r.assignedSchools(ctx, ids)
	if err != nil {
		return nil, err
	}
	letters, err := r.warningLetters(ctx, ids)
	if err != nil {
		return nil, err
	}
	trends, err := r.complianceTrend(ctx, ids)
	if err != nil {
		return nil, err
	}

	for i := range list {
		list[i].AssignedSchools = schools[list[i].ID]
		if list[i].AssignedSchools == nil {
			list[i].AssignedSchools = []models.SppgAssignedSchool{}
		}
		list[i].WarningLetters = letters[list[i].ID]
		if list[i].WarningLetters == nil {
			list[i].WarningLetters = []models.SppgWarningLetter{}
		}
		list[i].ComplianceTrend = trends[list[i].ID]
		if list[i].ComplianceTrend == nil {
			list[i].ComplianceTrend = []float64{}
		}
	}
	return list, nil
}

// assignedSchools membaca sekolah yang ditugaskan ke tiap dapur beserta porsi
// hari ini, mengikuti relasi schools.sppg_id.
func (r *pgSppgRepository) assignedSchools(ctx context.Context, ids []string) (map[string][]models.SppgAssignedSchool, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	rows, err := database.Pool().Query(ctx, `
		SELECT s.sppg_id, s.npsn, s.name, s.city, COALESCE(a.delivered_portions, 0)
		FROM schools s
		LEFT JOIN attendances a ON a.school_npsn = s.npsn AND a.date = CURRENT_DATE
		WHERE s.sppg_id = ANY($1)
		ORDER BY s.name ASC`, ids)
	if err != nil {
		return nil, fmt.Errorf("query sekolah dapur: %w", err)
	}
	defer rows.Close()

	out := map[string][]models.SppgAssignedSchool{}
	for rows.Next() {
		var sppgID string
		var s models.SppgAssignedSchool
		if err := rows.Scan(&sppgID, &s.NPSN, &s.Name, &s.City, &s.PortionsToday); err != nil {
			return nil, fmt.Errorf("scan sekolah dapurnya: %w", err)
		}
		out[sppgID] = append(out[sppgID], s)
	}
	return out, rows.Err()
}

// warningLetters membaca seluruh surat peringatan yang pernah terbit.
func (r *pgSppgRepository) warningLetters(ctx context.Context, ids []string) (map[string][]models.SppgWarningLetter, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	rows, err := database.Pool().Query(ctx, `
		SELECT sppg_id, id, letter_type, letter_number, reason, deadline_label, status, issued_by, created_at
		FROM sppg_warning_letters
		WHERE sppg_id = ANY($1)
		ORDER BY created_at DESC`, ids)
	if err != nil {
		return nil, fmt.Errorf("query surat peringatan: %w", err)
	}
	defer rows.Close()

	out := map[string][]models.SppgWarningLetter{}
	for rows.Next() {
		var sppgID string
		var w models.SppgWarningLetter
		if err := rows.Scan(&sppgID, &w.ID, &w.Type, &w.LetterNumber, &w.Reason, &w.DeadlineLabel,
			&w.Status, &w.IssuedBy, &w.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan surat peringatan: %w", err)
		}
		w.SppgID = sppgID
		out[sppgID] = append(out[sppgID], w)
	}
	return out, rows.Err()
}

// complianceTrend menghitung persentase pindai layak per hari selama 7 hari
// terakhir per dapur.
//
// Angka inilah yang jadi dasar penerbitan SP-1/SP-2 (ambang 85% selama 7 hari
// berturut-turut), jadi harus berasal dari scan nyata, bukan mock frontend.
func (r *pgSppgRepository) complianceTrend(ctx context.Context, ids []string) (map[string][]float64, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	rows, err := database.Pool().Query(ctx, `
		SELECT sppg_id, scan_date,
		       COALESCE(100.0 * COUNT(*) FILTER (WHERE ai_verdict = 'layak') / NULLIF(COUNT(*), 0), 0) AS pct
		FROM deliveries
		WHERE sppg_id = ANY($1) AND scan_date >= CURRENT_DATE - INTERVAL '6 days'
		GROUP BY sppg_id, scan_date`, ids)
	if err != nil {
		return nil, fmt.Errorf("query tren kepatuhan: %w", err)
	}
	defer rows.Close()

	type point struct {
		day time.Time
		pct float64
	}
	points := map[string][]point{}
	for rows.Next() {
		var sppgID string
		var day time.Time
		var pct float64
		if err := rows.Scan(&sppgID, &day, &pct); err != nil {
			return nil, fmt.Errorf("scan tren kepatuhan: %w", err)
		}
		points[sppgID] = append(points[sppgID], point{day: day, pct: pct})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Selaraskan semua dapurnya pada 7 hari kalender yang sama, sehingga grafik
	// di panel bisa dibandingkan berdampingan tanpa celah tersembunyi.
	out := map[string][]float64{}
	for _, id := range ids {
		byDay := map[string]float64{}
		for _, p := range points[id] {
			byDay[p.day.Format("2006-01-02")] = p.pct
		}
		trend := make([]float64, 0, 7)
		for i := 6; i >= 0; i-- {
			day := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
			trend = append(trend, round1(byDay[day]))
		}
		out[id] = trend
	}
	return out, nil
}

// IssueWarning menerbitkan surat peringatan dan menandai status dapurnya.
func (r *pgSppgRepository) IssueWarning(ctx context.Context, id, letterType, letterNumber, reason, deadline, actorID string) (*models.SPPGKitchen, error) {
	k, err := r.run(ctx, `
		UPDATE sppg_kitchens
		SET status = 'warning', updated_at = NOW()
		WHERE id = $6
		RETURNING id`,
		mutation{
			actorID: actorID, action: AuditSppgWarning, target: id,
			detail: auditDetail("letterType", letterType, reason),
			args:   []any{id},
		})
	if err != nil {
		return nil, err
	}

	letterID := fmt.Sprintf("SPW-%s-%d", id, time.Now().UnixNano())
	if _, err := database.Pool().Exec(ctx, `
		INSERT INTO sppg_warning_letters
			(id, sppg_id, letter_type, letter_number, reason, deadline_label, status, issued_by)
		VALUES ($1, $2, $3, $4, $5, $6, 'Menunggu Tanggapan / Rencana Aksi Korektif', $7)`,
		letterID, id, letterType, letterNumber, reason, deadline, actorID); err != nil {
		return nil, fmt.Errorf("simpan surat peringatan: %w", err)
	}
	return r.Get(ctx, k.ID)
}

// Suspend membekukan hak masak & distribusi, menonaktifkan kuotanya.
func (r *pgSppgRepository) Suspend(ctx context.Context, id, reason, alternativeID, actorID string) (*models.SPPGKitchen, error) {
	k, err := r.run(ctx, `
		UPDATE sppg_kitchens
		SET status = '`+models.SppgSuspended+`', active_quota = 0,
		    suspended_reason = $7, suspended_at = NOW(), updated_at = NOW()
		WHERE id = $6
		RETURNING id`,
		mutation{
			actorID: actorID, action: AuditSppgSuspend, target: id,
			detail: auditDetail("alternativeSppgId", alternativeID, reason),
			args:   []any{id, reason},
		})
	if err != nil {
		return nil, err
	}

	letterID := fmt.Sprintf("SPW-%s-%d", id, time.Now().UnixNano())
	if _, err := database.Pool().Exec(ctx, `
		INSERT INTO sppg_warning_letters
			(id, sppg_id, letter_type, letter_number, reason, deadline_label, status, issued_by)
		VALUES ($1, $2, '`+models.SppgLetterSuspension+`', $3, $4, 'Tindak lanjut langsung', 'DIBEKUKAN', $5)`,
		letterID, id, "BGN/SUSPENSION/MBG/"+id, reason, actorID); err != nil {
		return nil, fmt.Errorf("simpan dokumen penangguhan: %w", err)
	}

	// Alihkan sekolah binaan ke dapur alternatif agar suplai MBG tetap berjalan
	if _, err := database.Pool().Exec(ctx, `
		UPDATE schools
		SET sppg_id = $1
		WHERE sppg_id = $2`, alternativeID, id); err != nil {
		return nil, fmt.Errorf("rerouting sekolah binaan: %w", err)
	}

	return r.Get(ctx, k.ID)
}

// Reinstate memulihkan hak masak & distribusi dapur yang sebelumnya dibekukan.
func (r *pgSppgRepository) Reinstate(ctx context.Context, id, reason string, initialQuota int, actorID string) (*models.SPPGKitchen, error) {
	k, err := r.run(ctx, `
		UPDATE sppg_kitchens
		SET status = '`+models.SppgActive+`', active_quota = $7,
		    suspended_reason = '', suspended_at = NULL, updated_at = NOW()
		WHERE id = $6
		RETURNING id`,
		mutation{
			actorID: actorID, action: AuditSppgReinstate, target: id,
			detail: auditDetail("initialQuota", fmt.Sprint(initialQuota), reason),
			args:   []any{id, initialQuota},
		})
	if err != nil {
		return nil, err
	}
	return r.Get(ctx, k.ID)
}

// UpdateQuota menetapkan kuota produksi harian, tidak boleh melebihi kapasitas.
func (r *pgSppgRepository) UpdateQuota(ctx context.Context, id string, quota int, reason, actorID string) (*models.SPPGKitchen, error) {
	k, err := r.run(ctx, `
		UPDATE sppg_kitchens
		SET active_quota = $7, quota_updated_at = NOW(), quota_updated_by = $8, updated_at = NOW()
		WHERE id = $6 AND $7 <= max_daily_portions
		RETURNING id`,
		mutation{
			actorID: actorID, action: AuditSppgQuota, target: id,
			detail: auditDetail("activeQuota", fmt.Sprint(quota), reason),
			args:   []any{id, quota, actorID},
		})
	if err != nil {
		return nil, err
	}
	return k, nil
}

// RecordRecipeAudit menyimpan hasil audit gramatur resep terhadap TKPI.
func (r *pgSppgRepository) RecordRecipeAudit(ctx context.Context, id, tkpiStatus, auditor, notes string, deviation float64, actorID string) (*models.SPPGKitchen, error) {
	k, err := r.run(ctx, `
		UPDATE sppg_kitchens
		SET tkpi_status = $7, avg_deviation_pct = $8, recipe_auditor = $9,
		    recipe_audited_at = NOW(), updated_at = NOW()
		WHERE id = $6
		RETURNING id`,
		mutation{
			actorID: actorID, action: AuditSppgRecipeAudit, target: id,
			detail: auditDetail("tkpiStatus", tkpiStatus, notes),
			args:   []any{id, tkpiStatus, deviation, auditor},
		})
	if err != nil {
		return nil, err
	}
	return k, nil
}

// UpdateName memperbarui nama tampilan dapur (self-service akun SPPG).
func (r *pgSppgRepository) UpdateName(ctx context.Context, id, name, actorID string) (*models.SPPGKitchen, error) {
	k, err := r.run(ctx, `
		UPDATE sppg_kitchens
		SET name = $6, updated_at = NOW()
		WHERE id = $7
		RETURNING id`,
		mutation{
			actorID: actorID, action: AuditSppgProfile, target: id,
			detail: auditDetail("name", name, ""),
			args:   []any{name, id},
		})
	if err != nil {
		return nil, err
	}
	return k, nil
}

// run membungkus runAudited dan langsung memuat profil dapurnya.
// run menyatukan statement dengan jejak auditnya, mengeksekusi, lalu
// mengembalikan profil dapurnya dalam keadaan TERBARU (bukan instance basi).
func (r *pgSppgRepository) run(ctx context.Context, statement string, m mutation) (*models.SPPGKitchen, error) {
	m.statement = statement
	got, err := runAudited(ctx, auditTemplate, m, func(ctx context.Context, id string) (any, error) {
		return r.Get(ctx, id)
	})
	if err != nil {
		return nil, err
	}
	return got.(*models.SPPGKitchen), nil
}

func round1(v float64) float64 {
	return math.Round(v*10) / 10
}
