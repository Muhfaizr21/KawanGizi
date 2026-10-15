package models

import "time"

// Coordinates titik geolokasi sekolah last-mile.
type Coordinates struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

// PrincipalInfo rincian kontak kepala sekolah penerima.
type PrincipalInfo struct {
	Name  string `json:"name"`
	NIP   string `json:"nip"`
	Phone string `json:"phone"`
	Email string `json:"email"`
}

// Demographics komposisi siswa dan target gizi per kelompok umur sekolah.
type Demographics struct {
	LowerGrade           int    `json:"lowerGrade"`
	UpperGrade           int    `json:"upperGrade"`
	SMPGrade             int    `json:"smpGrade"`
	TotalStudents        int    `json:"totalStudents"`
	TotalCalorieTarget   int    `json:"totalCalorieTarget"`
	AvgCaloriePerPortion int    `json:"avgCaloriePerPortion"`
	AllergiesCount       int    `json:"allergiesCount"`
	DietaryNotes         string `json:"dietaryNotes"`
}

// SPPGSupplier profil dapur penyedia MBG yang melayani sekolah ini.
type SPPGSupplier struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Type           string  `json:"type"`
	Address        string  `json:"address"`
	DistanceKm     float64 `json:"distanceKm"`
	TransitMinutes int     `json:"transitMinutes"`
	TransitStatus  string  `json:"transitStatus"` // safe | moderate | critical
	CorridorRoute  string  `json:"corridorRoute"`
}

// EmergencyContacts kontak darurat medis, koordinator UKS, dan Puskesmas rujukan.
type EmergencyContacts struct {
	PrincipalPhone     string `json:"principalPhone"`
	UKSCoordinatorName string `json:"uksCoordinatorName"`
	UKSPhone           string `json:"uksPhone"`
	ReferralClinic     string `json:"referralClinic"`
	ClinicAddress      string `json:"clinicAddress"`
	ClinicPhone        string `json:"clinicPhone"`
	AmbulanceHotline   string `json:"ambulanceHotline"`
}

// TransitDetails telemetri jarak tempuh armada kurir dan status koridor.
type TransitDetails struct {
	DistanceKm     float64 `json:"distanceKm"`
	TransitMinutes int     `json:"transitMinutes"`
	TransitStatus  string  `json:"transitStatus"`
	CorridorRoute  string  `json:"corridorRoute"`
}

// School merepresentasikan master data sekolah binaan dan titik distribusi MBG.
type School struct {
	NPSN               string            `json:"npsn"`
	ID                 string            `json:"id"`
	Name               string            `json:"name"`
	Level              string            `json:"level"`
	Status             string            `json:"status"` // active | temp_inactive | radius_warning
	StatusLabel        string            `json:"statusLabel"`
	StatusReason       string            `json:"statusReason"`
	Address            string            `json:"address"`
	City               string            `json:"city"`
	District           string            `json:"district"`
	Lat                float64           `json:"lat"`
	Lng                float64           `json:"lng"`
	Coordinates        Coordinates       `json:"coordinates"`
	PrincipalName      string            `json:"principalName"`
	PrincipalNIP       string            `json:"principalNip"`
	PrincipalPhone     string            `json:"principalPhone"`
	PrincipalEmail     string            `json:"principalEmail"`
	Principal          PrincipalInfo     `json:"principal"`
	TotalStudents      int               `json:"totalStudents"`
	TotalCalorieTarget int               `json:"totalCalorieTarget"`
	DietaryNotes       string            `json:"dietaryNotes"`
	Demographics       Demographics      `json:"demographics"`
	SPPGID             string            `json:"sppgId"`
	SPPGSupplier       SPPGSupplier      `json:"sppgSupplier"`
	EmergencyContacts  EmergencyContacts `json:"emergencyContacts"`
	TransitDetails     TransitDetails    `json:"transitDetails"`
	LastAuditDate      string            `json:"lastAuditDate"`
	AcceptanceRate     float64           `json:"acceptanceRate"`
	AvgArrivalTime     string            `json:"avgArrivalTime"`
	CreatedAt          time.Time         `json:"createdAt"`
}

// CreateSchoolRequest payload untuk pendaftaran sekolah baru ke klaster distribusi MBG.
type CreateSchoolRequest struct {
	NPSN           string  `json:"npsn"`
	Name           string  `json:"name"`
	Level          string  `json:"level"`
	City           string  `json:"city"`
	District       string  `json:"district"`
	Address        string  `json:"address"`
	Lat            float64 `json:"lat"`
	Lng            float64 `json:"lng"`
	PrincipalName  string  `json:"principalName"`
	PrincipalPhone string  `json:"principalPhone"`
	UKSName        string  `json:"uksName"`
	UKSPhone       string  `json:"uksPhone"`
	ClinicName     string  `json:"clinicName"`
	ClinicPhone    string  `json:"clinicPhone"`
	LowerGrade     int     `json:"lowerGrade"`
	UpperGrade     int     `json:"upperGrade"`
	SMPGrade       int     `json:"smpGrade"`
	SPPGID         string  `json:"sppgId"`
}

// ReassignSchoolSPPGRequest payload mutasi dapur SPPG penyuplai sekolah.
type ReassignSchoolSPPGRequest struct {
	TargetSPPGID string `json:"targetSppgId"`
	Reason       string `json:"reason"`
}

// UpdateSchoolContactsRequest payload pembaruan kontak darurat UKS dan Puskesmas rujukan.
type UpdateSchoolContactsRequest struct {
	PrincipalName      string `json:"principalName"`
	PrincipalPhone     string `json:"principalPhone"`
	UKSCoordinatorName string `json:"uksCoordinatorName"`
	UKSPhone           string `json:"uksPhone"`
	ReferralClinic     string `json:"referralClinic"`
	ClinicAddress      string `json:"clinicAddress"`
	ClinicPhone        string `json:"clinicPhone"`
	AmbulanceHotline   string `json:"ambulanceHotline"`
}

// ToggleSchoolStatusRequest payload penonaktifan sementara / aktivasi kembali sekolah.
type ToggleSchoolStatusRequest struct {
	Status       string `json:"status"` // active | temp_inactive | radius_warning
	StatusLabel  string `json:"statusLabel,omitempty"`
	StatusReason string `json:"statusReason"`
	ReturnDate   string `json:"returnDate,omitempty"`
}

// DeleteSchoolRequest payload penghapusan sekolah dari daftar receivable MBG.
type DeleteSchoolRequest struct {
	Reason string `json:"reason"`
}

// SchoolFilter parameter filter pencarian sekolah.
type SchoolFilter struct {
	Search string `json:"search"`
	Level  string `json:"level"`
	Status string `json:"status"`
	City   string `json:"city"`
	SPPGID string `json:"sppgId"`
}
