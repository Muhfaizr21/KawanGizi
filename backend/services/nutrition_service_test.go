package services

import (
	"context"
	"encoding/csv"
	"os"
	"strconv"
	"strings"
	"testing"

	"backend/models"
)

type nutritionRepoStub struct {
	items []models.NutritionItem
	err   error
}

func (r *nutritionRepoStub) All(context.Context) ([]models.NutritionItem, error) {
	return r.items, r.err
}

// loadNutritionDataset membaca CSV dataset gizi dengan aturan identik dengan
// SeedNutrition supaya test mencerminkan data yang benar-benar ada di server.
func loadNutritionDataset(t *testing.T) []models.NutritionItem {
	t.Helper()
	file, err := os.Open("../data/dataset_nutrisi_kasar.csv")
	if err != nil {
		t.Skipf("dataset gizi tidak tersedia: %v", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1
	records, err := reader.ReadAll()
	if err != nil {
		t.Fatal(err)
	}

	var items []models.NutritionItem
	for i, row := range records {
		if i == 0 || len(row) < 5 {
			continue
		}
		cal, err1 := strconv.ParseFloat(strings.TrimSpace(row[0]), 64)
		pro, err2 := strconv.ParseFloat(strings.TrimSpace(row[1]), 64)
		fat, err3 := strconv.ParseFloat(strings.TrimSpace(row[2]), 64)
		carb, err4 := strconv.ParseFloat(strings.TrimSpace(row[3]), 64)
		if err1 != nil || err2 != nil || err3 != nil || err4 != nil {
			continue
		}
		name := strings.TrimSpace(row[4])
		if name == "" {
			continue
		}
		items = append(items, models.NutritionItem{
			Name: name, Calories: cal, Protein: pro, Fat: fat, Carbohydrate: carb,
		})
	}
	return items
}

// TestDetectedModelClassesResolveToDataset memastikan nama kelas yang dikenali
// model penamaan (makanan_minuman.pt / buah.pt, label Indonesia) bisa dicocokkan
// ke dataset gizi, sehingga kartu gizi terisi pada pemindaian tanpa batch.
func TestDetectedModelClassesResolveToDataset(t *testing.T) {
	names := []string{
		"Telur Goreng", "Telur Rebus", "Pempek", "salad", "Pisang", "Susu",
		"Nasi Kuning", "Nasi Putih", "Nasi Goreng", "Ayam Goreng", "Ikan Goreng",
		"Tahu Goreng", "Tempe Goreng", "Terong Balado", "Tumis Kangkung", "Capcay",
		"Mie Goreng", "Bakso", "Rendang Sapi", "Sate", "Spaghetti", "Burger",
		"Biskuit Choco Chips", "Apel", "Jeruk", "Nanas", "Tomat", "Cabai", "Kentang Goreng",
	}

	svc := NewNutritionService(&nutritionRepoStub{items: loadNutritionDataset(t)})
	requests := make([]ItemRequest, 0, len(names))
	for _, n := range names {
		requests = append(requests, ItemRequest{Name: n, WeightG: 100})
	}

	matches, macros, note, err := svc.MatchItems(context.Background(), requests)
	if err != nil {
		t.Fatal(err)
	}

	matched := map[string]bool{}
	for _, m := range matches {
		matched[m.Name] = true
	}
	var unmatched []string
	for _, n := range names {
		if !matched[n] {
			unmatched = append(unmatched, n)
		}
	}
	if len(unmatched) > 0 {
		t.Fatalf("nama makanan terdeteksi gagal dicocokkan ke dataset: %v (note=%q)", unmatched, note)
	}
	if macros == nil || macros.Energy <= 0 {
		t.Fatalf("expected positive macros from detected names, got %+v", macros)
	}
}
