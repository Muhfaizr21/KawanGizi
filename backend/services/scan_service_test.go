package services

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"backend/models"
)

type scanRepoStub struct {
	batch *models.ScanBatchInfo
}

func (r *scanRepoStub) FindBatch(context.Context, string) (*models.ScanBatchInfo, error) {
	return r.batch, nil
}
func (*scanRepoStub) InsertScan(context.Context, *models.ScanLog) error { return nil }
func (*scanRepoStub) CountToday(context.Context) (int, error)           { return 0, nil }
func (*scanRepoStub) ListRecentScans(context.Context, string, int) ([]models.ScanLog, error) {
	return nil, nil
}
func (*scanRepoStub) UpdateScanFeedback(context.Context, string, int, string, *float64) error {
	return nil
}
func (*scanRepoStub) DeleteScan(context.Context, string, string) (string, error) { return "", nil }
func (*scanRepoStub) DeleteAllScans(context.Context, string) ([]string, error)   { return nil, nil }

func scanServiceWithPrediction(t *testing.T, prediction map[string]any, status int, repo *scanRepoStub) ScanService {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if status != http.StatusOK {
			http.Error(w, "unavailable", status)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(prediction)
	}))
	t.Cleanup(server.Close)
	return NewScanService(repo, server.URL, nil)
}

func submitTestScan(t *testing.T, service ScanService) (*models.ScanResult, error) {
	t.Helper()
	return service.SubmitScan(context.Background(), ScanSubmission{
		ActorID:  "validator-1",
		Image:    []byte("image"),
		FileName: "scan.jpg",
		BatchID:  "BTH-01",
	})
}

func TestSubmitScanSeparatesMenuAndCookedFreshnessModels(t *testing.T) {
	service := scanServiceWithPrediction(t, map[string]any{
		"menu_class_name": "chicken_curry", "menu_confidence": 0.88,
		"freshness_class_name": "Fresh", "freshness_confidence": 0.93,
		"freshness_class_probabilities": map[string]float64{"Fresh": 0.93, "Spoiled": 0.07},
		"latency_ms":                    42.5,
	}, http.StatusOK, &scanRepoStub{batch: &models.ScanBatchInfo{
		BatchID: "BTH-01", SPPGName: "SPPG Menteng", MenuName: "Nasi Ayam Sayur",
		ProductionDate: "2026-10-07", Macros: &models.Macros{Energy: 520, Protein: 27, Carbs: 68, Fat: 16},
	}})

	result, err := submitTestScan(t, service)
	if err != nil {
		t.Fatal(err)
	}
	if result.MenuName != "Nasi Ayam Sayur" || result.MenuClass != "chicken_curry" {
		t.Fatalf("menu result not preserved: %+v", result)
	}
	if result.FreshnessClass != "Fresh" || result.FreshnessConfidence != 0.93 || result.Score != 93 {
		t.Fatalf("freshness result not preserved: %+v", result)
	}
	if result.Verdict != models.VerdictPeringatan {
		t.Fatalf("fresh visual prediction must still require staff verification, got %q", result.Verdict)
	}
	if result.BatchInfo == nil || result.BatchInfo.SPPGName != "SPPG Menteng" || result.Macros == nil || result.Macros.Energy != 520 {
		t.Fatalf("batch context not returned: %+v", result.BatchInfo)
	}
}

func TestSubmitScanSpoiledAndLowConfidenceRequireDifferentOutcomes(t *testing.T) {
	tests := []struct {
		name       string
		class      string
		confidence float64
		want       string
	}{
		{name: "spoiled with high confidence", class: "Spoiled", confidence: 0.95, want: models.VerdictTolak},
		{name: "low confidence", class: "Fresh", confidence: 0.49, want: models.VerdictPeringatan},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			service := scanServiceWithPrediction(t, map[string]any{
				"menu_class_name": "", "menu_confidence": 0,
				"freshness_class_name": tc.class, "freshness_confidence": tc.confidence,
				"freshness_class_probabilities": map[string]float64{"Fresh": 1 - tc.confidence, "Spoiled": tc.confidence},
				"latency_ms":                    12,
			}, http.StatusOK, &scanRepoStub{})
			result, err := submitTestScan(t, service)
			if err != nil {
				t.Fatal(err)
			}
			if result.Verdict != tc.want {
				t.Fatalf("got verdict %q, want %q", result.Verdict, tc.want)
			}
		})
	}
}

