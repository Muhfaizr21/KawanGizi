package repositories

import (
	"backend/models"
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type PostRepository interface {
	List(ctx context.Context, page, limit int, tag, search, currentUserID string) ([]models.CommunityPost, int, error)
	GetByID(ctx context.Context, id, currentUserID string) (*models.CommunityPost, error)
	Create(ctx context.Context, post *models.CommunityPost) error
	Delete(ctx context.Context, id, currentUserID string) error
	ToggleLike(ctx context.Context, id, currentUserID string) (int, bool, error)
	AddComment(ctx context.Context, postID string, comment *models.CommunityComment) error
	AddReply(ctx context.Context, postID, commentID string, reply *models.CommunityCommentReply) error
}

type memoryPostRepository struct {
	mu    sync.RWMutex
	posts []models.CommunityPost
	likes map[string]map[string]bool // postID -> userID -> bool
}

func NewPostRepository() PostRepository {
	repo := &memoryPostRepository{
		posts: make([]models.CommunityPost, 0),
		likes: make(map[string]map[string]bool),
	}
	repo.seedDefaults()
	return repo
}

func (r *memoryPostRepository) seedDefaults() {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()

	r.posts = []models.CommunityPost{
		{
			ID:         "post-1",
			Author:     "Ibu Ratna Dewi, S.Pd.",
			School:     "SDN Pegangsaan 01",
			AuthorID:   "auth-ratna-dewi",
			Role:       "Guru Validator",
			TimeAgo:    "15 menit lalu",
			CreatedAt:  now.Add(-15 * time.Minute).Format(time.RFC3339),
			Tag:        "SOP Suhu",
			TagColor:   "#047857",
			TagBg:      "#d1fae5",
			Title:      "Protokol penanganan tote boks saat suhu mendekati batas minimum 60°C",
			Content:    "Rekan guru validator, jika pembacaan termometer boks tiba di 60.5°C, pastikan porsi dibagikan dalam rentang 30 menit sesuai SOP keamanan pangan BGN.\n\nJangan biarkan boks terbuka lama di selasar sekolah saat cuaca dingin berangin. Segera distribusikan ke ketua kelas atau simpan sementara di ruang berpenghangat jika distribusi mundur dari jadwal biasanya.",
			MediaURI:   "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80",
			MediaType:  "image",
			LikesCount: 28,
			IsLiked:    false,
			IsPinned:   true,
			Comments: []models.CommunityComment{
				{
					ID:        "c-101",
					Author:    "Pak Budi Santoso, M.Pd.",
					School:    "SDN Cikini 02",
					AuthorID:  "auth-budi-santoso",
					Role:      "Guru Validator",
					TimeAgo:   "10 menit lalu",
					CreatedAt: now.Add(-10 * time.Minute).Format(time.RFC3339),
					Content:   "Terima kasih pengingatnya Bu Ratna. Kemarin di Cikini 02 sempat tiba di 61°C dan kami langsung percepat pembagian agar makanan tetap hangat dan higienis.",
					LikesCount: 5,
					Replies: []models.CommunityCommentReply{
						{
							ID:        "r-101-1",
							Author:    "Ibu Ratna Dewi, S.Pd.",
							School:    "SDN Pegangsaan 01",
							AuthorID:  "auth-ratna-dewi",
							Role:      "Guru Validator",
							TimeAgo:   "6 menit lalu",
							CreatedAt: now.Add(-6 * time.Minute).Format(time.RFC3339),
							Content:   "Sangat tepat Pak Budi! Prioritas keselamatan siswa adalah nomor satu sebelum batas 4 jam tercapai.",
							LikesCount: 2,
						},
					},
				},
				{
					ID:        "c-102",
					Author:    "Ibu Siti Aminah, S.Pd.",
					School:    "SDN Menteng 01 Pagi",
					AuthorID:  "validator-guru",
					Role:      "Guru Validator",
					TimeAgo:   "3 menit lalu",
					CreatedAt: now.Add(-3 * time.Minute).Format(time.RFC3339),
					Content:   "SOP ini sangat krusial, terutama saat armada SPPG tiba agak siang menjelang jam istirahat kedua.",
					LikesCount: 3,
					Replies:   []models.CommunityCommentReply{},
				},
			},
		},
		{
			ID:         "post-2",
			Author:     "Pak Budi Santoso, M.Pd.",
			School:     "SDN Cikini 02",
			AuthorID:   "auth-budi-santoso",
			Role:       "Guru Validator",
			TimeAgo:    "1 jam lalu",
			CreatedAt:  now.Add(-1 * time.Hour).Format(time.RFC3339),
			Tag:        "Rekap Presensi",
			TagColor:   "#047857",
			TagBg:      "#d1fae5",
			Title:      "Alur penanganan porsi surplus saat 14 siswa izin sakit bersamaan",
			Content:    "Hari ini kelas 4B ada 14 siswa tidak masuk karena flu musiman. Sesuai modul presensi validator KawanGizi, kami mengalokasikan 8 porsi ke satpam & penjaga sekolah, dan 6 porsi disimpan untuk cadangan ekskul sore. Jangan lupa berita acara surplus ditandatangani kepala sekolah.",
			LikesCount: 19,
			IsLiked:    false,
			Comments: []models.CommunityComment{
				{
					ID:        "c-201",
					Author:    "Ibu Siti Aminah, S.Pd.",
					School:    "SDN Menteng 01 Pagi",
					AuthorID:  "validator-guru",
					Role:      "Guru Validator",
					TimeAgo:   "45 menit lalu",
					CreatedAt: now.Add(-45 * time.Minute).Format(time.RFC3339),
					Content:   "Langkah tepat Pak! Presensi akurat mencegah mubazir pangan di sekolah.",
					LikesCount: 4,
					Replies:   []models.CommunityCommentReply{},
				},
			},
		},
		{
			ID:         "post-3",
			Author:     "Ibu Hendra Kusuma, S.Pd.",
			School:     "SMPN 3 Jakarta",
			AuthorID:   "auth-hendra-kusuma",
			Role:       "Guru Validator",
			TimeAgo:    "2 jam lalu",
			CreatedAt:  now.Add(-2 * time.Hour).Format(time.RFC3339),
			Tag:        "Pindai AI",
			TagColor:   "#047857",
			TagBg:      "#d1fae5",
			Title:      "Tips pencahayaan nampan saat AI memberi skor kelayakan 82%",
			Content:    "Jika hasil pindai menunjukkan peringatan refleksi mika atau bayangan kuat, coba miringkan piring 15 derajat ke arah jendela kelas. Kemarin skor kami naik dari 82% ke 98% setelah permukaan kuah capcay tidak memantulkan lampu neon.",
			MediaURI:   "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80",
			MediaType:  "image",
			LikesCount: 35,
			IsLiked:    true,
			Comments: []models.CommunityComment{
				{
					ID:        "c-301",
					Author:    "Ahmad Fauzi",
					School:    "SPPG Menteng 01",
					AuthorID:  "sppg-petugas",
					Role:      "Petugas Dapur SPPG",
					TimeAgo:   "1 jam lalu",
					CreatedAt: now.Add(-1 * time.Hour).Format(time.RFC3339),
					Content:   "Terima kasih rekomendasinya! Tim dapur juga akan menata wadah sayur agar lebih datar sehingga pemindaian lebih optimal.",
					LikesCount: 8,
					Replies:   []models.CommunityCommentReply{},
				},
			},
		},
		{
			ID:         "post-4",
			Author:     "Ibu Dewi Sartika, M.Pd.",
			School:     "SDN Melawai 01 Pagi",
			AuthorID:   "auth-dewi-sartika",
			Role:       "Guru Validator",
			TimeAgo:    "3 jam lalu",
			CreatedAt:  now.Add(-3 * time.Hour).Format(time.RFC3339),
			Tag:        "Menu Alergi",
			TagColor:   "#047857",
			TagBg:      "#d1fae5",
			Title:      "Penandaan khusus stiker kuning untuk siswa dengan alergi telur",
			Content:    "Di sekolah kami ada 3 siswa kelas 2 yang alergi telur berat. Dapur SPPG sangat kooperatif menyematkan stiker kuning dan mengganti telur balado dengan tahu tempe bacem organik. Mohon rekan validator lain teliti mengecek sekat lauk sebelum dibagikan ke siswa bersangkutan.",
			LikesCount: 42,
			IsLiked:    false,
			Comments:   []models.CommunityComment{},
		},
		{
			ID:         "post-5",
			Author:     "Pak Joko Prasetyo",
			School:     "Dapur Sentral SPPG-01 Menteng",
			AuthorID:   "auth-joko-sppg",
			Role:       "Petugas Dapur SPPG",
			TimeAgo:    "4 jam lalu",
			CreatedAt:  now.Add(-4 * time.Hour).Format(time.RFC3339),
			Tag:        "Distribusi",
			TagColor:   "#047857",
			TagBg:      "#d1fae5",
			Title:      "Informasi rute armada B-9102 untuk SDN Menteng 01 & Pegangsaan",
			Content:    "Mohon bersiap rekan validator, armada logistik pagi ini berangkat pukul 06:20 WIB. Estimasi tiba SDN Menteng 01 pukul 06:45 WIB dan lanjut ke Pegangsaan pukul 07:05 WIB. Kondisi suhu holding box terpantau 72.8°C saat segel dipasang.",
			LikesCount: 22,
			IsLiked:    false,
			Comments:   []models.CommunityComment{},
		},
		{
			ID:         "post-6",
			Author:     "Ibu Nurul Aini, S.Pd.",
			School:     "SMPN 11 Jakarta Selatan",
			AuthorID:   "auth-nurul-aini",
			Role:       "Guru Validator",
			TimeAgo:    "5 jam lalu",
			CreatedAt:  now.Add(-5 * time.Hour).Format(time.RFC3339),
			Tag:        "Kebersihan",
			TagColor:   "#047857",
			TagBg:      "#d1fae5",
			Title:      "Sanitasi ruang serah terima dan pemilahan wadah stainless",
			Content:    "Pengingat harian: ruang serah terima wajib dipel disinfektan sebelum tote boks tiba. Siswa diimbau menumpuk tray stainless yang sudah dibilas air bersih agar memudahkan kurir saat penjemputan sore nanti.",
			LikesCount: 16,
			IsLiked:    false,
			Comments:   []models.CommunityComment{},
		},
		{
			ID:         "post-7",
			Author:     "Pak Dian Kurniawan, S.Si.",
			School:     "SDN Cikini 01",
			AuthorID:   "auth-dian-kurniawan",
			Role:       "Guru Validator",
			TimeAgo:    "6 jam lalu",
			CreatedAt:  now.Add(-6 * time.Hour).Format(time.RFC3339),
			Tag:        "SOP Suhu",
			TagColor:   "#047857",
			TagBg:      "#d1fae5",
			Title:      "Kalibrasi berkala termometer tusuk digital validator",
			Content:    "Pastikan termometer probe digital dikalibrasi metode air es setiap Senin pagi. Jika deviasi suhu lebih dari 0.5°C, segera laporkan ke tim teknis SPPG agar diganti unit standar kalibrasi BGN.",
			LikesCount: 31,
			IsLiked:    false,
			Comments:   []models.CommunityComment{},
		},
		{
			ID:         "post-8",
			Author:     "Ibu Sri Wahyuni, S.Pd.",
			School:     "SDN Kramat 05",
			AuthorID:   "auth-sri-wahyuni",
			Role:       "Guru Validator",
			TimeAgo:    "7 jam lalu",
			CreatedAt:  now.Add(-7 * time.Hour).Format(time.RFC3339),
			Tag:        "Pindai AI",
			TagColor:   "#047857",
			TagBg:      "#d1fae5",
			Title:      "Deteksi kesegaran ayam suwir madu dan kelengkapan 5 sekat gizi",
			Content:    "Hari ini menu ayam suwir madu terdeteksi sangat baik dengan skor kesegaran 99.2%. Anak-anak makan lahap dan serat sayur brokoli habis tanpa sisa.",
			MediaURI:   "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80",
			MediaType:  "image",
			LikesCount: 45,
			IsLiked:    true,
			Comments:   []models.CommunityComment{},
		},
		{
			ID:         "post-9",
			Author:     "Pak Agus Salim, M.Pd.",
			School:     "SMPN 2 Jakarta",
			AuthorID:   "auth-agus-salim",
			Role:       "Guru Validator",
			TimeAgo:    "8 jam lalu",
			CreatedAt:  now.Add(-8 * time.Hour).Format(time.RFC3339),
			Tag:        "Rekap Presensi",
			TagColor:   "#047857",
			TagBg:      "#d1fae5",
			Title:      "Koneksi presensi digital dan integrasi ke modul riwayat validator",
			Content:    "Bagi sekolah yang menggunakan presensi barcode kelas, data sinkron otomatis dengan dasbor logistik. Sangat menghemat waktu rekap manual di akhir pekan.",
			LikesCount: 18,
			IsLiked:    false,
			Comments:   []models.CommunityComment{},
		},
		{
			ID:         "post-10",
			Author:     "Ibu Siti Aminah, S.Pd.",
			School:     "SDN Menteng 01 Pagi",
			AuthorID:   "validator-guru",
			Role:       "Guru Validator",
			TimeAgo:    "10 jam lalu",
			CreatedAt:  now.Add(-10 * time.Hour).Format(time.RFC3339),
			Tag:        "Distribusi",
			TagColor:   "#047857",
			TagBg:      "#d1fae5",
			Title:      "Berita Acara Digital Serah Terima MBG Kelas 1-6 Berhasil Disetujui",
			Content:    "Seluruh 668 porsi nutrisi hari ini telah selesai didistribusikan dengan skor kepatuhan SOP 100%. Tanda tangan berita acara digital sudah terarsip di sistem.",
			LikesCount: 52,
			IsLiked:    true,
			Comments:   []models.CommunityComment{},
		},
		{
			ID:         "post-11",
			Author:     "Pak Tri Wibowo, S.Pd.",
			School:     "SDN Senen 03 Pagi",
			AuthorID:   "auth-tri-wibowo",
			Role:       "Guru Validator",
			TimeAgo:    "Kemarin",
			CreatedAt:  now.Add(-24 * time.Hour).Format(time.RFC3339),
			Tag:        "SOP Suhu",
			TagColor:   "#047857",
			TagBg:      "#d1fae5",
			Title:      "Evaluasi holding box isolasi busa ganda untuk cuaca hujan",
			Content:    "Saat hujan deras kemarin, holding box busa ganda terbukti mempertahankan suhu 68°C selama lebih dari 3 jam perjalanan. Solusi yang patut dipertahankan.",
			LikesCount: 27,
			IsLiked:    false,
			Comments:   []models.CommunityComment{},
		},
		{
			ID:         "post-12",
			Author:     "Ibu Rina Marlina, S.Pd.",
			School:     "SDN Johar Baru 01",
			AuthorID:   "auth-rina-marlina",
			Role:       "Guru Validator",
			TimeAgo:    "2 hari lalu",
			CreatedAt:  now.Add(-48 * time.Hour).Format(time.RFC3339),
			Tag:        "Menu Alergi",
			TagColor:   "#047857",
			TagBg:      "#d1fae5",
			Title:      "Daftar alternatif protein nabati bagi siswa intoleran kedelai",
			Content:    "Bagi siswa yang alergi tahu/tempe, kami usulkan substitusi jamur tiram dan kacang merah. Nutrisi protein nabatinya setara dan aman bagi anak.",
			LikesCount: 39,
			IsLiked:    false,
			Comments:   []models.CommunityComment{},
		},
	}
}

func (r *memoryPostRepository) List(ctx context.Context, page, limit int, tag, search, currentUserID string) ([]models.CommunityPost, int, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var filtered []models.CommunityPost
	q := strings.ToLower(strings.TrimSpace(search))
	targetTag := strings.TrimSpace(tag)

	for _, p := range r.posts {
		if targetTag != "" && targetTag != "Semua" && !strings.EqualFold(p.Tag, targetTag) {
			continue
		}
		if q != "" {
			matchTitle := strings.Contains(strings.ToLower(p.Title), q)
			matchContent := strings.Contains(strings.ToLower(p.Content), q)
			matchAuthor := strings.Contains(strings.ToLower(p.Author), q)
			matchSchool := strings.Contains(strings.ToLower(p.School), q)
			if !matchTitle && !matchContent && !matchAuthor && !matchSchool {
				continue
			}
		}

		item := p
		if currentUserID != "" {
			if userLikes, ok := r.likes[p.ID]; ok {
				item.IsLiked = userLikes[currentUserID]
			}
		}
		filtered = append(filtered, item)
	}

	total := len(filtered)
	if limit <= 0 {
		limit = 10
	}
	if page <= 0 {
		page = 1
	}

	start := (page - 1) * limit
	if start >= total {
		return []models.CommunityPost{}, total, nil
	}

	end := start + limit
	if end > total {
		end = total
	}

	return filtered[start:end], total, nil
}

func (r *memoryPostRepository) GetByID(ctx context.Context, id, currentUserID string) (*models.CommunityPost, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, p := range r.posts {
		if p.ID == id {
			item := p
			if currentUserID != "" {
				if userLikes, ok := r.likes[p.ID]; ok {
					item.IsLiked = userLikes[currentUserID]
				}
			}
			return &item, nil
		}
	}
	return nil, errors.New("postingan tidak ditemukan")
}

func (r *memoryPostRepository) Create(ctx context.Context, post *models.CommunityPost) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if post.ID == "" {
		post.ID = "post-" + uuid.New().String()[:8]
	}
	if post.CreatedAt == "" {
		post.CreatedAt = time.Now().Format(time.RFC3339)
	}
	if post.TimeAgo == "" {
		post.TimeAgo = "Baru saja"
	}
	if post.Comments == nil {
		post.Comments = make([]models.CommunityComment, 0)
	}

	// Prepend to posts array so it appears at the top
	r.posts = append([]models.CommunityPost{*post}, r.posts...)
	return nil
}

