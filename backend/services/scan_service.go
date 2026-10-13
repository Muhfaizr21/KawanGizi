package services

import (
	"backend/models"
	"backend/repositories"
	"bytes"
	"context"
	"crypto/md5"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	// ErrAIUnavailable dipakai controller untuk membalas 502.
	ErrAIUnavailable = errors.New("layanan AI tidak tersedia")
	// ErrImageRequired dipakai controller untuk membalas 400.
	ErrImageRequired = errors.New("file gambar wajib diunggah")
)

const (
	// Ambang suhu pengukuran yang dimasukkan petugas.
	minReleaseTempC = 75.0
	minHoldingTempC = 60.0

	maxImageBytes          = 8 << 20 // 8 MB
	aiTimeout              = 30 * time.Second
	minFreshnessConfidence = 0.70
	minMenuConfidence      = 0.50
)

// qrTokenPattern: token QR boks berformat MBG-... (mis. MBG-2026-SPPG01-SDN01P-B17).
var qrTokenPattern = regexp.MustCompile(`^MBG-[A-Za-z0-9-]+$`)

// wib adalah zona waktu Indonesia Barat untuk tampilan scannedAt.
var wib = time.FixedZone("WIB", 7*3600)

// CompartmentPrediction is one tray compartment returned by POST /predict-tray.
// BBoxNorm holds normalised coordinates (0-1) relative to the normalised tray.
type CompartmentPrediction struct {
	Index         int         `json:"index"`
	Row           int         `json:"row"`
	Col           int         `json:"col"`
	Cell          string      `json:"cell"`
	BBoxNorm      []float64   `json:"bbox_norm"`
	BBoxQuadNorm  [][]float64 `json:"bbox_quad_norm"`
	Empty         bool        `json:"empty"`
	FoodRatio     float64     `json:"food_ratio"`
	Texture       float64     `json:"texture"`
	MenuClassID   int         `json:"menu_class_id"`
	MenuClassName string      `json:"menu_class_name"`
	// MenuDisplayName adalah nama tampilan bahasa Indonesia dari layanan AI.
	// Kosong pada layanan AI lawas; caller menjatuhkannya ke menuDisplayName.
	MenuDisplayName string             `json:"menu_display_name"`
	MenuConfidence  float64            `json:"menu_confidence"`
	// DetectedCategory adalah kategori umum dari model deteksi objek
	// (mis. lauk, sayur, makanan_pokok). Kosong pada layanan AI lawas.
	DetectedCategory    string             `json:"detected_category"`
	DetectionConfidence float64            `json:"detection_confidence"`
	Mixed               bool               `json:"mixed"`
	Alternatives        map[string]float64 `json:"alternatives"`
}

// Prediction is the JSON contract of POST {AI_BACKEND_URL}/predict-tray
// (dan POST /predict untuk layanan AI lawas yang belum mendukung sekat).
type Prediction struct {
	MenuClassName string `json:"menu_class_name"`
	MenuClassID   int    `json:"menu_class_id"`
	// MenuDisplayName dan FreshnessDisplayName adalah nama tampilan bahasa
	// Indonesia. Label mentah di atas tetap dipakai pencocokan (componentAliases).
	MenuDisplayName        string                  `json:"menu_display_name"`
	MenuConfidence         float64                 `json:"menu_confidence"`
	FreshnessClassName     string                  `json:"freshness_class_name"`
	FreshnessClassID       int                     `json:"freshness_class_id"`
	FreshnessDisplayName   string                  `json:"freshness_display_name"`
	FreshnessConfidence    float64                 `json:"freshness_confidence"`
	FreshnessProbabilities map[string]float64      `json:"freshness_class_probabilities"`
	TrayDetected           *bool                   `json:"tray_detected"`
	Compartments           []CompartmentPrediction `json:"compartments"`
	LatencyMS              float64                 `json:"latency_ms"`
}

