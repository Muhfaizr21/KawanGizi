package models

import "time"

// ValidatorDashboardFleet status armada logistik dapur SPPG
type ValidatorDashboardFleet struct {
	Unit         string `json:"unit"`
	LicensePlate string `json:"licensePlate"`
	Driver       string `json:"driver"`
	DriverPhone  string `json:"driverPhone"`
	DepartedAt   string `json:"departedAt"`
	Eta          string `json:"eta"`
	Status       string `json:"status"` // on_the_way | arrived | delayed | rescheduled
	StatusLabel  string `json:"statusLabel"`
	StatusReason string `json:"statusReason,omitempty"`
	MasterTotes  int    `json:"masterTotes"`
	Portions     int    `json:"portions"`
	Route        string `json:"route"`
}

// ValidatorDashboardHaccp countdown HACCP 4 jam dan golden window
type ValidatorDashboardHaccp struct {
	CookedAt         string  `json:"cookedAt"`
	DeliveredAt      string  `json:"deliveredAt"`
	LunchTime        string  `json:"lunchTime"`
	SafeUntil        string  `json:"safeUntil"`
	SecondsLeft      int     `json:"secondsLeft"`
	TotalSeconds     int     `json:"totalSeconds"`
	WindowMinutes    int     `json:"windowMinutes"`
	FreshnessPercent float64 `json:"freshnessPercent"`
	IsSafe           bool    `json:"isSafe"`
	StatusLabel      string  `json:"statusLabel"`
	WarningMessage   string  `json:"warningMessage,omitempty"`
}

// StudentBreakdownItem pembagian kelompok siswa
type StudentBreakdownItem struct {
	Label string `json:"label"`
	Value int    `json:"value"`
}

// ValidatorDashboardQuota papan kuota porsi sekolah
type ValidatorDashboardQuota struct {
	TargetPortions      int                    `json:"targetPortions"`
	StudentBreakdown    []StudentBreakdownItem `json:"studentBreakdown"`
	ValidatedPortions   int                    `json:"validatedPortions"`
	RejectedPortions    int                    `json:"rejectedPortions"`
	MasterTotesReceived int                    `json:"masterTotesReceived"`
	MasterTotesTotal    int                    `json:"masterTotesTotal"`
	ToteCapacity        int                    `json:"toteCapacity"`
	LeftoverPortions    int                    `json:"leftoverPortions"`
	SurplusStatus       string                 `json:"surplusStatus"`
}

// ValidatorDashboardMenu kartu menu hari ini dan nilai gizi
type ValidatorDashboardMenu struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	DayTitle     string   `json:"dayTitle"`
	Staple       string   `json:"staple"`
	ProteinMain  string   `json:"proteinMain"`
	SideVeggie   string   `json:"sideVeggie"`
	Fruit        string   `json:"fruit"`
	DairyDrink   string   `json:"dairyDrink"`
	Calories     int      `json:"calories"`
	Protein      float64  `json:"protein"`
	Fat          float64  `json:"fat"`
	Carbohydrate float64  `json:"carbohydrate"`
	HalalCert    string   `json:"halalCert"`
	SlhsCert     string   `json:"slhsCert"`
	Allergens    []string `json:"allergens"`
}

// ValidatorDashboardScanSummary statistik hasil scan classifier AI hari ini
type ValidatorDashboardScanSummary struct {
	TotalScans         int       `json:"totalScans"`
	RejectedScans      int       `json:"rejectedScans"`
	WarningScans       int       `json:"warningScans"`
	VerifiedScans      int       `json:"verifiedScans"`
	AverageConfidence  int       `json:"averageConfidence"`
	AverageHoldingTemp *float64  `json:"averageHoldingTemp"`
	RecentScans        []ScanLog `json:"recentScans"`
}

// ValidatorDashboardBundle bundel respons lengkap untuk GET /api/validator/dashboard
type ValidatorDashboardBundle struct {
	School           ValidatorSchoolInfo           `json:"school"`
	GateWindow       string                        `json:"gateWindow"`
	Fleet            ValidatorDashboardFleet       `json:"fleet"`
	Haccp            ValidatorDashboardHaccp       `json:"haccp"`
	Quota            ValidatorDashboardQuota       `json:"quota"`
	Menu             ValidatorDashboardMenu        `json:"menu"`
	ScanSummary      ValidatorDashboardScanSummary `json:"scanSummary"`
	AvailableSchools []ValidatorSchoolOption       `json:"availableSchools,omitempty"`
	LastUpdated      time.Time                     `json:"lastUpdated"`
}
