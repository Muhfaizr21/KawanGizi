package services

import (
	"backend/models"
	"backend/repositories"
	"context"
)

// ValidatorScanService mengelola alur bisnis pemindaian boks validator dan sinkronisasi lintas role
type ValidatorScanService interface {
	GetContext(ctx context.Context, userRole, userID, requestedNPSN, requestedSPPGID string) (*models.ValidatorScanContext, error)
	ConfirmDecision(ctx context.Context, payload *models.ValidatorScanConfirmPayload, actorID, actorName, actorRole string) (*models.ValidatorScanConfirmResult, error)
	GetHandoverBundle(ctx context.Context, userRole, userID, requestedNPSN, requestedSPPGID string) (*models.ValidatorHandoverBundle, error)
	SubmitBast(ctx context.Context, payload *models.ValidatorSubmitBastPayload, actorID, actorName, actorRole string) (*models.ValidatorSubmitBastResult, error)
	ResetHandover(ctx context.Context, npsn, sppgID string) error
	GetIncidentBundle(ctx context.Context, userRole, userID, requestedNPSN, requestedSPPGID string) (*models.ValidatorIncidentBundle, error)
	CreateIncident(ctx context.Context, payload *models.ValidatorCreateIncidentPayload, actorID, actorName, actorRole string) (*models.ValidatorIncidentItem, error)
	GetHistoryBundle(ctx context.Context, userRole, userID, requestedNPSN, requestedSPPGID string, limit int) (*models.ValidatorHistoryBundle, error)
	AllocateSurplus(ctx context.Context, payload *models.ValidatorAllocateSurplusPayload, actorID, actorName, actorRole string) (*models.ValidatorAllocateSurplusResult, error)
	GetDashboardBundle(ctx context.Context, userRole, userID, requestedNPSN, requestedSPPGID string) (*models.ValidatorDashboardBundle, error)
}

type validatorScanService struct {
	repo repositories.ValidatorScanRepository
}

// NewValidatorScanService constructor DI untuk validatorScanService
func NewValidatorScanService(repo repositories.ValidatorScanRepository) ValidatorScanService {
	return &validatorScanService{repo: repo}
}

func (s *validatorScanService) GetContext(ctx context.Context, userRole, userID, requestedNPSN, requestedSPPGID string) (*models.ValidatorScanContext, error) {
	return s.repo.GetContext(ctx, userRole, userID, requestedNPSN, requestedSPPGID)
}

func (s *validatorScanService) ConfirmDecision(ctx context.Context, payload *models.ValidatorScanConfirmPayload, actorID, actorName, actorRole string) (*models.ValidatorScanConfirmResult, error) {
	return s.repo.ConfirmDecision(ctx, payload, actorID, actorName, actorRole)
}

func (s *validatorScanService) GetHandoverBundle(ctx context.Context, userRole, userID, requestedNPSN, requestedSPPGID string) (*models.ValidatorHandoverBundle, error) {
	return s.repo.GetHandoverBundle(ctx, userRole, userID, requestedNPSN, requestedSPPGID)
}

func (s *validatorScanService) SubmitBast(ctx context.Context, payload *models.ValidatorSubmitBastPayload, actorID, actorName, actorRole string) (*models.ValidatorSubmitBastResult, error) {
	return s.repo.SubmitBast(ctx, payload, actorID, actorName, actorRole)
}

func (s *validatorScanService) ResetHandover(ctx context.Context, npsn, sppgID string) error {
	return s.repo.ResetHandover(ctx, npsn, sppgID)
}

func (s *validatorScanService) GetIncidentBundle(ctx context.Context, userRole, userID, requestedNPSN, requestedSPPGID string) (*models.ValidatorIncidentBundle, error) {
	return s.repo.GetIncidentBundle(ctx, userRole, userID, requestedNPSN, requestedSPPGID)
}

func (s *validatorScanService) CreateIncident(ctx context.Context, payload *models.ValidatorCreateIncidentPayload, actorID, actorName, actorRole string) (*models.ValidatorIncidentItem, error) {
	return s.repo.CreateIncident(ctx, payload, actorID, actorName, actorRole)
}

func (s *validatorScanService) GetHistoryBundle(ctx context.Context, userRole, userID, requestedNPSN, requestedSPPGID string, limit int) (*models.ValidatorHistoryBundle, error) {
	return s.repo.GetHistoryBundle(ctx, userRole, userID, requestedNPSN, requestedSPPGID, limit)
}

func (s *validatorScanService) AllocateSurplus(ctx context.Context, payload *models.ValidatorAllocateSurplusPayload, actorID, actorName, actorRole string) (*models.ValidatorAllocateSurplusResult, error) {
	return s.repo.AllocateSurplus(ctx, payload, actorID, actorName, actorRole)
}

func (s *validatorScanService) GetDashboardBundle(ctx context.Context, userRole, userID, requestedNPSN, requestedSPPGID string) (*models.ValidatorDashboardBundle, error) {
	return s.repo.GetDashboardBundle(ctx, userRole, userID, requestedNPSN, requestedSPPGID)
}