func TestSubmitScanUsesIndonesianDisplayNamesButKeepsRawClasses(t *testing.T) {
	service := scanServiceWithPrediction(t, map[string]any{
		"menu_class_name": "chicken_curry", "menu_display_name": "kari ayam",
		"menu_confidence": 0.88,
		"freshness_class_name": "Fresh", "freshness_display_name": "Segar",
		"freshness_confidence": 0.93,
		"freshness_class_probabilities": map[string]float64{"Fresh": 0.93, "Spoiled": 0.07},
		"latency_ms":                    42.5,
	}, http.StatusOK, &scanRepoStub{})

	result, err := submitTestScan(t, service)
	if err != nil {
		t.Fatal(err)
	}
	// Label mentah dipertahankan karena componentAliases mencocokkan kunci Inggris.
	if result.MenuClass != "chicken_curry" || result.FreshnessClass != "Fresh" {
		t.Fatalf("raw classes must stay untouched: %+v", result)
	}
	if result.MenuDisplay != "kari ayam" || result.FreshnessDisplay != "Segar" {
		t.Fatalf("indonesian display names lost: %+v", result)
	}
	if result.MenuName != "kari ayam" {
		t.Fatalf("display name should back menuName without a batch menu: %q", result.MenuName)
	}

	notes := map[string]string{}
	for _, check := range result.Checks {
		notes[check.Label] = check.Note
	}
	if note := notes["Pengenalan menu (YOLOv8)"]; !strings.Contains(note, "kari ayam") {
		t.Fatalf("menu check note must show the indonesian name: %q", note)
	}
	if note := notes["Kesegaran hidangan matang (YOLOv8)"]; !strings.Contains(note, "Segar") {
		t.Fatalf("freshness check note must show the indonesian name: %q", note)
	}
}

func TestSubmitScanFallsBackWhenAIServiceOmitsDisplayNames(t *testing.T) {
	// Layanan AI lawas tidak mengirim *_display_name; tampilan jatuh ke
	// menuDisplayName (title case) agar catatan tetap terbaca.
	service := scanServiceWithPrediction(t, map[string]any{
		"menu_class_name": "chicken_curry", "menu_confidence": 0.88,
		"freshness_class_name": "Fresh", "freshness_confidence": 0.93,
		"freshness_class_probabilities": map[string]float64{"Fresh": 0.93, "Spoiled": 0.07},
		"latency_ms":                    12,
	}, http.StatusOK, &scanRepoStub{})

	result, err := submitTestScan(t, service)
	if err != nil {
		t.Fatal(err)
	}
	if result.MenuDisplay != "Chicken Curry" {
		t.Fatalf("missing display name must fall back to title case, got %q", result.MenuDisplay)
	}
	if result.FreshnessDisplay != "Fresh" {
		t.Fatalf("missing freshness display name must keep the raw class, got %q", result.FreshnessDisplay)
	}
}

func TestSubmitScanReportsUnavailableAI(t *testing.T) {
	service := scanServiceWithPrediction(t, nil, http.StatusServiceUnavailable, &scanRepoStub{})
	_, err := submitTestScan(t, service)
	if err == nil || !strings.Contains(err.Error(), ErrAIUnavailable.Error()) {
		t.Fatalf("expected ErrAIUnavailable, got %v", err)
	}
}

type nutritionStub struct {
	calls     int
	lastItems []ItemRequest
	matches   []models.NutritionMatch
	macros    *models.Macros
	note      string
}

