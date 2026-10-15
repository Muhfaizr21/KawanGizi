package models

import (
	"encoding/json"
	"time"
)

// Verdict categories returned by scan checks; passing inputs remain pending staff review.
const (
	VerdictLayak      = "layak"
	VerdictPeringatan = "peringatan"
	VerdictTolak      = "tolak"
)

// Status pencocokan satu sekat nampan terhadap komponen menu batch.
const (
	// CompartmentStatusMatch: keyakinan memadai dan kelas AI cocok dengan komponen menu.
	CompartmentStatusMatch = "match"
	// CompartmentStatusReview: keyakinan rendah, komponen tercampur, atau menu batch tidak tersedia.
	CompartmentStatusReview = "review"
	// CompartmentStatusMismatch: keyakinan memadai tetapi hasil tidak sesuai menu batch.
	CompartmentStatusMismatch = "mismatch"
	// CompartmentStatusEmpty: sekat tidak berisi makanan.
	CompartmentStatusEmpty = "empty"
)

// Mode analisis yang dipilih pengguna saat memulai pemindaian. Keduanya memakai
// satu kali inferensi YOLOv8 + freshness classifier, hanya laporan keluaran yang
// dibedakan supaya validator tidak perlu mengulang pindai untuk pertanyaan berbeda.
const (
	// ScanModeKelayakan fokus pada kesegaran dan tanda pembusukan.
	ScanModeKelayakan = "kelayakan"
	// ScanModeNutrisi fokus pada estimasi porsi dan makronutrisi.
	ScanModeNutrisi = "nutrisi"
)

// Status kelayakan yang dilaporkan pada mode kelayakan.
const (
	KelLayak      = "Layak Konsumsi"
	KelWaspada    = "Waspada"
	KelTidakLayak = "Tidak Layak Konsumsi"
)

// ValidScanMode reports whether the given mode is a supported analysis mode.
func ValidScanMode(mode string) bool {
	return mode == ScanModeKelayakan || mode == ScanModeNutrisi
}

// KelayakanReport adalah keluaran mode kelayakan: hanya fokus pada keamanan
// konsumsi, bukan rincian gizi.
// KelayakanReport adalah keluaran mode kelayakan: fokus pada keamanan
// konsumsi, bukan rincian gizi.
type KelayakanReport struct {
	NamaHidrangan      string   `json:"nama_hidfangan"`
	StatusKelayakan    string   `json:"status_kelayakan"`
	SkorKesegaran      float64  `json:"skor_kesegaran"`
	IndikatorVisual    []string `json:"indikator_visual"`
	PeringatanKeamanan string   `json:"peringatan_keamanan,omitempty"`
	Rekomendasi        string   `json:"rekomendasi"`
}

// NutrisiBahan adalah satu baris bahan pada rincian porsi.
type NutrisiBahan struct {
	Bahan         string  `json:"bahan"`
	PorsiEstimasi string  `json:"porsi_estimasi"`
	WeightG       float64 `json:"weight_gram"`
}

// MakronutrisiReport adalah blok makronutrisi pada mode nutrisi.
type MakronutrisiReport struct {
	KaloriTotal float64 `json:"kalori_total"`
	Protein     float64 `json:"protein"`
	Karbohidrat float64 `json:"karbohidrat"`
	Lemak       float64 `json:"lemak"`
	Serat       float64 `json:"serat"`
}

// NutrisiReport adalah keluaran mode nutrisi: estimasi porsi dan makronutrisi
// yang dihitung dari dataset gizi, bukan ditebak dari gambar.
type NutrisiReport struct {
	NamaHidrangan      string             `json:"nama_hidfangan"`
	EstimasiBeratPorsi string             `json:"estimasi_berat_porsi"`
	RincianBahan       []NutrisiBahan     `json:"rincian_bahan"`
	Makronutrisi       MakronutrisiReport `json:"makronutrisi"`
	RingkasanGizi      string             `json:"ringkasan_gizi"`
}

// ScanLog is a persisted row in scan_logs (audit trail pemindaian boks).
type ScanLog struct {
	ID           string   `json:"id"`
	BoxID        string   `json:"boxId"`
	QRToken      string   `json:"qrToken"`
	BatchID      string   `json:"batchId"`
	ImageRef     string   `json:"imageRef"`
	AIClass      string   `json:"aiClass"`
	AIConfidence float64  `json:"aiConfidence"`
	VisualScore  float64  `json:"visualScore"`
	HoldingTempC *float64 `json:"holdingTempC,omitempty"`
	ReleaseTempC *float64 `json:"releaseTempC,omitempty"`
	// DurationMS adalah durasi inspeksi visual klien (ms). Nil bila tidak dikirim.
	DurationMS  *int      `json:"durationMs,omitempty"`
	Verdict     string    `json:"verdict"`
	Reason      string    `json:"reason"`
	ActorID     string    `json:"actorId"`
	CreatedAt   time.Time `json:"createdAt"`
	Rating      int       `json:"rating,omitempty"`
	Feedback    string    `json:"feedback,omitempty"`
	MenuName    string    `json:"menuName,omitempty"`
	MenuClass   string    `json:"menuClass,omitempty"`
	MenuDisplay string    `json:"menuDisplay,omitempty"`
	// MenuConfidence adalah keyakinan model menu (0-1) pada foto.
	MenuConfidence float64 `json:"menuConfidence,omitempty"`
	// ScanMode remembers the analysis mode the user picked for this scan.
	ScanMode string `json:"scanMode,omitempty"`
	// ImageMD5 is the content hash of the uploaded photo, used to reject a
	// duplicate submission of the very same picture.
	ImageMD5 string `json:"imageMd5,omitempty"`
	// Report menyimpan keluaran mode yang dipakai saat pindai (blok kelayakan
	// atau nutrisi) supaya halaman detail bisa menampilkannya kembali tanpa
	// menjalankan inferensi ulang.
	Report json.RawMessage `json:"report,omitempty"`
}

