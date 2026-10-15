package repositories

import (
	"backend/database"
	"backend/models"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NoticeRepository menyediakan interface akses data untuk papan pengumuman & edaran darurat Satgas MBG.
type NoticeRepository interface {
	List(ctx context.Context, filter models.NoticeFilter) ([]models.Notice, error)
	GetByID(ctx context.Context, id string) (*models.Notice, error)
	Create(ctx context.Context, req models.CreateNoticeRequest, actor models.User) (*models.Notice, error)
	BroadcastFlashAlert(ctx context.Context, id string, actor models.User) (*models.Notice, error)
	ToggleArchive(ctx context.Context, id string, isArchiving bool, actor models.User) (*models.Notice, error)
	Delete(ctx context.Context, id string, actor models.User) error
	Acknowledge(ctx context.Context, id string, validatorID string) error
}

type postgresNoticeRepository struct {
	pool *pgxpool.Pool
}

// NewNoticeRepository membuat instance postgresNoticeRepository.
func NewNoticeRepository(pool *pgxpool.Pool) NoticeRepository {
	if pool == nil {
		pool = database.Pool()
	}
	return &postgresNoticeRepository{pool: pool}
}

const baseNoticeSelect = `
	SELECT 
		id, ref_number, title, category, urgency, target_audience, scope_region,
		published_at, effective_date, author_name, author_role, content,
		is_flash_alert, requires_acknowledgement, status, status_label, COALESCE(status_reason, ''),
		COALESCE(acknowledgement_stats, '{"totalRecipients": 0, "acknowledgedCount": 0, "complianceRate": 0}'::jsonb),
		COALESCE(attachments, '[]'::jsonb),
		created_at, COALESCE(updated_at, created_at)
	FROM notices
`

func resolveLabels(n *models.Notice) {
	switch n.Category {
	case "circular":
		n.CategoryLabel = "Surat Edaran BGN"
	case "seasonal":
		n.CategoryLabel = "Peringatan Higienitas Musiman"
	case "system":
		n.CategoryLabel = "Pembaruan Sistem & AI"
	default:
		n.CategoryLabel = "Pengumuman Umum"
	}

	switch n.Urgency {
	case "critical":
		n.UrgencyLabel = "Panggilan Darurat (Flash Alert)"
	case "important":
		n.UrgencyLabel = "Penting"
	case "info":
		n.UrgencyLabel = "Info Biasa"
	default:
		n.UrgencyLabel = "Info Biasa"
	}

	switch n.TargetAudience {
	case "validators":
		n.TargetAudienceLabel = "Hanya Guru Validator Sekolah"
	case "sppg":
		n.TargetAudienceLabel = "Hanya Dapur SPPG & Katering"
	case "all":
		n.TargetAudienceLabel = "Semua Pihak (Nasional)"
	default:
		n.TargetAudienceLabel = "Semua Pihak (Nasional)"
	}

	switch n.Status {
	case "archived":
		n.StatusLabel = "Diarsipkan"
	case "active":
		n.StatusLabel = "Tayang Publik"
	}

	n.Author = models.NoticeAuthor{
		Name: n.AuthorName,
		Role: n.AuthorRole,
	}
}

func scanNotice(row pgx.Row) (*models.Notice, error) {
	var n models.Notice
	var ackBytes []byte
	var attBytes []byte

	err := row.Scan(
		&n.ID, &n.RefNumber, &n.Title, &n.Category, &n.Urgency,
		&n.TargetAudience, &n.ScopeRegion, &n.PublishedAt, &n.EffectiveDate,
		&n.AuthorName, &n.AuthorRole, &n.Content,
		&n.IsFlashAlert, &n.RequiresAcknowledgement, &n.Status, &n.StatusLabel,
		&n.StatusReason, &ackBytes, &attBytes,
		&n.CreatedAt, &n.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("scan notice: %w", err)
	}

	if len(ackBytes) > 0 {
		_ = json.Unmarshal(ackBytes, &n.AcknowledgementStats)
	}
	if len(attBytes) > 0 {
		n.Attachments = json.RawMessage(attBytes)
	} else {
		n.Attachments = json.RawMessage("[]")
	}

	resolveLabels(&n)
	return &n, nil
}

func (r *postgresNoticeRepository) List(ctx context.Context, filter models.NoticeFilter) ([]models.Notice, error) {
	query := baseNoticeSelect + " WHERE 1=1"
	var args []interface{}
	argIdx := 1

	if filter.Search != "" {
		s := "%" + strings.ToLower(filter.Search) + "%"
		query += fmt.Sprintf(" AND (LOWER(title) LIKE $%d OR LOWER(ref_number) LIKE $%d OR LOWER(content) LIKE $%d OR LOWER(author_name) LIKE $%d OR LOWER(scope_region) LIKE $%d)",
			argIdx, argIdx, argIdx, argIdx, argIdx)
		args = append(args, s)
		argIdx++
	}

	if filter.Category != "" && filter.Category != "all" {
		query += fmt.Sprintf(" AND category = $%d", argIdx)
		args = append(args, filter.Category)
		argIdx++
	}

	if filter.Urgency != "" && filter.Urgency != "all" {
		query += fmt.Sprintf(" AND urgency = $%d", argIdx)
		args = append(args, filter.Urgency)
		argIdx++
	}

	if filter.TargetAudience != "" && filter.TargetAudience != "all" {
		query += fmt.Sprintf(" AND target_audience = $%d", argIdx)
		args = append(args, filter.TargetAudience)
		argIdx++
	}

	if filter.Status != "" && filter.Status != "all" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, filter.Status)
		argIdx++
	}

	query += " ORDER BY created_at DESC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list notices: %w", err)
	}
	defer rows.Close()

	var list []models.Notice
	for rows.Next() {
		var n models.Notice
		var ackBytes []byte
		var attBytes []byte

		if err := rows.Scan(
			&n.ID, &n.RefNumber, &n.Title, &n.Category, &n.Urgency,
			&n.TargetAudience, &n.ScopeRegion, &n.PublishedAt, &n.EffectiveDate,
			&n.AuthorName, &n.AuthorRole, &n.Content,
			&n.IsFlashAlert, &n.RequiresAcknowledgement, &n.Status, &n.StatusLabel,
			&n.StatusReason, &ackBytes, &attBytes,
			&n.CreatedAt, &n.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan list notice: %w", err)
		}

		if len(ackBytes) > 0 {
			_ = json.Unmarshal(ackBytes, &n.AcknowledgementStats)
		}
		if len(attBytes) > 0 {
			n.Attachments = json.RawMessage(attBytes)
		} else {
			n.Attachments = json.RawMessage("[]")
		}

		resolveLabels(&n)
		list = append(list, n)
	}

	return list, nil
}

