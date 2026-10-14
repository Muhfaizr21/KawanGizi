package models

// SppgAccount is an administratable account bound to an SPPG kitchen. It is a
// projection of a `users` row with role 'sppg' joined with its kitchen so the
// superadmin directory can show which dapur an account signs in for.
type SppgAccount struct {
	ID          string `json:"id"`
	FullName    string `json:"fullName"`
	Email       string `json:"email"`
	SppgID      string `json:"sppgId"`
	KitchenName string `json:"kitchenName"`
	KitchenCode string `json:"kitchenCode"`
	Status      string `json:"status"`
	CreatedAt   string `json:"createdAt"`
}

// CreateSppgAccountRequest is the payload for POST /api/sppg/accounts.
type CreateSppgAccountRequest struct {
	FullName string `json:"fullName"`
	Email    string `json:"email"`
	Password string `json:"password"`
	SppgID   string `json:"sppgId"`
	Status   string `json:"status"`
}

// UpdateSppgAccountRequest is the payload for PATCH /api/sppg/accounts/{id}.
type UpdateSppgAccountRequest struct {
	FullName string `json:"fullName"`
	SppgID   string `json:"sppgId"`
	Status   string `json:"status"`
	Reason   string `json:"reason"`
}

// UpdateSppgAccountCredentialsRequest is the payload for
// PATCH /api/sppg/accounts/{id}/credentials. NewPassword may be empty to keep
// the current password.
type UpdateSppgAccountCredentialsRequest struct {
	Email       string `json:"email"`
	NewPassword string `json:"newPassword"`
	Reason      string `json:"reason"`
}
