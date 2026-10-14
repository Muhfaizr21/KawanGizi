package models

import "time"

// Status operasional validator lapangan.
//
// Status ini hidup di validator_profiles.status, sementara kelayakan masuk
// sistem hidup di users.status. Keduanya harus selalu berubah bersamaan —
// gunakan UserStatusFor untuk memetakan, dan jangan menulis users.status
// langsung dari handler.
const (
	ValidatorActive      = "active"
	ValidatorFlagged     = "flagged"
	ValidatorInactive    = "inactive"
	ValidatorBlacklisted = "blacklisted"
)

// Ambang durasi inspeksi visual (Juknis MBG Pasal 14).
// Pindai yang lebih cepat dari MinScanDurationMS dihitung sebagai anomali
// ketelitian pada audit superadmin.
const (
	MinScanDurationMS  = 200
	TargetInspectionMS = 500
	RecentScanLogLimit = 5
)

// validatorStatuses adalah daftar status yang boleh disetel lewat API.
var validatorStatuses = map[string]bool{
	ValidatorActive:      true,
	ValidatorFlagged:     true,
	ValidatorInactive:    true,
	ValidatorBlacklisted: true,
}

// ValidValidatorStatus reports whether the status identifier is known.
func ValidValidatorStatus(status string) bool {
	return validatorStatuses[status]
}

// UserStatusFor memetakan status validator ke status kelayakan akun (users).
// "flagged" tetap boleh login — akun hanya ditegur, bukan dibekukan.
func UserStatusFor(validatorStatus string) string {
	switch validatorStatus {
	case ValidatorActive, ValidatorFlagged:
		return StatusActive
	case ValidatorInactive:
		return StatusPending
	case ValidatorBlacklisted:
		return StatusBlacklisted
	default:
		return StatusPending
	}
}

// ValidatorProfile adalah roster validator lapangan untuk portal superadmin
// (/admin/validators).
//
// Semua field turunan (ScansToday, AvgDurationSec, Anomalies, LastScanAt,
// QuotaToday) dihitung ulang dari scan_logs & attendances saat dibaca —
// tidak disimpan, supaya tidak basi saat hari berganti.
type ValidatorProfile struct {
	ID         string `json:"id"`
	UserID     string `json:"userId,omitempty"`
	SatgasID   string `json:"satgasId"`
	Name       string `json:"name"`
	Email      string `json:"email,omitempty"`
	NIP        string `json:"nip"`
	NPSN       string `json:"npsn"`
	SchoolName string `json:"schoolName"`
	SchoolCity string `json:"schoolCity"`
	Role       string `json:"role"`

	Device        string `json:"device"`
	DeviceID      string `json:"deviceId"`
	DeviceBound   bool   `json:"deviceBound"`
	Certification string `json:"certification"`
	Status        string `json:"status"`

	BackupValidatorID   string     `json:"backupValidatorId,omitempty"`
	BackupValidatorName string     `json:"backupValidatorName,omitempty"`
	WarningCount        int        `json:"warningCount"`
	LastWarningAt       *time.Time `json:"lastWarningAt,omitempty"`
	LastWarningNote     string     `json:"lastWarningNote,omitempty"`

	ScansToday     int        `json:"scansToday"`
	QuotaToday     int        `json:"quotaToday"`
	AvgDurationSec float64    `json:"avgDurationSec"`
	Anomalies      int        `json:"anomalies"`
	LastScanAt     *time.Time `json:"lastScanAt,omitempty"`

	ScanLogs []ScanLog `json:"scanLogs"`
}

// SetValidatorStatusRequest mengubah status operasional validator.
type SetValidatorStatusRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason"`
}

// CreateValidatorRequest adalah payload POST /api/validators (superadmin).
// Membuat akun login (users) sekaligus profil roster (validator_profiles).
type CreateValidatorRequest struct {
	FullName      string `json:"fullName"`
	Email         string `json:"email"`
	Password      string `json:"password"`
	NPSN          string `json:"npsn"`
	SatgasID      string `json:"satgasId"`
	NIP           string `json:"nip"`
	Role          string `json:"role"`
	Certification string `json:"certification"`
	Device        string `json:"device"`
	SPPGID        string `json:"sppgId"`
}

// UpdateValidatorRequest adalah payload PATCH /api/validators/{id} untuk
// memperbarui identitas profil (bukan kredensial login).
type UpdateValidatorRequest struct {
	Name          string `json:"name"`
	NPSN          string `json:"npsn"`
	SatgasID      string `json:"satgasId"`
	NIP           string `json:"nip"`
	Role          string `json:"role"`
	Certification string `json:"certification"`
	Reason        string `json:"reason"`
	SPPGID        string `json:"sppgId"`
}

// UpdateValidatorCredentialsRequest adalah payload PATCH
// /api/validators/{id}/credentials. NewPassword boleh kosong (hanya ganti email).
type UpdateValidatorCredentialsRequest struct {
	Email       string `json:"email"`
	NewPassword string `json:"newPassword"`
	Reason      string `json:"reason"`
}

// ResetValidatorDeviceRequest memutus tautan kriptografis perangkat.
type ResetValidatorDeviceRequest struct {
	Reason string `json:"reason"`
}

// WarnValidatorRequest menerbitkan surat peringatan digital ke validator.
type WarnValidatorRequest struct {
	Note string `json:"note"`
}

// AssignBackupValidatorRequest menugaskan guru piket cadangan pada validator
// yang sedang bermasalah, agar verifikasi porsi school tidak terhenti.
type AssignBackupValidatorRequest struct {
	BackupValidatorID string `json:"backupValidatorId"`
	Reason            string `json:"reason"`
}
