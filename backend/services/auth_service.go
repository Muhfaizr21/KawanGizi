package services

import (
	"backend/models"
	"backend/repositories"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// ErrInvalidCredentials is returned when email/password do not match.
var ErrInvalidCredentials = errors.New("email atau kata sandi salah")

// ErrAccountDisabled is returned when the account is blacklisted or pending.
var ErrAccountDisabled = errors.New("akun dinonaktifkan, hubungi superadmin")

// ErrInvalidToken is returned when a refresh token is unknown, expired, or revoked.
var ErrInvalidToken = errors.New("sesi tidak valid, silakan login ulang")

// ErrEmailExists is returned when registration uses an email that is already taken.
var ErrEmailExists = errors.New("email sudah terdaftar")

// ErrValidation is returned when the registration payload fails validation rules.
var ErrValidation = errors.New("data pendaftaran tidak valid")

// ErrUnsupportedRole is returned when a role is not allowed to self-register.
var ErrUnsupportedRole = errors.New("role tidak dapat didaftarkan sendiri")

// ErrRoleInactive is returned when a legacy account uses a retired role.
var ErrRoleInactive = errors.New("role akun ini sudah tidak tersedia, hubungi administrator")

// publicRegisterRoles lists roles that may self-register via the public endpoint.
var publicRegisterRoles = map[string]bool{
	models.RoleValidator: true,
}

const refreshTokenBytes = 32

// AuthService implements login, token refresh, and logout against the user repository.
type AuthService struct {
	users      repositories.UserRepository
	jwtSecret  []byte
	accessTTL  time.Duration
	refreshTTL time.Duration
}

// NewAuthService wires the auth service with its dependencies (Constructor DI).
func NewAuthService(users repositories.UserRepository, jwtSecret string, accessTTL, refreshTTL time.Duration) *AuthService {
	return &AuthService{
		users:      users,
		jwtSecret:  []byte(jwtSecret),
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
	}
}

// Register validates the public registration payload, enforces email
// uniqueness, hashes the password, and creates a new active account.
func (s *AuthService) Register(ctx context.Context, req models.RegisterRequest) (*models.User, error) {
	fullName := strings.TrimSpace(req.FullName)
	email := strings.ToLower(strings.TrimSpace(req.Email))
	password := strings.TrimSpace(req.Password)
	npsn := strings.TrimSpace(req.NPSN)
	schoolName := strings.TrimSpace(req.SchoolName)
	sppgID := strings.TrimSpace(req.SppgID)

	if fullName == "" || email == "" || password == "" {
		return nil, ErrValidation
	}
	if len(password) < 8 {
		return nil, ErrValidation
	}
	if !isValidEmail(email) {
		return nil, ErrValidation
	}

	role := strings.TrimSpace(req.Role)
	if role == "" {
		role = models.RoleValidator
	}
	if !publicRegisterRoles[role] {
		return nil, ErrUnsupportedRole
	}
	if npsn == "" || schoolName == "" || sppgID == "" {
		return nil, ErrValidation
	}

	// Email harus unik: jika sudah dipakai akun mana pun, tolak pendaftaran.
	if _, err := s.users.GetByEmail(ctx, email); err == nil {
		return nil, ErrEmailExists
	} else if !errors.Is(err, repositories.ErrNotFound) {
		return nil, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &models.User{
		ID:           "usr-" + uuid.NewString(),
		FullName:     fullName,
		Email:        email,
		PasswordHash: string(hash),
		Role:         role,
		NPSN:         npsn,
		SchoolName:   schoolName,
		SppgID:       sppgID,
		Status:       models.StatusActive,
		CreatedAt:    time.Now().UTC().Format(time.RFC3339),
	}
	if err := s.users.Create(ctx, user); err != nil {
		return nil, err
	}
	return user, nil
}

// isValidEmail is a light structural check (bukan standar RFC lengkap).
func isValidEmail(email string) bool {
	at := strings.LastIndex(email, "@")
	if at <= 0 || at == len(email)-1 {
		return false
	}
	// Harus ada "." setelah "@" (misal domain.com); setidaknya 1 karakter di antara.
	dot := strings.IndexByte(email[at+1:], '.')
	return dot > 0
}

// Login verifies credentials and issues an access token plus a refresh token.
// The returned time is the refresh token expiry (for cookie Max-Age).
func (s *AuthService) Login(ctx context.Context, email, password string) (*models.User, string, string, time.Time, error) {
	user, err := s.users.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, "", "", time.Time{}, ErrInvalidCredentials
		}
		return nil, "", "", time.Time{}, err
	}

	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) != nil {
		return nil, "", "", time.Time{}, ErrInvalidCredentials
	}
	if user.Status != models.StatusActive {
		return nil, "", "", time.Time{}, ErrAccountDisabled
	}
	if !models.ValidRole(user.Role) {
		return nil, "", "", time.Time{}, ErrRoleInactive
	}

	return s.newSession(ctx, user)
}

