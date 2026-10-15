package models

// CommunityCommentReply mewakili balasan komentar berjenjang pada postingan komunitas
type CommunityCommentReply struct {
	ID         string `json:"id"`
	CommentID  string `json:"commentId,omitempty"`
	Author     string `json:"author"`
	School     string `json:"school"`
	AuthorID   string `json:"authorId"`
	Role       string `json:"role,omitempty"`
	TimeAgo    string `json:"timeAgo"`
	CreatedAt  string `json:"createdAt"`
	Content    string `json:"content"`
	LikesCount int    `json:"likesCount"`
	IsLiked    bool   `json:"isLiked"`
}

// CommunityComment mewakili komentar utama pada postingan komunitas
type CommunityComment struct {
	ID         string                  `json:"id"`
	PostID     string                  `json:"postId,omitempty"`
	Author     string                  `json:"author"`
	School     string                  `json:"school"`
	AuthorID   string                  `json:"authorId"`
	Role       string                  `json:"role,omitempty"`
	TimeAgo    string                  `json:"timeAgo"`
	CreatedAt  string                  `json:"createdAt"`
	Content    string                  `json:"content"`
	LikesCount int                     `json:"likesCount"`
	IsLiked    bool                    `json:"isLiked"`
	Replies    []CommunityCommentReply `json:"replies"`
}

// CommunityPost mewakili artikel / topik diskusi forum komunitas
type CommunityPost struct {
	ID         string             `json:"id"`
	Author     string             `json:"author"`
	School     string             `json:"school"`
	AuthorID   string             `json:"authorId"`
	Role       string             `json:"role"`
	TimeAgo    string             `json:"timeAgo"`
	CreatedAt  string             `json:"createdAt"`
	Tag        string             `json:"tag"`
	TagColor   string             `json:"tagColor"`
	TagBg      string             `json:"tagBg"`
	Title      string             `json:"title"`
	Content    string             `json:"content"`
	MediaURI   string             `json:"mediaUri,omitempty"`
	MediaType  string             `json:"mediaType,omitempty"`
	LikesCount int                `json:"likesCount"`
	IsLiked    bool               `json:"isLiked"`
	IsPinned   bool               `json:"isPinned,omitempty"`
	Comments   []CommunityComment `json:"comments"`
}

// CreatePostRequest payload untuk membuat postingan forum baru
type CreatePostRequest struct {
	Title     string `json:"title"`
	Content   string `json:"content"`
	Tag       string `json:"tag"`
	MediaURI  string `json:"mediaUri,omitempty"`
	MediaType string `json:"mediaType,omitempty"`
}

// CreateCommentRequest payload untuk menulis komentar atau balasan
type CreateCommentRequest struct {
	Content  string `json:"content"`
	ParentID string `json:"parentId,omitempty"` // ID komentar utama jika merupakan balasan
}

// PostsPaginationResponse pembungkus hasil feed dengan paginasi 10 item
type PostsPaginationResponse struct {
	Items      []CommunityPost `json:"items"`
	Total      int             `json:"total"`
	Page       int             `json:"page"`
	Limit      int             `json:"limit"`
	TotalPages int             `json:"totalPages"`
	HasMore    bool            `json:"hasMore"`
}
