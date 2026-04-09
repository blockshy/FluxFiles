package router

import (
	"log/slog"
	"net/http"
	"time"

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
	PublicFiles *controller.PublicFileController
	AdminAuth   *controller.AdminAuthController
	AdminFiles  *controller.AdminFileController
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
		middleware.RateLimit(deps.RateLimiter, resilience.RateRule{
			Name:   "public-list",
			Limit:  deps.Config.RateLimit.ListLimit,
			Window: time.Duration(deps.Config.RateLimit.ListWindowSeconds) * time.Second,
		}),
		deps.PublicFiles.List,
	)
	api.GET("/files/:id", deps.PublicFiles.Get)
	api.GET("/files/:id/download",
		middleware.RateLimit(deps.RateLimiter, resilience.RateRule{
			Name:   "public-download",
			Limit:  deps.Config.RateLimit.DownloadLimit,
			Window: time.Duration(deps.Config.RateLimit.DownloadWindowSeconds) * time.Second,
		}),
		deps.PublicFiles.Download,
	)

	admin := api.Group("/admin")
	admin.POST("/login",
		middleware.RateLimit(deps.RateLimiter, resilience.RateRule{
			Name:   "admin-login",
			Limit:  deps.Config.RateLimit.LoginLimit,
			Window: time.Duration(deps.Config.RateLimit.LoginWindowSeconds) * time.Second,
		}),
		deps.AdminAuth.Login,
	)

	adminAuthorized := admin.Group("")
	adminAuthorized.Use(middleware.RequireAdmin(deps.AuthService))
	adminAuthorized.GET("/me", deps.AdminAuth.Me)
	adminAuthorized.GET("/stats", deps.AdminFiles.Stats)
	adminAuthorized.GET("/files",
		middleware.RateLimit(deps.RateLimiter, resilience.RateRule{
			Name:   "admin-list",
			Limit:  deps.Config.RateLimit.ListLimit,
			Window: time.Duration(deps.Config.RateLimit.ListWindowSeconds) * time.Second,
		}),
		deps.AdminFiles.List,
	)
	adminAuthorized.GET("/files/:id", deps.AdminFiles.Get)
	adminAuthorized.POST("/files/upload-prepare",
		middleware.RateLimit(deps.RateLimiter, resilience.RateRule{
			Name:   "admin-upload",
			Limit:  deps.Config.RateLimit.UploadLimit,
			Window: time.Duration(deps.Config.RateLimit.UploadWindowSeconds) * time.Second,
		}),
		deps.AdminFiles.PrepareUpload,
	)
	adminAuthorized.POST("/files",
		middleware.RateLimit(deps.RateLimiter, resilience.RateRule{
			Name:   "admin-upload",
			Limit:  deps.Config.RateLimit.UploadLimit,
			Window: time.Duration(deps.Config.RateLimit.UploadWindowSeconds) * time.Second,
		}),
		deps.AdminFiles.Create,
	)
	adminAuthorized.PUT("/files/:id", deps.AdminFiles.Update)
	adminAuthorized.DELETE("/files/:id", deps.AdminFiles.Delete)

	return engine
}
