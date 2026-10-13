package repositories

import (
	"backend/database"
	"backend/models"
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// ScanRepository defines persistence operations for scan audit logs.
type ScanRepository interface {
	FindBatch(ctx context.Context, idOrQR string) (*models.ScanBatchInfo, error)
	InsertScan(ctx context.Context, log *models.ScanLog) error
	CountToday(ctx context.Context) (int, error)
	ListRecentScans(ctx context.Context, actorID string, limit int) ([]models.ScanLog, error)
	UpdateScanFeedback(ctx context.Context, id string, rating int, feedback string, tempC *float64) error
	DeleteScan(ctx context.Context, actorID, id string) (string, error)
	DeleteAllScans(ctx context.Context, actorID string) ([]string, error)
}

type pgScanRepository struct{}

// NewScanRepository returns the PostgreSQL-backed ScanRepository.
func NewScanRepository() ScanRepository {
	return &pgScanRepository{}
}

const scanColumns = `id, box_id, qr_token, batch_id, image_ref, ai_class, ai_confidence,
	visual_score, holding_temp_c, release_temp_c, verdict, reason, actor_id, created_at, rating, feedback,
	menu_name, menu_class, menu_display, menu_confidence`

func (r *pgScanRepository) scanLog(row pgx.Row) (*models.ScanLog, error) {
	s := &models.ScanLog{}
	err := row.Scan(&s.ID, &s.BoxID, &s.QRToken, &s.BatchID, &s.ImageRef,
		&s.AIClass, &s.AIConfidence, &s.VisualScore, &s.HoldingTempC, &s.ReleaseTempC,
		&s.Verdict, &s.Reason, &s.ActorID, &s.CreatedAt, &s.Rating, &s.Feedback,
		&s.MenuName, &s.MenuClass, &s.MenuDisplay, &s.MenuConfidence)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return s, nil
}

func (r *pgScanRepository) InsertScan(ctx context.Context, log *models.ScanLog) error {
	createdAt := log.CreatedAt
	if createdAt.IsZero() {
		createdAt = time.Now()
	}
	_, err := database.Pool().Exec(ctx, `
		INSERT INTO scan_logs (id, box_id, qr_token, batch_id, image_ref, ai_class,
			ai_confidence, visual_score, holding_temp_c, release_temp_c, verdict, reason, actor_id, created_at, rating, feedback,
			menu_name, menu_class, menu_display, menu_confidence)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
		log.ID, log.BoxID, log.QRToken, log.BatchID, log.ImageRef, log.AIClass,
		log.AIConfidence, log.VisualScore, log.HoldingTempC, log.ReleaseTempC,
		log.Verdict, log.Reason, log.ActorID, createdAt, log.Rating, log.Feedback,
		log.MenuName, log.MenuClass, log.MenuDisplay, log.MenuConfidence)
	return err
}

func (r *pgScanRepository) CountToday(ctx context.Context) (int, error) {
	var count int
	err := database.Pool().QueryRow(ctx,
		`SELECT COUNT(*) FROM scan_logs WHERE created_at::date = CURRENT_DATE`).Scan(&count)
	return count, err
}

func (r *pgScanRepository) ListRecentScans(ctx context.Context, actorID string, limit int) ([]models.ScanLog, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	rows, err := database.Pool().Query(ctx,
		"SELECT "+scanColumns+" FROM scan_logs WHERE actor_id = $1 ORDER BY created_at DESC LIMIT $2", actorID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.ScanLog
	for rows.Next() {
		entry := models.ScanLog{}
		if err := rows.Scan(&entry.ID, &entry.BoxID, &entry.QRToken, &entry.BatchID,
			&entry.ImageRef, &entry.AIClass, &entry.AIConfidence,
			&entry.VisualScore, &entry.HoldingTempC, &entry.ReleaseTempC,
			&entry.Verdict, &entry.Reason, &entry.ActorID, &entry.CreatedAt,
			&entry.Rating, &entry.Feedback,
			&entry.MenuName, &entry.MenuClass, &entry.MenuDisplay, &entry.MenuConfidence); err != nil {
			return nil, err
		}
		out = append(out, entry)
	}
	return out, rows.Err()
}

// FindBatch looks up a production batch by its ID or QR token and returns
// a ScanBatchInfo summary for the decision card. Returns nil (no error) when
// the batch is not found so callers can show a graceful fallback.
func (r *pgScanRepository) FindBatch(ctx context.Context, idOrQR string) (*models.ScanBatchInfo, error) {
	query := `
		SELECT id, COALESCE(sppg_id,''), COALESCE(menu_name,''),
		       cooking_date::text, COALESCE(school_name,'')
		FROM sppg_batches
		WHERE id = $1 OR token = $1
		LIMIT 1`
	var batchID, sppgID, menuName, productionDate, sppgName string
	err := database.Pool().QueryRow(ctx, query, idOrQR).Scan(
		&batchID, &sppgID, &menuName, &productionDate, &sppgName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	_ = sppgID // reserved for future SPPG lookup
	return &models.ScanBatchInfo{
		BatchID:        batchID,
		SPPGName:       sppgName,
		MenuName:       menuName,
		ProductionDate: productionDate,
	}, nil
}

func (r *pgScanRepository) UpdateScanFeedback(ctx context.Context, id string, rating int, feedback string, tempC *float64) error {
	var err error
	if tempC != nil {
		_, err = database.Pool().Exec(ctx,
			"UPDATE scan_logs SET rating = $1, feedback = $2, holding_temp_c = COALESCE(holding_temp_c, $3) WHERE id = $4",
			rating, feedback, *tempC, id)
	} else {
		_, err = database.Pool().Exec(ctx,
			"UPDATE scan_logs SET rating = $1, feedback = $2 WHERE id = $3",
			rating, feedback, id)
	}
	return err
}

func (r *pgScanRepository) DeleteScan(ctx context.Context, actorID, id string) (string, error) {
	var imageRef string
	err := database.Pool().QueryRow(ctx,
		"DELETE FROM scan_logs WHERE actor_id = $1 AND id = $2 RETURNING image_ref",
		actorID, id).Scan(&imageRef)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", err
	}
	return imageRef, nil
}

func (r *pgScanRepository) DeleteAllScans(ctx context.Context, actorID string) ([]string, error) {
	rows, err := database.Pool().Query(ctx, "DELETE FROM scan_logs WHERE actor_id = $1 RETURNING image_ref", actorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var imageRefs []string
	for rows.Next() {
		var ref string
		if err := rows.Scan(&ref); err == nil && ref != "" {
			imageRefs = append(imageRefs, ref)
		}
	}
	return imageRefs, rows.Err()
}
