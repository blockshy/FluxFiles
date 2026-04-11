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
	Config          *config.Config
	Logger          *slog.Logger
	AuthService     *service.AuthService
	UserService     *service.UserService
	PublicFiles     *controller.PublicFileController
	PublicAuth      *controller.PublicAuthController
	AdminAuth       *controller.AdminAuthController
	AdminFiles      *controller.AdminFileController
	AdminDownloads  *controller.AdminDownloadController
	AdminTaxonomies *controller.AdminTaxonomyController
	AdminUsers      *controller.AdminUserController
	AdminLogs       *controller.AdminLogController
	UserFiles       *controller.UserFileController
	PublicComments  *controller.PublicInteractionController
	UserActions     *controller.UserInteractionController
	PublicCommunity *controller.PublicCommunityController
	UserCommunity   *controller.UserCommunityController
	AdminCommunity  *controller.AdminCommunityController
	Settings        *service.SettingsService
	RateLimiter     *resilience.RateLimiter
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
		middleware.OptionalAuth(deps.AuthService),
		middleware.RateLimitFromSettings(deps.RateLimiter, deps.Settings, "public-list"),
		deps.PublicFiles.List,
	)
	api.GET("/files/categories/options", deps.PublicFiles.CategoryOptions)
	api.GET("/files/tags/options", deps.PublicFiles.TagOptions)
	api.GET("/files/download-config", deps.PublicFiles.DownloadConfig)
	api.GET("/files/:id", deps.PublicFiles.Get)
	api.GET("/files/:id/comments",
		middleware.OptionalAuth(deps.AuthService),
		deps.PublicComments.ListComments,
	)
	api.GET("/community/posts",
		middleware.OptionalAuth(deps.AuthService),
		deps.PublicCommunity.ListPosts,
	)
	api.GET("/community/posts/:id",
		middleware.OptionalAuth(deps.AuthService),
		deps.PublicCommunity.GetPost,
	)
	api.GET("/community/posts/:id/replies",
		middleware.OptionalAuth(deps.AuthService),
		deps.PublicCommunity.ListReplies,
	)
	api.GET("/files/:id/download",
		middleware.OptionalAuth(deps.AuthService),
		middleware.RateLimitFromSettings(deps.RateLimiter, deps.Settings, "public-download"),
		deps.PublicFiles.Download,
	)
	api.GET("/users/:username/profile",
		middleware.RequireAuth(deps.AuthService),
		deps.PublicAuth.PublicProfile,
	)

	authGroup := api.Group("/auth")
	authGroup.GET("/register-config", deps.PublicAuth.RegisterConfig)
	authGroup.GET("/captcha", deps.PublicAuth.Captcha)
	authGroup.POST("/register", deps.PublicAuth.Register)
	authGroup.POST("/login",
		middleware.OptionalAuth(deps.AuthService),
		middleware.RateLimitFromSettings(deps.RateLimiter, deps.Settings, "user-login"),
		deps.PublicAuth.Login,
	)

	admin := api.Group("/admin")
	admin.POST("/login",
		middleware.OptionalAuth(deps.AuthService),
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

	adminDownloads := adminAuthorized.Group("")
	adminDownloads.Use(middleware.RequireAnyPermission(deps.AuthService, service.PermissionAdminDownloadsView))
	adminDownloads.GET("/downloads", deps.AdminDownloads.List)
	adminDownloads.GET("/files/:id/downloads", deps.AdminDownloads.ListForFile)

	adminUsers := adminAuthorized.Group("")
	adminUsers.Use(middleware.RequireAnyPermission(deps.AuthService, service.PermissionAdminUsersCreate, service.PermissionAdminUsersEdit))
	adminUsers.GET("/users", deps.AdminUsers.List)
	adminUsers.POST("/users", deps.AdminUsers.Create)
	adminUsers.PUT("/users/:id", deps.AdminUsers.Update)
	adminUsers.PUT("/users/:id/enabled", deps.AdminUsers.UpdateEnabled)
	adminUsers.DELETE("/users/:id", deps.AdminUsers.Delete)

	adminCategories := adminAuthorized.Group("/categories")
	adminCategories.Use(middleware.RequireAnyPermission(
		deps.AuthService,
		service.PermissionAdminFilesOwn,
		service.PermissionAdminFilesAll,
		service.PermissionAdminFilesUpload,
		service.PermissionAdminFilesEdit,
		service.PermissionAdminCategoriesView,
		service.PermissionAdminCategoriesCreate,
		service.PermissionAdminCategoriesEdit,
		service.PermissionAdminCategoriesDelete,
		service.PermissionAdminCategoriesLogs,
	))
	adminCategories.GET("", deps.AdminTaxonomies.ListCategories)
	adminCategories.GET("/options", deps.AdminTaxonomies.CategoryOptions)
	adminCategories.POST("", deps.AdminTaxonomies.CreateCategory)
	adminCategories.PUT("/:id", deps.AdminTaxonomies.UpdateCategory)
	adminCategories.POST("/:id/move", deps.AdminTaxonomies.MoveCategory)
	adminCategories.DELETE("/:id", deps.AdminTaxonomies.DeleteCategory)
	adminCategories.GET("/:id/logs", deps.AdminTaxonomies.CategoryLogs)

	adminTags := adminAuthorized.Group("/tags")
	adminTags.Use(middleware.RequireAnyPermission(
		deps.AuthService,
		service.PermissionAdminFilesOwn,
		service.PermissionAdminFilesAll,
		service.PermissionAdminFilesUpload,
		service.PermissionAdminFilesEdit,
		service.PermissionAdminTagsView,
		service.PermissionAdminTagsCreate,
		service.PermissionAdminTagsEdit,
		service.PermissionAdminTagsDelete,
		service.PermissionAdminTagsLogs,
	))
	adminTags.GET("", deps.AdminTaxonomies.ListTags)
	adminTags.GET("/options", deps.AdminTaxonomies.TagOptions)
	adminTags.POST("", deps.AdminTaxonomies.CreateTag)
	adminTags.PUT("/:id", deps.AdminTaxonomies.UpdateTag)
	adminTags.POST("/:id/move", deps.AdminTaxonomies.MoveTag)
	adminTags.DELETE("/:id", deps.AdminTaxonomies.DeleteTag)
	adminTags.GET("/:id/logs", deps.AdminTaxonomies.TagLogs)

	adminSettings := adminAuthorized.Group("")
	adminSettings.Use(middleware.RequirePermission(deps.AuthService, service.PermissionAdminSettings))
	adminSettings.GET("/settings", deps.AdminUsers.GetSettings)
	adminSettings.PUT("/settings/registration", deps.AdminUsers.UpdateSettings)
	adminSettings.PUT("/settings/guest-download", deps.AdminUsers.UpdateGuestDownloadSettings)
	adminSettings.PUT("/settings/download", deps.AdminUsers.UpdateDownloadSettings)
	adminSettings.PUT("/settings/captcha", deps.AdminUsers.UpdateCaptchaSettings)
	adminSettings.PUT("/settings/rate-limits", deps.AdminUsers.UpdateRateLimitSettings)
	adminSettings.PUT("/settings/upload", deps.AdminUsers.UpdateUploadSettings)
	adminSettings.GET("/settings/permission-templates", deps.AdminUsers.GetPermissionTemplates)
	adminSettings.PUT("/settings/permission-templates", deps.AdminUsers.UpdatePermissionTemplates)

	adminAudit := adminAuthorized.Group("")
	adminAudit.Use(middleware.RequirePermission(deps.AuthService, service.PermissionAdminAudit))
	adminAudit.GET("/logs", deps.AdminLogs.List)

	adminCommunity := adminAuthorized.Group("/community")
	adminCommunity.Use(middleware.RequireAnyPermission(deps.AuthService, service.PermissionAdminCommunityView, service.PermissionAdminCommunityModerate))
	adminCommunity.GET("/posts", deps.AdminCommunity.ListPosts)
	adminCommunity.POST("/posts/:id/moderate",
		middleware.RequirePermission(deps.AuthService, service.PermissionAdminCommunityModerate),
		deps.AdminCommunity.ModeratePost,
	)

	userAuthorized := api.Group("/user")
	userAuthorized.Use(middleware.RequireAuth(deps.AuthService))
	userAuthorized.GET("/me", deps.PublicAuth.Me)
	userAuthorized.PUT("/me", deps.PublicAuth.UpdateProfile)
	userAuthorized.PUT("/password", deps.PublicAuth.ChangePassword)
	userAuthorized.GET("/favorites", deps.UserFiles.ListFavorites)
	userAuthorized.POST("/favorites/:id", deps.UserFiles.AddFavorite)
	userAuthorized.DELETE("/favorites/:id", deps.UserFiles.RemoveFavorite)
	userAuthorized.GET("/downloads", deps.UserFiles.ListDownloads)
	userAuthorized.POST("/files/:id/comments", deps.UserActions.CreateComment)
	userAuthorized.DELETE("/comments/:id", deps.UserActions.DeleteComment)
	userAuthorized.POST("/comments/:id/vote", deps.UserActions.VoteComment)
	userAuthorized.GET("/comments/mine", deps.UserActions.ListMyComments)
	userAuthorized.GET("/notifications", deps.UserActions.ListNotifications)
	userAuthorized.POST("/notifications/read-all", deps.UserActions.MarkNotificationsRead)
	userAuthorized.POST("/notifications/:id/read", deps.UserActions.MarkNotificationRead)
	userAuthorized.POST("/community/posts", deps.UserCommunity.CreatePost)
	userAuthorized.PUT("/community/posts/:id", deps.UserCommunity.UpdatePost)
	userAuthorized.DELETE("/community/posts/:id", deps.UserCommunity.DeletePost)
	userAuthorized.POST("/community/posts/:id/replies", deps.UserCommunity.CreateReply)
	userAuthorized.DELETE("/community/replies/:id", deps.UserCommunity.DeleteReply)

	return engine
}
