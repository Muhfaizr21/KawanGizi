package services

import (
	"backend/models"
	"backend/repositories"
	"context"
	"errors"
	"strings"
)

var (
	ErrSchoolNotFound         = errors.New("data sekolah binaan tidak ditemukan")
	ErrInvalidNPSN            = errors.New("NPSN wajib diisi dengan format valid")
	ErrSchoolNameRequired     = errors.New("nama sekolah wajib diisi minimal 3 karakter")
	ErrSchoolNPSNExists       = errors.New("sekolah dengan NPSN tersebut sudah terdaftar di sistem")
	ErrMissingSPPG            = errors.New("dapur SPPG penyuplai wajib dipilih")
	ErrInvalidReassignReason  = errors.New("alasan pengalihan dapur SPPG wajib diisi minimal 5 karakter")
	ErrInvalidSchoolStatus    = errors.New("status operasional sekolah tidak valid (gunakan: active, temp_inactive, radius_warning)")
	ErrMissingStatusReason    = errors.New("alasan perubahan status operasional sekolah wajib diisi minimal 5 karakter")
	ErrMissingContact         = errors.New("nama kepala sekolah dan nomor kontak darurat wajib diisi")
	ErrSchoolHasValidators    = errors.New("masih ada akun validator yang terikat pada sekolah ini; hapus atau alihkan akun validator terlebih dahulu")
	ErrMissingDeleteReason    = errors.New("alasan penghapusan sekolah wajib diisi minimal 5 karakter")
)

// SchoolService mengatur aturan bisnis dan validasi pangkalan data master sekolah MBG.
type SchoolService interface {
	List(ctx context.Context, filter models.SchoolFilter) ([]models.School, error)
	GetByNPSN(ctx context.Context, npsn string) (*models.School, error)
	Create(ctx context.Context, req models.CreateSchoolRequest, actor models.User) (*models.School, error)
	ReassignSPPG(ctx context.Context, npsn string, req models.ReassignSchoolSPPGRequest, actor models.User) (*models.School, error)
	UpdateContacts(ctx context.Context, npsn string, req models.UpdateSchoolContactsRequest, actor models.User) (*models.School, error)
	ToggleStatus(ctx context.Context, npsn string, req models.ToggleSchoolStatusRequest, actor models.User) (*models.School, error)
	CountLinkedValidatorAccounts(ctx context.Context, npsn string) (int, error)
	GetOwnedSchool(ctx context.Context, idOrSchoolID, sppgID string) (*models.School, error)
	Delete(ctx context.Context, npsn string, req models.DeleteSchoolRequest, actor models.User) error
}

type schoolService struct {
	repo repositories.SchoolRepository
}

func NewSchoolService(repo repositories.SchoolRepository) SchoolService {
	return &schoolService{repo: repo}
}

func (s *schoolService) List(ctx context.Context, filter models.SchoolFilter) ([]models.School, error) {
	return s.repo.List(ctx, filter)
}

func (s *schoolService) GetByNPSN(ctx context.Context, npsn string) (*models.School, error) {
	npsn = strings.TrimSpace(npsn)
	if npsn == "" {
		return nil, ErrSchoolNotFound
	}
	sch, err := s.repo.GetByNPSN(ctx, npsn)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, ErrSchoolNotFound
		}
		return nil, err
	}
	return sch, nil
}

func (s *schoolService) Create(ctx context.Context, req models.CreateSchoolRequest, actor models.User) (*models.School, error) {
	req.NPSN = strings.TrimSpace(req.NPSN)
	req.Name = strings.TrimSpace(req.Name)
	if req.NPSN == "" {
		return nil, ErrInvalidNPSN
	}
	if len(req.Name) < 3 {
		return nil, ErrSchoolNameRequired
	}
	if strings.TrimSpace(req.SPPGID) == "" {
		return nil, ErrMissingSPPG
	}
	if strings.TrimSpace(req.PrincipalName) == "" || strings.TrimSpace(req.PrincipalPhone) == "" {
		return nil, ErrMissingContact
	}

	// Cek duplikasi NPSN
	existing, _ := s.repo.GetByNPSN(ctx, req.NPSN)
	if existing != nil {
		return nil, ErrSchoolNPSNExists
	}

	if req.Level == "" {
		req.Level = "SD"
	}
	if req.City == "" {
		req.City = "Jakarta Pusat"
	}
	if req.District == "" {
		req.District = "Kecamatan Terpadu"
	}

	return s.repo.Create(ctx, req, actor)
}