// ScanCheck is one row on the decision card checklist.
type ScanCheck struct {
	Label string `json:"label"`
	OK    bool   `json:"ok"`
	Note  string `json:"note"`
}

// Macros is the visual macro estimate shown on the decision card.
// Optional: nil saat mesin nutrisi belum terhubung.
type Macros struct {
	Energy  float64 `json:"energy"`
	Protein float64 `json:"protein"`
	Carbs   float64 `json:"carbs"`
	Fat     float64 `json:"fat"`
	Fiber   float64 `json:"fiber"`
}

// CompartmentMatch is the verdict of one tray compartment against the batch menu.
type CompartmentMatch struct {
	Index     int         `json:"index"`
	Cell      string      `json:"cell"`
	BBoxNorm  []float64   `json:"bboxNorm,omitempty"`
	BBoxQuad  [][]float64 `json:"bboxQuadNorm,omitempty"`
	Empty     bool        `json:"empty"`
	Predicted string      `json:"predicted,omitempty"`
	// PredictedDisplay adalah nama tampilan bahasa Indonesia untuk Predicted.
	// Predicted tetap label mentah karena dipakai pencocokan komponen.
	PredictedDisplay string  `json:"predictedDisplay,omitempty"`
	Component        string  `json:"component,omitempty"`
	Confidence       float64 `json:"confidence"`
	Mixed            bool    `json:"mixed,omitempty"`
	Status           string  `json:"status"`
	Note             string  `json:"note"`
}

// BatchIngredient rincian bahan komponen makanan dalam batch produksi.
type BatchIngredient struct {
	Name    string  `json:"name"`
	WeightG float64 `json:"weightG,omitempty"`
}

// ScanBatchInfo ringkasan batch produksi SPPG yang terikat ke boks makanan.
type ScanBatchInfo struct {
	BatchID        string            `json:"batchId"`
	SPPGName       string            `json:"sppgName,omitempty"`
	MenuName       string            `json:"menuName,omitempty"`
	ProductionDate string            `json:"productionDate,omitempty"`
	Note           string            `json:"note,omitempty"`
	Components     []string          `json:"components,omitempty"`
	Ingredients    []BatchIngredient `json:"ingredients,omitempty"`
	RecipeData     []byte            `json:"recipeData,omitempty"`
	Macros         *Macros           `json:"macros,omitempty"`
}

// ScanResult is the classifier and measurement summary returned to web/mobile.
type ScanResult struct {
	ID                  string             `json:"id"`
	BoxID               string             `json:"boxId"`
	QRToken             string             `json:"qrToken"`
	BatchID             string             `json:"batchId,omitempty"`
	MenuName            string             `json:"menuName,omitempty"`
	MenuClass           string             `json:"menuClass,omitempty"`
	MenuDisplay         string             `json:"menuDisplay,omitempty"`
	MenuConfidence      float64            `json:"menuConfidence,omitempty"`
	FreshnessClass      string             `json:"freshnessClass,omitempty"`
	FreshnessDisplay    string             `json:"freshnessDisplay,omitempty"`
	FreshnessConfidence float64            `json:"freshnessConfidence,omitempty"`
	BatchInfo           *ScanBatchInfo     `json:"batchInfo,omitempty"`
	ScannedAt           string             `json:"scannedAt"`
	Score               float64            `json:"score"`
	Verdict             string             `json:"verdict"`
	VerdictLabel        string             `json:"verdictLabel"`
	ReleaseTemp         float64            `json:"releaseTemp"`
	HoldTemp            float64            `json:"holdTemp"`
	Checks              []ScanCheck        `json:"checks"`
	Compartments        []CompartmentMatch `json:"compartments,omitempty"`
	Macros              *Macros            `json:"macros,omitempty"`
	Nutrition           []NutritionMatch   `json:"nutrition,omitempty"`
	NutritionNote       string             `json:"nutritionNote,omitempty"`
	Rating              int                `json:"rating,omitempty"`
	Feedback            string             `json:"feedback,omitempty"`
	Note                string             `json:"note"`
	AIClass             string             `json:"aiClass"`
	AIConfidence        float64            `json:"aiConfidence"`
	AILatencyMS         float64            `json:"aiLatencyMs,omitempty"`
	// ScanMode is the analysis mode chosen by the validator (kelayanan / nutrisi).
	ScanMode string `json:"scanMode"`
	// DuplicateImage true bila foto ini sama dengan pindai yang baru saja
	// disimpan, sehingga tidak dibuat baris riwayat baru.
	DuplicateImage bool `json:"duplicateImage,omitempty"`
	// Kelayakan diisi hanya saat mode kelayakan; Nutrisi diisi hanya saat mode
	// nutrisi. Field lawannya dibiarkan nil supaya respons tiap mode hanya
	// membawa output yang relevan.
	Kelayakan *KelayakanReport `json:"kelayakan,omitempty"`
	Nutrisi   *NutrisiReport   `json:"nutrisi,omitempty"`
}