// ScanSubmission adalah input tervalidasi untuk satu pemindaian boks.
//
// Dipakai struct (bukan daftar parameter) karenaSubmitScan sudah punya banyak
// input opsional; satu perubahan field tidak boleh menggeser posisi argumen.
type ScanSubmission struct {
	ActorID      string
	Image        []byte
	FileName     string
	QRToken      string
	BoxID        string
	BatchID      string
	Items        string
	HoldingTempC *float64
	ReleaseTempC *float64

	// DurationMS adalah lama inspeksi visual yang diukur klien, dalam
	// milidetik. Dipakai audit superadmin untuk menandai pindai "kilat"
	// (Juknis MBG Pasal 14). Nil bila klien tidak mengirimkannya.
	DurationMS *int

	Persist  bool
	Rating   int
	Feedback string
}

// ScanService defines business logic for the scan endpoint.
type ScanService interface {
	Predict(ctx context.Context, image []byte, fileName string) (*Prediction, error)
	SubmitScan(ctx context.Context, in ScanSubmission) (*models.ScanResult, error)
	ListRecent(ctx context.Context, actorID string, limit int) ([]models.ScanLog, error)
	UpdateFeedback(ctx context.Context, id string, rating int, feedback string, tempC *float64) error
	DeleteScan(ctx context.Context, actorID, id string) error
	DeleteAllScans(ctx context.Context, actorID string) error
}

type scanService struct {
	repo      repositories.ScanRepository
	aiURL     string
	nutrition NutritionService
	client    *http.Client
}

// NewScanService injects the repository, AI service URL, and nutrition service (Dependency Injection).
func NewScanService(repo repositories.ScanRepository, aiURL string, nutrition NutritionService) ScanService {
	return &scanService{
		repo:      repo,
		aiURL:     strings.TrimRight(aiURL, "/"),
		nutrition: nutrition,
		client:    &http.Client{Timeout: aiTimeout},
	}
}

// Predict forwards the image to the Python AI service (multipart field "image").
// Endpoint /predict-tray diprioritaskan agar tiap sekat nampan diprediksi
// terpisah; layanan AI lawas yang hanya mengenal /predict tetap didukung.
func (s *scanService) Predict(ctx context.Context, image []byte, fileName string) (*Prediction, error) {
	if len(image) == 0 {
		return nil, ErrImageRequired
	}
	if len(image) > maxImageBytes {
		return nil, fmt.Errorf("%w: ukuran gambar maksimal %d byte", ErrImageRequired, maxImageBytes)
	}

	pred, status, err := s.postPrediction(ctx, "/predict-tray", image, fileName)
	if status == http.StatusNotFound || status == http.StatusMethodNotAllowed {
		pred, status, err = s.postPrediction(ctx, "/predict", image, fileName)
	}
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("AI service membalas HTTP %d", status)
	}
	return pred, nil
}

