package models

import "time"

// ValidatorIncidentTimeline tahapan penanganan tiket insiden
type ValidatorIncidentTimeline struct {
	Label string `json:"label"`
	Time  string `json:"time"`
	Done  bool   `json:"done"`
}

// ValidatorIncidentItem entitas tiket insiden untuk portal validator
type ValidatorIncidentItem struct {
	ID            string                      `json:"id"`
	Category      string                      `json:"category"`
	Severity      string                      `json:"severity"` // "low" | "medium" | "high"
	SeverityLabel string                      `json:"severityLabel"`
	OpenedAt      string                      `json:"openedAt"`
	Status        string                      `json:"status"` // "open" | "in_progress" | "resolved"
	StatusLabel   string                      `json:"statusLabel"`
	Handler       string                      `json:"handler"`
	Timeline      []ValidatorIncidentTimeline `json:"timeline"`
	Note          string                      `json:"note"`
	Responses     []string                    `json:"responses,omitempty"`
	Fresh         bool                        `json:"fresh,omitempty"`
	SchoolName    string                      `json:"schoolName,omitempty"`
	BatchToken    string                      `json:"batchToken,omitempty"`
	CreatedAt     time.Time                   `json:"createdAt"`
}

// ValidatorCreateIncidentPayload payload dari form pelaporan insiden validator
type ValidatorCreateIncidentPayload struct {
	Category     string   `json:"category"`
	Severity     string   `json:"severity"` // "low" | "medium" | "high"
	Description  string   `json:"description"`
	Photos       []int    `json:"photos,omitempty"`
	NPSN         string   `json:"npsn,omitempty"`
	SPPGID       string   `json:"sppgId,omitempty"`
	BatchToken   string   `json:"batchToken,omitempty"`
	ReporterName string   `json:"reporterName,omitempty"`
}

// ValidatorIncidentBundle bundle data lengkap untuk halaman /validator/incidents
type ValidatorIncidentBundle struct {
	School           ValidatorSchoolInfo       `json:"school"`
	ParentSPPG       ValidatorParentSPPGInfo   `json:"parentSppg"`
	ActiveBatch      string                    `json:"activeBatch"`
	Tickets          []ValidatorIncidentItem   `json:"tickets"`
	AvailableSchools []ValidatorSchoolOption   `json:"availableSchools,omitempty"`
	LastUpdated      time.Time                 `json:"lastUpdated"`
}