func (s *schoolService) ReassignSPPG(ctx context.Context, npsn string, req models.ReassignSchoolSPPGRequest, actor models.User) (*models.School, error) {
	npsn = strings.TrimSpace(npsn)
	if npsn == "" {
		return nil, ErrSchoolNotFound
	}
	if strings.TrimSpace(req.TargetSPPGID) == "" {
		return nil, ErrMissingSPPG
	}
	if len(strings.TrimSpace(req.Reason)) < 5 {
		return nil, ErrInvalidReassignReason
	}

	_, err := s.GetByNPSN(ctx, npsn)
	if err != nil {
		return nil, err
	}

	return s.repo.ReassignSPPG(ctx, npsn, req, actor)
}

func (s *schoolService) UpdateContacts(ctx context.Context, npsn string, req models.UpdateSchoolContactsRequest, actor models.User) (*models.School, error) {
	npsn = strings.TrimSpace(npsn)
	if npsn == "" {
		return nil, ErrSchoolNotFound
	}
	if strings.TrimSpace(req.PrincipalName) == "" || strings.TrimSpace(req.PrincipalPhone) == "" {
		return nil, ErrMissingContact
	}
	if strings.TrimSpace(req.ReferralClinic) == "" {
		req.ReferralClinic = "Puskesmas Wilayah Binaan"
	}

	_, err := s.GetByNPSN(ctx, npsn)
	if err != nil {
		return nil, err
	}

	return s.repo.UpdateContacts(ctx, npsn, req, actor)
}

func (s *schoolService) ToggleStatus(ctx context.Context, npsn string, req models.ToggleSchoolStatusRequest, actor models.User) (*models.School, error) {
	npsn = strings.TrimSpace(npsn)
	if npsn == "" {
		return nil, ErrSchoolNotFound
	}

	req.Status = strings.TrimSpace(req.Status)
	if req.Status != "active" && req.Status != "temp_inactive" && req.Status != "radius_warning" {
		return nil, ErrInvalidSchoolStatus
	}

	if req.Status == "temp_inactive" && len(strings.TrimSpace(req.StatusReason)) < 5 {
		return nil, ErrMissingStatusReason
	}

	_, err := s.GetByNPSN(ctx, npsn)
	if err != nil {
		return nil, err
	}

	return s.repo.ToggleStatus(ctx, npsn, req, actor)
}

func (s *schoolService) CountLinkedValidatorAccounts(ctx context.Context, npsn string) (int, error) {
	return s.repo.CountLinkedValidatorAccounts(ctx, strings.TrimSpace(npsn))
}

// Delete menicorp sekolah beserta data operasionalnya. Akun login validator yang
// masih terikat tidak ikut dihapus — linkage-nya dicek lebih dulu supaya tidak
// ada akun yatim yang menunjuk sekolah yang sudah tidak ada.
// GetOwnedSchool mengembalikan sekolah hanya bila benar-benar milik dapurnya.
// idOrSchoolID bisa berupa NPSN, schools.id, maupun id baris kuota harian.
func (s *schoolService) GetOwnedSchool(ctx context.Context, idOrSchoolID, sppgID string) (*models.School, error) {
	idOrSchoolID = strings.TrimSpace(idOrSchoolID)
	sppgID = strings.TrimSpace(sppgID)
	if idOrSchoolID == "" || sppgID == "" {
		return nil, ErrSchoolNotFound
	}

	npsn, err := s.repo.ResolveNPSNByRef(ctx, idOrSchoolID)
	if err != nil {
		return nil, ErrSchoolNotFound
	}

	school, err := s.GetByNPSN(ctx, npsn)
	if err != nil {
		return nil, err
	}

	if school.SPPGID != sppgID {
		return nil, ErrSchoolNotFound
	}
	return school, nil
}

func (s *schoolService) Delete(ctx context.Context, npsn string, req models.DeleteSchoolRequest, actor models.User) error {
	npsn = strings.TrimSpace(npsn)
	if npsn == "" {
		return ErrSchoolNotFound
	}

	if len(strings.TrimSpace(req.Reason)) < 5 {
		return ErrMissingDeleteReason
	}

	if _, err := s.GetByNPSN(ctx, npsn); err != nil {
		return err
	}

	linked, err := s.repo.CountLinkedValidatorAccounts(ctx, npsn)
	if err != nil {
		return err
	}
	if linked > 0 {
		return ErrSchoolHasValidators
	}

	return s.repo.Delete(ctx, npsn, actor)
}
