package models

// SppgDashboardBundle menggabungkan seluruh metrik cockpit operasional dapur dari semua subsistem.
type SppgDashboardBundle struct {
	KitchenProfile SppgDashboardKitchenProfile `json:"kitchenProfile"`
	TodayMenu      SppgDashboardMenu           `json:"todayMenu"`
	PipelineStages []SppgPipelineStage         `json:"pipelineStages"`
	ActiveStageID  string                      `json:"activeStageId"`
	Telemetry      SppgDashboardTelemetry      `json:"telemetry"`
	HaccpTimer     SppgDashboardTimer          `json:"haccpTimer"`
	Devices        SppgDashboardDevices        `json:"devices"`
	Delivery       SppgDashboardDelivery       `json:"delivery"`
	Manifest       []SppgDashboardManifestItem `json:"manifest"`
	ActiveAlert    *SppgDashboardAlert         `json:"activeAlert"`
	Analytics      SppgDashboardAnalytics      `json:"analytics"`
}

type SppgDashboardKitchenProfile struct {
	ID           string  `json:"id"`
	Code         string  `json:"code"`
	Name         string  `json:"name"`
	HeadChef     string  `json:"headChef"`
	Nutritionist string  `json:"nutritionist"`
	LicenseNo    string  `json:"licenseNo"`
	HalalID      string  `json:"halalId"`
	StaffCount   int     `json:"staffCount"`
	SafetyScore  float64 `json:"safetyScore"`
	Grade        string  `json:"grade"`
}

type SppgDashboardMenu struct {
	Code      string   `json:"code"`
	Name      string   `json:"name"`
	Calories  int      `json:"calories"`
	Protein   float64  `json:"protein"`
	Carbs     float64  `json:"carbs"`
	Fat       float64  `json:"fat"`
	Allergens []string `json:"allergens"`
}

type SppgPipelineStage struct {
	ID          string `json:"id"`
	StageNumber int    `json:"stageNumber"`
	Title       string `json:"title"`
	Subtitle    string `json:"subtitle"`
	TimeWindow  string `json:"timeWindow"`
	Status      string `json:"status"` // 'completed' | 'active' | 'upcoming'
	StatusLabel string `json:"statusLabel"`
	Progress    int    `json:"progress"`
	MetricValue string `json:"metricValue"`
	MetricUnit  string `json:"metricUnit"`
	Icon        string `json:"icon"` // 'Flame' | 'PackageCheck' | 'QrCode' | 'Truck'
}

type SppgDashboardTelemetry struct {
	CoreCookingTemp        float64 `json:"coreCookingTemp"`
	HoldingTemp            float64 `json:"holdingTemp"`
	AmbientKitchenHumidity int     `json:"ambientKitchenHumidity"`
	AmbientTemp            float64 `json:"ambientTemp"`
	IsCcp1Passed           bool    `json:"isCcp1Passed"`
}

type SppgDashboardTimer struct {
	StartTime          string  `json:"startTime"`
	MustConsumeBefore  string  `json:"mustConsumeBefore"`
	TotalSafetyMinutes int     `json:"totalSafetyMinutes"`
	RemainingMinutes   int     `json:"remainingMinutes"`
	FreshnessPercent   float64 `json:"freshnessPercent"`
	Status             string  `json:"status"` // 'SAFE' | 'WARNING' | 'EXPIRED'
}

type SppgDashboardDevices struct {
	TempSensor SppgDeviceItem `json:"tempSensor"`
	QRPrinter  SppgDeviceItem `json:"qrPrinter"`
	RFIDSeal   SppgDeviceItem `json:"rfidSeal"`
	GPSArmada  SppgDeviceItem `json:"gpsArmada"`
}

type SppgDeviceItem struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Status string `json:"status"`
}

type SppgDashboardDelivery struct {
	Target          int     `json:"target"`
	Cooked          int     `json:"cooked"`
	SignedCount     int     `json:"signedCount"`
	PendingCount    int     `json:"pendingCount"`
	SignedPortions  int     `json:"signedPortions"`
	PendingPortions int     `json:"pendingPortions"`
	SignedPct       int     `json:"signedPct"`
	AvgFleetTemp    float64 `json:"avgFleetTemp"`
}

type SppgDashboardManifestItem struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Quota      int    `json:"quota"`
	Distance   string `json:"distance"`
	Fleet      string `json:"fleet"`
	Driver     string `json:"driver"`
	PICTeacher string `json:"picTeacher"`
	Status     string `json:"status"`
	Boxes      int    `json:"boxes"`
	BastSigned bool   `json:"bastSigned"`
}

type SppgDashboardAlert struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Severity  string `json:"severity"` // 'amber' | 'red'
	Notes     string `json:"notes"`
	Timestamp string `json:"timestamp"`
}

type SppgDashboardAnalytics struct {
	FlowTimeline       []SppgFlowTimelinePoint       `json:"flowTimeline"`
	NutritionAccuracy  []SppgNutritionAccuracyPoint  `json:"nutritionAccuracy"`
	SchoolDistribution []SppgSchoolDistributionPoint `json:"schoolDistribution"`
	TeamAllocation     []SppgTeamAllocationPoint     `json:"teamAllocation"`
	QualityControl     []SppgQualityControlPoint     `json:"qualityControl"`
	SLARadar           []SppgSLARadarPoint           `json:"slaRadar"`
	CCPSummary         SppgCCPSummary                `json:"ccpSummary"`
}

type SppgFlowTimelinePoint struct {
	Time       string `json:"time"`
	PorsiMasak int    `json:"porsiMasak"`
	PorsiKirim int    `json:"porsiKirim"`
}

type SppgNutritionAccuracyPoint struct {
	Nutrient string  `json:"nutrient"`
	Target   float64 `json:"target"`
	Actual   float64 `json:"actual"`
	Unit     string  `json:"unit"`
}

type SppgSchoolDistributionPoint struct {
	School   string `json:"school"`
	Quota    int    `json:"quota"`
	Capacity int    `json:"capacity"`
	Status   string `json:"status"`
}

type SppgTeamAllocationPoint struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
	Color string `json:"color"`
}

type SppgQualityControlPoint struct {
	CCP   string  `json:"ccp"`
	Score float64 `json:"score"`
}

type SppgSLARadarPoint struct {
	Metric string  `json:"metric"`
	Score  float64 `json:"score"`
}

type SppgCCPSummary struct {
	Passing int `json:"passing"`
	Total   int `json:"total"`
}

type SppgStageTransitionPayload struct {
	TargetStageID   string `json:"targetStageId"`
	TempChecked     bool   `json:"tempChecked"`
	NutritionSigned bool   `json:"nutritionSigned"`
	BoxesReady      bool   `json:"boxesReady"`
}

type SppgEmergencyTriggerPayload struct {
	Reason   string `json:"reason"`
	Severity string `json:"severity"`
	Notes    string `json:"notes"`
}

type SppgEmergencyResolvePayload struct {
	AlertID string `json:"alertId"`
}
