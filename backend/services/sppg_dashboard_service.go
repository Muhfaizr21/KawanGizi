package services

import (
	"backend/models"
	"backend/repositories"
	"context"
)

type SppgDashboardService interface {
	GetDashboardBundle(ctx context.Context, sppgID string) (*models.SppgDashboardBundle, error)
	TransitionStage(ctx context.Context, sppgID string, payload *models.SppgStageTransitionPayload) (*models.SppgDashboardBundle, error)
	TriggerEmergency(ctx context.Context, sppgID string, payload *models.SppgEmergencyTriggerPayload, actorName string) (*models.SppgDashboardAlert, error)
	ResolveEmergency(ctx context.Context, sppgID string, alertID string, actorName string) error
}

type sppgDashboardService struct {
	repo repositories.SppgDashboardRepository
}

func NewSppgDashboardService(repo repositories.SppgDashboardRepository) SppgDashboardService {
	return &sppgDashboardService{repo: repo}
}

func (s *sppgDashboardService) GetDashboardBundle(ctx context.Context, sppgID string) (*models.SppgDashboardBundle, error) {
	return s.repo.GetDashboardBundle(ctx, sppgID)
}

func (s *sppgDashboardService) TransitionStage(ctx context.Context, sppgID string, payload *models.SppgStageTransitionPayload) (*models.SppgDashboardBundle, error) {
	return s.repo.TransitionStage(ctx, sppgID, payload)
}

func (s *sppgDashboardService) TriggerEmergency(ctx context.Context, sppgID string, payload *models.SppgEmergencyTriggerPayload, actorName string) (*models.SppgDashboardAlert, error) {
	return s.repo.TriggerEmergency(ctx, sppgID, payload, actorName)
}

func (s *sppgDashboardService) ResolveEmergency(ctx context.Context, sppgID string, alertID string, actorName string) error {
	return s.repo.ResolveEmergency(ctx, sppgID, alertID, actorName)
}