func (r *memoryPostRepository) Delete(ctx context.Context, id, currentUserID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	foundIndex := -1
	for i, p := range r.posts {
		if p.ID == id {
			if p.AuthorID != currentUserID && currentUserID != "superadmin" {
				return errors.New("hanya pembuat postingan yang dapat menghapus")
			}
			foundIndex = i
			break
		}
	}

	if foundIndex == -1 {
		return errors.New("postingan tidak ditemukan")
	}

	r.posts = append(r.posts[:foundIndex], r.posts[foundIndex+1:]...)
	delete(r.likes, id)
	return nil
}

func (r *memoryPostRepository) ToggleLike(ctx context.Context, id, currentUserID string) (int, bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for i := range r.posts {
		if r.posts[i].ID == id {
			if r.likes[id] == nil {
				r.likes[id] = make(map[string]bool)
			}
			isLiked := r.likes[id][currentUserID]
			if isLiked {
				delete(r.likes[id], currentUserID)
				if r.posts[i].LikesCount > 0 {
					r.posts[i].LikesCount--
				}
				return r.posts[i].LikesCount, false, nil
			} else {
				r.likes[id][currentUserID] = true
				r.posts[i].LikesCount++
				return r.posts[i].LikesCount, true, nil
			}
		}
	}
	return 0, false, errors.New("postingan tidak ditemukan")
}

