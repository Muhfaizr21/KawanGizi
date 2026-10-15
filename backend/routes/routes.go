package routes

import (
	"backend/controllers"
	"backend/middlewares"
	"backend/models"
	"backend/utils"
	"net/http"
	"time"

	httpSwagger "github.com/swaggo/http-swagger/v2"
)

type RouterDependencies struct {
	HealthCtrl     *controllers.HealthController
	ItemCtrl       *controllers.ItemController
	AuthCtrl       *controllers.AuthController
	ScanCtrl       *controllers.ScanController
	NutritionCtrl  *controllers.NutritionController
	PortalCtrl     *controllers.PortalController
	ValidatorCtrl  *controllers.ValidatorController
	SppgCtrl       *controllers.SppgController
	SppgAccountCtrl *controllers.SppgAccountController
	DeliveryCtrl   *controllers.DeliveryController
	AttendanceCtrl *controllers.AttendanceController
	SchoolCtrl     *controllers.SchoolController
	ScheduleCtrl   *controllers.ScheduleController
	NoticeCtrl     *controllers.NoticeController
	CalendarCtrl   *controllers.CalendarController
	ReportCtrl     *controllers.ReportController
	FeedbackCtrl   *controllers.FeedbackController
	DashboardCtrl  *controllers.DashboardController
	SppgRecipeCtrl *controllers.SppgRecipeController
	SppgBatchCtrl  *controllers.SppgBatchController
	SppgQualityCtrl *controllers.SppgQualityController
	SppgLogisticsCtrl *controllers.SppgLogisticsController
	SppgSchoolCtrl *controllers.SppgSchoolController
	SppgHandoverCtrl  *controllers.SppgHandoverController
	SppgIncidentCtrl   *controllers.SppgIncidentController
	SppgBillingCtrl    *controllers.SppgBillingController
	SppgComplianceCtrl *controllers.SppgComplianceController
	SppgDashboardCtrl  *controllers.SppgDashboardController
	ValidatorScanCtrl  *controllers.ValidatorScanController
	AuthMW             func(http.Handler) http.Handler
	CORSOrigins    []string
	AppEnv         string
}

