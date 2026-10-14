package models

import "time"

// Status operasional dapur SPPG.
const (
	SppgActive    = "active"
	SppgWarning   = "warning"
	SppgSuspended = "suspended"
)

// Jenis surat peringatan BGN terhadap dapur SPPG (SUPERADMIN.md Bab 3).
// SP-1 untuk pelanggaran ringan, SP-2 untuk pelanggaran berulang/berat.
const (
	SppgLetterSP1        = "SP-1"
	SppgLetterSP2        = "SP-2"
	SppgLetterSuspension = "SUSPENSION"
)

// Status hasil audit gramatur resep terhadap standar TKPI Kemenkes.
const (
	TkpiCompliant = "COMPLIANT"
	TkpiMinor     = "MINOR_DEVIATION"
	TkpiViolation = "VIOLATION"
)

// Ambang keberlakuan akreditasi (SUPERADMIN.md Bab 3B): SP-1/SP-2 terbit bila
// kepatuhan di bawah 85% selama 7 hari berturut-turut.
const SppgComplianceThresholdPct = 85.0

// sppgStatuses adalah status yang boleh disetel lewat API.
var sppgStatuses = map[string]bool{
	SppgActive:    true,
	SppgWarning:   true,
	SppgSuspended: true,
}

// ValidSppgStatus reports apakah status dapurnya dikenal.
func ValidSppgStatus(status string) bool { return sppgStatuses[status] }

// SPPGKitchen adalah entitas dapur sentral atau rekanan MBG.
type SPPGKitchen struct {
	ID               string  `json:"id"`
	Code             string  `json:"code"`
	Name             string  `json:"name"`
	LegalEntity      string  `json:"legalEntity"`
	Type             string  `json:"type"`
	TypeLabel        string  `json:"typeLabel"`
	Address          string  `json:"address"`
	Subdistrict      string  `json:"subdistrict"`
	City             string  `json:"city"`
	Province         string  `json:"province"`
	Cluster          string  `json:"cluster"`
	Coordinates      string  `json:"coordinates"`
	ManagerName      string  `json:"managerName"`
	ManagerNIP       string  `json:"managerNip"`
	ManagerPhone     string  `json:"managerPhone"`
	NutritionistName string  `json:"nutritionistName"`
	NutritionistSTR  string  `json:"nutritionistStr"`
	StaffCount       int     `json:"staffCount"`
	KitchenArea      string  `json:"kitchenArea"`
	FleetCount       int     `json:"fleetCount"`
	FleetType        string  `json:"fleetType"`
	MaxDailyPortions int     `json:"maxDailyPortions"`
	ActiveQuota      int     `json:"activeQuota"`
	SafetyScore      float64 `json:"safetyScore"`
	ColdChainScore   float64 `json:"coldChainScore"`
	TimelinessScore  float64 `json:"timelinessScore"`
	CompositeScore   float64 `json:"compositeScore"`
	Grade            string  `json:"grade"`
	Status           string  `json:"status"`

	// Status audit & teguran; kolom nullable di DB, dinormalkan di sini.
	TkpiStatus      string               `json:"tkpiStatus"`
	AvgDeviationPct float64              `json:"avgDeviationPct"`
	RecipeAuditedAt *time.Time           `json:"recipeAuditedAt,omitempty"`
	RecipeAuditor   string               `json:"recipeAuditor,omitempty"`
	SuspendedReason string               `json:"suspendedReason,omitempty"`
	SuspendedAt     *time.Time           `json:"suspendedAt,omitempty"`
	QuotaUpdatedAt  *time.Time           `json:"quotaUpdatedAt,omitempty"`
	QuotaUpdatedBy  string               `json:"quotaUpdatedBy,omitempty"`
	WarningLetters  []SppgWarningLetter  `json:"warningLetters"`
	AssignedSchools []SppgAssignedSchool `json:"assignedSchools"`
	ComplianceTrend []float64            `json:"complianceTrend"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// SppgWarningLetter adalah satu surat peringatan resmi terhadap dapurnya.
type SppgWarningLetter struct {
	ID            string    `json:"id"`
	SppgID        string    `json:"sppgId"`
	Type          string    `json:"type"`
	LetterNumber  string    `json:"letterNumber"`
	Reason        string    `json:"reason"`
	DeadlineLabel string    `json:"deadlineLabel"`
	Status        string    `json:"status"`
	IssuedBy      string    `json:"issuedBy"`
	CreatedAt     time.Time `json:"createdAt"`
}

// UpdateSppgProfileRequest memperbarui identitas dapur milik akun SPPG sendiri.
type UpdateSppgProfileRequest struct {
	Name string `json:"name"`
}

// SppgAssignedSchool adalah sekolah yang dilayani sebuah dapur.
type SppgAssignedSchool struct {
	NPSN          string `json:"npsn"`
	Name          string `json:"name"`
	City          string `json:"city"`
	PortionsToday int    `json:"portionsToday"`
}

// IssueWarningRequest menerbitkan surat peringatan SP-1/SP-2.
type IssueWarningRequest struct {
	LetterType    string `json:"letterType"`
	LetterNumber  string `json:"letterNumber"`
	Reason        string `json:"reason"`
	DeadlineLabel string `json:"deadlineLabel"`
}

// SuspendKitchenRequest membekukan hak masak & distribusi sebuah dapur.
type SuspendKitchenRequest struct {
	Reason            string `json:"reason"`
	AlternativeSppgID string `json:"alternativeSppgId"`
}

// ReinstateKitchenRequest memulihkan status dapur yang sempat dibekukan.
type ReinstateKitchenRequest struct {
	Reason       string `json:"reason"`
	InitialQuota int    `json:"initialQuota"`
}

// UpdateQuotaRequest menetapkan kuota produksi harian baru.
type UpdateQuotaRequest struct {
	Quota  int    `json:"quota"`
	Reason string `json:"reason"`
}

// RecordRecipeAuditRequest mencatat hasil audit gramatur resep TKPI.
type RecordRecipeAuditRequest struct {
	TkpiStatus      string  `json:"tkpiStatus"`
	AvgDeviationPct float64 `json:"avgDeviationPct"`
	Auditor         string  `json:"auditor"`
	Notes           string  `json:"notes"`
}