func (r *postgresNoticeRepository) GetByID(ctx context.Context, id string) (*models.Notice, error) {
	query := baseNoticeSelect + " WHERE id = $1"
	row := r.pool.QueryRow(ctx, query, id)
	return scanNotice(row)
}

func (r *postgresNoticeRepository) Create(ctx context.Context, req models.CreateNoticeRequest, actor models.User) (*models.Notice, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	newID := fmt.Sprintf("NOT-%d-%s", time.Now().Year(), strings.ToUpper(uuid.New().String()[:4]))

	refNumber := req.RefNumber
	if refNumber == "" {
		refNumber = fmt.Sprintf("BGN/SE/%s/%s/%d", strings.ToUpper(uuid.New().String()[:3]), time.Now().Format("01"), time.Now().Year())
	}

	scopeRegion := req.ScopeRegion
	if scopeRegion == "" {
		scopeRegion = "Nasional (Seluruh Indonesia)"
	}

	authorName := req.AuthorName
	if authorName == "" {
		authorName = actor.FullName
		if authorName == "" {
			authorName = "Badan Gizi Nasional (BGN)"
		}
	}

	authorRole := req.AuthorRole
	if authorRole == "" {
		authorRole = "Pusat Komando Satgas MBG"
	}

	publishedAt := time.Now().Format("02 Jan 2006, 15:04 WIB")
	effectiveDate := req.EffectiveDate
	if effectiveDate == "" {
		effectiveDate = "Berlaku Segera"
	}

	isFlash := req.IsFlashAlert || req.Urgency == "critical"
	requiresAck := req.RequiresAcknowledgement || isFlash

	totalRecipients := 1850
	switch req.TargetAudience {
	case "sppg":
		totalRecipients = 180
	case "validators":
		totalRecipients = 1250
	}

	ackStats := models.NoticeAcknowledgementStats{
		TotalRecipients:   totalRecipients,
		AcknowledgedCount: 0,
		ComplianceRate:    0.0,
	}
	ackBytes, _ := json.Marshal(ackStats)

	var attList []models.NoticeAttachment
	if req.AttachmentName != "" {
		attSize := req.AttachmentSize
		if attSize == "" {
			attSize = "1.5 MB"
		}
		attList = append(attList, models.NoticeAttachment{
			FileName:          req.AttachmentName,
			FileSize:          attSize,
			VerifiedSignature: "Terverifikasi Digital BSrE",
		})
	}
	attBytes, _ := json.Marshal(attList)

	statusReason := ""
	if isFlash {
		statusReason = "Siaran Flash Alert Aktif. Aplikasi validator terkunci hingga konfirmasi diterima."
	}

	insertQuery := `
		INSERT INTO notices (
			id, ref_number, title, category, urgency, target_audience, scope_region,
			published_at, effective_date, author_name, author_role, content,
			is_flash_alert, requires_acknowledgement, status, status_label, status_reason,
			acknowledgement_stats, attachments, created_at, updated_at
		)
		VALUES (
			$1, $2, $3, $4, $5, $6, $7,
			$8, $9, $10, $11, $12,
			$13, $14, 'active', 'Tayang Publik', $15,
			$16, $17, NOW(), NOW()
		)
	`
	_, err = tx.Exec(ctx, insertQuery,
		newID, refNumber, req.Title, req.Category, req.Urgency, req.TargetAudience, scopeRegion,
		publishedAt, effectiveDate, authorName, authorRole, req.Content,
		isFlash, requiresAck, statusReason,
		ackBytes, attBytes,
	)
	if err != nil {
		return nil, fmt.Errorf("insert notice: %w", err)
	}

	// Write Audit Log
	auditDetails, _ := json.Marshal(map[string]interface{}{
		"noticeId":       newID,
		"refNumber":      refNumber,
		"title":          req.Title,
		"category":       req.Category,
		"urgency":        req.Urgency,
		"targetAudience": req.TargetAudience,
		"isFlashAlert":   isFlash,
	})
	auditQuery := `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, 'notice.create', $3, $4, NOW())
	`
	actorID := actor.ID
	if actorID == "" {
		actorID = actor.Email
	}
	_, err = tx.Exec(ctx, auditQuery, uuid.New().String(), actorID, newID, string(auditDetails))
	if err != nil {
		return nil, fmt.Errorf("write audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return r.GetByID(ctx, newID)
}

func (r *postgresNoticeRepository) BroadcastFlashAlert(ctx context.Context, id string, actor models.User) (*models.Notice, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var currentTitle string
	checkQuery := `SELECT title FROM notices WHERE id = $1`
	if err := tx.QueryRow(ctx, checkQuery, id).Scan(&currentTitle); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("notice with ID '%s' not found", id)
		}
		return nil, fmt.Errorf("check notice: %w", err)
	}

	updateQuery := `
		UPDATE notices
		SET urgency = 'critical',
		    is_flash_alert = TRUE,
		    requires_acknowledgement = TRUE,
		    status = 'active',
		    status_label = 'Tayang Publik',
		    status_reason = 'Siaran Flash Alert Aktif. Aplikasi validator terkunci hingga konfirmasi diterima.',
		    updated_at = NOW()
		WHERE id = $1
	`
	if _, err := tx.Exec(ctx, updateQuery, id); err != nil {
		return nil, fmt.Errorf("update flash alert: %w", err)
	}

	auditDetails, _ := json.Marshal(map[string]interface{}{
		"noticeId": id,
		"title":    currentTitle,
		"action":   "BROADCAST_FLASH_ALERT",
		"urgency":  "critical",
	})
	auditQuery := `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, 'notice.flash_alert', $3, $4, NOW())
	`
	actorID := actor.ID
	if actorID == "" {
		actorID = actor.Email
	}
	if _, err := tx.Exec(ctx, auditQuery, uuid.New().String(), actorID, id, string(auditDetails)); err != nil {
		return nil, fmt.Errorf("write audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return r.GetByID(ctx, id)
}

func (r *postgresNoticeRepository) ToggleArchive(ctx context.Context, id string, isArchiving bool, actor models.User) (*models.Notice, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var currentTitle string
	checkQuery := `SELECT title FROM notices WHERE id = $1`
	if err := tx.QueryRow(ctx, checkQuery, id).Scan(&currentTitle); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("notice with ID '%s' not found", id)
		}
		return nil, fmt.Errorf("check notice: %w", err)
	}

	newStatus := "active"
	newLabel := "Tayang Publik"
	newReason := ""
	if isArchiving {
		newStatus = "archived"
		newLabel = "Diarsipkan"
		newReason = "Pengumuman telah diarsipkan dari papan publik Satgas MBG."
	}

	updateQuery := `
		UPDATE notices
		SET status = $1,
		    status_label = $2,
		    status_reason = $3,
		    updated_at = NOW()
		WHERE id = $4
	`
	if _, err := tx.Exec(ctx, updateQuery, newStatus, newLabel, newReason, id); err != nil {
		return nil, fmt.Errorf("toggle archive: %w", err)
	}

	auditAction := "notice.archive"
	if !isArchiving {
		auditAction = "notice.unarchive"
	}
	auditDetails, _ := json.Marshal(map[string]interface{}{
		"noticeId":    id,
		"title":       currentTitle,
		"isArchiving": isArchiving,
		"newStatus":   newStatus,
	})
	auditQuery := `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, $3, $4, $5, NOW())
	`
	actorID := actor.ID
	if actorID == "" {
		actorID = actor.Email
	}
	if _, err := tx.Exec(ctx, auditQuery, uuid.New().String(), actorID, auditAction, id, string(auditDetails)); err != nil {
		return nil, fmt.Errorf("write audit log: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return r.GetByID(ctx, id)
}

func (r *postgresNoticeRepository) Delete(ctx context.Context, id string, actor models.User) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var currentTitle string
	checkQuery := `SELECT title FROM notices WHERE id = $1`
	if err := tx.QueryRow(ctx, checkQuery, id).Scan(&currentTitle); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("notice with ID '%s' not found", id)
		}
		return fmt.Errorf("check notice: %w", err)
	}

	deleteQuery := `DELETE FROM notices WHERE id = $1`
	if _, err := tx.Exec(ctx, deleteQuery, id); err != nil {
		return fmt.Errorf("delete notice: %w", err)
	}

	auditDetails, _ := json.Marshal(map[string]interface{}{
		"noticeId": id,
		"title":    currentTitle,
		"deleted":  true,
	})
	auditQuery := `
		INSERT INTO audit_logs (id, actor_id, action, target, detail, at)
		VALUES ($1, $2, 'notice.delete', $3, $4, NOW())
	`
	actorID := actor.ID
	if actorID == "" {
		actorID = actor.Email
	}
	if _, err := tx.Exec(ctx, auditQuery, uuid.New().String(), actorID, id, string(auditDetails)); err != nil {
		return fmt.Errorf("write audit log: %w", err)
	}

	return tx.Commit(ctx)
}