// SetupRoutes registers all application routes and returns a configured handler.
// Chain: Logger -> SecurityHeaders -> BodyLimit -> CORS -> RateLimiter -> Auth (populates context) -> Mux.
func SetupRoutes(deps RouterDependencies) http.Handler {
	mux := http.NewServeMux()

	// Rate limiters:
	// - Auth limiter: 10 requests / min burst 15 per IP (anti brute-force / credential stuffing)
	// - API limiter: 200 requests / min burst 300 per IP (anti scraping / DDoS)
	authLimiter := middlewares.NewRateLimiter(10, 15, time.Minute)

	// Swagger documentation route
	mux.Handle("/swagger/", httpSwagger.WrapHandler)

	// Root route (exact match using /{$} in Go 1.22+)
	mux.HandleFunc("GET /{$}", deps.HealthCtrl.Root)
	mux.HandleFunc("GET /api/health", deps.HealthCtrl.HealthCheck)

	// Auth routes (protected against brute-force)
	mux.Handle("POST /api/auth/register", authLimiter.Limit("Terlalu banyak permintaan pendaftaran. Silakan coba lagi dalam 1 menit.")(http.HandlerFunc(deps.AuthCtrl.Register)))
	mux.Handle("POST /api/auth/login", authLimiter.Limit("Terlalu banyak percobaan login. Akun dilindungi dari serangan brute-force. Silakan tunggu 1 menit.")(http.HandlerFunc(deps.AuthCtrl.Login)))
	mux.HandleFunc("POST /api/auth/refresh", deps.AuthCtrl.Refresh)
	mux.HandleFunc("POST /api/auth/logout", deps.AuthCtrl.Logout)
	mux.Handle("GET /api/auth/me", middlewares.RequireAuth(http.HandlerFunc(deps.AuthCtrl.Me)))
	mux.Handle("PATCH /api/auth/password", middlewares.RequireAuth(http.HandlerFunc(deps.AuthCtrl.ChangePassword)))
	mux.Handle("PATCH /api/auth/profile", middlewares.RequireAuth(http.HandlerFunc(deps.AuthCtrl.UpdateProfile)))

	// Item resource routes (CRUD) — read: any authenticated user, write: restricted
	mux.Handle("GET /api/items", middlewares.RequireAuth(http.HandlerFunc(deps.ItemCtrl.GetAll)))
	mux.Handle("GET /api/items/{id}", middlewares.RequireAuth(http.HandlerFunc(deps.ItemCtrl.GetByID)))
	mux.Handle("POST /api/items", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.ItemCtrl.Create)))
	mux.Handle("DELETE /api/items/{id}", middlewares.RequirePermission(models.PermKillswitch)(http.HandlerFunc(deps.ItemCtrl.Delete)))

	// Scan routes — submit & history require scan.submit (role validator)
	mux.Handle("POST /api/scans", middlewares.RequirePermission(models.PermScanSubmit)(http.HandlerFunc(deps.ScanCtrl.Submit)))
	mux.Handle("POST /api/v1/scan", middlewares.RequirePermission(models.PermScanSubmit)(http.HandlerFunc(deps.ScanCtrl.Submit)))
	mux.Handle("GET /api/scans/recent", middlewares.RequirePermission(models.PermScanSubmit)(http.HandlerFunc(deps.ScanCtrl.Recent)))
	mux.Handle("PUT /api/scans/{id}", middlewares.RequirePermission(models.PermScanSubmit)(http.HandlerFunc(deps.ScanCtrl.UpdateFeedback)))
	mux.Handle("DELETE /api/scans/all", middlewares.RequirePermission(models.PermScanSubmit)(http.HandlerFunc(deps.ScanCtrl.DeleteAllScans)))
	mux.Handle("DELETE /api/scans/{id}", middlewares.RequirePermission(models.PermScanSubmit)(http.HandlerFunc(deps.ScanCtrl.DeleteScan)))

	// Nutrition dataset — any authenticated user may look up item gizi
	mux.Handle("GET /api/nutrition/items", middlewares.RequireAuth(http.HandlerFunc(deps.NutritionCtrl.Items)))

	// Dapur SPPG resource routes.
	// Baca: sppg.read (superadmin, satgas, sppg, validator).
	// Kapasitas & audit resep: sppg.manage — dapur boleh mengisi data sendiri.
	// Tindakan disipliner (surat teguran, pembekuan) tetap superadmin: dapur
	// tidak boleh menjatuhkan teguran ke dirinya sendiri.
	if deps.SppgCtrl != nil {
		mux.Handle("GET /api/sppg", middlewares.RequirePermission(models.PermSppgRead)(http.HandlerFunc(deps.SppgCtrl.List)))
		mux.Handle("GET /api/sppg/{id}", middlewares.RequirePermission(models.PermSppgRead)(http.HandlerFunc(deps.SppgCtrl.Get)))
		mux.Handle("POST /api/sppg/{id}/warnings", middlewares.RequireRole(models.RoleSuperadmin)(http.HandlerFunc(deps.SppgCtrl.IssueWarning)))
		mux.Handle("POST /api/sppg/{id}/suspension", middlewares.RequireRole(models.RoleSuperadmin)(http.HandlerFunc(deps.SppgCtrl.Suspend)))
		mux.Handle("POST /api/sppg/{id}/reinstate", middlewares.RequireRole(models.RoleSuperadmin)(http.HandlerFunc(deps.SppgCtrl.Reinstate)))
		mux.Handle("PUT /api/sppg/{id}/quota", middlewares.RequirePermission(models.PermSppgManage)(http.HandlerFunc(deps.SppgCtrl.UpdateQuota)))
		mux.Handle("POST /api/sppg/{id}/recipe-audit", middlewares.RequirePermission(models.PermSppgManage)(http.HandlerFunc(deps.SppgCtrl.RecordRecipeAudit)))
		// Self-service identitas dapur milik akun SPPG yang sedang login.
		mux.Handle("GET /api/sppg/profile", middlewares.RequireRole(models.RoleSppg)(http.HandlerFunc(deps.SppgCtrl.GetProfile)))
		mux.Handle("PATCH /api/sppg/profile", middlewares.RequireRole(models.RoleSppg)(http.HandlerFunc(deps.SppgCtrl.UpdateProfile)))
	}

	// Akun login dapur SPPG — hanya superadmin. Literal segment "accounts" lebih
	// spesifik dari wildcard {id} sehingga tidak bentrok dengan GET /api/sppg/{id}.
	if deps.SppgAccountCtrl != nil {
		mux.Handle("GET /api/sppg/accounts", middlewares.RequireRole(models.RoleSuperadmin)(http.HandlerFunc(deps.SppgAccountCtrl.List)))
		mux.Handle("POST /api/sppg/accounts", middlewares.RequireRole(models.RoleSuperadmin)(http.HandlerFunc(deps.SppgAccountCtrl.Create)))
		mux.Handle("PATCH /api/sppg/accounts/{id}", middlewares.RequireRole(models.RoleSuperadmin)(http.HandlerFunc(deps.SppgAccountCtrl.Update)))
		mux.Handle("PATCH /api/sppg/accounts/{id}/credentials", middlewares.RequireRole(models.RoleSuperadmin)(http.HandlerFunc(deps.SppgAccountCtrl.UpdateCredentials)))
		mux.Handle("DELETE /api/sppg/accounts/{id}", middlewares.RequireRole(models.RoleSuperadmin)(http.HandlerFunc(deps.SppgAccountCtrl.Delete)))
	}

	// SPPG Recipes, Daily Operational States, Substitutions & Batch Traceability (Multi-Tenant)
	if deps.SppgRecipeCtrl != nil {
		mux.Handle("GET /api/sppg/recipes/bundle", middlewares.RequireAuth(http.HandlerFunc(deps.SppgRecipeCtrl.GetBundle)))
		mux.Handle("GET /api/sppg/recipes/packages", middlewares.RequireAuth(http.HandlerFunc(deps.SppgRecipeCtrl.ListPackages)))
		mux.Handle("GET /api/sppg/recipes/packages/{id}", middlewares.RequireAuth(http.HandlerFunc(deps.SppgRecipeCtrl.GetPackageByID)))
		mux.Handle("POST /api/sppg/recipes/packages", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgRecipeCtrl.CreatePackage)))
		mux.Handle("GET /api/sppg/recipes/state", middlewares.RequireAuth(http.HandlerFunc(deps.SppgRecipeCtrl.GetDailyState)))
		mux.Handle("PUT /api/sppg/recipes/state", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgRecipeCtrl.UpdateDailyState)))
		mux.Handle("POST /api/sppg/recipes/lock", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgRecipeCtrl.ToggleLock)))
		mux.Handle("GET /api/sppg/recipes/substitutions", middlewares.RequireAuth(http.HandlerFunc(deps.SppgRecipeCtrl.ListSubstitutions)))
		mux.Handle("POST /api/sppg/recipes/substitutions", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgRecipeCtrl.CreateSubstitution)))
		mux.Handle("GET /api/sppg/recipes/batches", middlewares.RequireAuth(http.HandlerFunc(deps.SppgRecipeCtrl.ListBatches)))
		mux.Handle("POST /api/sppg/recipes/batches", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgRecipeCtrl.CreateBatch)))
	}

	// SPPG Batches, HACCP Thermal QR Printing & Superadmin Safety Intervention
	if deps.SppgBatchCtrl != nil {
		mux.Handle("GET /api/sppg/batches/bundle", middlewares.RequireAuth(http.HandlerFunc(deps.SppgBatchCtrl.GetBundle)))
		mux.Handle("GET /api/sppg/batches", middlewares.RequireAuth(http.HandlerFunc(deps.SppgBatchCtrl.List)))
		mux.Handle("POST /api/sppg/batches", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgBatchCtrl.Create)))
		mux.Handle("PUT /api/sppg/batches/{id}/status", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgBatchCtrl.UpdateStatus)))
		mux.Handle("POST /api/sppg/batches/verify", middlewares.RequireAuth(http.HandlerFunc(deps.SppgBatchCtrl.VerifyToken)))
		mux.Handle("POST /api/sppg/batches/{id}/quarantine", middlewares.RequireRole(models.RoleSuperadmin)(http.HandlerFunc(deps.SppgBatchCtrl.Quarantine)))
		mux.Handle("DELETE /api/sppg/batches/{id}", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgBatchCtrl.Delete)))
	}

	// SPPG Quality HACCP, Critical Control Points, Sensory Release & Food Retention Samples
	if deps.SppgQualityCtrl != nil {
		mux.Handle("GET /api/sppg/quality/bundle", middlewares.RequireAuth(http.HandlerFunc(deps.SppgQualityCtrl.GetBundle)))
		mux.Handle("GET /api/sppg/quality/temp-logs", middlewares.RequireAuth(http.HandlerFunc(deps.SppgQualityCtrl.ListTempLogs)))
		mux.Handle("POST /api/sppg/quality/temp-logs", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgQualityCtrl.CreateTempLog)))
		mux.Handle("GET /api/sppg/quality/signoffs", middlewares.RequireAuth(http.HandlerFunc(deps.SppgQualityCtrl.ListSignoffs)))
		mux.Handle("POST /api/sppg/quality/signoffs", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgQualityCtrl.CreateSignoff)))
		mux.Handle("GET /api/sppg/quality/samples", middlewares.RequireAuth(http.HandlerFunc(deps.SppgQualityCtrl.ListSamples)))
		mux.Handle("POST /api/sppg/quality/samples", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgQualityCtrl.CreateSample)))
		mux.Handle("PUT /api/sppg/quality/samples/{id}/status", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgQualityCtrl.UpdateSampleStatus)))
		mux.Handle("POST /api/sppg/quality/intervention", middlewares.RequireRole(models.RoleSuperadmin)(http.HandlerFunc(deps.SppgQualityCtrl.SuperadminIntervention)))
	}

	// SPPG Logistics & Fleet Management
	if deps.SppgLogisticsCtrl != nil {
		mux.Handle("GET /api/sppg/logistics/bundle", middlewares.RequireAuth(http.HandlerFunc(deps.SppgLogisticsCtrl.GetBundle)))
		mux.Handle("GET /api/sppg/logistics/fleets", middlewares.RequireAuth(http.HandlerFunc(deps.SppgLogisticsCtrl.ListFleets)))
		mux.Handle("POST /api/sppg/logistics/fleets", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgLogisticsCtrl.CreateFleet)))
		mux.Handle("PUT /api/sppg/logistics/fleets/{id}/telemetry", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgLogisticsCtrl.UpdateTelemetry)))
		mux.Handle("POST /api/sppg/logistics/fleets/{id}/dispatch-backup", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgLogisticsCtrl.DispatchBackup)))
		mux.Handle("POST /api/sppg/logistics/fleets/{id}/notify", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgLogisticsCtrl.SendNotification)))
		mux.Handle("POST /api/sppg/logistics/intervention", middlewares.RequireRole(models.RoleSuperadmin)(http.HandlerFunc(deps.SppgLogisticsCtrl.SuperadminIntervention)))
	}

	// SPPG Schools & Daily Quotas
	if deps.SppgSchoolCtrl != nil {
		mux.Handle("GET /api/sppg/schools/bundle", middlewares.RequireAuth(http.HandlerFunc(deps.SppgSchoolCtrl.GetBundle)))
		mux.Handle("GET /api/sppg/schools", middlewares.RequireAuth(http.HandlerFunc(deps.SppgSchoolCtrl.ListSchools)))
		mux.Handle("POST /api/sppg/schools", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SchoolCtrl.CreateOwned)))
		mux.Handle("GET /api/sppg/schools/{id}", middlewares.RequireAuth(http.HandlerFunc(deps.SppgSchoolCtrl.GetSchool)))
		mux.Handle("PUT /api/sppg/schools/{id}/attendance", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgSchoolCtrl.UpdateAttendance)))
		mux.Handle("PUT /api/sppg/schools/{id}/droppoint", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgSchoolCtrl.UpdateDroppoint)))
		mux.Handle("POST /api/sppg/schools/{id}/remind", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgSchoolCtrl.RemindAttendance)))
		mux.Handle("DELETE /api/sppg/schools/{id}", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SchoolCtrl.DeleteOwned)))
	}

	// SPPG Serah Terima BAST Digital & Kontrol Porsi (SPPG.md Bab 7)
	if deps.SppgHandoverCtrl != nil {
		mux.Handle("GET /api/sppg/handover/bundle", middlewares.RequireAuth(http.HandlerFunc(deps.SppgHandoverCtrl.GetBundle)))
		mux.Handle("GET /api/sppg/handover", middlewares.RequireAuth(http.HandlerFunc(deps.SppgHandoverCtrl.ListHandovers)))
		mux.Handle("GET /api/sppg/handover/{id}", middlewares.RequireAuth(http.HandlerFunc(deps.SppgHandoverCtrl.GetHandover)))
		mux.Handle("PATCH /api/sppg/handover/{id}/stage", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgHandoverCtrl.AdvanceStage)))
		mux.Handle("POST /api/sppg/handover/{id}/finish-scan", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgHandoverCtrl.FinishScan)))
		mux.Handle("POST /api/sppg/handover/{id}/reject", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgHandoverCtrl.RejectBoxes)))
		mux.Handle("POST /api/sppg/handover/{id}/replace", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgHandoverCtrl.ReplaceRejected)))
		mux.Handle("POST /api/sppg/handover/{id}/sign-bast", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgHandoverCtrl.SignBast)))
	}

	// SPPG Insiden, Respon Aduan & Karantina Batch (SPPG.md Bab 8)
	if deps.SppgIncidentCtrl != nil {
		mux.Handle("GET /api/sppg/incidents/bundle", middlewares.RequireAuth(http.HandlerFunc(deps.SppgIncidentCtrl.GetBundle)))
		mux.Handle("GET /api/sppg/incidents", middlewares.RequireAuth(http.HandlerFunc(deps.SppgIncidentCtrl.ListTickets)))
		mux.Handle("POST /api/sppg/incidents", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgIncidentCtrl.CreateTicket)))
		mux.Handle("GET /api/sppg/incidents/{id}", middlewares.RequireAuth(http.HandlerFunc(deps.SppgIncidentCtrl.GetTicket)))
		mux.Handle("POST /api/sppg/incidents/{id}/reply", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgIncidentCtrl.ReplyTicket)))
		mux.Handle("POST /api/sppg/incidents/{id}/replace", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgIncidentCtrl.ReplacePortions)))
		mux.Handle("POST /api/sppg/incidents/{id}/close", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgIncidentCtrl.CloseTicket)))
		mux.Handle("POST /api/sppg/incidents/recall", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgIncidentCtrl.RecallBatch)))
	}

	// SPPG Klaim & Penagihan Invoice ke BGN (SPPG.md Bab 9)
	if deps.SppgBillingCtrl != nil {
		mux.Handle("GET /api/sppg/billing/bundle", middlewares.RequireAuth(http.HandlerFunc(deps.SppgBillingCtrl.GetBundle)))
		mux.Handle("GET /api/sppg/billing/rows", middlewares.RequireAuth(http.HandlerFunc(deps.SppgBillingCtrl.ListRows)))
		mux.Handle("GET /api/sppg/billing/invoices", middlewares.RequireAuth(http.HandlerFunc(deps.SppgBillingCtrl.ListInvoices)))
		mux.Handle("GET /api/sppg/billing/invoices/{id}", middlewares.RequireAuth(http.HandlerFunc(deps.SppgBillingCtrl.GetInvoice)))
		mux.Handle("POST /api/sppg/billing/invoices/generate", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgBillingCtrl.GenerateInvoice)))
		mux.Handle("POST /api/sppg/billing/invoices/{id}/advance", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgBillingCtrl.AdvanceInvoice)))
		mux.Handle("POST /api/sppg/billing/invoices/{id}/notes", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgBillingCtrl.AttachNotes)))
	}

	// SPPG Sertifikasi Akreditasi, Sanitasi & Uji Lab (SPPG.md Bab 10)
	if deps.SppgComplianceCtrl != nil {
		mux.Handle("GET /api/sppg/compliance/bundle", middlewares.RequireAuth(http.HandlerFunc(deps.SppgComplianceCtrl.GetBundle)))
		mux.Handle("GET /api/sppg/compliance/docs", middlewares.RequireAuth(http.HandlerFunc(deps.SppgComplianceCtrl.ListDocs)))
		mux.Handle("POST /api/sppg/compliance/docs/renew", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgComplianceCtrl.RenewDoc)))
		mux.Handle("GET /api/sppg/compliance/handlers", middlewares.RequireAuth(http.HandlerFunc(deps.SppgComplianceCtrl.ListHandlers)))
		mux.Handle("POST /api/sppg/compliance/handlers", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgComplianceCtrl.CreateHandler)))
		mux.Handle("GET /api/sppg/compliance/labs", middlewares.RequireAuth(http.HandlerFunc(deps.SppgComplianceCtrl.ListLabs)))
		mux.Handle("POST /api/sppg/compliance/labs", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgComplianceCtrl.CreateLab)))
		mux.Handle("GET /api/sppg/compliance/audits", middlewares.RequireAuth(http.HandlerFunc(deps.SppgComplianceCtrl.ListAudits)))
		mux.Handle("POST /api/sppg/compliance/audits", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgComplianceCtrl.RequestAudit)))
	}

	// SPPG Cockpit Dashboard Operasional Terpadu (Single Pane of Glass)
	if deps.SppgDashboardCtrl != nil {
		mux.Handle("GET /api/sppg/dashboard/bundle", middlewares.RequireAuth(http.HandlerFunc(deps.SppgDashboardCtrl.GetBundle)))
		mux.Handle("POST /api/sppg/dashboard/transition", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgDashboardCtrl.TransitionStage)))
		mux.Handle("POST /api/sppg/dashboard/emergency", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgDashboardCtrl.TriggerEmergency)))
		mux.Handle("POST /api/sppg/dashboard/emergency/resolve", middlewares.RequirePermission(models.PermKitchenOps)(http.HandlerFunc(deps.SppgDashboardCtrl.ResolveEmergency)))
	}

	// Validator resource routes.
	// Baca: validators.read (superadmin, satgas, validator).
	// Tulis: validators.manage — superadmin saja, sesuai SUPERADMIN.md Bab 2.
	if deps.ValidatorCtrl != nil {
		mux.Handle("GET /api/validators", middlewares.RequirePermission(models.PermValidatorsRead)(http.HandlerFunc(deps.ValidatorCtrl.List)))
		mux.Handle("GET /api/validators/{id}", middlewares.RequirePermission(models.PermValidatorsRead)(http.HandlerFunc(deps.ValidatorCtrl.Get)))
		mux.Handle("POST /api/validators", middlewares.RequirePermission(models.PermValidatorsManage)(http.HandlerFunc(deps.ValidatorCtrl.Create)))
		mux.Handle("PATCH /api/validators/{id}", middlewares.RequirePermission(models.PermValidatorsManage)(http.HandlerFunc(deps.ValidatorCtrl.Update)))
		mux.Handle("DELETE /api/validators/{id}", middlewares.RequirePermission(models.PermValidatorsManage)(http.HandlerFunc(deps.ValidatorCtrl.Delete)))
		mux.Handle("PATCH /api/validators/{id}/credentials", middlewares.RequirePermission(models.PermValidatorsManage)(http.HandlerFunc(deps.ValidatorCtrl.UpdateCredentials)))
		mux.Handle("PATCH /api/validators/{id}/status", middlewares.RequirePermission(models.PermValidatorsManage)(http.HandlerFunc(deps.ValidatorCtrl.SetStatus)))
		mux.Handle("POST /api/validators/{id}/device/reset", middlewares.RequirePermission(models.PermValidatorsManage)(http.HandlerFunc(deps.ValidatorCtrl.ResetDevice)))
		mux.Handle("POST /api/validators/{id}/warnings", middlewares.RequirePermission(models.PermValidatorsManage)(http.HandlerFunc(deps.ValidatorCtrl.IssueWarning)))
		mux.Handle("PUT /api/validators/{id}/backup", middlewares.RequirePermission(models.PermValidatorsManage)(http.HandlerFunc(deps.ValidatorCtrl.AssignBackup)))
	}

	// Ruang Pemindaian, Serah Terima (BAST), & Eskalasi Insiden Validator (Sinkronisasi Lintas Role)
	if deps.ValidatorScanCtrl != nil {
		mux.Handle("GET /api/validator/scan/context", middlewares.RequireAuth(http.HandlerFunc(deps.ValidatorScanCtrl.GetContext)))
		mux.Handle("POST /api/validator/scan/confirm", middlewares.RequirePermission(models.PermScanSubmit)(http.HandlerFunc(deps.ValidatorScanCtrl.ConfirmDecision)))
		mux.Handle("GET /api/validator/handover/bundle", middlewares.RequireAuth(http.HandlerFunc(deps.ValidatorScanCtrl.GetHandoverBundle)))
		mux.Handle("POST /api/validator/handover/submit-bast", middlewares.RequirePermission(models.PermHandoverBast)(http.HandlerFunc(deps.ValidatorScanCtrl.SubmitBast)))
		mux.Handle("POST /api/validator/handover/reset", middlewares.RequirePermission(models.PermHandoverBast)(http.HandlerFunc(deps.ValidatorScanCtrl.ResetHandover)))
		mux.Handle("GET /api/validator/incidents", middlewares.RequireAuth(http.HandlerFunc(deps.ValidatorScanCtrl.GetIncidents)))
		mux.Handle("POST /api/validator/incidents", middlewares.RequirePermission(models.PermIncidentSubmit)(http.HandlerFunc(deps.ValidatorScanCtrl.CreateIncident)))
		mux.Handle("GET /api/validator/history/bundle", middlewares.RequireAuth(http.HandlerFunc(deps.ValidatorScanCtrl.GetHistory)))
		mux.Handle("POST /api/validator/history/surplus", middlewares.RequirePermission(models.PermAttendanceRead)(http.HandlerFunc(deps.ValidatorScanCtrl.AllocateSurplus)))
		mux.Handle("GET /api/validator/dashboard", middlewares.RequireAuth(http.HandlerFunc(deps.ValidatorScanCtrl.GetDashboard)))
	}

	// Telemetri Pengiriman Makanan & Hasil YOLOv8
	if deps.DeliveryCtrl != nil {
		mux.Handle("GET /api/deliveries", middlewares.RequirePermission(models.PermDeliveriesRead)(http.HandlerFunc(deps.DeliveryCtrl.List)))
		mux.Handle("GET /api/deliveries/{id}", middlewares.RequirePermission(models.PermDeliveriesRead)(http.HandlerFunc(deps.DeliveryCtrl.Get)))
		mux.Handle("POST /api/deliveries/{id}/override", middlewares.RequireRole(models.RoleSuperadmin)(http.HandlerFunc(deps.DeliveryCtrl.OverrideAI)))
		mux.Handle("POST /api/deliveries/{id}/lab-audit", middlewares.RequireRole(models.RoleSuperadmin)(http.HandlerFunc(deps.DeliveryCtrl.OrderLabTest)))
	}

	// Rekonsiliasi Presensi & Penerimaan Porsi Siswa MBG
	if deps.AttendanceCtrl != nil {
		mux.Handle("GET /api/attendance", middlewares.RequirePermission(models.PermAttendanceRead)(http.HandlerFunc(deps.AttendanceCtrl.List)))
		mux.Handle("GET /api/attendance/{id}", middlewares.RequirePermission(models.PermAttendanceRead)(http.HandlerFunc(deps.AttendanceCtrl.GetByID)))
		mux.Handle("PUT /api/attendance/{id}/quota", middlewares.RequirePermission(models.PermAttendanceManage)(http.HandlerFunc(deps.AttendanceCtrl.AdjustQuota)))
		mux.Handle("POST /api/attendance/{id}/redistribute", middlewares.RequirePermission(models.PermAttendanceManage)(http.HandlerFunc(deps.AttendanceCtrl.RedistributeSurplus)))
		mux.Handle("POST /api/attendance/{id}/audit", middlewares.RequirePermission(models.PermAttendanceManage)(http.HandlerFunc(deps.AttendanceCtrl.AuditDiscrepancy)))
	}

	// Master Data Sekolah Binaan & Titik Distribusi Last-Mile MBG
	if deps.SchoolCtrl != nil {
		mux.Handle("GET /api/schools", middlewares.RequirePermission(models.PermSchoolsRead)(http.HandlerFunc(deps.SchoolCtrl.List)))
		mux.Handle("GET /api/schools/{npsn}", middlewares.RequirePermission(models.PermSchoolsRead)(http.HandlerFunc(deps.SchoolCtrl.GetByNPSN)))
		mux.Handle("POST /api/schools", middlewares.RequirePermission(models.PermSchoolsManage)(http.HandlerFunc(deps.SchoolCtrl.Create)))
		mux.Handle("PUT /api/schools/{npsn}/sppg", middlewares.RequirePermission(models.PermSchoolsManage)(http.HandlerFunc(deps.SchoolCtrl.ReassignSPPG)))
		mux.Handle("PUT /api/schools/{npsn}/contacts", middlewares.RequirePermission(models.PermSchoolsManage)(http.HandlerFunc(deps.SchoolCtrl.UpdateContacts)))
		mux.Handle("PATCH /api/schools/{npsn}/status", middlewares.RequirePermission(models.PermSchoolsManage)(http.HandlerFunc(deps.SchoolCtrl.ToggleStatus)))
		mux.Handle("DELETE /api/schools/{npsn}", middlewares.RequirePermission(models.PermSchoolsManage)(http.HandlerFunc(deps.SchoolCtrl.Delete)))
	}

	// Jadwal Distribusi & Armada Cold-Chain MBG
	if deps.ScheduleCtrl != nil {
		mux.Handle("GET /api/schedules", middlewares.RequirePermission(models.PermScheduleRead)(http.HandlerFunc(deps.ScheduleCtrl.List)))
		mux.Handle("GET /api/schedules/backup-fleets", middlewares.RequirePermission(models.PermScheduleRead)(http.HandlerFunc(deps.ScheduleCtrl.GetBackupFleets)))
		mux.Handle("GET /api/schedules/{id}", middlewares.RequirePermission(models.PermScheduleRead)(http.HandlerFunc(deps.ScheduleCtrl.GetByID)))
		mux.Handle("PUT /api/schedules/{id}/reschedule", middlewares.RequirePermission(models.PermScheduleManage)(http.HandlerFunc(deps.ScheduleCtrl.Reschedule)))
		mux.Handle("POST /api/schedules/{id}/delay-alert", middlewares.RequirePermission(models.PermScheduleManage)(http.HandlerFunc(deps.ScheduleCtrl.SendDelayAlert)))
		mux.Handle("POST /api/schedules/{id}/reroute", middlewares.RequirePermission(models.PermScheduleManage)(http.HandlerFunc(deps.ScheduleCtrl.RerouteBackupFleet)))
	}

	// Notice & Broadcast resource routes.
	// Baca: notices.read (superadmin, satgas, sppg, validator, siswa).
	// Tulis: notices.publish — superadmin.
	if deps.NoticeCtrl != nil {
		mux.Handle("GET /api/notices", middlewares.RequirePermission(models.PermNoticesRead)(http.HandlerFunc(deps.NoticeCtrl.List)))
		mux.Handle("GET /api/notices/{id}", middlewares.RequirePermission(models.PermNoticesRead)(http.HandlerFunc(deps.NoticeCtrl.GetByID)))
		mux.Handle("POST /api/notices", middlewares.RequirePermission(models.PermNoticesPublish)(http.HandlerFunc(deps.NoticeCtrl.Create)))
		mux.Handle("POST /api/notices/{id}/flash-alert", middlewares.RequirePermission(models.PermNoticesPublish)(http.HandlerFunc(deps.NoticeCtrl.BroadcastFlashAlert)))
		mux.Handle("PUT /api/notices/{id}/archive", middlewares.RequirePermission(models.PermNoticesPublish)(http.HandlerFunc(deps.NoticeCtrl.ToggleArchive)))
		mux.Handle("DELETE /api/notices/{id}", middlewares.RequirePermission(models.PermNoticesPublish)(http.HandlerFunc(deps.NoticeCtrl.Delete)))
		mux.Handle("POST /api/notices/{id}/ack", middlewares.RequireAuth(http.HandlerFunc(deps.NoticeCtrl.Acknowledge)))
	}

	// Kalender Operasional MBG, Siklus Menu Nasional & Penggantian Darurat
	if deps.CalendarCtrl != nil {
		mux.Handle("GET /api/calendar", middlewares.RequirePermission(models.PermCalendarRead)(http.HandlerFunc(deps.CalendarCtrl.ListDays)))
		mux.Handle("GET /api/calendar/days/{date}", middlewares.RequirePermission(models.PermCalendarRead)(http.HandlerFunc(deps.CalendarCtrl.GetDayByDate)))
		mux.Handle("POST /api/calendar/lock-month", middlewares.RequireRole(models.RoleSuperadmin)(http.HandlerFunc(deps.CalendarCtrl.LockMonth)))
		mux.Handle("PUT /api/calendar/days/{date}/lock", middlewares.RequireRole(models.RoleSuperadmin)(http.HandlerFunc(deps.CalendarCtrl.ToggleDayLock)))
		mux.Handle("POST /api/calendar/days/{date}/blackout", middlewares.RequireRole(models.RoleSuperadmin)(http.HandlerFunc(deps.CalendarCtrl.SetBlackoutDate)))
		mux.Handle("GET /api/calendar/substitutions", middlewares.RequirePermission(models.PermCalendarRead)(http.HandlerFunc(deps.CalendarCtrl.ListSubstitutions)))
		mux.Handle("GET /api/calendar/substitutions/{id}", middlewares.RequirePermission(models.PermCalendarRead)(http.HandlerFunc(deps.CalendarCtrl.GetSubstitutionByID)))
		mux.Handle("POST /api/calendar/substitutions", middlewares.RequirePermission(models.PermCalendarManage)(http.HandlerFunc(deps.CalendarCtrl.CreateSubstitution)))
		mux.Handle("PUT /api/calendar/substitutions/{id}/review", middlewares.RequireRole(models.RoleSuperadmin)(http.HandlerFunc(deps.CalendarCtrl.ReviewSubstitution)))
		mux.Handle("POST /api/calendar/days/{date}/inspection", middlewares.RequirePermission(models.PermCalendarManage)(http.HandlerFunc(deps.CalendarCtrl.ScheduleInspection)))
		mux.Handle("GET /api/menu-packages", middlewares.RequirePermission(models.PermCalendarRead)(http.HandlerFunc(deps.CalendarCtrl.ListMenuPackages)))
	}

	// Katalog Dokumen Laporan Resmi, BAST Digital, Payment Clearance & Audit Forensik
	if deps.ReportCtrl != nil {
		mux.Handle("GET /api/reports/bundle", middlewares.RequirePermission(models.PermReportsDownload)(http.HandlerFunc(deps.ReportCtrl.GetBundle)))
		mux.Handle("GET /api/reports", middlewares.RequirePermission(models.PermReportsDownload)(http.HandlerFunc(deps.ReportCtrl.ListReports)))
		mux.Handle("GET /api/reports/stats", middlewares.RequirePermission(models.PermReportsDownload)(http.HandlerFunc(deps.ReportCtrl.GetExecutiveStats)))
		mux.Handle("POST /api/reports", middlewares.RequirePermission(models.PermReportsManage)(http.HandlerFunc(deps.ReportCtrl.CreateReport)))
		mux.Handle("GET /api/reports/basts", middlewares.RequirePermission(models.PermReportsDownload)(http.HandlerFunc(deps.ReportCtrl.ListDigitalBasts)))
		mux.Handle("GET /api/reports/basts/{id}", middlewares.RequirePermission(models.PermReportsDownload)(http.HandlerFunc(deps.ReportCtrl.GetDigitalBastByID)))
		mux.Handle("GET /api/reports/invoices", middlewares.RequirePermission(models.PermReportsDownload)(http.HandlerFunc(deps.ReportCtrl.ListVendorInvoices)))
		mux.Handle("GET /api/reports/invoices/{id}", middlewares.RequirePermission(models.PermReportsDownload)(http.HandlerFunc(deps.ReportCtrl.GetVendorInvoiceByID)))
		mux.Handle("POST /api/reports/invoices/{id}/clearance", middlewares.RequirePermission(models.PermPaymentClearance)(http.HandlerFunc(deps.ReportCtrl.AuthorizePayment)))
		mux.Handle("GET /api/reports/forensic", middlewares.RequirePermission(models.PermReportsDownload)(http.HandlerFunc(deps.ReportCtrl.ListForensicFindings)))
		mux.Handle("GET /api/reports/{id}", middlewares.RequirePermission(models.PermReportsDownload)(http.HandlerFunc(deps.ReportCtrl.GetReportByID)))
	}

	// Feedback & Emergency Kill-Switch resource routes.
	// Triage & Baca: feedback.triage (superadmin, satgas, sppg).
	// Buat aduan & tutup tiket: feedback.triage (superadmin, satgas).
	// Eksekusi Kill-Switch: killswitch (superadmin only).
	if deps.FeedbackCtrl != nil {
		mux.Handle("GET /api/feedback/bundle", middlewares.RequirePermission(models.PermFeedbackTriage)(http.HandlerFunc(deps.FeedbackCtrl.GetBundle)))
		mux.Handle("GET /api/feedback/stats", middlewares.RequirePermission(models.PermFeedbackTriage)(http.HandlerFunc(deps.FeedbackCtrl.GetStats)))
		mux.Handle("GET /api/feedback", middlewares.RequirePermission(models.PermFeedbackTriage)(http.HandlerFunc(deps.FeedbackCtrl.ListTickets)))
		mux.Handle("POST /api/feedback", middlewares.RequirePermission(models.PermFeedbackTriage)(http.HandlerFunc(deps.FeedbackCtrl.CreateTicket)))
		mux.Handle("GET /api/feedback/{id}", middlewares.RequirePermission(models.PermFeedbackTriage)(http.HandlerFunc(deps.FeedbackCtrl.GetTicketByID)))
		mux.Handle("POST /api/feedback/{id}/kill-switch", middlewares.RequirePermission(models.PermKillswitch)(http.HandlerFunc(deps.FeedbackCtrl.ExecuteKillSwitch)))
		mux.Handle("POST /api/feedback/{id}/medical", middlewares.RequirePermission(models.PermFeedbackTriage)(http.HandlerFunc(deps.FeedbackCtrl.EscalateMedical)))
		mux.Handle("POST /api/feedback/{id}/close", middlewares.RequirePermission(models.PermFeedbackTriage)(http.HandlerFunc(deps.FeedbackCtrl.CloseTicket)))
	}

	// Admin portal & live executive dashboard
	if deps.DashboardCtrl != nil {
		mux.Handle("GET /api/admin/dashboard", middlewares.RequirePermission(models.PermDashboardRead)(http.HandlerFunc(deps.DashboardCtrl.GetDashboardBundle)))
		mux.Handle("GET /api/admin/metrics", middlewares.RequirePermission(models.PermDashboardRead)(http.HandlerFunc(deps.DashboardCtrl.GetMetrics)))
	}
	mux.Handle("GET /api/admin/summary", middlewares.RequireRole(models.RoleSuperadmin)(http.HandlerFunc(adminSummary)))
	mux.Handle("GET /api/admin/audit", middlewares.RequireRole(models.RoleSuperadmin)(http.HandlerFunc(adminSummary)))

	// SPPG portal — SPPG staff and superadmin
	mux.Handle("GET /api/sppg/overview", middlewares.RequireRole(models.RoleSuperadmin, models.RoleSppg)(http.HandlerFunc(sppgOverview)))

	// Static uploads — gambar scan yang disimpan server (untuk thumbnail riwayat)
	uploadDir := "uploads"
	mux.Handle("GET /uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadDir))))

	apiLimiter := middlewares.NewRateLimiter(200, 300, time.Minute)

	handler := middlewares.Logger(
		middlewares.SecurityHeaders(deps.AppEnv)(
			middlewares.BodyLimit(10 * 1024 * 1024)( // 10MB max request body
				middlewares.CORS(deps.CORSOrigins)(
					apiLimiter.Limit()(
						deps.AuthMW(mux),
					),
				),
			),
		),
	)

	return handler
}

// adminSummary is a placeholder payload for the admin dashboard until Phase 3
func adminSummary(w http.ResponseWriter, r *http.Request) {
	utils.Success(w, http.StatusOK, "admin summary available", map[string]any{
		"role":  middlewares.Role(r.Context()),
		"actor": middlewares.UserID(r.Context()),
	})
}

// sppgOverview is a placeholder payload for the SPPG portal until Phase 3
func sppgOverview(w http.ResponseWriter, r *http.Request) {
	utils.Success(w, http.StatusOK, "sppg overview available", map[string]any{
		"role":  middlewares.Role(r.Context()),
		"actor": middlewares.UserID(r.Context()),
	})
}