// postPrediction mengirim satu foto ke endpoint AI dan membalas status HTTP-nya.
func (s *scanService) postPrediction(ctx context.Context, path string, image []byte, fileName string) (*Prediction, int, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("image", fileName)
	if err != nil {
		return nil, 0, fmt.Errorf("menyiapkan multipart: %w", err)
	}
	if _, err := part.Write(image); err != nil {
		return nil, 0, fmt.Errorf("menulis gambar: %w", err)
	}
	if err := writer.Close(); err != nil {
		return nil, 0, fmt.Errorf("menutup multipart: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.aiURL+path, &body)
	if err != nil {
		return nil, 0, fmt.Errorf("membuat request AI: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("memanggil AI service: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("membaca respons AI: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, resp.StatusCode, nil
	}

	pred := &Prediction{}
	if err := json.Unmarshal(raw, pred); err != nil {
		return nil, resp.StatusCode, fmt.Errorf("respons AI tidak valid: %w", err)
	}
	return pred, http.StatusOK, nil
}

// SubmitScan runs the two-stage verification (QR + visual AI), persists scan_logs,
// enriches the decision card with macros from the nutrition dataset, and returns it.
func (s *scanService) SubmitScan(ctx context.Context, in ScanSubmission) (*models.ScanResult, error) {
	actorID := in.ActorID
	image := in.Image
	fileName := in.FileName
	qrToken := strings.TrimSpace(in.QRToken)
	boxID := strings.TrimSpace(in.BoxID)
	batchID := strings.TrimSpace(in.BatchID)
	holdingTempC := in.HoldingTempC
	releaseTempC := in.ReleaseTempC
	durationMS := in.DurationMS
	rating := in.Rating
	feedback := in.Feedback
	if len(image) == 0 {
		return nil, ErrImageRequired
	}
	if fileName == "" {
		fileName = "capture.jpg"
	}

	// Cek deduplikasi: jika scan identik dikirim dalam 5 detik, jangan duplikasi database
	dedupKey := fmt.Sprintf("%s:%x", actorID, md5.Sum(image))
	if cached := getCachedScan(dedupKey); cached != nil {
		return cached, nil
	}

	pred, err := s.Predict(ctx, image, fileName)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrAIUnavailable, err)
	}

	freshClass := strings.TrimSpace(pred.FreshnessClassName)
	freshConfidence := clampConfidence(pred.FreshnessConfidence)
	menuClass := strings.TrimSpace(pred.MenuClassName)
	menuConfidence := clampConfidence(pred.MenuConfidence)
	if isInvalidMenuClass(menuClass) || menuConfidence < minMenuConfidence {
		menuClass = ""
	}
	// Nama tampilan bahasa Indonesia. Mengikuti menuClass yang sudah dibersihkan
	// sehingga prediksi di bawah ambang tidak ikut menampilkan namanya.
	menuDisplay := displayMenuName(pred.MenuDisplayName, menuClass)
	if menuClass == "" {
		menuDisplay = ""
	}
	freshDisplay := displayMenuName(pred.FreshnessDisplayName, freshClass)
	freshProbability := probabilityForClass(pred.FreshnessProbabilities, "fresh", "segar")
	score := math.Round(freshProbability*1000) / 10
	qrValid := qrTokenPattern.MatchString(qrToken)
	freshIsFresh := isFreshClass(freshClass)
	freshIsSpoiled := isSpoiledClass(freshClass)
	freshConfident := freshConfidence >= minFreshnessConfidence && (freshIsFresh || freshIsSpoiled)
	menuUsable := menuClass != "" && menuConfidence >= minMenuConfidence

	var reasons []string
	checks := []models.ScanCheck{}
	var batchNutrition []models.NutritionMatch
	var batchNutritionNote string
	lookupID := strings.TrimSpace(batchID)
	if lookupID == "" {
		lookupID = qrToken
	}
	var batchInfo *models.ScanBatchInfo
	if lookupID != "" {
		batchInfo, err = s.repo.FindBatch(ctx, lookupID)
		if err != nil {
			batchInfo = nil
			reasons = append(reasons, "data batch tidak dapat dibaca dari database")
		}
	}
	if batchInfo != nil {
		batchID = batchInfo.BatchID
		batchInfo.Note = "Data SPPG, menu, dan tanggal berasal dari batch produksi."
		batchIngredients := resolveBatchIngredients(batchInfo)
		batchInfo.Ingredients = make([]models.BatchIngredient, 0, len(batchIngredients))
		for _, item := range batchIngredients {
			batchInfo.Ingredients = append(batchInfo.Ingredients, models.BatchIngredient{Name: item.Name, WeightG: item.WeightG})
		}
		if s.nutrition != nil && len(batchIngredients) > 0 {
			matches, macros, nutritionNote, nutritionErr := s.nutrition.MatchItems(ctx, batchIngredients)
			if nutritionErr == nil && macros != nil && len(matches) == len(batchIngredients) {
				batchInfo.Macros = macros
				batchNutrition = matches
				batchNutritionNote = nutritionNote
				batchInfo.Note += " Gizi dihitung dari takaran resep dan dataset nutrisi."
			} else if nutritionErr != nil {
				batchInfo.Note += " Detail gizi resep belum dapat dihitung."
			} else {
				batchNutritionNote = nutritionNote
				if batchInfo.Macros != nil {
					batchInfo.Note += " Takaran resep belum lengkap di dataset; total memakai paket menu."
					batchNutritionNote = "Total gizi berasal dari paket menu; rincian beberapa bahan resep belum cocok dengan dataset."
				} else {
					batchInfo.Note += " Takaran resep belum cocok dengan dataset gizi; total belum tersedia."
				}
			}
		} else if batchInfo.Macros != nil {
			batchInfo.Note += " Gizi memakai total paket menu; rincian takaran resep belum tercatat."
			batchNutritionNote = "Makronutrien berasal dari nilai total paket menu di database."
		} else {
			batchInfo.Note += " Data gizi resep belum tercatat."
		}
	} else if lookupID != "" {
		batchInfo = &models.ScanBatchInfo{BatchID: lookupID, Note: "Batch/QR tidak ditemukan; data produksi dan resep belum tercatat."}
	}

	// 1. Verifikasi QR (Tahap 1) — hanya dijalankan bila token disertai.
	// Pemindaian foto makanan (tanpa boks) tidak menyertakan QR, sehingga
	// keputusan diambil dari hasil AI + suhu saja (konsisten dengan cek suhu opsional).
	if qrToken != "" {
		qrNote := "Format token " + qrToken + " diterima; keaslian dan rute belum diverifikasi"
		if !qrValid {
			qrNote = "Token " + qrToken + " tidak cocok format MBG-..."
		} else {
			reasons = append(reasons, "Token hanya diperiksa formatnya; tanda tangan digital, status batch, dan rute belum diverifikasi")
		}
		if batchInfo != nil && batchInfo.BatchID != "" && batchInfo.BatchID != lookupID {
			qrNote = "Token QR terhubung ke batch " + batchInfo.BatchID + "; tanda tangan digital dan rute belum diverifikasi"
		}
		checks = append(checks, models.ScanCheck{Label: "Verifikasi token QR boks", OK: qrValid, Note: qrNote})
		if !qrValid {
			reasons = append(reasons, "QR boks gagal verifikasi")
		}
	}

	// 2. Suhu lepas dapur (opsional).
	if in.ReleaseTempC != nil {
		ok := *in.ReleaseTempC >= minReleaseTempC
		note := fmt.Sprintf("%.1f°C — di atas ambang %.0f°C", *in.ReleaseTempC, minReleaseTempC)
		if !ok {
			note = fmt.Sprintf("%.1f°C — di bawah ambang %.0f°C", *in.ReleaseTempC, minReleaseTempC)
			reasons = append(reasons, fmt.Sprintf("suhu lepas dapur %.1f°C di bawah %.0f°C", *in.ReleaseTempC, minReleaseTempC))
		}
		checks = append(checks, models.ScanCheck{Label: "Suhu masak inti saat lepas dapur", OK: ok, Note: note})
	}

	// 3. Suhu holding (opsional).
	if in.HoldingTempC != nil {
		ok := *in.HoldingTempC >= minHoldingTempC
		note := fmt.Sprintf("%.1f°C — di atas ambang %.0f°C", *in.HoldingTempC, minHoldingTempC)
		if !ok {
			note = fmt.Sprintf("%.1f°C — di bawah ambang %.0f°C", *in.HoldingTempC, minHoldingTempC)
			reasons = append(reasons, fmt.Sprintf("suhu holding %.1f°C di bawah %.0f°C", *in.HoldingTempC, minHoldingTempC))
		}
		checks = append(checks, models.ScanCheck{Label: "Suhu holding boks", OK: ok, Note: note})
	}

	// 4. Pengenalan menu dan kesegaran hidangan matang dijalankan oleh model terpisah.
	menuNote := "Menu belum dikenali dengan keyakinan memadai"
	if menuUsable {
		menuNote = fmt.Sprintf("%s · keyakinan %.0f%%", menuDisplay, menuConfidence*100)
	}
	checks = append(checks, models.ScanCheck{Label: "Pengenalan menu (YOLOv8)", OK: menuUsable, Note: menuNote})
	if !menuUsable {
		reasons = append(reasons, "nama menu dari foto belum dapat dipastikan")
	}

	// 4b. Pencocokan komponen menu terhadap tiap sekat nampan.
	expectedMenu := expectedComponents(batchInfo)
	compartments := matchCompartments(pred.Compartments, expectedMenu)
	if len(compartments) > 0 {
		matchOK, matchNote := summarizeCompartments(compartments, expectedMenu)
		if pred.TrayDetected != nil && !*pred.TrayDetected {
			matchNote += "; nampan tidak terdeteksi, sekat memakai grid baku"
			reasons = append(reasons, "posisi nampan belum terdeteksi, pembagian sekat memakai pola baku")
		}
		checks = append(checks, models.ScanCheck{
			Label: fmt.Sprintf("Pencocokan komponen menu per sekat (%d sekat)", len(compartments)),
			OK:    matchOK,
			Note:  matchNote,
		})
		if !matchOK {
			reasons = append(reasons, "pencocokan komponen menu per sekat belum tuntas")
		}
	}

	freshNote := fmt.Sprintf("%s · keyakinan %.0f%%", freshDisplay, freshConfidence*100)
	if !freshConfident {
		freshNote += " · keyakinan rendah, perlu pemeriksaan petugas"
	} else if freshIsFresh {
		freshNote += " · prediksi visual, bukan penetapan keamanan pangan"
	} else {
		freshNote += " · hidangan ditahan untuk pemeriksaan petugas"
	}
	checks = append(checks, models.ScanCheck{Label: "Kesegaran hidangan matang (YOLOv8)", OK: freshConfident && freshIsFresh, Note: freshNote})
	if !freshConfident {
		reasons = append(reasons, "hasil kesegaran belum meyakinkan; perlu verifikasi petugas")
	} else if freshIsSpoiled {
		reasons = append(reasons, "AI mendeteksi hidangan tidak segar")
	}

	// Prediksi segar tidak membuktikan keamanan pangan; hasil tetap menunggu petugas.
	blocked := (qrToken != "" && !qrValid) || (freshConfident && freshIsSpoiled) ||
		(in.ReleaseTempC != nil && *in.ReleaseTempC < minReleaseTempC) ||
		(in.HoldingTempC != nil && *in.HoldingTempC < minHoldingTempC)

	var verdict, verdictLabel string
	switch {
	case blocked:
		verdict, verdictLabel = models.VerdictTolak, "DITAHAN UNTUK PEMERIKSAAN"
	default:
		verdict, verdictLabel = models.VerdictPeringatan, "PERLU VERIFIKASI PETUGAS"
	}
	note := strings.Join(reasons, "; ")
	visualSafetyNote := "Prediksi visual bukan penetapan keamanan pangan; validator tetap perlu memeriksa hidangan sesuai SOP."
	if note == "" {
		note = visualSafetyNote
	} else {
		note += "; " + visualSafetyNote
	}
	menuName := menuDisplay
	if batchInfo != nil && batchInfo.MenuName != "" {
		menuName = batchInfo.MenuName
	}

	// Identitas boks: dari client, atau diturunkan dari token QR.
	if boxID == "" && qrToken != "" {
		segments := strings.Split(qrToken, "-")
		boxID = "BOK-" + segments[len(segments)-1]
	}
	if boxID == "" {
		boxID = "BOK-TANPA-QR"
	}

	now := time.Now().In(wib)
	scanID := "TEMP-PREVIEW"
	savedFileName := ""

	if in.Persist {
		var err error
		scanID, err = s.nextScanID(ctx)
		if err != nil {
			return nil, fmt.Errorf("membuat id scan: %w", err)
		}

		// Simpan gambar ke folder uploads/
		savedFileName = scanID + ".webp"
		if err := saveUploadedImage(image, savedFileName); err != nil {
			// Tidak fatal — lanjutkan meski gagal simpan file
			savedFileName = fileName
		}
		// Upload gambar adalah artefak runtime privat, bukan bagian source code.
		// Abaikan foldernya agar foto pengguna tidak masuk ke perubahan Git.
		_ = os.WriteFile(filepath.Join("uploads", ".gitignore"), []byte("*\n!.gitignore\n"), 0644)

		entry := &models.ScanLog{
			ID:             scanID,
			BoxID:          boxID,
			QRToken:        qrToken,
			BatchID:        strings.TrimSpace(batchID),
			ImageRef:       savedFileName,
			AIClass:        freshClass,
			AIConfidence:   freshConfidence,
			VisualScore:    score,
			HoldingTempC:   holdingTempC,
			ReleaseTempC:   releaseTempC,
			DurationMS:     durationMS,
			Verdict:        verdict,
			Reason:         note,
			ActorID:        actorID,
			CreatedAt:      now,
			Rating:         rating,
			Feedback:       feedback,
			MenuName:       menuName,
			MenuClass:      menuClass,
			MenuDisplay:    menuDisplay,
			MenuConfidence: menuConfidence,
		}
		if err := s.repo.InsertScan(ctx, entry); err != nil {
			return nil, fmt.Errorf("menyimpan scan log: %w", err)
		}
	}

	result := &models.ScanResult{
		ID:                  scanID,
		BoxID:               boxID,
		QRToken:             qrToken,
		BatchID:             batchID,
		MenuName:            menuName,
		MenuClass:           menuClass,
		MenuDisplay:         menuDisplay,
		MenuConfidence:      menuConfidence,
		FreshnessClass:      freshClass,
		FreshnessDisplay:    freshDisplay,
		FreshnessConfidence: freshConfidence,
		BatchInfo:           batchInfo,
		ScannedAt:           now.In(wib).Format("15:04") + " WIB",
		Score:               score,
		Verdict:             verdict,
		VerdictLabel:        verdictLabel,
		ReleaseTemp:         derefFloat(releaseTempC),
		HoldTemp:            derefFloat(holdingTempC),
		Checks:              checks,
		Compartments:        compartments,
		Note:                note,
		AIClass:             freshClass,
		AIConfidence:        freshConfidence,
		AILatencyMS:         pred.LatencyMS,
	}

	// Makronutrien: utamakan total dari batch/resep; bila tidak ada, fallback
	// ke komposisi manual yang dikirim client.
	if batchInfo != nil && batchInfo.Macros != nil {
		result.Macros = batchInfo.Macros
		result.Nutrition = batchNutrition
		result.NutritionNote = batchNutritionNote
	} else if s.nutrition != nil && strings.TrimSpace(in.Items) != "" {
		matches, macros, nutritionNote, matchErr := s.nutrition.MatchItems(ctx, ParseItems(in.Items))
		if matchErr != nil {
			return nil, matchErr
		}
		if macros != nil {
			result.Macros = macros
			result.Nutrition = matches
			result.NutritionNote = nutritionNote
		}
	} else if len(batchNutrition) > 0 {
		result.Nutrition = batchNutrition
		result.NutritionNote = batchNutritionNote
	}
	if result.Macros == nil && batchInfo != nil && batchInfo.Macros != nil {
		result.Macros = batchInfo.Macros
	}
	if result.NutritionNote == "" && batchNutritionNote != "" {
		result.NutritionNote = batchNutritionNote
	}

	if in.Persist {
		setCachedScan(dedupKey, result)
	}
	return result, nil
}

// ListRecent returns the newest scan logs for the validator history view.
func (s *scanService) ListRecent(ctx context.Context, actorID string, limit int) ([]models.ScanLog, error) {
	return s.repo.ListRecentScans(ctx, actorID, limit)
}

func (s *scanService) UpdateFeedback(ctx context.Context, id string, rating int, feedback string, tempC *float64) error {
	return s.repo.UpdateScanFeedback(ctx, id, rating, feedback, tempC)
}

func (s *scanService) nextScanID(ctx context.Context) (string, error) {
	count, err := s.repo.CountToday(ctx)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("SCN-VLD-%s-%03d", time.Now().In(wib).Format("060102"), count+1), nil
}

// isFreshClass reports whether the top prediction means the food is fit to serve.
func isFreshClass(className string) bool {
	n := strings.ToLower(strings.TrimSpace(className))
	if n == "" {
		return false
	}
	if strings.HasPrefix(n, "stale") || strings.HasPrefix(n, "spoiled") ||
		strings.HasPrefix(n, "rotten") || strings.HasPrefix(n, "bad") || n == "busuk" {
		return false
	}
	return strings.HasPrefix(n, "fresh") || n == "segar"
}

func isSpoiledClass(className string) bool {
	n := strings.ToLower(strings.TrimSpace(className))
	return strings.HasPrefix(n, "spoiled") || strings.HasPrefix(n, "stale") ||
		strings.HasPrefix(n, "rotten") || strings.HasPrefix(n, "bad") || n == "busuk"
}

func isInvalidMenuClass(className string) bool {
	switch strings.ToLower(strings.TrimSpace(className)) {
	case "train", "test", "valid", "val":
		return true
	default:
		return false
	}
}

func clampConfidence(value float64) float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
		return 0
	}
	if value > 1 {
		return 1
	}
	return value
}

