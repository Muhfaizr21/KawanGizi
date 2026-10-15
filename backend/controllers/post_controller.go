package controllers

import (
	"backend/middlewares"
	"backend/models"
	"backend/repositories"
	"backend/services"
	"backend/utils"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

type PostController struct {
	postSvc  *services.PostService
	userRepo repositories.UserRepository
}

func NewPostController(postSvc *services.PostService, userRepo repositories.UserRepository) *PostController {
	return &PostController{
		postSvc:  postSvc,
		userRepo: userRepo,
	}
}

// List godoc
// @Summary Ambil daftar postingan forum komunitas (Paginasi 10 item)
// @Router /api/v1/posts [get]
func (c *PostController) List(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page <= 0 {
		page = 1
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 10
	}

	tag := r.URL.Query().Get("tag")
	search := r.URL.Query().Get("search")
	if search == "" {
		search = r.URL.Query().Get("q")
	}

	currentUserID := middlewares.UserID(r.Context())

	resp, err := c.postSvc.GetPosts(r.Context(), page, limit, tag, search, currentUserID)
	if err != nil {
		utils.Error(w, http.StatusInternalServerError, "gagal memuat postingan komunitas")
		return
	}

	utils.Success(w, http.StatusOK, "daftar postingan berhasil dimuat", resp)
}

// GetByID godoc
// @Summary Ambil rincian postingan beserta komentar
// @Router /api/v1/posts/{id} [get]
func (c *PostController) GetByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		utils.Error(w, http.StatusBadRequest, "id postingan diperlukan")
		return
	}

	currentUserID := middlewares.UserID(r.Context())
	post, err := c.postSvc.GetPostByID(r.Context(), id, currentUserID)
	if err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.Success(w, http.StatusOK, "rincian postingan berhasil dimuat", post)
}

// Create godoc
// @Summary Buat postingan baru di forum komunitas
// @Router /api/v1/posts [post]
func (c *PostController) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreatePostRequest

	// Support both application/json and multipart form
	if strings.Contains(r.Header.Get("Content-Type"), "application/json") {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			utils.Error(w, http.StatusBadRequest, "payload JSON tidak valid")
			return
		}
	} else {
		_ = r.ParseMultipartForm(10 << 20)
		req.Title = r.FormValue("title")
		req.Content = r.FormValue("content")
		req.Tag = r.FormValue("tag")
		req.MediaURI = r.FormValue("mediaUri")
		req.MediaType = r.FormValue("mediaType")
	}

	currentUserID := middlewares.UserID(r.Context())
	var currentUser *models.User
	if currentUserID != "" && c.userRepo != nil {
		currentUser, _ = c.userRepo.GetByID(r.Context(), currentUserID)
	}

	post, err := c.postSvc.CreatePost(r.Context(), currentUser, &req)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.Success(w, http.StatusCreated, "postingan berhasil diterbitkan", post)
}

// Delete godoc
// @Summary Hapus postingan oleh pemiliknya
// @Router /api/v1/posts/{id} [delete]
func (c *PostController) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		utils.Error(w, http.StatusBadRequest, "id postingan diperlukan")
		return
	}

	currentUserID := middlewares.UserID(r.Context())
	if currentUserID == "" {
		utils.Error(w, http.StatusUnauthorized, "autentikasi diperlukan")
		return
	}

	if err := c.postSvc.DeletePost(r.Context(), id, currentUserID); err != nil {
		utils.Error(w, http.StatusForbidden, err.Error())
		return
	}

	utils.Success(w, http.StatusOK, "postingan berhasil dihapus", map[string]string{"id": id})
}

// ToggleLike godoc
// @Summary Suka / batalkan suka pada postingan
// @Router /api/v1/posts/{id}/like [post]
func (c *PostController) ToggleLike(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		utils.Error(w, http.StatusBadRequest, "id postingan diperlukan")
		return
	}

	currentUserID := middlewares.UserID(r.Context())
	if currentUserID == "" {
		currentUserID = "guest"
	}

	likesCount, isLiked, err := c.postSvc.ToggleLike(r.Context(), id, currentUserID)
	if err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.Success(w, http.StatusOK, "status suka diperbarui", map[string]any{
		"id":         id,
		"likesCount": likesCount,
		"isLiked":    isLiked,
	})
}

// GetComments godoc
// @Summary Ambil daftar komentar untuk suatu postingan
// @Router /api/v1/posts/{id}/comments [get]
func (c *PostController) GetComments(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		utils.Error(w, http.StatusBadRequest, "id postingan diperlukan")
		return
	}

	currentUserID := middlewares.UserID(r.Context())
	post, err := c.postSvc.GetPostByID(r.Context(), id, currentUserID)
	if err != nil {
		utils.Error(w, http.StatusNotFound, err.Error())
		return
	}

	utils.Success(w, http.StatusOK, "komentar berhasil dimuat", post.Comments)
}

// CreateComment godoc
// @Summary Tulis komentar atau balasan baru
// @Router /api/v1/posts/{id}/comments [post]
func (c *PostController) CreateComment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		utils.Error(w, http.StatusBadRequest, "id postingan diperlukan")
		return
	}

	var req models.CreateCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.Error(w, http.StatusBadRequest, "payload komentar tidak valid")
		return
	}

	currentUserID := middlewares.UserID(r.Context())
	var currentUser *models.User
	if currentUserID != "" && c.userRepo != nil {
		currentUser, _ = c.userRepo.GetByID(r.Context(), currentUserID)
	}

	comment, err := c.postSvc.AddComment(r.Context(), id, currentUser, &req)
	if err != nil {
		utils.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.Success(w, http.StatusCreated, "komentar berhasil ditambahkan", comment)
}
