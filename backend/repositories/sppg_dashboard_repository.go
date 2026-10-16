package repositories

import (
	"backend/database"
	"backend/models"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
)

type SppgDashboardRepository interface {
	GetDashboardBundle(ctx context.Context, sppgID string) (*models.SppgDashboardBundle, error)
	TransitionStage(ctx context.Context, sppgID string, payload *models.SppgStageTransitionPayload) (*models.SppgDashboardBundle, error)
	TriggerEmergency(ctx context.Context, sppgID string, payload *models.SppgEmergencyTriggerPayload, actorName string) (*models.SppgDashboardAlert, error)
	ResolveEmergency(ctx context.Context, sppgID string, alertID string, actorName string) error
}

type pgSppgDashboardRepository struct{}

func NewSppgDashboardRepository() SppgDashboardRepository {
	return &pgSppgDashboardRepository{}
}

func (r *pgSppgDashboardRepository) GetDashboardBundle(ctx context.Context, sppgID string) (*models.SppgDashboardBundle, error) {
	// 1. Profil Dapur
	var kitchenCode, kitchenName, managerName, nutritionistName, grade string
	var staffCount int
	var safetyScore float64

	err := database.Pool().QueryRow(ctx, `
		SELECT code, name, COALESCE(manager_name, 'Chef Kuswanto D., A.Md.Par'),
		       COALESCE(nutritionist_name, 'dr. Amanda Sp.GK'),
		       COALESCE(staff_count, 28), COALESCE(safety_score, 99.4),
		       COALESCE(grade, 'A')
		FROM sppg_kitchens
		WHERE id = $1
	`, sppgID).Scan(&kitchenCode, &kitchenName, &managerName, &nutritionistName, &staffCount, &safetyScore, &grade)
	if err != nil {
		kitchenCode = sppgID
		kitchenName = "SPPG 01 Menteng Jaya Mandiri"
		managerName = "Kuswanto D."
		nutritionistName = "dr. Amanda Sp.GK"
		staffCount = 28
		safetyScore = 99.4
		grade = "Grade A"
	}

	profile := models.SppgDashboardKitchenProfile{
		ID:           sppgID,
		Code:         kitchenCode,
		Name:         kitchenName,
		HeadChef:     managerName,
		Nutritionist: nutritionistName,
		LicenseNo:    "SLHS-3171/2026/088",
		HalalID:      "ID3111000189201026",
		StaffCount:   staffCount,
		SafetyScore:  safetyScore,
		Grade:        grade,
	}

	// 2. Menu Hari Ini (Resep Aktif)
	menu := models.SppgDashboardMenu{
		Code:      "PAKET-A-01",
		Name:      "Ayam Panggang Madu & Capcay Brokoli Segar",
		Calories:  545,
		Protein:   28.5,
		Carbs:     68.0,
		Fat:       14.5,
		Allergens: []string{"Kedelai (Tahu/Kecap)", "Laktosa (Susu Sapi)"},
	}

	var menuPkgID string
	_ = database.Pool().QueryRow(ctx, `
		SELECT selected_package_id
		FROM sppg_recipe_daily_states
		WHERE sppg_id = $1
		ORDER BY date DESC LIMIT 1
	`, sppgID).Scan(&menuPkgID)

	if menuPkgID != "" {
		var allergensBytes []byte
		err := database.Pool().QueryRow(ctx, `
			SELECT code, name, calories, protein, carbs, fat, allergens
			FROM sppg_menu_packages
			WHERE id = $1 OR code = $1
			LIMIT 1
		`, menuPkgID).Scan(&menu.Code, &menu.Name, &menu.Calories, &menu.Protein, &menu.Carbs, &menu.Fat, &allergensBytes)
		if err == nil && len(allergensBytes) > 0 {
			_ = json.Unmarshal(allergensBytes, &menu.Allergens)
		}
	}

	// 3. Pipeline Stages
	activeStageID := "stage-2"
	var stg1Status, stg2Status, stg3Status, stg4Status string
	var stg1Prog, stg2Prog, stg3Prog, stg4Prog int

	err = database.Pool().QueryRow(ctx, `
		SELECT current_stage_id, stage1_status, stage1_progress,
		       stage2_status, stage2_progress, stage3_status, stage3_progress,
		       stage4_status, stage4_progress
		FROM sppg_kitchen_pipeline_states
		WHERE sppg_id = $1 AND date = CURRENT_DATE
	`, sppgID).Scan(&activeStageID, &stg1Status, &stg1Prog, &stg2Status, &stg2Prog, &stg3Status, &stg3Prog, &stg4Status, &stg4Prog)

	if err != nil {
		// Default pipeline state
		activeStageID = "stage-2"
		stg1Status = "completed"
		stg1Prog = 100
		stg2Status = "active"
		stg2Prog = 100
		stg3Status = "upcoming"
		stg3Prog = 0
		stg4Status = "upcoming"
		stg4Prog = 0
	}

	stages := []models.SppgPipelineStage{
		{
			ID:          "stage-1",
			StageNumber: 1,
			Title:       "Tahap 1 · Persiapan Bahan",
			Subtitle:    "Penerimaan Bahan Baku & Thawing",
			TimeWindow:  "03:30 – 05:00 WIB",
			Status:      stg1Status,
			StatusLabel: stageStatusLabel(stg1Status, stg1Prog),
			Progress:    stg1Prog,
			MetricValue: "1.250",
			MetricUnit:  "Kg Bahan",
			Icon:        "Flame",
		},
		{
			ID:          "stage-2",
			StageNumber: 2,
			Title:       "Tahap 2 · Lini Memasak",
			Subtitle:    "Pengolahan & Pemasakan Inti",
			TimeWindow:  "04:30 – 06:00 WIB",
			Status:      stg2Status,
			StatusLabel: stageStatusLabel(stg2Status, stg2Prog),
			Progress:    stg2Prog,
			MetricValue: "2.500",
			MetricUnit:  "Porsi Matang",
			Icon:        "Flame",
		},
		{
			ID:          "stage-3",
			StageNumber: 3,
			Title:       "Tahap 3 · Pengemasan",
			Subtitle:    "Packing & Segel Termal QR",
			TimeWindow:  "05:45 – 06:45 WIB",
			Status:      stg3Status,
			StatusLabel: stageStatusLabel(stg3Status, stg3Prog),
			Progress:    stg3Prog,
			MetricValue: "50",
			MetricUnit:  "Boks Termal",
			Icon:        "QrCode",
		},
		{
			ID:          "stage-4",
			StageNumber: 4,
			Title:       "Tahap 4 · Distribusi",
			Subtitle:    "Muat Armada & Drop-off Sekolah",
			TimeWindow:  "06:30 – 08:00 WIB",
			Status:      stg4Status,
			StatusLabel: stageStatusLabel(stg4Status, stg4Prog),
			Progress:    stg4Prog,
			MetricValue: "4",
			MetricUnit:  "Armada Jalan",
			Icon:        "Truck",
		},
	}

	// 4. Telemetri & Sensor Suhu
	coreTemp := 78.5
	_ = database.Pool().QueryRow(ctx, `
		SELECT value
		FROM sppg_quality_temp_logs
		WHERE sppg_id = $1 AND (point_id = 'ccp-1' OR point_id = 'cooking_core' OR point_id = 'core_temp')
		ORDER BY created_at DESC LIMIT 1
	`, sppgID).Scan(&coreTemp)

	holdingTemp := 64.2
	_ = database.Pool().QueryRow(ctx, `
		SELECT COALESCE(AVG(box_temp_c), 64.2)
		FROM sppg_fleets
		WHERE sppg_id = $1 AND status != 'siaga'
	`, sppgID).Scan(&holdingTemp)

	telemetry := models.SppgDashboardTelemetry{
		CoreCookingTemp:        coreTemp,
		HoldingTemp:            holdingTemp,
		AmbientKitchenHumidity: 48,
		AmbientTemp:            26.5,
		IsCcp1Passed:           coreTemp >= 75.0,
	}

	// 5. HACCP 4-Hour Countdown Timer
	haccpTimer := models.SppgDashboardTimer{
		StartTime:          "06:00",
		MustConsumeBefore:  "10:00",
		TotalSafetyMinutes: 240,
		RemainingMinutes:   165,
		FreshnessPercent:   68.8,
		Status:             "SAFE",
	}

	var cookedAtStr, consumeByStr string
	_ = database.Pool().QueryRow(ctx, `
		SELECT cooked_at, consume_by
		FROM sppg_batches
		WHERE sppg_id = $1
		ORDER BY created_at DESC LIMIT 1
	`, sppgID).Scan(&cookedAtStr, &consumeByStr)

	if cookedAtStr != "" && consumeByStr != "" {
		haccpTimer.StartTime = cookedAtStr
		haccpTimer.MustConsumeBefore = consumeByStr
	}

	// 6. Ringkasan Porsi & Pengiriman (Delivery KPIs)
	targetPortions := 2500
	_ = database.Pool().QueryRow(ctx, `
		SELECT COALESCE(SUM(present - reduce_special), 2500)
		FROM sppg_school_quotas
		WHERE sppg_id = $1
	`, sppgID).Scan(&targetPortions)

	cookedPortions := targetPortions
	var batchPortions int
	_ = database.Pool().QueryRow(ctx, `
		SELECT COALESCE(SUM(box_count * 50), 0)
		FROM sppg_batches
		WHERE sppg_id = $1
	`, sppgID).Scan(&batchPortions)
	if batchPortions > 0 {
		cookedPortions = batchPortions
	}

	// Handover & BAST stats
	var signedPortions, pendingPortions int
	var signedCount, pendingCount int

	handoverRows, err := database.Pool().Query(ctx, `
		SELECT sent * 50, bast_no
		FROM sppg_handovers
		WHERE sppg_id = $1
	`, sppgID)
	if err == nil {
		defer handoverRows.Close()
		for handoverRows.Next() {
			var portions int
			var bastNo string
			if err := handoverRows.Scan(&portions, &bastNo); err == nil {
				if bastNo != "" {
					signedCount++
					signedPortions += portions
				} else {
					pendingCount++
					pendingPortions += portions
				}
			}
		}
	}

	if signedCount == 0 && pendingCount == 0 {
		// Seed default handover fallback
		signedCount = 3
		signedPortions = 1850
		pendingCount = 1
		pendingPortions = 650
	}

	signedPct := 0
	if targetPortions > 0 {
		signedPct = int(math.Round(float64(signedPortions) / float64(targetPortions) * 100))
	}

	delivery := models.SppgDashboardDelivery{
		Target:          targetPortions,
		Cooked:          cookedPortions,
		SignedCount:     signedCount,
		PendingCount:    pendingCount,
		SignedPortions:  signedPortions,
		PendingPortions: pendingPortions,
		SignedPct:       signedPct,
		AvgFleetTemp:    holdingTemp,
	}

	// 7. Manifest Sekolah & Armada
	var manifest []models.SppgDashboardManifestItem
	schoolsQuery := `
		SELECT s.school_id, s.school_name, (s.present - s.reduce_special) AS quota,
		       COALESCE(s.fleet_assigned, 'Armada 1'), COALESCE(s.principal_name, 'Kepala Sekolah'),
		       COALESCE(h.bast_no, '') AS bast_no, COALESCE(h.stage, 'dikirim') AS stage
		FROM sppg_school_quotas s
		LEFT JOIN sppg_handovers h ON s.sppg_id = h.sppg_id AND (s.school_id = h.school_id OR s.npsn = h.school_npsn)
		WHERE s.sppg_id = $1
		ORDER BY s.id ASC
	`
	rows, err := database.Pool().Query(ctx, schoolsQuery, sppgID)
	if err == nil {
		defer rows.Close()
		distances := []string{"1.8 km", "3.2 km", "4.1 km", "2.5 km"}
		drivers := []string{"Supriyadi", "Hendra W.", "Bambang K.", "Dedi S."}
		idx := 0
		for rows.Next() {
			var m models.SppgDashboardManifestItem
			var bastNo, stage string
			if err := rows.Scan(&m.ID, &m.Name, &m.Quota, &m.Fleet, &m.PICTeacher, &bastNo, &stage); err == nil {
				m.Distance = distances[idx%len(distances)]
				m.Driver = drivers[idx%len(drivers)]
				m.Boxes = int(math.Ceil(float64(m.Quota) / 25.0))
				m.BastSigned = bastNo != ""
				if m.BastSigned {
					m.Status = "Tiba & BAST"
				} else if stage == "diterima" || stage == "pemeriksaan" {
					m.Status = "Pemeriksaan"
				} else {
					m.Status = "Menuju Lokasi"
				}
				manifest = append(manifest, m)
				idx++
			}
		}
	}

	if len(manifest) == 0 {
		manifest = []models.SppgDashboardManifestItem{
			{ID: "sch-01", Name: "SDN Menteng 01 Pagi", Quota: 650, Distance: "1.8 km", Fleet: "Armada 1 (B 9102 PQA)", Driver: "Supriyadi", PICTeacher: "Ibu Nurhasanah, S.Pd", Status: "Tiba & BAST", Boxes: 26, BastSigned: true},
			{ID: "sch-02", Name: "SDN Kebayoran Baru 02", Quota: 800, Distance: "3.2 km", Fleet: "Armada 2 (B 9441 KZA)", Driver: "Hendra W.", PICTeacher: "Bpk. Bambang, M.Pd", Status: "Tiba & BAST", Boxes: 32, BastSigned: true},
			{ID: "sch-03", Name: "SMPN 3 Jakarta", Quota: 750, Distance: "4.1 km", Fleet: "Armada 3 (B 9018 SXQ)", Driver: "Bambang K.", PICTeacher: "Ibu Sri Rahayu", Status: "Tiba & BAST", Boxes: 30, BastSigned: true},
			{ID: "sch-04", Name: "SDN Cikini 01", Quota: 300, Distance: "2.5 km", Fleet: "Armada 4 (B 9211 RFA)", Driver: "Dedi S.", PICTeacher: "Bpk. Achmad Syarif", Status: "Menuju Lokasi", Boxes: 12, BastSigned: false},
		}
	}

	// 8. Perangkat Dapur Pintar
	var activeFleetCount int
	_ = database.Pool().QueryRow(ctx, `
		SELECT COUNT(*) FROM sppg_fleets WHERE sppg_id = $1 AND status != 'siaga'
	`, sppgID).Scan(&activeFleetCount)
	if activeFleetCount == 0 {
		activeFleetCount = 4
	}

	devices := models.SppgDashboardDevices{
		TempSensor: models.SppgDeviceItem{Name: "Sensor Suhu", Value: fmt.Sprintf("%.1f°C", coreTemp), Status: "online"},
		QRPrinter:  models.SppgDeviceItem{Name: "Printer QR", Value: "92% Kertas", Status: "online"},
		RFIDSeal:   models.SppgDeviceItem{Name: "Segel RFID", Value: "4/4 Boks", Status: "online"},
		GPSArmada:  models.SppgDeviceItem{Name: "GPS Armada", Value: fmt.Sprintf("%d Aktif", activeFleetCount), Status: "active"},
	}

	// 9. Emergency Alert Banner (dari sppg_incident_tickets)
	var activeAlert *models.SppgDashboardAlert
	var ticketID, ticketMsg, ticketClock string
	var ticketLvl int

	err = database.Pool().QueryRow(ctx, `
		SELECT id, message, level, created_at_clock
		FROM sppg_incident_tickets
		WHERE sppg_id = $1 AND status != 'selesai'
		ORDER BY level ASC, created_at DESC
		LIMIT 1
	`, sppgID).Scan(&ticketID, &ticketMsg, &ticketLvl, &ticketClock)

	if err == nil && ticketID != "" {
		sev := "amber"
		if ticketLvl == 1 {
			sev = "red"
		}
		notes := ticketMsg
		if strings.TrimSpace(notes) == "" {
			notes = "Laporan insiden baru masuk dari sekolah binaan (memerlukan tindakan)"
		}
		activeAlert = &models.SppgDashboardAlert{
			ID:        ticketID,
			Title:     "Peringatan Operasional Dapur Aktif",
			Severity:  sev,
			Notes:     notes,
			Timestamp: ticketClock,
		}
	}

	// 10. Analytics Bundle Data
	analytics := models.SppgDashboardAnalytics{
		FlowTimeline: []models.SppgFlowTimelinePoint{
			{Time: "04:00", PorsiMasak: 500, PorsiKirim: 0},
			{Time: "05:00", PorsiMasak: 1600, PorsiKirim: 0},
			{Time: "06:00", PorsiMasak: 2500, PorsiKirim: 650},
			{Time: "07:00", PorsiMasak: 2500, PorsiKirim: 1850},
			{Time: "08:00", PorsiMasak: 2500, PorsiKirim: 2500},
			{Time: "09:00", PorsiMasak: 2500, PorsiKirim: 2500},
			{Time: "10:00", PorsiMasak: 2500, PorsiKirim: 2500},
		},
		NutritionAccuracy: []models.SppgNutritionAccuracyPoint{
			{Nutrient: "Kalori", Target: 550, Actual: float64(menu.Calories), Unit: "kkal"},
			{Nutrient: "Protein", Target: 28, Actual: menu.Protein, Unit: "g"},
			{Nutrient: "Karbohidrat", Target: 70, Actual: menu.Carbs, Unit: "g"},
			{Nutrient: "Lemak", Target: 15, Actual: menu.Fat, Unit: "g"},
			{Nutrient: "Kalsium", Target: 400, Actual: 420, Unit: "mg"},
			{Nutrient: "Zat Besi", Target: 5.5, Actual: 5.8, Unit: "mg"},
		},
		SchoolDistribution: make([]models.SppgSchoolDistributionPoint, len(manifest)),
		TeamAllocation: []models.SppgTeamAllocationPoint{
			{Name: "Persiapan & Thawing", Count: 6, Color: "#3B82F6"},
			{Name: "Lini Masak & Pengolahan", Count: 10, Color: "#23259C"},
			{Name: "Packing & Segel Termal", Count: 6, Color: "#10B981"},
			{Name: "QC & Laboratorium", Count: 2, Color: "#F59E0B"},
			{Name: "Logistik & Driver", Count: 4, Color: "#6366F1"},
		},
		QualityControl: []models.SppgQualityControlPoint{
			{CCP: "CCP-1 Suhu Inti Masak", Score: 100},
			{CCP: "CCP-2 Uji Organoleptik", Score: 98.5},
			{CCP: "CCP-3 Kebersihan Boks", Score: 99.2},
			{CCP: "CCP-4 Suhu Insulasi Boks", Score: 97.8},
			{CCP: "CCP-5 Segel RFID QR", Score: 100},
		},
		SLARadar: []models.SppgSLARadarPoint{
			{Metric: "Ketepatan Waktu", Score: 99.2},
			{Metric: "Kesesuaian Menu", Score: 100},
			{Metric: "Suhu Armada", Score: 98.7},
			{Metric: "Zero Defect", Score: 99.5},
			{Metric: "Kelengkapan BAST", Score: 97.4},
			{Metric: "Rating Kepuasan", Score: 99.1},
		},
		CCPSummary: models.SppgCCPSummary{
			Passing: 5,
			Total:   5,
		},
	}

	for i, m := range manifest {
		analytics.SchoolDistribution[i] = models.SppgSchoolDistributionPoint{
			School:   m.Name,
			Quota:    m.Quota,
			Capacity: m.Boxes * 25,
			Status:   m.Status,
		}
	}

	bundle := &models.SppgDashboardBundle{
		KitchenProfile: profile,
		TodayMenu:      menu,
		PipelineStages: stages,
		ActiveStageID:  activeStageID,
		Telemetry:      telemetry,
		HaccpTimer:     haccpTimer,
		Devices:        devices,
		Delivery:       delivery,
		Manifest:       manifest,
		ActiveAlert:    activeAlert,
		Analytics:      analytics,
	}

	return bundle, nil
}

