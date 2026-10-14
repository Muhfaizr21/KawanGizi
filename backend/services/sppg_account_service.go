package services

import (
	"backend/models"
	"backend/repositories"
	"context"
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// Sentinel errors untuk pengelolaan akun login dapur SPPG.
var (
	ErrSppgAccountNotFound   = errors.New("akun SPPG tidak ditemukan")
	ErrSppgAccountInvalid    = errors.New("data akun SPPG tidak valid")
	ErrSppgAccountEmailTaken = errors.New("email sudah terdaftar")
)

// Batas minimal nama dan kata sandi akun SPPG.
const (
	minSppgAccountNameLen     = 3
	minSppgAccountPasswordLen = 8
)

// SppgAccountService menegakkan aturan bisnis pengelolaan akun login dapur:
// email valid, kata sandi memadai, dan dapur rujukan wajib ada.
type SppgAccountService interface {
	List(ctx context.Context) ([]models.SppgAccount, error)
	Create(ctx context.Context, actorID string, req models.CreateSppgAccountRequest) (*models.SppgAccount, error)
	Update(ctx context.Context, actorID, id string, req models.UpdateSppgAccountRequest) (*models.SppgAccount, error)
	UpdateCredentials(ctx context.Context, actorID, id string, req models.UpdateSppgAccountCredentialsRequest) (*models.SppgAccount, error)
	Delete(ctx context.Context, actorID, id string) error
}

type sppgAccountService struct {
	repo repositories.SppgAccountRepository
}

// NewSppgAccountService wires the SPPG account service (Constructor DI).
func NewSppgAccountService(repo repositories.SppgAccountRepository) SppgAccountService {
	return &sppgAccountService{repo: repo}
}

func (s *sppgAccountService) List(ctx context.Context) ([]models.SppgAccount, error) {
	list, err := s.repo.List(ctx)
	return list, mapSppgAccountErr(err)
}

func (s *sppgAccountService) Create(ctx context.Context, actorID string, req models.CreateSppgAccountRequest) (*models.SppgAccount, error) {
	name := strings.TrimSpace(req.FullName)
	email := strings.ToLower(strings.TrimSpace(req.Email))
	sppgID := strings.TrimSpace(req.SppgID)
	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = models.StatusActive
	}
	if len([]rune(name)) < minSppgAccountNameLen || !isValidEmail(email) ||
		len([]rune(req.Password)) < minSppgAccountPasswordLen || sppgID == "" ||
		!validSppgAccountStatus(status) {
		return nil, ErrSppgAccountInvalid
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	a, err := s.repo.Create(ctx, repositories.CreateSppgAccountParams{
		FullName:     name,
		Email:        email,
		PasswordHash: string(hash),
		SppgID:       sppgID,
		Status:       status,
	}, actorID)
	return a, mapSppgAccountErr(err)
}

func (s *sppgAccountService) Update(ctx context.Context, actorID, id string, req models.UpdateSppgAccountRequest) (*models.SppgAccount, error) {
	id = strings.TrimSpace(id)
	name := strings.TrimSpace(req.FullName)
	sppgID := strings.TrimSpace(req.SppgID)
	status := strings.TrimSpace(req.Status)
	if id == "" || len([]rune(name)) < minSppgAccountNameLen || sppgID == "" ||
		!validSppgAccountStatus(status) {
		return nil, ErrSppgAccountInvalid
	}

	a, err := s.repo.Update(ctx, id, repositories.UpdateSppgAccountParams{
		FullName: name,
		SppgID:   sppgID,
		Status:   status,
		Reason:   strings.TrimSpace(req.Reason),
	}, actorID)
	return a, mapSppgAccountErr(err)
}

// UpdateCredentials mengganti email dan/atau kata sandi. NewPassword kosong
// berarti kata sandi lama dipertahankan.
func (s *sppgAccountService) UpdateCredentials(ctx context.Context, actorID, id string, req models.UpdateSppgAccountCredentialsRequest) (*models.SppgAccount, error) {
	id = strings.TrimSpace(id)
	email := strings.ToLower(strings.TrimSpace(req.Email))
	newPassword := strings.TrimSpace(req.NewPassword)
	if id == "" || !isValidEmail(email) {
		return nil, ErrSppgAccountInvalid
	}

	var hash string
	if newPassword != "" {
		if len([]rune(newPassword)) < minSppgAccountPasswordLen {
			return nil, ErrSppgAccountInvalid
		}
		h, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		hash = string(h)
	}

	a, err := s.repo.UpdateCredentials(ctx, id, email, hash, actorID, strings.TrimSpace(req.Reason))
	return a, mapSppgAccountErr(err)
}

func (s *sppgAccountService) Delete(ctx context.Context, actorID, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return ErrSppgAccountInvalid
	}
	return mapSppgAccountErr(s.repo.Delete(ctx, id, actorID))
}

// validSppgAccountStatus membatasi status akun ke nilai yang dikenal sistem.
func validSppgAccountStatus(status string) bool {
	switch status {
	case models.StatusActive, models.StatusPending, models.StatusBlacklisted:
		return true
	default:
		return false
	}
}

// mapSppgAccountErr menerjemahkan error persistence ke error domain.
func mapSppgAccountErr(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, repositories.ErrNotFound):
		return ErrSppgAccountNotFound
	case errors.Is(err, repositories.ErrEmailTaken):
		return ErrSppgAccountEmailTaken
	case errors.Is(err, repositories.ErrInvalidReference):
		return ErrSppgAccountInvalid
	default:
		return err
	}
}
