package services

import (
	"backend/models"
	"backend/repositories"
	"context"
	"errors"
	"fmt"
	"strings"
)

// Sentinel errors untuk operasi dapur SPPG.
var (
	ErrSppgNotFound     = errors.New("dapur SPPG tidak ditemukan")
	ErrSppgInvalid      = errors.New("permintaan tidak valid")
	ErrSppgSuspended    = errors.New("dapur sedang dibekukan")
	ErrSppgQuotaTooHigh = errors.New("kuota melebihi kapasitas produksi harian dapur")
)

// minWarningReasonLen mencegah teguran tanpa alasan yang bisa diaudit.
const minWarningReasonLen = 20

// SppgService menegakkan aturan bisnis atas direktori dapur SPPG: apakah sebuah
// tindakan wajar untuk kondisi dapurnya saat itu.
type SppgService interface {
	List(ctx context.Context) ([]models.SPPGKitchen, error)
	Get(ctx context.Context, id string) (*models.SPPGKitchen, error)
	IssueWarning(ctx context.Context, actorID, id string, req models.IssueWarningRequest) (*models.SPPGKitchen, error)
	Suspend(ctx context.Context, actorID, id string, req models.SuspendKitchenRequest) (*models.SPPGKitchen, error)
	Reinstate(ctx context.Context, actorID, id string, req models.ReinstateKitchenRequest) (*models.SPPGKitchen, error)
	UpdateQuota(ctx context.Context, actorID, id string, req models.UpdateQuotaRequest) (*models.SPPGKitchen, error)
	UpdateProfile(ctx context.Context, actorID, id string, req models.UpdateSppgProfileRequest) (*models.SPPGKitchen, error)
	RecordRecipeAudit(ctx context.Context, actorID, id string, req models.RecordRecipeAuditRequest) (*models.SPPGKitchen, error)
}

type sppgService struct {
	repo repositories.SppgRepository
}

// NewSppgService wires the SPPG service (Constructor DI).
func NewSppgService(repo repositories.SppgRepository) SppgService {
	return &sppgService{repo: repo}
}

func (s *sppgService) List(ctx context.Context) ([]models.SPPGKitchen, error) {
	list, err := s.repo.List(ctx)
	return list, mapSppgErr(err)
}

func (s *sppgService) Get(ctx context.Context, id string) (*models.SPPGKitchen, error) {
	k, err := s.repo.Get(ctx, strings.TrimSpace(id))
	return k, mapSppgErr(err)
}

// IssueWarning menerbitkan surat teguran resmi.
//
// SP-2 hanya boleh terbit bila SP-1 sebelumnya sudah ada. Urutan ini
// ditegakkan dari riwayat surat dapurnya sendiri, sehingga dua admin yang
// klik bersamaan tidak bisa menerbitkan dua SP-1 untuk satu pelanggaran.
func (s *sppgService) IssueWarning(ctx context.Context, actorID, id string, req models.IssueWarningRequest) (*models.SPPGKitchen, error) {
	k, err := s.mustGet(ctx, id)
	if err != nil {
		return nil, err
	}
	if k.Status == models.SppgSuspended {
		return nil, ErrSppgSuspended
	}

	reason := strings.TrimSpace(req.Reason)
	if len([]rune(reason)) < minWarningReasonLen {
		return nil, ErrSppgInvalid
	}

	letterType := strings.TrimSpace(req.LetterType)
	if !s.letterTypeFits(k, letterType) {
		return nil, ErrSppgInvalid
	}

	number := strings.TrimSpace(req.LetterNumber)
	if number == "" {
		return nil, ErrSppgInvalid
	}

	updated, err := s.repo.IssueWarning(ctx, k.ID, letterType, number, reason, strings.TrimSpace(req.DeadlineLabel), actorID)
	return updated, mapSppgErr(err)
}

// letterTypeFits memastikan nomor surat naik sesuai tahapnya: SP-2 hanya
// setelah SP-1 pernah terbit, SP-1 tidak boleh issued berulang.
func (s *sppgService) letterTypeFits(k *models.SPPGKitchen, letterType string) bool {
	issued := map[string]int{}
	for _, w := range k.WarningLetters {
		if w.Type != models.SppgLetterSuspension {
			issued[w.Type]++
		}
	}

	switch letterType {
	case models.SppgLetterSP1:
		return issued[models.SppgLetterSP1] == 0
	case models.SppgLetterSP2:
		return issued[models.SppgLetterSP1] > 0 && issued[models.SppgLetterSP2] == 0
	default:
		return false
	}
}

