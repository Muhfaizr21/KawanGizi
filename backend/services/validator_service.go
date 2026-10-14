package services

import (
	"backend/models"
	"backend/repositories"
	"context"
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// Sentinel errors untuk operasi validator. Controller memetakannya ke status
// HTTP dengan errors.Is — bukan perbandingan string.
var (
	ErrValidatorNotFound   = errors.New("validator tidak ditemukan")
	ErrValidatorInvalid    = errors.New("permintaan tidak valid")
	ErrValidatorNoBackup   = errors.New("validator cadangan tidak memenuhi syarat")
	ErrValidatorEmailTaken = errors.New("email sudah terdaftar")
)

// ValidatorService menegakkan aturan bisnis atas roster validator lapangan:
// status apa yang boleh disetel, dan apakah sebuah aksi logis untuk kondisi yang
// diberikan. Validasi bentuk payload ada di controller, validasi makna di sini.
type ValidatorService interface {
	List(ctx context.Context) ([]models.ValidatorProfile, error)
	Get(ctx context.Context, id string) (*models.ValidatorProfile, error)
	SetStatus(ctx context.Context, actorID, id, status, reason string) (*models.ValidatorProfile, error)
	ResetDevice(ctx context.Context, actorID, id, reason string) (*models.ValidatorProfile, error)
	IssueWarning(ctx context.Context, actorID, id, note string) (*models.ValidatorProfile, error)
	AssignBackup(ctx context.Context, actorID, id, backupID, reason string) (*models.ValidatorProfile, error)
	Create(ctx context.Context, actorID string, req models.CreateValidatorRequest) (*models.ValidatorProfile, error)
	Update(ctx context.Context, actorID, id string, req models.UpdateValidatorRequest) (*models.ValidatorProfile, error)
	UpdateCredentials(ctx context.Context, actorID, id string, req models.UpdateValidatorCredentialsRequest) (*models.ValidatorProfile, error)
	Delete(ctx context.Context, actorID, id string) error
}

type validatorService struct {
	repo repositories.ValidatorRepository
}

// NewValidatorService wires the validator service (Constructor DI).
func NewValidatorService(repo repositories.ValidatorRepository) ValidatorService {
	return &validatorService{repo: repo}
}

func (s *validatorService) List(ctx context.Context) ([]models.ValidatorProfile, error) {
	list, err := s.repo.List(ctx)
	return list, mapValidatorErr(err)
}

func (s *validatorService) Get(ctx context.Context, id string) (*models.ValidatorProfile, error) {
	v, err := s.repo.Get(ctx, strings.TrimSpace(id))
	return v, mapValidatorErr(err)
}

// SetStatus mengubah status operasional validator.
//
// Status 'flagged' diperlakukan sebagai penandaan, bukan pembekuan: akun tetap
// boleh login supaya validator bisa membaca surat peringatan yang dikirimkan.
func (s *validatorService) SetStatus(ctx context.Context, actorID, id, status, reason string) (*models.ValidatorProfile, error) {
	id = strings.TrimSpace(id)
	status = strings.TrimSpace(status)
	if id == "" || !models.ValidValidatorStatus(status) {
		return nil, ErrValidatorInvalid
	}

	v, err := s.repo.SetStatus(ctx, id, status, actorID, strings.TrimSpace(reason))
	return v, mapValidatorErr(err)
}

// ResetDevice memutus tautan kriptografis perangkat sehingga validator wajib
// registrasi ulang. Idempoten: reset pada perangkat yang sudah unbound tetap
// berhasil dan tetap tercatat di audit log.
func (s *validatorService) ResetDevice(ctx context.Context, actorID, id, reason string) (*models.ValidatorProfile, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return nil, ErrValidatorInvalid
	}

	v, err := s.repo.ResetDevice(ctx, id, actorID, strings.TrimSpace(reason))
	return v, mapValidatorErr(err)
}

// IssueWarning menerbitkan surat peringatan digital.
//
// Catatan wajib berisi penjelasan: teguran tanpa alasan tidak bisa diaudit,
// padahal SUPERADMIN.md Bab 2 menyebut tembusan resmi ke Kepala Sekolah dan
// Satgas Wilayah sebagai bagian dari aksi ini.
func (s *validatorService) IssueWarning(ctx context.Context, actorID, id, note string) (*models.ValidatorProfile, error) {
	id = strings.TrimSpace(id)
	note = strings.TrimSpace(note)
	if id == "" || len([]rune(note)) < minWarningNoteLen {
		return nil, ErrValidatorInvalid
	}

	v, err := s.repo.IssueWarning(ctx, id, actorID, note)
	return v, mapValidatorErr(err)
}

// AssignBackup menunjuk guru piket cadangan agar verifikasi porsi di sekolah
// tidak terhenti selama validator bermasalah.
//
// Cadangan wajib validator aktif pada sekolah yang sama — menunjuk orang dari
// sekolah lain membuat serah terima BAST ditolak di sekolah tujuan.
func (s *validatorService) AssignBackup(ctx context.Context, actorID, id, backupID, reason string) (*models.ValidatorProfile, error) {
	id = strings.TrimSpace(id)
	backupID = strings.TrimSpace(backupID)
	if id == "" || backupID == "" || id == backupID {
		return nil, ErrValidatorInvalid
	}

	target, err := s.repo.Get(ctx, id)
	if err != nil {
		return nil, mapValidatorErr(err)
	}
	backup, err := s.repo.Get(ctx, backupID)
	if err != nil {
		return nil, mapValidatorErr(err)
	}
	if err := assertEligibleBackup(target, backup); err != nil {
		return nil, err
	}

	v, err := s.repo.AssignBackup(ctx, id, backupID, actorID, strings.TrimSpace(reason))
	return v, mapValidatorErr(err)
}

