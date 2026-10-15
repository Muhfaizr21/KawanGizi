package main

import (
	"backend/config"
	"backend/controllers"
	"backend/database"
	_ "backend/docs"
	"backend/middlewares"
	"backend/repositories"
	"backend/routes"
	"backend/services"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

// @title           MBG Backend API
// @version         1.0
// @description     RESTful API Service built with Golang, Clean Code, and SOLID principles.
// @termsOfService  http://swagger.io/terms/

// @contact.name   API Support
// @contact.url    http://localhost:8080
// @contact.email  support@example.com

// @license.name  MIT
// @license.url   https://opensource.org/licenses/MIT

// @host      localhost:8080
// @BasePath  /
func main() {
	// 1. Load Configurations & Validate Security Posture
	cfg := config.LoadConfig()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("Security posture validation failed: %v\n", err)
	}

	bootCtx, bootCancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer bootCancel()

	// 2. Connect database (PostgreSQL) + migrate + seed demo accounts
	if err := database.Connect(bootCtx, cfg); err != nil {
		log.Fatalf("Database connection failed: %v\n", err)
	}
	defer database.Close()

	if err := database.Migrate(bootCtx); err != nil {
		log.Fatalf("Migration failed: %v\n", err)
	}
	if err := database.MigrateExtended(bootCtx); err != nil {
		log.Fatalf("Extended migration failed: %v\n", err)
	}
	if err := database.Seed(bootCtx); err != nil {
		log.Fatalf("Seed failed: %v\n", err)
	}
	if err := database.SeedExtended(bootCtx); err != nil {
		log.Fatalf("Extended seed failed: %v\n", err)
	}
	if err := database.SeedNutrition(bootCtx, cfg.NutritionDataPath); err != nil {
		log.Fatalf("Seed nutrition failed: %v\n", err)
	}
	if err := database.SeedValidatorDemo(bootCtx); err != nil {
		log.Fatalf("Seed validator demo failed: %v\n", err)
	}

	// 3. Initialize Repositories (Data Access Layer)
	itemRepo := repositories.NewInMemoryItemRepository()
	userRepo := repositories.NewUserRepository()
	scanRepo := repositories.NewScanRepository()
	nutritionRepo := repositories.NewNutritionRepository()
	portalRepo := repositories.NewPortalRepository()
	validatorRepo := repositories.NewValidatorRepository()
	sppgRepo := repositories.NewSppgRepository()
	sppgAccountRepo := repositories.NewSppgAccountRepository()
	deliveryRepo := repositories.NewDeliveryRepository()
	attendanceRepo := repositories.NewAttendanceRepository(database.Pool())
	schoolRepo := repositories.NewSchoolRepository(database.Pool())
	scheduleRepo := repositories.NewScheduleRepository(database.Pool())
	noticeRepo := repositories.NewNoticeRepository(database.Pool())
	calendarRepo := repositories.NewCalendarRepository(database.Pool())
	reportRepo := repositories.NewReportRepository(database.Pool())
	feedbackRepo := repositories.NewPostgresFeedbackRepository(database.Pool())
	dashboardRepo := repositories.NewDashboardRepository(database.Pool())
	sppgRecipeRepo := repositories.NewSppgRecipeRepository()
	sppgBatchRepo := repositories.NewSppgBatchRepository()
	sppgQualityRepo := repositories.NewSppgQualityRepository()
	sppgLogisticsRepo := repositories.NewSppgLogisticsRepository()
	sppgSchoolRepo := repositories.NewSppgSchoolRepository()
	sppgHandoverRepo := repositories.NewSppgHandoverRepository()
	sppgIncidentRepo := repositories.NewSppgIncidentRepository()
	sppgBillingRepo := repositories.NewSppgBillingRepository()
	sppgComplianceRepo := repositories.NewSppgComplianceRepository()
	sppgDashboardRepo := repositories.NewSppgDashboardRepository()
	validatorScanRepo := repositories.NewValidatorScanRepository()

	// 4. Initialize Services (Business Logic Layer - Dependency Inversion)
	itemService := services.NewItemService(itemRepo)
	authService := services.NewAuthService(
		userRepo,
		cfg.JWTSecret,
		time.Duration(cfg.JWTAccessTTLMinutes)*time.Minute,
		time.Duration(cfg.JWTRefreshTTLHours)*time.Hour,
	)
	nutritionService := services.NewNutritionService(nutritionRepo)
	scanService := services.NewScanService(scanRepo, cfg.AIBackendURL, nutritionService)
	portalService := services.NewPortalService(portalRepo)
	validatorService := services.NewValidatorService(validatorRepo)
	sppgService := services.NewSppgService(sppgRepo)
	sppgAccountService := services.NewSppgAccountService(sppgAccountRepo)
	deliveryService := services.NewDeliveryService(deliveryRepo)
	attendanceService := services.NewAttendanceService(attendanceRepo)
	schoolService := services.NewSchoolService(schoolRepo)
	scheduleService := services.NewScheduleService(scheduleRepo)
	noticeService := services.NewNoticeService(noticeRepo)
	calendarService := services.NewCalendarService(calendarRepo)
	reportService := services.NewReportService(reportRepo)
	feedbackService := services.NewFeedbackService(feedbackRepo)
	dashboardService := services.NewDashboardService(dashboardRepo)
	sppgRecipeService := services.NewSppgRecipeService(sppgRecipeRepo)
	sppgBatchService := services.NewSppgBatchService(sppgBatchRepo)
	sppgQualityService := services.NewSppgQualityService(sppgQualityRepo)
	sppgLogisticsService := services.NewSppgLogisticsService(sppgLogisticsRepo)
	sppgSchoolService := services.NewSppgSchoolService(sppgSchoolRepo)
	sppgHandoverService := services.NewSppgHandoverService(sppgHandoverRepo)
	sppgIncidentService := services.NewSppgIncidentService(sppgIncidentRepo)
	sppgBillingService := services.NewSppgBillingService(sppgBillingRepo)
	sppgComplianceService := services.NewSppgComplianceService(sppgComplianceRepo)
	sppgDashboardService := services.NewSppgDashboardService(sppgDashboardRepo)
	validatorScanService := services.NewValidatorScanService(validatorScanRepo)

	// 5. Initialize Controllers (Presentation / HTTP Layer)
	healthCtrl := controllers.NewHealthController(controllers.LandingPage{
		AppEnv: cfg.AppEnv,
		Port:   cfg.Port,
		AIURL:  cfg.AIBackendURL,
		WebURL: cfg.WebClientURL,
	})
	itemCtrl := controllers.NewItemController(itemService)
	authCtrl := controllers.NewAuthController(authService)
	scanCtrl := controllers.NewScanController(scanService)
	nutritionCtrl := controllers.NewNutritionController(nutritionService)
	portalCtrl := controllers.NewPortalController(portalService)
	validatorCtrl := controllers.NewValidatorController(validatorService)
	validatorScanCtrl := controllers.NewValidatorScanController(validatorScanService)
	sppgCtrl := controllers.NewSppgController(sppgService)
	sppgAccountCtrl := controllers.NewSppgAccountController(sppgAccountService)
	deliveryCtrl := controllers.NewDeliveryController(deliveryService)
	attendanceCtrl := controllers.NewAttendanceController(attendanceService)
	schoolCtrl := controllers.NewSchoolController(schoolService)
	scheduleCtrl := controllers.NewScheduleController(scheduleService)
	noticeCtrl := controllers.NewNoticeController(noticeService)
	calendarCtrl := controllers.NewCalendarController(calendarService)
	reportCtrl := controllers.NewReportController(reportService)
	feedbackCtrl := controllers.NewFeedbackController(feedbackService)
	dashboardCtrl := controllers.NewDashboardController(dashboardService)
	sppgRecipeCtrl := controllers.NewSppgRecipeController(sppgRecipeService)
	sppgBatchCtrl := controllers.NewSppgBatchController(sppgBatchService)
	sppgQualityCtrl := controllers.NewSppgQualityController(sppgQualityService)
	sppgLogisticsCtrl := controllers.NewSppgLogisticsController(sppgLogisticsService)
	sppgSchoolCtrl := controllers.NewSppgSchoolController(sppgSchoolService)
	sppgHandoverCtrl := controllers.NewSppgHandoverController(sppgHandoverService)
	sppgIncidentCtrl := controllers.NewSppgIncidentController(sppgIncidentService)
	sppgBillingCtrl := controllers.NewSppgBillingController(sppgBillingService)
	sppgComplianceCtrl := controllers.NewSppgComplianceController(sppgComplianceService)
	sppgDashboardCtrl := controllers.NewSppgDashboardController(sppgDashboardService)

	// 6. Initialize Routes & Middlewares
	routerDeps := routes.RouterDependencies{
		HealthCtrl:         healthCtrl,
		ItemCtrl:           itemCtrl,
		AuthCtrl:           authCtrl,
		ScanCtrl:           scanCtrl,
		NutritionCtrl:      nutritionCtrl,
		PortalCtrl:         portalCtrl,
		ValidatorCtrl:      validatorCtrl,
		SppgCtrl:           sppgCtrl,
		SppgAccountCtrl:    sppgAccountCtrl,
		DeliveryCtrl:       deliveryCtrl,
		AttendanceCtrl:     attendanceCtrl,
		SchoolCtrl:         schoolCtrl,
		ScheduleCtrl:       scheduleCtrl,
		NoticeCtrl:         noticeCtrl,
		CalendarCtrl:       calendarCtrl,
		ReportCtrl:         reportCtrl,
		FeedbackCtrl:       feedbackCtrl,
		DashboardCtrl:      dashboardCtrl,
		SppgRecipeCtrl:     sppgRecipeCtrl,
		SppgBatchCtrl:      sppgBatchCtrl,
		SppgQualityCtrl:    sppgQualityCtrl,
		SppgLogisticsCtrl:  sppgLogisticsCtrl,
		SppgSchoolCtrl:     sppgSchoolCtrl,
		SppgHandoverCtrl:   sppgHandoverCtrl,
		SppgIncidentCtrl:   sppgIncidentCtrl,
		SppgBillingCtrl:    sppgBillingCtrl,
		SppgComplianceCtrl: sppgComplianceCtrl,
		SppgDashboardCtrl:  sppgDashboardCtrl,
		ValidatorScanCtrl:  validatorScanCtrl,
		AuthMW:             middlewares.Auth(authService),
		CORSOrigins:        cfg.CORSOrigins,
		AppEnv:             cfg.AppEnv,
	}
	handler := routes.SetupRoutes(routerDeps)

	// 7. Setup HTTP Server
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      handler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// 8. Start Server in Goroutine
	go func() {
		fmt.Printf("🚀 Backend running at http://localhost:%s (env: %s)\n", cfg.Port, cfg.AppEnv)
		fmt.Printf("📖 Swagger UI available at http://localhost:%s/swagger/index.html\n", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server startup failed: %v\n", err)
		}
	}()

	// 9. Graceful Shutdown on SIGINT / SIGTERM
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v\n", err)
	}

	log.Println("Server exited successfully.")
}