// Suspend membekukan dapurnya dan menuntut adanya dapur alternatif, agar
// sekolah binaannya tetap terlayani esok hari.
func (s *sppgService) Suspend(ctx context.Context, actorID, id string, req models.SuspendKitchenRequest) (*models.SPPGKitchen, error) {
	k, err := s.mustGet(ctx, id)
	if err != nil {
		return nil, err
	}

	reason := strings.TrimSpace(req.Reason)
	if len([]rune(reason)) < minWarningReasonLen {
		return nil, ErrSppgInvalid
	}

	alternativeID := strings.TrimSpace(req.AlternativeSppgID)
	if alternativeID == "" || alternativeID == k.ID {
		return nil, ErrSppgInvalid
	}

	alternative, err := s.mustGet(ctx, alternativeID)
	if err != nil {
		return nil, err
	}
	if alternative.Status != models.SppgActive {
		return nil, ErrSppgInvalid
	}
	if alternative.MaxDailyPortions < k.ActiveQuota {
		return nil, fmt.Errorf("%w: dapur alternatif hanya mampu %d porsi/hari",
			ErrSppgInvalid, alternative.MaxDailyPortions)
	}

	updated, err := s.repo.Suspend(ctx, k.ID, reason, alternativeID, actorID)
	return updated, mapSppgErr(err)
}

// Reinstate memulihkan operasional dapur yang sebelumnya dibekukan.
func (s *sppgService) Reinstate(ctx context.Context, actorID, id string, req models.ReinstateKitchenRequest) (*models.SPPGKitchen, error) {
	k, err := s.mustGet(ctx, id)
	if err != nil {
		return nil, err
	}
	if k.Status != models.SppgSuspended {
		return nil, fmt.Errorf("%w: hanya dapur yang berstatus ditangguhkan yang dapat dipulihkan", ErrSppgInvalid)
	}

	reason := strings.TrimSpace(req.Reason)
	if len([]rune(reason)) < minWarningReasonLen {
		return nil, ErrSppgInvalid
	}

	quota := req.InitialQuota
	if quota <= 0 {
		quota = int(float64(k.MaxDailyPortions) * 0.7) // Default pemulihan awal: 70% kapasitas maksimal
	}
	if quota > k.MaxDailyPortions {
		return nil, ErrSppgQuotaTooHigh
	}

	updated, err := s.repo.Reinstate(ctx, k.ID, reason, quota, actorID)
	return updated, mapSppgErr(err)
}

// UpdateQuota menetapkan kuota produksi harian; tidak boleh melebihi kapasitas.
func (s *sppgService) UpdateQuota(ctx context.Context, actorID, id string, req models.UpdateQuotaRequest) (*models.SPPGKitchen, error) {
	k, err := s.mustGet(ctx, id)
	if err != nil {
		return nil, err
	}
	if k.Status == models.SppgSuspended {
		return nil, ErrSppgSuspended
	}
	if req.Quota <= 0 {
		return nil, ErrSppgInvalid
	}
	if req.Quota > k.MaxDailyPortions {
		return nil, ErrSppgQuotaTooHigh
	}
	if strings.TrimSpace(req.Reason) == "" {
		return nil, ErrSppgInvalid
	}

	updated, err := s.repo.UpdateQuota(ctx, k.ID, req.Quota, strings.TrimSpace(req.Reason), actorID)
	return updated, mapSppgErr(err)
}

// UpdateProfile mengganti nama dapur milik akun SPPG sendiri (self-service).
func (s *sppgService) UpdateProfile(ctx context.Context, actorID, id string, req models.UpdateSppgProfileRequest) (*models.SPPGKitchen, error) {
	k, err := s.mustGet(ctx, id)
	if err != nil {
		return nil, err
	}

	name := strings.TrimSpace(req.Name)
	if length := len([]rune(name)); length < 3 || length > 120 {
		return nil, ErrSppgInvalid
	}

	updated, err := s.repo.UpdateName(ctx, k.ID, name, actorID)
	return updated, mapSppgErr(err)
}

// RecordRecipeAudit menyimpan hasil audit gramatur resep terhadap TKPI.
func (s *sppgService) RecordRecipeAudit(ctx context.Context, actorID, id string, req models.RecordRecipeAuditRequest) (*models.SPPGKitchen, error) {
	k, err := s.mustGet(ctx, id)
	if err != nil {
		return nil, err
	}
	if k.Status == models.SppgSuspended {
		return nil, ErrSppgSuspended
	}

	status := strings.TrimSpace(req.TkpiStatus)
	switch status {
	case models.TkpiCompliant, models.TkpiMinor, models.TkpiViolation:
	default:
		return nil, ErrSppgInvalid
	}
	if req.AvgDeviationPct < 0 || req.AvgDeviationPct > 100 {
		return nil, ErrSppgInvalid
	}
	auditor := strings.TrimSpace(req.Auditor)
	if auditor == "" {
		return nil, ErrSppgInvalid
	}

	updated, err := s.repo.RecordRecipeAudit(ctx, k.ID, status, auditor,
		strings.TrimSpace(req.Notes), req.AvgDeviationPct, actorID)
	return updated, mapSppgErr(err)
}

func (s *sppgService) mustGet(ctx context.Context, id string) (*models.SPPGKitchen, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, ErrSppgInvalid
	}
	k, err := s.repo.Get(ctx, id)
	if err != nil {
		return nil, mapSppgErr(err)
	}
	return k, nil
}

func mapSppgErr(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, repositories.ErrNotFound):
		return ErrSppgNotFound
	default:
		return err
	}
}
