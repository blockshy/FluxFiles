package app

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"fluxfiles/api/internal/config"
	"fluxfiles/api/internal/controller"
	"fluxfiles/api/internal/repository"
	"fluxfiles/api/internal/router"
	"fluxfiles/api/internal/service"
	"fluxfiles/api/pkg/auth"
	"fluxfiles/api/pkg/logger"
	ossclient "fluxfiles/api/pkg/oss"
	"fluxfiles/api/pkg/resilience"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type App struct {
	Config *config.Config
	Logger *slog.Logger
	DB     *gorm.DB
	Redis  *redis.Client
	HTTP   *http.Server
	Router *gin.Engine
}

func New() (*App, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, err
	}

	log := logger.New(cfg.App.Env)

	db, err := gorm.Open(postgres.Open(cfg.DatabaseDSN()), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("connect database: %w", err)
	}

	redisClient := redis.NewClient(&redis.Options{
		Addr:         cfg.Redis.Addr,
		Password:     cfg.Redis.Password,
		DB:           cfg.Redis.DB,
		ReadTimeout:  2 * time.Second,
		WriteTimeout: 2 * time.Second,
	})

	if err := redisClient.Ping(context.Background()).Err(); err != nil {
		log.Warn("redis unavailable, degraded mode enabled", "error", err)
		redisClient = nil
	}

	storage, err := ossclient.New(cfg.Storage)
	if err != nil {
		return nil, fmt.Errorf("init oss client: %w", err)
	}

	breakers := resilience.NewBreakers(log)
	rateLimiter := resilience.NewRateLimiter(redisClient, log, cfg.Redis.Prefix)
	jwtManager := auth.NewJWTManager(cfg.Security.JWTSecret, cfg.Security.JWTExpireHours)

	userRepo := repository.NewUserRepository(db)
	fileRepo := repository.NewFileRepository(db)
	logRepo := repository.NewOperationLogRepository(db)
	userLibraryRepo := repository.NewUserLibraryRepository(db)
	settingsRepo := repository.NewSystemSettingRepository(db)

	logService := service.NewOperationLogService(logRepo)
	authService := service.NewAuthService(cfg.Security, userRepo, redisClient, jwtManager)
	settingsService := service.NewSettingsService(settingsRepo, cfg.RateLimit, cfg.Security)
	captchaService := service.NewCaptchaService(redisClient, cfg.Redis.Prefix)
	userService := service.NewUserService(userRepo, userLibraryRepo, fileRepo)
	adminService := service.NewAdminService(userRepo, settingsService, logService)
	fileService := service.NewFileService(cfg, fileRepo, storage, breakers, logService, settingsService)

	if err := authService.EnsureBootstrapAdmin(context.Background()); err != nil {
		return nil, fmt.Errorf("bootstrap admin: %w", err)
	}

	httpRouter := router.New(router.Dependencies{
		Config:      cfg,
		Logger:      log,
		AuthService: authService,
		UserService: userService,
		PublicFiles: controller.NewPublicFileController(fileService, userService),
		PublicAuth:  controller.NewPublicAuthController(authService, userService, settingsService, captchaService),
		AdminAuth:   controller.NewAdminAuthController(authService),
		AdminFiles:  controller.NewAdminFileController(fileService),
		AdminUsers:  controller.NewAdminUserController(adminService),
		AdminLogs:   controller.NewAdminLogController(logService),
		UserFiles:   controller.NewUserFileController(userService),
		Settings:    settingsService,
		RateLimiter: rateLimiter,
	})

	server := &http.Server{
		Addr:              cfg.Address(),
		Handler:           httpRouter,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	return &App{
		Config: cfg,
		Logger: log,
		DB:     db,
		Redis:  redisClient,
		HTTP:   server,
		Router: httpRouter,
	}, nil
}

func (a *App) Run() error {
	a.Logger.Info("starting server", "address", a.Config.Address(), "env", a.Config.App.Env)
	return a.HTTP.ListenAndServe()
}

func (a *App) Shutdown(ctx context.Context) error {
	if a.Redis != nil {
		_ = a.Redis.Close()
	}

	sqlDB, err := a.DB.DB()
	if err == nil {
		_ = sqlDB.Close()
	}

	return a.HTTP.Shutdown(ctx)
}