func probabilityForClass(probabilities map[string]float64, names ...string) float64 {
	for key, value := range probabilities {
		for _, name := range names {
			if strings.EqualFold(strings.TrimSpace(key), name) {
				return clampConfidence(value)
			}
		}
	}
	return 0
}

func menuDisplayName(className string) string {
	className = strings.TrimSpace(className)
	if className == "" {
		return ""
	}
	return strings.Title(strings.ReplaceAll(strings.ReplaceAll(className, "_", " "), "-", " "))
}

// displayMenuName memakai nama tampilan Indonesia dari layanan AI bila tersedia;
// layanan AI lawas yang tidak mengirimkannya jatuh ke menuDisplayName.
func displayMenuName(displayName, className string) string {
	if name := strings.TrimSpace(displayName); name != "" {
		return name
	}
	return menuDisplayName(className)
}

var ingredientWeightPattern = regexp.MustCompile(`(?i)(\d+(?:[.,]\d+)?)\s*(?:g|gram)`)

func resolveBatchIngredients(batch *models.ScanBatchInfo) []ItemRequest {
	if batch == nil {
		return nil
	}
	var payload any
	if len(batch.RecipeData) > 0 && json.Unmarshal(batch.RecipeData, &payload) == nil {
		if object, ok := payload.(map[string]any); ok {
			payload = object["ingredients"]
		}
		if entries, ok := payload.([]any); ok {
			var out []ItemRequest
			for _, entry := range entries {
				item := parseRecipeIngredient(entry)
				if item.Name != "" && item.WeightG > 0 {
					out = append(out, item)
				}
			}
			if len(out) > 0 {
				return out
			}
		}
	}
	var out []ItemRequest
	for _, component := range batch.Components {
		item := parseComponentIngredient(component)
		if item.Name != "" && item.WeightG > 0 {
			out = append(out, item)
		}
	}
	return out
}

