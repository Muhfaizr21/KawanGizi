package models

import "time"

// ClassRecapItem entitas rincian presensi dan serah terima makan per kelas
type ClassRecapItem struct {
	ClassName     string `json:"className"`
	Quota         int    `json:"quota"`
	Present       int    `json:"present"`
	Sick          int    `json:"sick"`
	Permit        int    `json:"permit"`
	Handed        int    `json:"handed"`
	Leftover      int    `json:"leftover"`
	SurplusOption string `json:"surplusOption"` // "staff" | "afternoon" | "redistribute" | "dispose"
	AllocatedBy   string `json:"allocatedBy,omitempty"`
	AllocatedAt   string `json:"allocatedAt,omitempty"`
	Notes         string `json:"notes,omitempty"`
}

// ValidatorHistoryTotals metrik ringkasan eksekutif untuk rekonsiliasi harian
type ValidatorHistoryTotals struct {
	BoxesScanned  int     `json:"boxesScanned"`
	ReviewRate    int     `json:"reviewRate"`
	Quota         int     `json:"quota"`
	Present       int     `json:"present"`
	Handed        int     `json:"handed"`
	Leftover      int     `json:"leftover"`
	AttendancePct float64 `json:"attendancePct"`
}

// ValidatorHistoryBundle bundel data lengkap untuk halaman /validator/history
type ValidatorHistoryBundle struct {
	School            ValidatorSchoolInfo     `json:"school"`
	ParentSPPG        ValidatorParentSPPGInfo `json:"parentSppg"`
	ActiveBatch       string                  `json:"activeBatch"`
	Date              string                  `json:"date"`
	GoldenWindow      GoldenWindow            `json:"goldenWindow"`
	Totals            ValidatorHistoryTotals  `json:"totals"`
	ClassRecap        []ClassRecapItem        `json:"classRecap"`
	SurplusSelections map[string]string       `json:"surplusSelections"`
	Scans             []ScanLog               `json:"scans"`
	AvailableSchools  []ValidatorSchoolOption `json:"availableSchools,omitempty"`
	LastUpdated       time.Time               `json:"lastUpdated"`
}

// ValidatorAllocateSurplusPayload payload saat validator memilih alokasi porsi sisa
type ValidatorAllocateSurplusPayload struct {
	NPSN             string `json:"npsn,omitempty"`
	SchoolNPSN       string `json:"schoolNpsn,omitempty"`
	ClassName        string `json:"className"`
	Option           string `json:"option"` // "staff" | "afternoon" | "redistribute" | "dispose"
	SurplusOption    string `json:"surplusOption,omitempty"`
	LeftoverPortions int    `json:"leftoverPortions"`
	Leftover         int    `json:"leftover,omitempty"`
	Notes            string `json:"notes,omitempty"`
}

// ValidatorAllocateSurplusResult hasil dari penyimpanan alokasi porsi sisa
type ValidatorAllocateSurplusResult struct {
	Success          bool                   `json:"success"`
	Message          string                 `json:"message"`
	ClassName        string                 `json:"className"`
	Option           string                 `json:"option"`
	StatusLabel      string                 `json:"statusLabel"`
	LeftoverPortions int                    `json:"leftoverPortions"`
	Totals           ValidatorHistoryTotals `json:"totals"`
	SurplusStatus    string                 `json:"surplusStatus"`
}
