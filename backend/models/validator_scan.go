package models

import "time"

// ValidatorSchoolInfo informasi sekolah aktif untuk ruang validator
type ValidatorSchoolInfo struct {
	NPSN          string `json:"npsn"`
	Name          string `json:"name"`
	Level         string `json:"level"`
	City          string `json:"city"`
	District      string `json:"district"`
	Address       string `json:"address"`
	TotalStudents int    `json:"totalStudents"`
	SPPGID        string `json:"sppgId"`
}

// ValidatorParentSPPGInfo data dapur sentral (parent) penyedia makanan
type ValidatorParentSPPGInfo struct {
	ID          string  `json:"id"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	HeadChef    string  `json:"headChef"`
	Nutritionist string `json:"nutritionist"`
	SafetyScore float64 `json:"safetyScore"`
	Grade       string  `json:"grade"`
	Phone       string  `json:"phone"`
}

// ValidatorTodayMenuInfo rincian hidangan hari ini dari batch parent SPPG
type ValidatorTodayMenuInfo struct {
	Code      string  `json:"code"`
	Name      string  `json:"name"`
	Calories  int     `json:"calories"`
	Protein   float64 `json:"protein"`
	Carbs     float64 `json:"carbs"`
	Fat       float64 `json:"fat"`
	CookedAt  string  `json:"cookedAt"`
	ConsumeBy string  `json:"consumeBy"`
}

// ValidatorHaccpInfo perhitungan jendela aman konsumsi 4 jam (HACCP)
type ValidatorHaccpInfo struct {
	CookedAt         string  `json:"cookedAt"`
	ConsumeBy        string  `json:"consumeBy"`
	RemainingMinutes int     `json:"remainingMinutes"`
	FreshnessPercent float64 `json:"freshnessPercent"`
	IsSafe           bool    `json:"isSafe"`
	StatusLabel      string  `json:"statusLabel"`
	WarningMessage   string  `json:"warningMessage,omitempty"`
}

// ValidatorBoxItem representasi boks thermal pengiriman hari ini
type ValidatorBoxItem struct {
	ID           string   `json:"id"`
	QRToken      string   `json:"qrToken"`
	BatchID      string   `json:"batchId"`
	Portions     int      `json:"portions"`
	Status       string   `json:"status"` // pending | scanned | approved | rejected
	TempMeasured *float64 `json:"tempMeasured,omitempty"`
	DriverName   string   `json:"driverName"`
	FleetPlate   string   `json:"fleetPlate"`
}

// ValidatorHandoverInfo status serah terima dan BAST sekolah
type ValidatorHandoverInfo struct {
	ID          string `json:"id"`
	Stage       string `json:"stage"` // menunggu | proses | diterima | lolos | bast | hold
	Sent        int    `json:"sent"`
	Scanned     int    `json:"scanned"`
	BastNo      string `json:"bastNo"`
	BastAt      string `json:"bastAt"`
	BastSigned  bool   `json:"bastSigned"`
	CourierSign string `json:"courierSign"`
	TeacherSign string `json:"teacherSign"`
}

// ValidatorSchoolOption pilihan sekolah untuk role superadmin
type ValidatorSchoolOption struct {
	NPSN     string `json:"npsn"`
	Name     string `json:"name"`
	SPPGID   string `json:"sppgId"`
	SPPGName string `json:"sppgName"`
}

// ValidatorScanContext bundle lengkap ruang pemindaian validator
type ValidatorScanContext struct {
	School           ValidatorSchoolInfo     `json:"school"`
	ParentSPPG       ValidatorParentSPPGInfo `json:"parentSppg"`
	TodayMenu        ValidatorTodayMenuInfo  `json:"todayMenu"`
	Haccp            ValidatorHaccpInfo      `json:"haccp"`
	TodayBoxes       []ValidatorBoxItem      `json:"todayBoxes"`
	Handover         ValidatorHandoverInfo   `json:"handover"`
	RecentScans      []ScanLog               `json:"recentScans"`
	AvailableSchools []ValidatorSchoolOption `json:"availableSchools,omitempty"`
	LastUpdated      time.Time               `json:"lastUpdated"`
}

// ValidatorScanConfirmPayload payload keputusan akhir validator (Setujui / Tolak)
type ValidatorScanConfirmPayload struct {
	ScanID        string  `json:"scanId"`
	BoxID         string  `json:"boxId"`
	QRToken       string  `json:"qrToken"`
	BatchID       string  `json:"batchId"`
	Decision      string  `json:"decision"` // approve | reject
	HoldingTemp   float64 `json:"holdingTemp"`
	ReleaseTemp   float64 `json:"releaseTemp"`
	ValidatorName string  `json:"validatorName"`
	Notes         string  `json:"notes"`
	NPSN          string  `json:"npsn"`
	SPPGID        string  `json:"sppgId"`
}

// ValidatorScanConfirmResult respon konfirmasi dan status sinkronisasi 3 role
type ValidatorScanConfirmResult struct {
	Success        bool   `json:"success"`
	Message        string `json:"message"`
	BastNo         string `json:"bastNo"`
	BastSigned     bool   `json:"bastSigned"`
	BastAt         string `json:"bastAt"`
	TeacherSign    string `json:"teacherSign"`
	DeliveryStatus string `json:"deliveryStatus"`
	HandoverStage  string `json:"handoverStage"`
	SyncedToSPPG   bool   `json:"syncedToSppg"`
	SyncedToAdmin  bool   `json:"syncedToAdmin"`
}

// ValidatorMasterToteItem status tiap master tote thermal (1 tote = 50 porsi)
type ValidatorMasterToteItem struct {
	ID          string   `json:"id"`
	QR          string   `json:"qr"`
	Portions    int      `json:"portions"`
	TempCelsius *float64 `json:"tempCelsius,omitempty"`
	Status      string   `json:"status"` // "received" | "pending" | "rejected"
	ScannedAt   string   `json:"scannedAt,omitempty"`
}

// ValidatorFleetStatus data armada pengantar logistik dapur ke sekolah
type ValidatorFleetStatus struct {
	Status      string `json:"status"`
	StatusLabel string `json:"statusLabel"`
	Plate       string `json:"plate"`
	Unit        string `json:"unit"`
	Driver      string `json:"driver"`
	DriverPhone string `json:"driverPhone"`
	Courier     string `json:"courier"`
	ETA         string `json:"eta"`
	DepartedAt  string `json:"departedAt"`
	Route       string `json:"route"`
	MasterTotes int    `json:"masterTotes"`
	Portions    int    `json:"portions"`
}

// ValidatorTempLogItem catatan log suhu holding kontainer
type ValidatorTempLogItem struct {
	ToteID string  `json:"toteId"`
	Temp   float64 `json:"temp"`
	At     string  `json:"at,omitempty"`
}

// ValidatorHandoverBundle bundle lengkap untuk halaman /validator/handover
type ValidatorHandoverBundle struct {
	School           ValidatorSchoolInfo       `json:"school"`
	ParentSPPG       ValidatorParentSPPGInfo   `json:"parentSppg"`
	Fleet            ValidatorFleetStatus      `json:"fleet"`
	TargetPortions   int                       `json:"targetPortions"`
	MasterTotesTotal int                       `json:"masterTotesTotal"`
	ToteCapacity     int                       `json:"toteCapacity"`
	Totes            []ValidatorMasterToteItem `json:"totes"`
	TempLogs         []ValidatorTempLogItem    `json:"tempLogs"`
	Handover         ValidatorHandoverInfo     `json:"handover"`
	AvailableSchools []ValidatorSchoolOption   `json:"availableSchools,omitempty"`
	LastUpdated      time.Time                 `json:"lastUpdated"`
}

// ValidatorSubmitBastPayload payload terbitkan BAST dari halaman validator handover
type ValidatorSubmitBastPayload struct {
	NPSN             string                 `json:"npsn"`
	SPPGID           string                 `json:"sppgId"`
	HandoverID       string                 `json:"handoverId"`
	ReceivedTotes    int                    `json:"receivedTotes"`
	ReceivedPortions int                    `json:"receivedPortions"`
	DamagedPortions  int                    `json:"damagedPortions"`
	AvgTemp          float64                `json:"avgTemp"`
	TempLogs         []ValidatorTempLogItem `json:"tempLogs"`
	DriverSign       string                 `json:"driverSign"`
	ValidatorSign    string                 `json:"validatorSign"`
	DriverStrokes    string                 `json:"driverStrokes,omitempty"`
	ValidatorStrokes string                 `json:"validatorStrokes,omitempty"`
	Notes            string                 `json:"notes,omitempty"`
}

// ValidatorSubmitBastResult respon hasil penerbitan BAST
type ValidatorSubmitBastResult struct {
	Success        bool      `json:"success"`
	Message        string    `json:"message"`
	BastNo         string    `json:"bastNo"`
	BastAt         string    `json:"bastAt"`
	BastHash       string    `json:"bastHash"`
	Totes          int       `json:"totes"`
	Portions       int       `json:"portions"`
	DeliveryStatus string    `json:"deliveryStatus"`
	HandoverStage  string    `json:"handoverStage"`
	SyncedToSPPG   bool      `json:"syncedToSppg"`
	SyncedToAdmin  bool      `json:"syncedToAdmin"`
	Timestamp      time.Time `json:"timestamp"`
}