func parseRecipeIngredient(value any) ItemRequest {
	if text, ok := value.(string); ok {
		return parseComponentIngredient(text)
	}
	object, ok := value.(map[string]any)
	if !ok {
		return ItemRequest{}
	}
	name := firstString(object, "name", "ingredient", "item", "food", "nama")
	weight := 0.0
	for _, key := range []string{"weightG", "weight_g", "grams", "amount_g", "quantity_g", "amount", "quantity"} {
		if raw, exists := object[key]; exists {
			if n, ok := raw.(float64); ok {
				weight = n
				break
			}
			if text, ok := raw.(string); ok {
				if match := ingredientWeightPattern.FindStringSubmatch(text); len(match) > 1 {
					weight, _ = strconv.ParseFloat(strings.ReplaceAll(match[1], ",", "."), 64)
				} else {
					weight, _ = strconv.ParseFloat(strings.TrimSpace(text), 64)
				}
				break
			}
		}
	}
	return ItemRequest{Name: name, WeightG: weight}
}

func firstString(values map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := values[key].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func parseComponentIngredient(component string) ItemRequest {
	component = strings.TrimSpace(component)
	if component == "" {
		return ItemRequest{}
	}
	match := ingredientWeightPattern.FindStringSubmatch(component)
	if len(match) < 2 {
		return ItemRequest{Name: component}
	}
	weight, _ := strconv.ParseFloat(strings.ReplaceAll(match[1], ",", "."), 64)
	nameEnd := ingredientWeightPattern.FindStringIndex(component)[0]
	if paren := strings.Index(component, "("); paren >= 0 && paren < nameEnd {
		nameEnd = paren
	}
	name := strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(component[:nameEnd]), "("))
	return ItemRequest{Name: name, WeightG: weight}
}