// Create membuat akun login sekaligus profil roster validator. Email wajib unik
// dan kata sandi di-hash sebelum disimpan.
func (s *validatorService) Create(ctx context.Context, actorID string, req models.CreateValidatorRequest) (*models.ValidatorProfile, error) {
	fullName := strings.TrimSpace(req.FullName)
	email := strings.ToLower(strings.TrimSpace(req.Email))
	npsn := strings.TrimSpace(req.NPSN)
	role := strings.TrimSpace(req.Role)
	if role == "" {
		role = "Penanggung Jawab MBG Sekolah"
	}

	if len([]rune(fullName)) < minValidatorNameLen || !isValidEmail(email) ||
		len(strings.TrimSpace(req.Password)) < minValidatorPasswordLen || npsn == "" {
		return nil, ErrValidatorInvalid
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(strings.TrimSpace(req.Password)), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	v, err := s.repo.Create(ctx, repositories.CreateValidatorParams{
		FullName:      fullName,
		Email:         email,
		PasswordHash:  string(hash),
		NPSN:          npsn,
		SatgasID:      strings.TrimSpace(req.SatgasID),
		NIP:           strings.TrimSpace(req.NIP),
		Role:          role,
		Certification: strings.TrimSpace(req.Certification),
		Device:        strings.TrimSpace(req.Device),
		SPPGID:        strings.TrimSpace(req.SPPGID),
	}, actorID)
	return v, mapValidatorErr(err)
}

// Update memperbarui identitas profil validator (nama, NPSN, NIP, dll).
func (s *validatorService) Update(ctx context.Context, actorID, id string, req models.UpdateValidatorRequest) (*models.ValidatorProfile, error) {
	id = strings.TrimSpace(id)
	name := strings.TrimSpace(req.Name)
	npsn := strings.TrimSpace(req.NPSN)
	if id == "" || len([]rune(name)) < minValidatorNameLen || npsn == "" {
		return nil, ErrValidatorInvalid
	}
	role := strings.TrimSpace(req.Role)
	if role == "" {
		role = "Penanggung Jawab MBG Sekolah"
	}

	v, err := s.repo.Update(ctx, id, repositories.UpdateValidatorParams{
		Name:          name,
		NPSN:          npsn,
		SatgasID:      strings.TrimSpace(req.SatgasID),
		NIP:           strings.TrimSpace(req.NIP),
		Role:          role,
		Certification: strings.TrimSpace(req.Certification),
		Reason:        strings.TrimSpace(req.Reason),
		SPPGID:        strings.TrimSpace(req.SPPGID),
	}, actorID)
	return v, mapValidatorErr(err)
}

// UpdateCredentials mengganti email dan/atau kata sandi akun validator.
// NewPassword kosong berarti kata sandi lama dipertahankan.
func (s *validatorService) UpdateCredentials(ctx context.Context, actorID, id string, req models.UpdateValidatorCredentialsRequest) (*models.ValidatorProfile, error) {
	id = strings.TrimSpace(id)
	email := strings.ToLower(strings.TrimSpace(req.Email))
	newPassword := strings.TrimSpace(req.NewPassword)
	if id == "" || !isValidEmail(email) {
		return nil, ErrValidatorInvalid
	}

	var hash string
	if newPassword != "" {
		if len(newPassword) < minValidatorPasswordLen {
			return nil, ErrValidatorInvalid
		}
		h, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		hash = string(h)
	}

	v, err := s.repo.UpdateCredentials(ctx, id, email, hash, actorID, strings.TrimSpace(req.Reason))
	return v, mapValidatorErr(err)
}

// Delete menghapus akun login dan profil roster validator.
func (s *validatorService) Delete(ctx context.Context, actorID, id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return ErrValidatorInvalid
	}
	return mapValidatorErr(s.repo.Delete(ctx, id, actorID))
}

const (
	minValidatorNameLen     = 3
	minValidatorPasswordLen = 8
)

// minWarningNoteLen prevents a warning that carries no auditable explanation.
const minWarningNoteLen = 10

// assertEligibleBackup menegakkan syarat guru piket cadangan.
func assertEligibleBackup(target, backup *models.ValidatorProfile) error {
	if backup.Status != models.ValidatorActive {
		return ErrValidatorNoBackup
	}
	if backup.UserID == "" {
		return ErrValidatorNoBackup
	}
	if backup.NPSN == "" || backup.NPSN != target.NPSN {
		return ErrValidatorNoBackup
	}
	return nil
}

// mapValidatorErr menerjemahkan error persistence ke error domain.
func mapValidatorErr(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, repositories.ErrNotFound):
		return ErrValidatorNotFound
	case errors.Is(err, repositories.ErrEmailTaken):
		return ErrValidatorEmailTaken
	case errors.Is(err, repositories.ErrInvalidReference):
		return ErrValidatorInvalid
	default:
		return err
	}
}