func (*nutritionStub) Search(context.Context, string, int) ([]models.NutritionItem, error) {
	return nil, nil
}

func (n *nutritionStub) MatchItems(_ context.Context, items []ItemRequest) ([]models.NutritionMatch, *models.Macros, string, error) {
	n.calls++
	n.lastItems = items
	return n.matches, n.macros, n.note, nil
}

func trayPredictionServer(t *testing.T) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"menu_class_name": "", "menu_confidence": 0,
			"freshness_class_name": "Fresh", "freshness_confidence": 0.93,
			"freshness_class_probabilities": map[string]float64{"Fresh": 0.93, "Spoiled": 0.07},
			"compartments": []map[string]any{
				{"index": 0, "empty": false, "menu_class_name": "nasi_kuning", "menu_display_name": "Nasi Kuning", "menu_confidence": 0.9},
				{"index": 1, "empty": true},
				{"index": 2, "empty": false, "menu_class_name": "ayam_goreng", "menu_display_name": "Ayam Goreng", "menu_confidence": 0.8},
			},
			"latency_ms": 20,
		})
	}))
	t.Cleanup(server.Close)
	return server
}

func TestSubmitScanFallsBackToDetectedNutritionPerCompartment(t *testing.T) {
	nutrition := &nutritionStub{
		matches: []models.NutritionMatch{{Name: "Nasi Kuning", MatchedTo: "Beras Giling masak (nasi)", WeightG: 100, Energy: 178}},
		macros:  &models.Macros{Energy: 178, Protein: 2.1, Carbs: 40.6, Fat: 0.1},
		note:    "gizi dihitung dari 2 bahan",
	}
	server := trayPredictionServer(t)

	service := NewScanService(&scanRepoStub{}, server.URL, nutrition)
	result, err := service.SubmitScan(context.Background(), ScanSubmission{ActorID: "v", Image: []byte("img"), FileName: "s.jpg"})
	if err != nil {
		t.Fatal(err)
	}
	if nutrition.calls != 1 {
		t.Fatalf("expected one nutrition lookup, got %d", nutrition.calls)
	}
	if len(nutrition.lastItems) != 2 {
		t.Fatalf("expected two detected items (empty compartment skipped), got %+v", nutrition.lastItems)
	}
	for _, item := range nutrition.lastItems {
		if item.WeightG != 100 {
			t.Fatalf("detected nutrition items must default to 100 g, got %+v", item)
		}
	}
	if result.Macros == nil || result.Macros.Energy != 178 || len(result.Nutrition) != 1 {
		t.Fatalf("fallback nutrition not attached: %+v", result)
	}
	if !strings.Contains(result.NutritionNote, "100 g") {
		t.Fatalf("nutrition note must flag the 100 g assumption: %q", result.NutritionNote)
	}
}

func TestSubmitScanPrefersBatchNutritionOverDetection(t *testing.T) {
	nutrition := &nutritionStub{macros: &models.Macros{Energy: 999}}
	server := trayPredictionServer(t)

	service := NewScanService(&scanRepoStub{batch: &models.ScanBatchInfo{
		BatchID: "BTH-01", MenuName: "Nasi Ayam Sayur",
		Macros: &models.Macros{Energy: 520, Protein: 27, Carbs: 68, Fat: 16},
	}}, server.URL, nutrition)
	result, err := service.SubmitScan(context.Background(), ScanSubmission{ActorID: "v", Image: []byte("img"), FileName: "s.jpg", BatchID: "BTH-01"})
	if err != nil {
		t.Fatal(err)
	}
	if nutrition.calls != 0 {
		t.Fatalf("batch nutrition must win; detection fallback should not run (calls=%d)", nutrition.calls)
	}
	if result.Macros == nil || result.Macros.Energy != 520 {
		t.Fatalf("expected batch macros to be preserved, got %+v", result.Macros)
	}
}
