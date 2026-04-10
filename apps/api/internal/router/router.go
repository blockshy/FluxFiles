package router

import (
	"log/slog"
	"net/http"

	"fluxfiles/api/internal/config"
	"fluxfiles/api/internal/controller"
	"fluxfiles/api/internal/middleware"
	"fluxfiles/api/internal/service"
	"fluxfiles/api/pkg/resilience"

	"github.com/gin-gonic/gin"
)

type Dependencies struct {
	Config      *config.Config
	Logger      *slog.Logger
	AuthService *service.AuthService
	UserService *service.UserService
	PublicFiles *controller.PublicFileController
	PublicAuth  *controller.PublicAuthController
	AdminAuth   *controller.AdminAuthController
	AdminFiles  *controller.AdminFileController
	AdminUsers  *controller.AdminUserController
	AdminLogs   *controller.AdminLogController
	UserFiles   *controller.UserFileController
	Settings    *service.SettingsService
	RateLimiter *resilience.RateLimiter
}

func New(deps Dependencies) *gin.Engine {
	if deps.Config.App.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	engine := gin.New()
	engine.MaxMultipartMemory = deps.Config.Security.MaxUploadSizeBytes
	_ = engine.SetTrustedProxies(deps.Config.App.TrustedProxies)

	engine.Use(middleware.RequestID())
	engine.Use(middleware.AccessLog(deps.Logger))
	engine.Use(middleware.ErrorRecovery(deps.Logger))
	engine.Use(middleware.SecurityHeaders())
	engine.Use(middleware.Blacklist(deps.Config.Security.BlacklistIPs))

	engine.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := engine.Group("/api")

	api.GET("/files",
		middleware.RateLimitFromSettings(deps.RateLimiter, deps.Settings, "public-list"),
		deps.PublicFiles.List,
	)
	api.GET("/files/:id", deps.PublicFiles.Get)
	api.GET("/files/:id/download",
		middleware.OptionalAuth(deps.AuthService),
		middleware.RateLimitFromSettings(deps.RateLimiter, deps.Settings, "public-download"),
		deps.PublicFiles.Download,
	)
	api.GET("/users/:username/profile", deps.PublicAuth.PublicProfile)

	authGroup := api.Group("/auth")
	authGroup.GET("/register-config", deps.PublicAuth.RegisterConfig)
	authGroup.GET("/captcha", deps.PublicAuth.Captcha)
	authGroup.POST("/register", deps.PublicAuth.Register)
	authGroup.POST("/login",
		middleware.RateLimitFromSettings(deps.RateLimiter, deps.Settings, "user-login"),
		deps.PublicAuth.Login,
	)

	admin := api.Group("/admin")
	admin.POST("/login",
		middleware.RateLimitFromSettings(deps.RateLimiter, deps.Settings, "admin-login"),
		deps.AdminAuth.Login,
	)

	adminAuthorized := admin.Group("")
	adminAuthorized.Use(middleware.RequireAdmin(deps.AuthService))
	adminAuthorized.GET("/me", deps.AdminAuth.Me)

	adminFiles := adminAuthorized.Group("")
	adminFiles.Use(middleware.RequireAnyPermission(
		deps.AuthService,
		service.PermissionAdminFilesOwn,
		service.PermissionAdminFilesAll,
		service.PermissionAdminFilesUpload,
		service.PermissionAdminFilesEdit,
		service.PermissionAdminFilesDelete,
	))
	adminFiles.GET("/stats", deps.AdminFiles.Stats)
	adminFiles.GET("/files",
		middleware.RateLimitFromSettings(deps.RateLimiter, deps.Settings, "admin-list"),
		deps.AdminFiles.List,
	)
	adminFiles.GET("/files/upload-settings", deps.AdminFiles.UploadSettings)
	adminFiles.GET("/files/:id", deps.AdminFiles.Get)
	adminFiles.POST("/files/upload-prepare",
		middleware.RateLimitFromSettings(deps.RateLimiter, deps.Settings, "admin-upload"),
		deps.AdminFiles.PrepareUpload,
	)
	adminFiles.POST("/files",
		middleware.RateLimitFromSettings(deps.RateLimiter, deps.Settings, "admin-upload"),
		deps.AdminFiles.Create,
	)
	adminFiles.PUT("/files/:id", deps.AdminFiles.Update)
	adminFiles.DELETE("/files/:id", deps.AdminFiles.Delete)

	adminUsers := adminAuthorized.Group("")
	adminUsers.Use(middleware.RequireAnyPermission(deps.AuthService, service.PermissionAdminUsersCreate, service.PermissionAdminUsersEdit))
	adminUsers.GET("/users", deps.AdminUsers.List)
	adminUsers.POST("/users", deps.AdminUsers.Create)
	adminUsers.PUT("/users/:id", deps.AdminUsers.Update)

	adminSettings := adminAuthorized.Group("")
	adminSettings.Use(middleware.RequirePermission(deps.AuthService, service.PermissionAdminSettings))
	adminSettings.GET("/settings", deps.AdminUsers.GetSettings)
	adminSettings.PUT("/settings/registration", deps.AdminUsers.UpdateSettings)
	adminSettings.PUT("/settings/captcha", deps.AdminUsers.UpdateCaptchaSettings)
	adminSettings.PUT("/settings/rate-limits", deps.AdminUsers.UpdateRateLimitSettings)
	adminSettings.PUT("/settings/upload", deps.AdminUsers.UpdateUploadSettings)
	adminSettings.GET("/settings/permission-templates", deps.AdminUsers.GetPermissionTemplates)
	adminSettings.PUT("/settings/permission-templates", deps.AdminUsers.UpdatePermissionTemplates)

	adminAudit := adminAuthorized.Group("")
	adminAudit.Use(middleware.RequirePermission(deps.AuthService, service.PermissionAdminAudit))
	adminAudit.GET("/logs", deps.AdminLogs.List)

	userAuthorized := api.Group("/user")
	userAuthorized.Use(middleware.RequireAuth(deps.AuthService))
	userAuthorized.GET("/me", deps.PublicAuth.Me)
	userAuthorized.PUT("/me", deps.PublicAuth.UpdateProfile)
	userAuthorized.PUT("/password", deps.PublicAuth.ChangePassword)
	userAuthorized.GET("/favorites", deps.UserFiles.ListFavorites)
	userAuthorized.POST("/favorites/:id", deps.UserFiles.AddFavorite)
	userAuthorized.DELETE("/favorites/:id", deps.UserFiles.RemoveFavorite)
	userAuthorized.GET("/downloads", deps.UserFiles.ListDownloads)

	return engine
}