func derefFloat(v *float64) float64 {
	if v == nil {
		return 0
	}
	return *v
}

func (s *scanService) DeleteScan(ctx context.Context, actorID, id string) error {
	imageRef, err := s.repo.DeleteScan(ctx, actorID, id)
	if err != nil {
		return err
	}
	if imageRef != "" {
		deleteUploadedImage(imageRef)
	}
	return nil
}

func (s *scanService) DeleteAllScans(ctx context.Context, actorID string) error {
	imageRefs, err := s.repo.DeleteAllScans(ctx, actorID)
	if err != nil {
		return err
	}
	for _, ref := range imageRefs {
		deleteUploadedImage(ref)
	}
	return nil
}

// saveUploadedImage menyimpan bytes gambar ke folder uploads/ di direktori kerja.
func saveUploadedImage(data []byte, fileName string) error {
	const uploadDir = "uploads"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return fmt.Errorf("membuat folder uploads: %w", err)
	}
	dest := filepath.Join(uploadDir, fileName)
	return os.WriteFile(dest, data, 0644)
}

func deleteUploadedImage(fileName string) {
	if fileName == "" {
		return
	}
	cleanName := filepath.Base(fileName)
	_ = os.Remove(filepath.Join("uploads", cleanName))
}

type scanDedupEntry struct {
	result    *models.ScanResult
	createdAt time.Time
}

var (
	dedupMu    sync.Mutex
	dedupCache = make(map[string]scanDedupEntry)
)

func getCachedScan(key string) *models.ScanResult {
	dedupMu.Lock()
	defer dedupMu.Unlock()
	entry, ok := dedupCache[key]
	if !ok {
		return nil
	}
	if time.Since(entry.createdAt) > 5*time.Second {
		delete(dedupCache, key)
		return nil
	}
	return entry.result
}

func setCachedScan(key string, res *models.ScanResult) {
	dedupMu.Lock()
	defer dedupMu.Unlock()
	now := time.Now()
	for k, v := range dedupCache {
		if now.Sub(v.createdAt) > time.Minute {
			delete(dedupCache, k)
		}
	}
	dedupCache[key] = scanDedupEntry{
		result:    res,
		createdAt: now,
	}
}