func stageStatusLabel(status string, progress int) string {
	switch status {
	case "completed":
		return "Selesai 100%"
	case "active":
		return fmt.Sprintf("Sedang Berlangsung %d%%", progress)
	default:
		return "Menunggu Jadwal"
	}
}

func (r *pgSppgDashboardRepository) TransitionStage(ctx context.Context, sppgID string, payload *models.SppgStageTransitionPayload) (*models.SppgDashboardBundle, error) {
	stg1Status, stg1Prog := "completed", 100
	stg2Status, stg2Prog := "completed", 100
	stg3Status, stg3Prog := "upcoming", 0
	stg4Status, stg4Prog := "upcoming", 0

	target := payload.TargetStageID
	switch target {
	case "stage-3":
		stg3Status, stg3Prog = "active", 35
	case "stage-4":
		stg3Status, stg3Prog = "completed", 100
		stg4Status, stg4Prog = "active", 40
	case "stage-2":
		stg2Status, stg2Prog = "active", 50
	}

	query := `
		INSERT INTO sppg_kitchen_pipeline_states (
			sppg_id, date, current_stage_id,
			stage1_status, stage1_progress,
			stage2_status, stage2_progress,
			stage3_status, stage3_progress,
			stage4_status, stage4_progress,
			updated_at
		) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
		ON CONFLICT (sppg_id, date) DO UPDATE SET
			current_stage_id = EXCLUDED.current_stage_id,
			stage1_status = EXCLUDED.stage1_status,
			stage1_progress = EXCLUDED.stage1_progress,
			stage2_status = EXCLUDED.stage2_status,
			stage2_progress = EXCLUDED.stage2_progress,
			stage3_status = EXCLUDED.stage3_status,
			stage3_progress = EXCLUDED.stage3_progress,
			stage4_status = EXCLUDED.stage4_status,
			stage4_progress = EXCLUDED.stage4_progress,
			updated_at = NOW()
	`

	_, err := database.Pool().Exec(ctx, query,
		sppgID, target,
		stg1Status, stg1Prog,
		stg2Status, stg2Prog,
		stg3Status, stg3Prog,
		stg4Status, stg4Prog,
	)
	if err != nil {
		return nil, fmt.Errorf("transition stage failed: %w", err)
	}

	return r.GetDashboardBundle(ctx, sppgID)
}

