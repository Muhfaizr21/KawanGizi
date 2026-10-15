package services

import (
	"backend/models"
	"backend/repositories"
	"context"
	"errors"
	"math"
	"strings"
	"time"
)

type PostService struct {
	repo repositories.PostRepository
}

func NewPostService(repo repositories.PostRepository) *PostService {
	return &PostService{repo: repo}
}

// GetPosts mengembalikan daftar postingan terpaginasi 10 item per halaman
func (s *PostService) GetPosts(ctx context.Context, page, limit int, tag, search, currentUserID string) (*models.PostsPaginationResponse, error) {
	if limit <= 0 {
		limit = 10
	}
	if page <= 0 {
		page = 1
	}

	items, total, err := s.repo.List(ctx, page, limit, tag, search, currentUserID)
	if err != nil {
		return nil, err
	}

	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	hasMore := page < totalPages

	return &models.PostsPaginationResponse{
		Items:      items,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
		HasMore:    hasMore,
	}, nil
}

// GetPostByID mengambil postingan tunggal beserta komentar
func (s *PostService) GetPostByID(ctx context.Context, id, currentUserID string) (*models.CommunityPost, error) {
	return s.repo.GetByID(ctx, id, currentUserID)
}

// CreatePost memvalidasi dan menyimpan postingan baru
func (s *PostService) CreatePost(ctx context.Context, user *models.User, req *models.CreatePostRequest) (*models.CommunityPost, error) {
	title := strings.TrimSpace(req.Title)
	content := strings.TrimSpace(req.Content)
	if title == "" {
		return nil, errors.New("judul postingan tidak boleh kosong")
	}
	if content == "" {
		return nil, errors.New("isi postingan tidak boleh kosong")
	}

	tag := strings.TrimSpace(req.Tag)
	if tag == "" || tag == "Semua" {
		tag = "SOP Suhu"
	}

	authorName := "Validator Sekolah"
	schoolName := "SDN Menteng 01 Pagi"
	authorID := "guest"
	roleName := "Guru Validator"

	if user != nil {
		authorName = user.FullName
		if user.SchoolName != "" {
			schoolName = user.SchoolName
		}
		authorID = user.ID
		switch user.Role {
		case "validator":
			roleName = "Guru Validator"
		case "sppg":
			roleName = "Petugas Dapur SPPG"
		case "superadmin":
			roleName = "Admin Satgas BGN"
		default:
			roleName = user.Role
		}
	}

	mediaType := ""
	if req.MediaURI != "" {
		mediaType = req.MediaType
		if mediaType == "" {
			mediaType = "image"
		}
	}

	post := &models.CommunityPost{
		Author:     authorName,
		School:     schoolName,
		AuthorID:   authorID,
		Role:       roleName,
		TimeAgo:    "Baru saja",
		CreatedAt:  time.Now().Format(time.RFC3339),
		Tag:        tag,
		TagColor:   "#047857", // Emerald 700
		TagBg:      "#d1fae5", // Emerald 100
		Title:      title,
		Content:    content,
		MediaURI:   req.MediaURI,
		MediaType:  mediaType,
		LikesCount: 0,
		IsLiked:    false,
		Comments:   make([]models.CommunityComment, 0),
	}

	if err := s.repo.Create(ctx, post); err != nil {
		return nil, err
	}

	return post, nil
}

// DeletePost menghapus postingan milik pengguna
func (s *PostService) DeletePost(ctx context.Context, id, currentUserID string) error {
	return s.repo.Delete(ctx, id, currentUserID)
}

// ToggleLike menyukai atau membatalkan suka
func (s *PostService) ToggleLike(ctx context.Context, id, currentUserID string) (int, bool, error) {
	return s.repo.ToggleLike(ctx, id, currentUserID)
}

// AddComment menambahkan komentar atau balasan
func (s *PostService) AddComment(ctx context.Context, postID string, user *models.User, req *models.CreateCommentRequest) (*models.CommunityComment, error) {
	content := strings.TrimSpace(req.Content)
	if content == "" {
		return nil, errors.New("komentar tidak boleh kosong")
	}

	authorName := "Petugas KawanGizi"
	schoolName := "SDN Menteng 01 Pagi"
	authorID := "guest"
	roleName := "Guru Validator"

	if user != nil {
		authorName = user.FullName
		if user.SchoolName != "" {
			schoolName = user.SchoolName
		}
		authorID = user.ID
		switch user.Role {
		case "validator":
			roleName = "Guru Validator"
		case "sppg":
			roleName = "Petugas Dapur SPPG"
		case "superadmin":
			roleName = "Admin Satgas BGN"
		default:
			roleName = user.Role
		}
	}

	// Jika merupakan balasan pada komentar induk
	if req.ParentID != "" {
		reply := &models.CommunityCommentReply{
			CommentID:  req.ParentID,
			Author:     authorName,
			School:     schoolName,
			AuthorID:   authorID,
			Role:       roleName,
			TimeAgo:    "Baru saja",
			CreatedAt:  time.Now().Format(time.RFC3339),
			Content:    content,
			LikesCount: 0,
			IsLiked:    false,
		}
		if err := s.repo.AddReply(ctx, postID, req.ParentID, reply); err != nil {
			return nil, err
		}
		// Return wrapper
		return &models.CommunityComment{
			ID:        reply.ID,
			PostID:    postID,
			Author:    reply.Author,
			School:    reply.School,
			AuthorID:  reply.AuthorID,
			Role:      reply.Role,
			TimeAgo:   reply.TimeAgo,
			CreatedAt: reply.CreatedAt,
			Content:   reply.Content,
		}, nil
	}

	comment := &models.CommunityComment{
		PostID:     postID,
		Author:     authorName,
		School:     schoolName,
		AuthorID:   authorID,
		Role:       roleName,
		TimeAgo:    "Baru saja",
		CreatedAt:  time.Now().Format(time.RFC3339),
		Content:    content,
		LikesCount: 0,
		IsLiked:    false,
		Replies:    make([]models.CommunityCommentReply, 0),
	}

	if err := s.repo.AddComment(ctx, postID, comment); err != nil {
		return nil, err
	}

	return comment, nil
}