// Refresh rotates a refresh token and issues new credentials.
// The old refresh token is revoked so it can never be replayed.
func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*models.User, string, string, time.Time, error) {
	if refreshToken == "" {
		return nil, "", "", time.Time{}, ErrInvalidToken
	}

	hash := hashToken(refreshToken)
	userID, expiresAt, revoked, err := s.users.FindRefreshToken(ctx, hash)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, "", "", time.Time{}, ErrInvalidToken
		}
		return nil, "", "", time.Time{}, err
	}
	if revoked || time.Now().After(expiresAt) {
		return nil, "", "", time.Time{}, ErrInvalidToken
	}

	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, "", "", time.Time{}, ErrInvalidToken
		}
		return nil, "", "", time.Time{}, err
	}
	if user.Status != models.StatusActive {
		return nil, "", "", time.Time{}, ErrAccountDisabled
	}
	if !models.ValidRole(user.Role) {
		return nil, "", "", time.Time{}, ErrRoleInactive
	}

	if err := s.users.RevokeRefreshToken(ctx, hash); err != nil {
		return nil, "", "", time.Time{}, err
	}

	return s.newSession(ctx, user)
}

// Logout revokes the presented refresh token.
func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	if refreshToken == "" {
		return nil
	}
	return s.users.RevokeRefreshToken(ctx, hashToken(refreshToken))
}

// Me returns the profile for an authenticated user id.
func (s *AuthService) Me(ctx context.Context, userID string) (*models.User, error) {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, ErrInvalidToken
		}
		return nil, err
	}
	if !models.ValidRole(user.Role) {
		return nil, ErrRoleInactive
	}
	return user, nil
}

// ChangePassword memverifikasi kata sandi lama lalu menimpa dengan yang baru.
func (s *AuthService) ChangePassword(ctx context.Context, userID, currentPassword, newPassword string) error {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return ErrInvalidToken
		}
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)) != nil {
		return ErrInvalidCredentials
	}

	newPassword = strings.TrimSpace(newPassword)
	if len(newPassword) < 8 || newPassword == currentPassword {
		return ErrValidation
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.users.UpdatePasswordHash(ctx, user.ID, string(hash))
}

// UpdateProfile mengganti nama tampilan akun (self-service). Nama wajib 3–120 karakter.
func (s *AuthService) UpdateProfile(ctx context.Context, userID, fullName string) (*models.User, error) {
	fullName = strings.TrimSpace(fullName)
	if length := len([]rune(fullName)); length < 3 || length > 120 {
		return nil, ErrValidation
	}

	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, ErrInvalidToken
		}
		return nil, err
	}
	if !models.ValidRole(user.Role) {
		return nil, ErrRoleInactive
	}

	if err := s.users.UpdateFullName(ctx, user.ID, fullName); err != nil {
		return nil, err
	}
	user.FullName = fullName
	return user, nil
}

// ParseAccessToken validates a JWT access token and returns user claims (subject, role, sppgId, npsn).
func (s *AuthService) ParseAccessToken(tokenString string) (userID string, role string, sppgID string, npsn string, err error) {
	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("metode signing tak dikenal")
		}
		return s.jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return "", "", "", "", ErrInvalidToken
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", "", "", "", ErrInvalidToken
	}
	sub, _ := claims["sub"].(string)
	userRole, _ := claims["role"].(string)
	userSppgID, _ := claims["sppgId"].(string)
	userNPSN, _ := claims["npsn"].(string)
	if sub == "" || !models.ValidRole(userRole) {
		return "", "", "", "", ErrInvalidToken
	}
	return sub, userRole, userSppgID, userNPSN, nil
}

// newSession signs the access token and persists a fresh refresh token.
func (s *AuthService) newSession(ctx context.Context, user *models.User) (*models.User, string, string, time.Time, error) {
	now := time.Now()
	access, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":    user.ID,
		"role":   user.Role,
		"sppgId": user.SppgID,
		"npsn":   user.NPSN,
		"iat":    now.Unix(),
		"exp":    now.Add(s.accessTTL).Unix(),
	}).SignedString(s.jwtSecret)
	if err != nil {
		return nil, "", "", time.Time{}, err
	}

	rawRefresh, refreshHash, err := newRefreshToken()
	if err != nil {
		return nil, "", "", time.Time{}, err
	}

	refreshExpires := now.Add(s.refreshTTL)
	if err := s.users.SaveRefreshToken(ctx, user.ID, refreshHash, refreshExpires); err != nil {
		return nil, "", "", time.Time{}, err
	}

	return user, access, rawRefresh, refreshExpires, nil
}

func newRefreshToken() (raw string, hash string, err error) {
	buf := make([]byte, refreshTokenBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", "", err
	}
	raw = hex.EncodeToString(buf)
	return raw, hashToken(raw), nil
}

func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