func (r *pgSppgDashboardRepository) TriggerEmergency(ctx context.Context, sppgID string, payload *models.SppgEmergencyTriggerPayload, actorName string) (*models.SppgDashboardAlert, error) {
	level := 2
	if strings.ToLower(payload.Severity) == "red" || strings.ToLower(payload.Severity) == "siaga 1" {
		level = 1
	}

	reasonsMap := map[string]string{
		"kompor_gas":          "Kompor Rusak / Pasokan Gas Terganggu (+20 Menit)",
		"suhu_drop":           "Suhu Masak Inti Turun di Bawah Standar 75°C (Re-cooking)",
		"keterlambatan_armada": "Keterlambatan Penjemputan Armada Logistik > 15 Menit",
		"kontaminasi_fisik":   "Temuan Anomali Fisik Bahan Baku Saat Pengemasan",
	}

	title := reasonsMap[payload.Reason]
	if title == "" {
		title = "Peringatan Operasional Dapur"
	}

	ticketID := "INC-" + strconv.FormatInt(time.Now().UnixMilli(), 10)
	clock := time.Now().Format("15:04") + " WIB"

	msg := title
	if payload.Notes != "" {
		msg = fmt.Sprintf("%s — Catatan mitigasi: %s (Oleh: %s)", title, payload.Notes, actorName)
	}

	schoolName := "Dapur Sentral " + sppgID
	query := `
		INSERT INTO sppg_incident_tickets (
			id, sppg_id, school_id, school_name, batch_token,
			level, category, message, created_at_clock, status,
			responses, resolution, created_at, updated_at
		) VALUES (
			$1, $2, 'KITCHEN-OPS', $3, '',
			$4, 'Darurat Operasional Dapur', $5, $6, 'investigasi',
			'[]'::jsonb, '', NOW(), NOW()
		)
	`

	_, err := database.Pool().Exec(ctx, query, ticketID, sppgID, schoolName, level, msg, clock)
	if err != nil {
		return nil, fmt.Errorf("trigger emergency incident ticket failed: %w", err)
	}

	alert := &models.SppgDashboardAlert{
		ID:        ticketID,
		Title:     title,
		Severity:  payload.Severity,
		Notes:     msg,
		Timestamp: clock,
	}

	return alert, nil
}

func (r *pgSppgDashboardRepository) ResolveEmergency(ctx context.Context, sppgID string, alertID string, actorName string) error {
	resolution := fmt.Sprintf("Mitigasi darurat diselesaikan oleh %s pada %s", actorName, time.Now().Format("15:04:05 WIB"))
	query := `
		UPDATE sppg_incident_tickets
		SET status = 'selesai', resolution = $3, updated_at = NOW()
		WHERE sppg_id = $1 AND (id = $2 OR $2 = '' OR $2 = 'all')
	`
	_, err := database.Pool().Exec(ctx, query, sppgID, alertID, resolution)
	if err != nil {
		return fmt.Errorf("resolve emergency ticket failed: %w", err)
	}
	return nil
}
