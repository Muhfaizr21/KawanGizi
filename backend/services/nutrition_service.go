package services

import (
	"backend/models"
	"backend/repositories"
	"context"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// ItemRequest adalah satu bahan menu hasil deteksi: nama + berat porsi (gram).
type ItemRequest struct {
	Name    string
	WeightG float64
}

// ParseItems mem-parse field form `items` berformat "Nama:gram,Nama2:gram".
func ParseItems(raw string) []ItemRequest {
	var items []ItemRequest
	for _, part := range strings.Split(strings.TrimSpace(raw), ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		name := strings.TrimSpace(part)
		weight := 100.0
		if colon := strings.LastIndex(part, ":"); colon > 0 {
			if w, err := strconv.ParseFloat(strings.TrimSpace(part[colon+1:]), 64); err == nil && w > 0 {
				weight = w
				name = strings.TrimSpace(part[:colon])
			}
		}
		if name == "" {
			continue
		}
		items = append(items, ItemRequest{Name: name, WeightG: weight})
	}
	return items
}

// NutritionService defines business logic around the nutrition dataset.
type NutritionService interface {
	// Search mengembalikan item gizi yang cocok dengan query (untuk UI lookup).
	Search(ctx context.Context, query string, limit int) ([]models.NutritionItem, error)
	// MatchItems mencocokkan daftar bahan menu ke dataset dan menjumlahkannya.
	MatchItems(ctx context.Context, items []ItemRequest) ([]models.NutritionMatch, *models.Macros, string, error)
}

type nutritionService struct {
	repo repositories.NutritionRepository
}

// NewNutritionService injects the nutrition repository (Constructor DI).
func NewNutritionService(repo repositories.NutritionRepository) NutritionService {
	return &nutritionService{repo: repo}
}

// matchThreshold: skor minimum agar sebuah bahan dianggap cocok dengan dataset.
const matchThreshold = 0.5

// aliases memetakan nama item demo yang tidak ada persis di dataset
// ke nama kanonik CSV agar nilai demo deterministik dan benar.
var aliases = map[string][]string{
	"nasi":                {"Nasi"},
	"nasi putih":          {"Beras Giling masak (nasi)"},
	"nasi kuning":         {"Beras Giling masak (nasi)"},
	"telur dadar suwir":   {"Telur Ayam dadar"},
	"telur rebus":         {"Telur Ayam"},
	"telur goreng":        {"Telur Ayam"},
	"timun":               {"Ketimun"},
	"selada":              {"Selada"},
	"salad":               {"Selada"},
	"ayam":                {"Ayam"},
	"ayam goreng":         {"Ayam goreng paha"},
	"pisang":              {"Pisang Ambon"},
	"susu":                {"Susu Sapi"},
	"biskuit choco chips": {"Biskuit"},
	"capcay":              {"Cap cai sayur"},
	"terong balado":       {"Terong"},
	"tumis kangkung":      {"Kangkung"},
}

var tokenPattern = regexp.MustCompile(`[a-z0-9]+`)

func normalize(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func tokenize(s string) []string {
	return tokenPattern.FindAllString(s, -1)
}

// resolveName menguraikan satu nama bahan menjadi satu atau lebih query
// lookup (nama majemuk "A & B" dipecah menjadi dua query).
func (s *nutritionService) resolveName(name string) []string {
	norm := normalize(name)
	if a, ok := aliases[norm]; ok {
		return append([]string(nil), a...)
	}
	for _, sep := range []string{" & ", ",", "+", "/"} {
		if strings.Contains(norm, sep) {
			var sub []string
			for _, part := range strings.Split(norm, sep) {
				part = normalize(part)
				if part == "" {
					continue
				}
				if a, ok := aliases[part]; ok {
					sub = append(sub, a...)
				} else {
					sub = append(sub, part)
				}
			}
			if len(sub) > 0 {
				return sub
			}
		}
	}
	return []string{norm}
}

// scoreTokens menghitung kecocokan query terhadap kandidat CSV.
func scoreTokens(query string, qTokens []string, candidate string) float64 {
	if len(qTokens) == 0 {
		return 0
	}
	cTokens := tokenize(candidate)
	if len(cTokens) == 0 {
		return 0
	}
	present := 0
	for _, t := range qTokens {
		for _, ct := range cTokens {
			if ct == t {
				present++
				break
			}
		}
	}
	score := float64(present) / float64(len(qTokens))
	if strings.Contains(candidate, query) {
		score += 0.3
	}
	if strings.HasPrefix(candidate, query) {
		score += 0.3
	}
	if score > 1 {
		score = 1
	}
	return score
}

// matchItem memilih kandidat terbaik untuk satu query (skor tertinggi;
// seri → nama terpendek) dan mengembalikan skornya.
func matchItem(query string, candidates []models.NutritionItem) (models.NutritionItem, float64) {
	q := normalize(query)
	qTokens := tokenize(q)
	var best models.NutritionItem
	var bestScore float64
	bestLen := math.MaxInt
	for _, c := range candidates {
		cand := normalize(c.Name)
		if cand == "" {
			continue
		}
		sc := scoreTokens(q, qTokens, cand)
		if sc > bestScore || (sc == bestScore && len(cand) < bestLen) {
			bestScore = sc
			best = c
			bestLen = len(cand)
		}
	}
	return best, bestScore
}

func round1(v float64) float64 {
	return math.Round(v*10) / 10
}

// Search mengembalikan item dataset yang cocok dengan query (mode lookup).
func (s *nutritionService) Search(ctx context.Context, query string, limit int) ([]models.NutritionItem, error) {
	candidates, err := s.repo.All(ctx)
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	q := normalize(query)
	if q == "" {
		if len(candidates) > limit {
			candidates = candidates[:limit]
		}
		return candidates, nil
	}

	type scored struct {
		item  models.NutritionItem
		score float64
	}
	var matches []scored
	for _, c := range candidates {
		sc := scoreTokens(q, tokenize(q), normalize(c.Name))
		if sc > 0 {
			matches = append(matches, scored{item: c, score: sc})
		}
	}
	sort.SliceStable(matches, func(i, j int) bool {
		if matches[i].score != matches[j].score {
			return matches[i].score > matches[j].score
		}
		return normalize(matches[i].item.Name) < normalize(matches[j].item.Name)
	})
	if len(matches) > limit {
		matches = matches[:limit]
	}
	out := make([]models.NutritionItem, 0, len(matches))
	for _, m := range matches {
		out = append(out, m.item)
	}
	return out, nil
}

// MatchItems mencocokkan bahan menu ke dataset dan menjumlahkan makronutrien
// yang diskalakan sesuai berat porsi (per 100 g → gram/100).
func (s *nutritionService) MatchItems(ctx context.Context, items []ItemRequest) ([]models.NutritionMatch, *models.Macros, string, error) {
	if len(items) == 0 {
		return nil, nil, "", nil
	}
	candidates, err := s.repo.All(ctx)
	if err != nil {
		return nil, nil, "", err
	}
	if len(candidates) == 0 {
		return nil, nil, "data gizi belum tersedia", nil
	}

	var matches []models.NutritionMatch
	matchedCount := 0
	for _, it := range items {
		name := strings.TrimSpace(it.Name)
		if name == "" {
			continue
		}
		weight := it.WeightG
		if weight <= 0 {
			weight = 100
		}
		factor := weight / 100

		sum := models.NutritionMatch{Name: name, WeightG: round1(weight)}
		var matchedNames []string
		ok := true
		for _, target := range s.resolveName(name) {
			cand, sc := matchItem(target, candidates)
			if sc < matchThreshold {
				ok = false
				break
			}
			sum.Energy += cand.Calories * factor
			sum.Protein += cand.Protein * factor
			sum.Fat += cand.Fat * factor
			sum.Carbs += cand.Carbohydrate * factor
			matchedNames = append(matchedNames, cand.Name)
		}
		if !ok {
			continue
		}
		sum.MatchedTo = strings.Join(matchedNames, " + ")
		sum.Energy = round1(sum.Energy)
		sum.Protein = round1(sum.Protein)
		sum.Fat = round1(sum.Fat)
		sum.Carbs = round1(sum.Carbs)
		matches = append(matches, sum)
		matchedCount++
	}

	if len(matches) == 0 {
		note := fmt.Sprintf("tidak ada bahan yang cocok dengan dataset gizi (%d dicoba)", len(items))
		return nil, nil, note, nil
	}

	total := &models.Macros{}
	for _, m := range matches {
		total.Energy += m.Energy
		total.Protein += m.Protein
		total.Fat += m.Fat
		total.Carbs += m.Carbs
	}
	total.Energy = round1(total.Energy)
	total.Protein = round1(total.Protein)
	total.Fat = round1(total.Fat)
	total.Carbs = round1(total.Carbs)

	note := fmt.Sprintf("cocok %d dari %d bahan dengan dataset gizi", matchedCount, len(items))
	if matchedCount < len(items) {
		note += fmt.Sprintf(" (%d tidak ditemukan)", len(items)-matchedCount)
	}
	return matches, total, note, nil
}