func (r *memoryPostRepository) AddComment(ctx context.Context, postID string, comment *models.CommunityComment) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if comment.ID == "" {
		comment.ID = "c-" + uuid.New().String()[:8]
	}
	if comment.CreatedAt == "" {
		comment.CreatedAt = time.Now().Format(time.RFC3339)
	}
	if comment.TimeAgo == "" {
		comment.TimeAgo = "Baru saja"
	}
	if comment.Replies == nil {
		comment.Replies = make([]models.CommunityCommentReply, 0)
	}

	for i := range r.posts {
		if r.posts[i].ID == postID {
			r.posts[i].Comments = append(r.posts[i].Comments, *comment)
			return nil
		}
	}
	return errors.New("postingan tidak ditemukan")
}

func (r *memoryPostRepository) AddReply(ctx context.Context, postID, commentID string, reply *models.CommunityCommentReply) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if reply.ID == "" {
		reply.ID = "r-" + uuid.New().String()[:8]
	}
	if reply.CreatedAt == "" {
		reply.CreatedAt = time.Now().Format(time.RFC3339)
	}
	if reply.TimeAgo == "" {
		reply.TimeAgo = "Baru saja"
	}

	for i := range r.posts {
		if r.posts[i].ID == postID {
			for j := range r.posts[i].Comments {
				if r.posts[i].Comments[j].ID == commentID {
					r.posts[i].Comments[j].Replies = append(r.posts[i].Comments[j].Replies, *reply)
					return nil
				}
			}
			return errors.New("komentar tidak ditemukan")
		}
	}
	return errors.New("postingan tidak ditemukan")
}