func (r *postgresNoticeRepository) Acknowledge(ctx context.Context, id string, validatorID string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var ackBytes []byte
	selectQuery := `SELECT acknowledgement_stats FROM notices WHERE id = $1 FOR UPDATE`
	if err := tx.QueryRow(ctx, selectQuery, id).Scan(&ackBytes); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("notice with ID '%s' not found", id)
		}
		return fmt.Errorf("select ack stats: %w", err)
	}

	var stats models.NoticeAcknowledgementStats
	if len(ackBytes) > 0 {
		_ = json.Unmarshal(ackBytes, &stats)
	}

	if stats.TotalRecipients == 0 {
		stats.TotalRecipients = 1250
	}
	stats.AcknowledgedCount++
	if stats.AcknowledgedCount > stats.TotalRecipients {
		stats.TotalRecipients = stats.AcknowledgedCount
	}
	stats.ComplianceRate = float64(stats.AcknowledgedCount) / float64(stats.TotalRecipients) * 100

	newAckBytes, err := json.Marshal(stats)
	if err != nil {
		return fmt.Errorf("marshal ack stats: %w", err)
	}

	updateQuery := `UPDATE notices SET acknowledgement_stats = $1, updated_at = NOW() WHERE id = $2`
	if _, err := tx.Exec(ctx, updateQuery, newAckBytes, id); err != nil {
		return fmt.Errorf("update ack stats: %w", err)
	}

	return tx.Commit(ctx)
}
