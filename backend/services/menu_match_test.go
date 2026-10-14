package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"backend/models"
)

func expectedFor(menuName string) []string {
	return expectedComponents(&models.ScanBatchInfo{MenuName: menuName})
}

func TestExpectedComponentsPrefersRecipeIngredients(t *testing.T) {
	batch := &models.ScanBatchInfo{
		MenuName: "Nasi Ulen Empal Daging Suwir & Sayur Lodeh",
		Ingredients: []models.BatchIngredient{
			{Name: "Nasi Putih Organik Beras Cianjur (150g)", WeightG: 150},
			{Name: "Empal Daging Sapi Suwir Lengkuas Gurih (75g)", WeightG: 75},
		},
	}
	got := expectedComponents(batch)
	want := []string{"nasi putih organik beras cianjur", "empal daging sapi suwir lengkuas gurih"}
	if len(got) != len(want) {
		t.Fatalf("expected %v, got %v", want, got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("component %d: expected %q, got %q", i, want[i], got[i])
		}
	}
}

func TestExpectedComponentsFallsBackToMenuName(t *testing.T) {
	got := expectedFor("Nasi Ayam Panggang Madu & Capcay Brokoli Organik")
	if len(got) != 2 {
		t.Fatalf("expected two components, got %v", got)
	}
	if got[0] != "nasi ayam panggang madu" || got[1] != "capcay brokoli organik" {
		t.Fatalf("unexpected split: %v", got)
	}
	if expectedComponents(nil) != nil {
		t.Fatal("nil batch must yield no components")
	}
}

func TestNormalizeComponentStripsWeightAndPunctuation(t *testing.T) {
	got := normalizeComponent("Semangka Merah Potong Dingin (120g)")
	if got != "semangka merah potong dingin" {
		t.Fatalf("unexpected normalization: %q", got)
	}
	if normalizeComponent("  Susu Sapi 200ml, ") != "susu sapi" {
		t.Fatalf("unexpected normalization: %q", normalizeComponent("  Susu Sapi 200ml, "))
	}
}

