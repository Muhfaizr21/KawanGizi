package models

// Role identifiers for the RBAC system.
const (
	RoleSuperadmin = "superadmin"
	RoleSppg       = "sppg"
	RoleValidator  = "validator"
)

// Account status values.
const (
	StatusActive      = "active"
	StatusPending     = "pending"
	StatusBlacklisted = "blacklisted"
)

// User is an authenticated account bound to a role in the MBG ecosystem.
type User struct {
	ID           string `json:"id"`
	FullName     string `json:"fullName"`
	Email        string `json:"email"`
	PasswordHash string `json:"-"`
	Role         string `json:"role"`
	NPSN         string `json:"npsn,omitempty"`
	SchoolName   string `json:"schoolName,omitempty"`
	SppgID       string `json:"sppgId,omitempty"`
	Status       string `json:"status"`
	CreatedAt    string `json:"createdAt"`
}

// LoginRequest is the payload for POST /api/auth/login.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// RegisterRequest is the public payload for POST /api/auth/register.
// Only validator accounts may self-register.
type RegisterRequest struct {
	FullName   string `json:"fullName"`
	Email      string `json:"email"`
	Password   string `json:"password"`
	Role       string `json:"role"`
	NPSN       string `json:"npsn"`
	SchoolName string `json:"schoolName"`
	SppgID     string `json:"sppgId"`
}

// ChangePasswordRequest is the payload for PATCH /api/auth/password.
type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

// UpdateProfileRequest is the payload for PATCH /api/auth/profile.
type UpdateProfileRequest struct {
	FullName string `json:"fullName"`
}

// AuthResponse is returned after login/refresh/me.
type AuthResponse struct {
	AccessToken string   `json:"accessToken,omitempty"`
	ExpiresIn   int64    `json:"expiresIn,omitempty"`
	User        *User    `json:"user"`
	Permissions []string `json:"permissions"`
}

// Permission identifiers resolved server-side from the caller's role.
const (
	PermDashboardRead    = "dashboard.read"
	PermValidatorsRead   = "validators.read"
	PermValidatorsManage = "validators.manage"
	PermSppgRead         = "sppg.read"
	PermSppgManage       = "sppg.manage"
	PermDeliveriesRead   = "deliveries.read"
	PermAttendanceRead   = "attendance.read"
	PermAttendanceManage = "attendance.manage"
	PermSchoolsRead      = "schools.read"
	PermSchoolsManage    = "schools.manage"
	PermScheduleRead     = "schedule.read"
	PermScheduleManage   = "schedule.manage"
	PermNoticesRead      = "notices.read"
	PermNoticesPublish   = "notices.publish"
	PermCalendarRead     = "calendar.read"
	PermCalendarManage   = "calendar.manage"
	PermReportsDownload  = "reports.download"
	PermReportsManage    = "reports.manage"
	PermFeedbackTriage   = "feedback.triage"
	PermAiOverride       = "ai.override"
	PermPaymentClearance = "payment.clearance"
	PermKillswitch       = "killswitch"
	PermScanSubmit       = "scan.submit"
	PermHandoverBast     = "handover.bast"
	PermIncidentSubmit   = "incident.submit"
	PermKitchenOps       = "kitchen.ops"
	PermUsersCreate      = "users.create"
)

// rolePermissions maps each role to its granted permission set.
// These are the only active roles; superadmin has access across all portals.
var rolePermissions = map[string][]string{
	RoleSuperadmin: {
		PermDashboardRead, PermValidatorsRead, PermValidatorsManage,
		PermSppgRead, PermSppgManage, PermDeliveriesRead, PermAttendanceRead,
		PermSchoolsRead, PermScheduleRead, PermNoticesRead, PermNoticesPublish,
		PermCalendarRead, PermReportsDownload, PermFeedbackTriage,
		PermAiOverride, PermPaymentClearance, PermKillswitch,
		PermHandoverBast, PermIncidentSubmit, PermKitchenOps, PermUsersCreate,
		PermScanSubmit,
	},
	RoleSppg: {
		PermDashboardRead, PermSppgRead, PermSppgManage, PermDeliveriesRead,
		PermAttendanceRead, PermSchoolsRead, PermScheduleRead, PermNoticesRead,
		PermCalendarRead, PermReportsDownload, PermFeedbackTriage,
		PermHandoverBast, PermIncidentSubmit, PermKitchenOps,
	},
	RoleValidator: {
		PermValidatorsRead, PermSppgRead, PermDeliveriesRead,
		PermAttendanceRead, PermSchoolsRead, PermScheduleRead, PermNoticesRead,
		PermCalendarRead, PermFeedbackTriage, PermScanSubmit,
		PermHandoverBast, PermIncidentSubmit,
	},
}

// PermissionsFor returns the permission list granted to a role.
// Unknown roles receive an empty (deny-all) list.
func PermissionsFor(role string) []string {
	perms, ok := rolePermissions[role]
	if !ok {
		return nil
	}
	out := make([]string, len(perms))
	copy(out, perms)
	return out
}

// HasPermission reports whether the role grants the given permission.
func HasPermission(role, permission string) bool {
	for _, p := range rolePermissions[role] {
		if p == permission {
			return true
		}
	}
	return false
}

// ValidRole reports whether the role identifier is known.
func ValidRole(role string) bool {
	_, ok := rolePermissions[role]
	return ok
}
