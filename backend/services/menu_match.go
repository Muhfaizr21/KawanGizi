package services

import (
	"backend/models"
	"fmt"
	"regexp"
	"strings"
)

const (
	// minCompartmentMatchConfidence: keyakinan minimal agar sekat dinyatakan cocok.
	minCompartmentMatchConfidence = 0.60
	// minCompartmentReviewConfidence: di bawah ini prediksi terlalu lemah untuk dibandingkan.
	minCompartmentReviewConfidence = 0.35
)

// componentAliases memetakan kelas checkpoint ke kata kunci komponen menu SPPG.
// Pemetaan dibuat eksplisit agar hasil pencocokan bisa diaudit, bukan ditebak
// dari kemiripan huruf.
//
// Dua kelompok kelas didaftarkan:
//   - kelas bergaya Indonesia (empal_suwir, nasi_putih, ...) dipakai begitu
//     checkpoint diganti dengan model yang dilatih pada menu SPPG;
//   - kelas Food-101 yang memang ada pada checkpoint bawaan
//     (food_recognition_best.pt), dipetakan hanya ke kategori komponen yang
//     secara jujur dapat diwakilinya.
var componentAliases = map[string][]string{
	// --- Kelas menu SPPG (aktif setelah checkpoint diganti) ---
	"empal_suwir":    {"empal daging sapi suwir", "empal"},
	"nasi_putih":     {"nasi putih", "nasi ulen", "nasi"},
	"nasi_kuning":    {"nasi kuning", "nasi"},
	"nasi_liwet":     {"nasi liwet", "nasi"},
	"nasi_merah":     {"nasi merah", "nasi"},
	"ayam_panggang":  {"ayam panggang", "ayam"},
	"rolade_ayam":    {"rolade ayam", "rolade", "ayam"},
	"ikan_cakalang":  {"cakalang", "ikan"},
	"ikan_nila":      {"nila", "ikan"},
	"sayur_lodeh":    {"sayur lodeh", "sayur"},
	"sayur_urap":     {"sayur urap", "urap", "sayur"},
	"tumis_buncis":   {"tumis buncis", "buncis", "sayur"},
	"capcay":         {"capcay", "sayur"},
	"sup_bening":     {"sup bening", "bayam", "sayur"},
	"semangka":       {"semangka", "buah"},
	"pepaya":         {"pepaya", "buah"},
	"jeruk":          {"jeruk", "buah"},
	"melon":          {"melon", "buah"},
	"pisang":         {"pisang", "buah"},
	"susu_cokelat":   {"susu sapi", "susu", "minuman"},
	"susu_fullcream": {"susu", "minuman"},
	"susu_kedelai":   {"susu kedelai", "minuman"},
	"yogurt":         {"yogurt", "minuman"},
	"air_mineral":    {"air mineral", "minuman"},

	// --- Kelas checkpoint makanan_indo.pt (29 makanan Indonesia) ---
	"nasi_goreng":         {"nasi goreng", "nasi"},
	"mie_goreng":          {"mie goreng", "mie"},
	"bakso":               {"bakso"},
	"pempek":              {"pempek"},
	"spaghetti":           {"spaghetti", "pasta", "mie"},
	"pizza":               {"pizza", "roti"},
	"burger":              {"burger", "roti", "daging"},
	"ayam_goreng":         {"ayam goreng", "ayam"},
	"ikan_goreng":         {"ikan goreng", "ikan"},
	"rendang_sapi":        {"rendang", "daging sapi", "daging"},
	"sate":                {"sate", "ayam", "daging"},
	"steak":               {"steak", "daging sapi", "daging"},
	"tahu_goreng":         {"tahu"},
	"tempe_goreng":        {"tempe"},
	"telur_goreng":        {"telur"},
	"telur_rebus":         {"telur"},
	"nugget":              {"nugget", "ayam"},
	"terong_balado":       {"terong", "terung", "balado", "sayur"},
	"tumis_kangkung":      {"kangkung", "sayur"},
	"apel":                {"apel", "buah"},
	"kiwi":                {"kiwi", "buah"},
	"nanas":               {"nanas", "buah"},
	"stroberi":            {"stroberi", "buah"},
	"biskuit_choco_chips": {"biskuit", "kue"},
	"donat":               {"donat", "kue"},
	"kentang_goreng":      {"kentang", "kripik"},

	// --- Kelas checkpoint bawaan (Food-101) ---
	"chicken_curry":      {"ayam"},
	"chicken_wings":      {"ayam"},
	"chicken_quesadilla": {"ayam"},
	"beef_carpaccio":     {"daging sapi", "daging", "empal"},
	"beef_tartare":       {"daging sapi", "daging", "empal"},
	"baby_back_ribs":     {"daging sapi", "daging"},
	"ceviche":            {"ikan", "cakalang", "nila"},
	"clam_chowder":       {"ikan", "seafood"},
	"crab_cakes":         {"ikan", "seafood"},
	"deviled_eggs":       {"telur"},
	"eggs_benedict":      {"telur"},
	"caesar_salad":       {"sayur"},
	"beet_salad":         {"sayur"},
	"caprese_salad":      {"sayur"},
	"edamame":            {"kacang", "sayur"},
	"croque_madame":      {"roti", "daging"},
	"club_sandwich":      {"roti"},
	"bruschetta":         {"roti"},
	"breakfast_burrito":  {"roti"},
}