func TestNormalizeClassUnifiesSpacesAndHyphens(t *testing.T) {
	cases := map[string]string{
		"Nasi Putih":      "nasi_putih",
		"squash-patisson": "squash_patisson",
		"Bell Pepper":     "bell_pepper",
	}
	for in, want := range cases {
		if got := normalizeClass(in); got != want {
			t.Fatalf("normalizeClass(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestMatchCompartmentSpelledOutMenuClassStillMatches(t *testing.T) {
	// makanan_minuman.pt memakai nama kelas majemuk berspasi ("Nasi Putih").
	comp := CompartmentPrediction{Cell: "A1", MenuClassName: "Nasi Putih", MenuConfidence: 0.9}
	got := matchCompartment(comp, expectedFor("Nasi Putih Organik & Empal Daging Sapi Suwir"))
	if got.Status != models.CompartmentStatusMatch || !strings.Contains(got.Component, "nasi putih") {
		t.Fatalf("spaced class name must still match, got %+v", got)
	}
}

func TestMatchCompartmentProduceClassCoversComponent(t *testing.T) {
	// Kelas buah.pt berbahasa Inggris dipetakan ke komponen menu Indonesia.
	comp := CompartmentPrediction{Cell: "A2", MenuClassName: "tomato", MenuConfidence: 0.9}
	got := matchCompartment(comp, expectedFor("Nasi Putih & Tomat Segar"))
	if got.Status != models.CompartmentStatusMatch || !strings.Contains(got.Component, "tomat") {
		t.Fatalf("produce alias should cover tomato component, got %+v", got)
	}
}

func TestMatchCompartmentDrinkBrandCoversMilkComponent(t *testing.T) {
	// Kelas minuman(susu).pt adalah merek susu; semua mewakili komponen "susu".
	comp := CompartmentPrediction{Cell: "A3", MenuClassName: "milk life", MenuConfidence: 0.9}
	got := matchCompartment(comp, expectedFor("Nasi Putih & Susu UHT"))
	if got.Status != models.CompartmentStatusMatch || !strings.Contains(got.Component, "susu") {
		t.Fatalf("drink alias should cover susu component, got %+v", got)
	}
}

func TestMatchCompartmentConfidentHitAgainstBatchMenu(t *testing.T) {
	comp := CompartmentPrediction{Index: 1, Cell: "A2", MenuClassName: "empal_suwir", MenuConfidence: 0.82}
	got := matchCompartment(comp, expectedFor("Nasi Ulen Empal Daging Suwir & Sayur Lodeh"))
	if got.Status != models.CompartmentStatusMatch {
		t.Fatalf("expected match, got %s (%s)", got.Status, got.Note)
	}
	if !strings.Contains(got.Component, "empal") {
		t.Fatalf("expected component to mention empal, got %q", got.Component)
	}
	if got.Cell != "A2" || got.Index != 1 {
		t.Fatalf("compartment identity lost: %+v", got)
	}
}

func TestMatchCompartmentAliasFromShippedCheckpoint(t *testing.T) {
	comp := CompartmentPrediction{Cell: "B1", MenuClassName: "chicken_curry", MenuConfidence: 0.71}
	got := matchCompartment(comp, expectedFor("Nasi Ayam Panggang Madu & Capcay Brokoli Organik"))
	if got.Status != models.CompartmentStatusMatch || got.Component != "nasi ayam panggang madu" {
		t.Fatalf("expected chicken alias to cover ayam component, got %+v", got)
	}
}

func TestMatchCompartmentLowConfidenceNeedsReview(t *testing.T) {
	comp := CompartmentPrediction{Cell: "A1", MenuClassName: "empal_suwir", MenuConfidence: 0.30}
	got := matchCompartment(comp, expectedFor("Nasi Ulen Empal Daging Suwir"))
	if got.Status != models.CompartmentStatusReview {
		t.Fatalf("expected review, got %s", got.Status)
	}
	if !strings.Contains(got.Note, "keyakinan") {
		t.Fatalf("note should mention confidence: %q", got.Note)
	}
}

func TestMatchCompartmentConfidentClassOutsideBatchMenu(t *testing.T) {
	comp := CompartmentPrediction{Cell: "A3", MenuClassName: "donuts", MenuConfidence: 0.77}
	got := matchCompartment(comp, expectedFor("Nasi Ayam Panggang Madu & Capcay Brokoli Organik"))
	if got.Status != models.CompartmentStatusMismatch {
		t.Fatalf("expected mismatch, got %s (%s)", got.Status, got.Note)
	}
}

func TestMatchCompartmentMidConfidenceWithUnknownAliasStaysReview(t *testing.T) {
	comp := CompartmentPrediction{Cell: "A3", MenuClassName: "donuts", MenuConfidence: 0.48}
	got := matchCompartment(comp, expectedFor("Nasi Ayam Panggang Madu"))
	if got.Status != models.CompartmentStatusReview {
		t.Fatalf("expected review below match threshold, got %s", got.Status)
	}
}

func TestMatchCompartmentEmptyAndMixedAreHandled(t *testing.T) {
	empty := matchCompartment(
		CompartmentPrediction{Cell: "A2", Empty: true, MenuConfidence: 0.9},
		expectedFor("Nasi Ulen Empal Daging Suwir"),
	)
	if empty.Status != models.CompartmentStatusEmpty || empty.Predicted != "" || empty.Confidence != 0 {
		t.Fatalf("expected cleared empty compartment, got %+v", empty)
	}

	mixed := matchCompartment(
		CompartmentPrediction{Cell: "B2", MenuClassName: "empal_suwir", MenuConfidence: 0.9, Mixed: true},
		expectedFor("Nasi Ulen Empal Daging Suwir"),
	)
	if mixed.Status != models.CompartmentStatusReview {
		t.Fatalf("mixed compartment must stay review, got %s", mixed.Status)
	}
	if !strings.Contains(mixed.Note, "tercampur") {
		t.Fatalf("note should explain mixing: %q", mixed.Note)
	}
}

func TestMatchCompartmentWithoutBatchMenuCannotConfirm(t *testing.T) {
	comp := CompartmentPrediction{Cell: "A1", MenuClassName: "empal_suwir", MenuConfidence: 0.95}
	got := matchCompartment(comp, nil)
	if got.Status != models.CompartmentStatusReview {
		t.Fatalf("without a batch menu nothing may be confirmed, got %s", got.Status)
	}
}

func TestMatchCompartmentCategoryAliasDoesNotFabricateAMatch(t *testing.T) {
	// caesar_salad hanya berbagi kategori "sayur" dengan capcay; nama hidangan
	// berbeda sehingga tidak boleh dinyatakan cocok.
	comp := CompartmentPrediction{Cell: "A2", MenuClassName: "caesar_salad", MenuConfidence: 0.9}
	got := matchCompartment(comp, expectedFor("Nasi Ayam Panggang Madu & Capcay Brokoli Organik"))
	if got.Status == models.CompartmentStatusMatch {
		t.Fatalf("shared category must not count as a match: %+v", got)
	}
}

func TestSummarizeCompartmentsOutcomes(t *testing.T) {
	expected := expectedFor("Nasi Ayam Panggang Madu & Capcay Brokoli Organik")

	allMatch := matchCompartments([]CompartmentPrediction{
		{Cell: "A1", MenuClassName: "chicken_curry", MenuConfidence: 0.9},
		{Cell: "A2", MenuClassName: "capcay", MenuConfidence: 0.85},
	}, expected)
	ok, note := summarizeCompartments(allMatch, expected)
	if !ok || !strings.Contains(note, "2 cocok") {
		t.Fatalf("expected clean summary, ok=%v note=%q", ok, note)
	}

	withMismatch := matchCompartments([]CompartmentPrediction{
		{Cell: "A1", MenuClassName: "chicken_curry", MenuConfidence: 0.9},
		{Cell: "A2", MenuClassName: "donuts", MenuConfidence: 0.88},
	}, expected)
	ok, note = summarizeCompartments(withMismatch, expected)
	if ok || !strings.Contains(note, "1 tidak cocok") {
		t.Fatalf("mismatch must fail the check, ok=%v note=%q", ok, note)
	}

	noneMatch := matchCompartments([]CompartmentPrediction{
		{Cell: "A1", MenuClassName: "donuts", MenuConfidence: 0.4},
		{Cell: "A2", Empty: true},
	}, expected)
	ok, note = summarizeCompartments(noneMatch, expected)
	if ok || !strings.Contains(note, "belum ada komponen menu yang terkonfirmasi") {
		t.Fatalf("unconfirmed compartments must fail, ok=%v note=%q", ok, note)
	}

	covered := matchCompartments([]CompartmentPrediction{
		{Cell: "A1", MenuClassName: "chicken_curry", MenuConfidence: 0.9},
	}, expected)
	ok, note = summarizeCompartments(covered, expected)
	if !ok || !strings.Contains(note, "komponen belum terlihat: capcay brokoli organik") {
		t.Fatalf("uncovered component should be reported, ok=%v note=%q", ok, note)
	}

	ok, note = summarizeCompartments(nil, expected)
	if ok || !strings.Contains(note, "sekat nampan tidak tersedia") {
		t.Fatalf("missing compartments must fail, ok=%v note=%q", ok, note)
	}
}

func TestSubmitScanSurfacesPerCompartmentMenuCheck(t *testing.T) {
	trayDetected := true
	service := scanServiceWithPrediction(t, map[string]any{
		"menu_class_name": "chicken_curry", "menu_confidence": 0.88,
		"freshness_class_name": "Fresh", "freshness_confidence": 0.93,
		"freshness_class_probabilities": map[string]float64{"Fresh": 0.93, "Spoiled": 0.07},
		"tray_detected":                 trayDetected,
		"compartments": []map[string]any{
			{"index": 0, "cell": "A1", "bbox_norm": []float64{0.02, 0.02, 0.48, 0.48},
				"bbox_quad_norm": [][]float64{{0.01, 0.02}, {0.49, 0.03}, {0.48, 0.49}, {0.01, 0.48}},
				"empty":          false, "menu_class_name": "chicken_curry", "menu_confidence": 0.91},
			{"index": 1, "cell": "A2", "bbox_norm": []float64{0.52, 0.02, 0.98, 0.48},
				"bbox_quad_norm": [][]float64{{0.51, 0.03}, {0.99, 0.04}, {0.98, 0.49}, {0.52, 0.48}},
				"empty":          true, "menu_class_name": "", "menu_confidence": 0.0},
			{"index": 2, "cell": "B1", "bbox_norm": []float64{0.02, 0.52, 0.48, 0.98},
				"bbox_quad_norm": [][]float64{{0.01, 0.51}, {0.48, 0.52}, {0.47, 0.99}, {0.01, 0.97}},
				"empty":          false, "menu_class_name": "donuts", "menu_confidence": 0.84},
		},
		"latency_ms": 60.0,
	}, http.StatusOK, &scanRepoStub{batch: &models.ScanBatchInfo{
		BatchID: "BTH-01", SPPGName: "SPPG Menteng",
		MenuName: "Nasi Ayam Panggang Madu & Capcay Brokoli Organik",
	}})

	result, err := submitTestScan(t, service)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Compartments) != 3 {
		t.Fatalf("expected three compartments, got %+v", result.Compartments)
	}
	if result.Compartments[0].Status != models.CompartmentStatusMatch ||
		result.Compartments[1].Status != models.CompartmentStatusEmpty ||
		result.Compartments[2].Status != models.CompartmentStatusMismatch {
		t.Fatalf("unexpected statuses: %+v", result.Compartments)
	}
	if len(result.Compartments[0].BBoxQuad) != 4 {
		t.Fatalf("perspective quad must reach the client for the overlay: %+v", result.Compartments[0])
	}

	var found bool
	for _, check := range result.Checks {
		if strings.HasPrefix(check.Label, "Pencocokan komponen menu per sekat") {
			found = true
			if check.OK {
				t.Fatalf("mismatch must not pass the check: %q", check.Note)
			}
			if !strings.Contains(check.Note, "1 tidak cocok") || !strings.Contains(check.Note, "1 kosong") {
				t.Fatalf("check note should summarise compartments: %q", check.Note)
			}
		}
	}
	if !found {
		t.Fatalf("per-compartment check missing from decision card: %+v", result.Checks)
	}
}

func TestSubmitScanFlagsUndetectedTray(t *testing.T) {
	trayDetected := false
	service := scanServiceWithPrediction(t, map[string]any{
		"menu_class_name": "chicken_curry", "menu_confidence": 0.8,
		"freshness_class_name": "Fresh", "freshness_confidence": 0.9,
		"freshness_class_probabilities": map[string]float64{"Fresh": 0.9},
		"tray_detected":                 trayDetected,
		"compartments": []map[string]any{
			{"index": 0, "cell": "A1", "empty": false, "menu_class_name": "chicken_curry", "menu_confidence": 0.9},
		},
	}, http.StatusOK, &scanRepoStub{batch: &models.ScanBatchInfo{
		BatchID: "BTH-02", MenuName: "Nasi Ayam Panggang Madu",
	}})

	result, err := submitTestScan(t, service)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Compartments) != 1 {
		t.Fatalf("expected one compartment, got %+v", result.Compartments)
	}
	var check *models.ScanCheck
	for i := range result.Checks {
		if strings.HasPrefix(result.Checks[i].Label, "Pencocokan komponen menu per sekat") {
			check = &result.Checks[i]
		}
	}
	if check == nil {
		t.Fatalf("compartment check missing: %+v", result.Checks)
	}
	if !strings.Contains(check.Note, "nampan tidak terdeteksi") {
		t.Fatalf("undetected tray must be disclosed: %q", check.Note)
	}
	if !strings.Contains(result.Note, "pembagian sekat memakai pola baku") {
		t.Fatalf("decision note should disclose fallback grid: %q", result.Note)
	}
}

func TestSubmitScanSkipsCompartmentCheckForLegacyAIService(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/predict" {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"menu_class_name":"chicken_curry","menu_confidence":0.8,"freshness_class_name":"Fresh","freshness_confidence":0.9,"freshness_class_probabilities":{"Fresh":0.9}}`))
			return
		}
		http.Error(w, "not found", http.StatusNotFound)
	}))
	t.Cleanup(server.Close)
	service := NewScanService(&scanRepoStub{batch: &models.ScanBatchInfo{
		BatchID: "BTH-02", MenuName: "Nasi Ayam Panggang Madu",
	}}, server.URL, nil)

	// Endpoint sekat tidak tersedia: layanan AI lawas dipakai tanpa hasil sekat.
	result, err := submitTestScan(t, service)
	if err != nil {
		t.Fatal(err)
	}
	for _, check := range result.Checks {
		if strings.HasPrefix(check.Label, "Pencocokan komponen menu per sekat") {
			t.Fatalf("legacy AI service must not report a compartment check: %+v", check)
		}
	}
	if result.MenuClass != "chicken_curry" {
		t.Fatalf("whole-image fallback broken: %+v", result)
	}
}

func TestPredictFallsBackToWholeImageEndpoint(t *testing.T) {
	paths := []string{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.URL.Path)
		if r.URL.Path == "/predict-tray" {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"menu_class_name":"chicken_curry","menu_confidence":0.5}`))
	}))
	t.Cleanup(server.Close)

	service := NewScanService(&scanRepoStub{}, server.URL, nil)
	pred, err := service.Predict(context.Background(), []byte("image"), "scan.jpg")
	if err != nil {
		t.Fatal(err)
	}
	if pred.MenuClassName != "chicken_curry" {
		t.Fatalf("fallback prediction lost: %+v", pred)
	}
	if len(paths) != 2 || paths[0] != "/predict-tray" || paths[1] != "/predict" {
		t.Fatalf("unexpected request sequence: %v", paths)
	}
}