var (
	parenPattern   = regexp.MustCompile(`\([^)]*\)`)
	numberPattern  = regexp.MustCompile(`\d+(?:[.,]\d+)?\s*(?:gram|gr|g|ml|liter|buah|pcs)?`)
	multiSpace     = regexp.MustCompile(`\s+`)
	componentSplit = regexp.MustCompile(`\s*(?:&|,|\bdan\b)\s*`)
)

// normalizeClass mengubah nama kelas checkpoint ke bentuk seragam kunci alias.
func normalizeClass(className string) string {
	name := strings.ToLower(strings.TrimSpace(className))
	name = strings.ReplaceAll(name, "-", "_")
	return name
}

// normalizeComponent menghapus takaran berat, tanda baca, dan menurunkan huruf
// besar-kecil agar nama komponen dan kata kunci bisa dibandingkan langsung.
func normalizeComponent(text string) string {
	name := strings.ToLower(strings.TrimSpace(text))
	name = parenPattern.ReplaceAllString(name, " ")
	name = numberPattern.ReplaceAllString(name, " ")
	name = strings.NewReplacer("_", " ", "-", " ", "/", " ").Replace(name)
	name = strings.Trim(name, " .,:;")
	return multiSpace.ReplaceAllString(name, " ")
}

// splitMenuComponents memecah nama menu menjadi daftar komponen.
func splitMenuComponents(menuName string) []string {
	parts := componentSplit.Split(menuName, -1)
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if normalized := normalizeComponent(part); normalized != "" {
			out = append(out, normalized)
		}
	}
	return out
}

// expectedComponents mengembalikan komponen menu batch dalam bentuk ternormalisasi.
// Daftar bahan resep diprioritaskan karena lebih rinci daripada nama paket menu.
func expectedComponents(batch *models.ScanBatchInfo) []string {
	if batch == nil {
		return nil
	}
	seen := make(map[string]bool)
	out := make([]string, 0, 6)
	add := func(raw string) {
		normalized := normalizeComponent(raw)
		if normalized == "" || seen[normalized] {
			return
		}
		seen[normalized] = true
		out = append(out, normalized)
	}
	for _, ingredient := range batch.Ingredients {
		add(ingredient.Name)
	}
	if len(out) == 0 && strings.TrimSpace(batch.MenuName) != "" {
		for _, component := range splitMenuComponents(batch.MenuName) {
			add(component)
		}
	}
	return out
}

// aliasFor mengembalikan kata kunci komponen untuk sebuah kelas checkpoint.
// Kelas tanpa alias berarti tidak terdaftar sebagai komponen menu SPPG.
func aliasFor(className string) []string {
	key := normalizeClass(className)
	if key == "" {
		return nil
	}
	return componentAliases[key]
}

// componentCovered melaporkan apakah kata kunci ditemukan pada salah satu komponen menu.
func componentCovered(tokens []string, expected []string) (string, bool) {
	for _, token := range tokens {
		for _, component := range expected {
			if strings.Contains(component, token) {
				return component, true
			}
		}
	}
	return "", false
}

// matchCompartment menilai satu sekat terhadap komponen menu batch.
// Status selalu memakai konstanta models.Compartment*.
func matchCompartment(comp CompartmentPrediction, expected []string) models.CompartmentMatch {
	predicted := strings.TrimSpace(comp.MenuClassName)
	match := models.CompartmentMatch{
		Index:      comp.Index,
		Cell:       comp.Cell,
		BBoxNorm:   comp.BBoxNorm,
		BBoxQuad:   comp.BBoxQuadNorm,
		Empty:      comp.Empty,
		Predicted:  predicted,
		Confidence: clampConfidence(comp.MenuConfidence),
		Mixed:      comp.Mixed,
		Status:     models.CompartmentStatusReview,
	}
	match.PredictedDisplay = displayMenuName(comp.MenuDisplayName, predicted)

	if comp.Empty {
		match.Status = models.CompartmentStatusEmpty
		match.Predicted = ""
		match.PredictedDisplay = ""
		match.Confidence = 0
		match.Note = "sekat kosong"
		return match
	}

	confidence := match.Confidence
	tokens := aliasFor(match.Predicted)

	switch {
	case confidence < minCompartmentReviewConfidence:
		match.Note = fmt.Sprintf("keyakinan %.0f%% di bawah ambang, perlu verifikasi petugas", confidence*100)
	case len(expected) == 0:
		match.Note = "menu batch tidak tersedia, pencocokan belum dapat dilakukan"
	case comp.Mixed:
		match.Note = "komponen tercampur dalam satu sekat, perlu verifikasi petugas"
	case len(tokens) == 0 && confidence >= minCompartmentMatchConfidence:
		match.Status = models.CompartmentStatusMismatch
		match.Note = fmt.Sprintf("%s tidak terdaftar sebagai komponen menu (keyakinan %.0f%%)",
			match.PredictedDisplay, confidence*100)
	case len(tokens) == 0:
		match.Note = fmt.Sprintf("%s tidak terdaftar sebagai komponen menu, perlu verifikasi petugas",
			match.PredictedDisplay)
	default:
		covered, ok := componentCovered(tokens, expected)
		switch {
		case ok && confidence >= minCompartmentMatchConfidence:
			match.Status = models.CompartmentStatusMatch
			match.Component = covered
			match.Note = fmt.Sprintf("cocok dengan %s Â· keyakinan %.0f%%", covered, confidence*100)
		case ok:
			match.Note = fmt.Sprintf("kemungkinan %s Â· keyakinan %.0f%%, perlu verifikasi petugas",
				covered, confidence*100)
		case confidence >= minCompartmentMatchConfidence:
			match.Status = models.CompartmentStatusMismatch
			match.Note = fmt.Sprintf("%s tidak sesuai menu batch (keyakinan %.0f%%)",
				match.PredictedDisplay, confidence*100)
		default:
			match.Note = fmt.Sprintf("%s belum meyakinkan, perlu verifikasi petugas",
				match.PredictedDisplay)
		}
	}
	// Tampilkan kategori model deteksi objek (mis. lauk, sayur) agar hasil
	// Pendekatan 1 terlihat jelas di kartu keputusan.
	if category := strings.TrimSpace(comp.DetectedCategory); category != "" {
		match.Note = "deteksi: " + category + " · " + match.Note
	}
	return match
}

// matchCompartments menilai seluruh sekat dan meringkasnya untuk kartu keputusan.
func matchCompartments(compartments []CompartmentPrediction, expected []string) []models.CompartmentMatch {
	out := make([]models.CompartmentMatch, 0, len(compartments))
	for _, comp := range compartments {
		out = append(out, matchCompartment(comp, expected))
	}
	return out
}

// uncoveredComponents mengembalikan komponen menu yang tidak terlihat di sekat mana pun.
func uncoveredComponents(matches []models.CompartmentMatch, expected []string) []string {
	covered := make(map[string]bool)
	for _, match := range matches {
		if match.Status == models.CompartmentStatusMatch && match.Component != "" {
			covered[match.Component] = true
		}
	}
	var missing []string
	for _, component := range expected {
		if !covered[component] {
			missing = append(missing, component)
		}
	}
	return missing
}

// summarizeCompartments menghasilkan status checklist dan catatan ringkas.
func summarizeCompartments(matches []models.CompartmentMatch, expected []string) (bool, string) {
	if len(matches) == 0 {
		return false, "pemotongan sekat nampan tidak tersedia pada hasil AI"
	}

	counts := map[string]int{}
	for _, match := range matches {
		counts[match.Status]++
	}
	missing := uncoveredComponents(matches, expected)

	parts := []string{
		fmt.Sprintf("%d sekat", len(matches)),
		fmt.Sprintf("%d cocok", counts[models.CompartmentStatusMatch]),
		fmt.Sprintf("%d perlu verifikasi", counts[models.CompartmentStatusReview]),
		fmt.Sprintf("%d tidak cocok", counts[models.CompartmentStatusMismatch]),
	}
	if counts[models.CompartmentStatusEmpty] > 0 {
		parts = append(parts, fmt.Sprintf("%d kosong", counts[models.CompartmentStatusEmpty]))
	}
	note := strings.Join(parts, ", ")

	if counts[models.CompartmentStatusMismatch] > 0 {
		return false, note + "; terdapat sekat yang tidak sesuai menu batch"
	}
	if counts[models.CompartmentStatusMatch] == 0 {
		return false, note + "; belum ada komponen menu yang terkonfirmasi"
	}
	if len(missing) > 0 {
		return true, note + "; komponen belum terlihat: " + strings.Join(missing, ", ")
	}
	return true, note
}
