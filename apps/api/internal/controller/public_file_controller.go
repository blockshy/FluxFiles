package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"fluxfiles/api/internal/repository"
	"fluxfiles/api/internal/service"
	"fluxfiles/api/pkg/response"

	"github.com/gin-gonic/gin"
)

type PublicFileController struct {
	files      *service.FileService
	users      *service.UserService
	taxonomies *service.TaxonomyService
	settings   *service.SettingsService
	captcha    *service.CaptchaService
}

func NewPublicFileController(files *service.FileService, users *service.UserService, taxonomies *service.TaxonomyService, settings *service.SettingsService, captcha *service.CaptchaService) *PublicFileController {
	return &PublicFileController{files: files, users: users, taxonomies: taxonomies, settings: settings, captcha: captcha}
}

func (ctl *PublicFileController) List(c *gin.Context) {
	params := repository.FileListParams{
		Page:       parseInt(c.DefaultQuery("page", "1"), 1),
		PageSize:   parseInt(c.DefaultQuery("pageSize", "10"), 10),
		Search:     c.Query("search"),
		Categories: splitCSVQuery(c.Query("categories")),
		Tags:       splitCSVQuery(c.Query("tags")),
		SortBy:     c.DefaultQuery("sortBy", "createdAt"),
		SortOrder:  c.DefaultQuery("sortOrder", "desc"),
		PublicOnly: true,
	}

	items, total, err := ctl.files.ListPublic(c.Request.Context(), params)
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "file service is temporarily unavailable")
		return
	}

	response.Paginated(c, "ok", items, params.Page, params.PageSize, total)
}

func (ctl *PublicFileController) CategoryOptions(c *gin.Context) {
	if ctl.taxonomies == nil {
		response.Error(c, http.StatusServiceUnavailable, "taxonomy service is temporarily unavailable")
		return
	}
	items, err := ctl.taxonomies.ListOptions(c.Request.Context(), repository.TaxonomyKindCategory)
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "taxonomy service is temporarily unavailable")
		return
	}
	response.Success(c, http.StatusOK, "ok", gin.H{"items": items})
}

func (ctl *PublicFileController) TagOptions(c *gin.Context) {
	if ctl.taxonomies == nil {
		response.Error(c, http.StatusServiceUnavailable, "taxonomy service is temporarily unavailable")
		return
	}
	items, err := ctl.taxonomies.ListOptions(c.Request.Context(), repository.TaxonomyKindTag)
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "taxonomy service is temporarily unavailable")
		return
	}
	response.Success(c, http.StatusOK, "ok", gin.H{"items": items})
}

func (ctl *PublicFileController) DownloadConfig(c *gin.Context) {
	settings, err := ctl.settings.GetDownloadSettings(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}
	response.Success(c, http.StatusOK, "ok", gin.H{
		"captchaEnabled":       settings.CaptchaEnabled,
		"guestDownloadAllowed": settings.GuestDownloadAllowed,
	})
}

func (ctl *PublicFileController) ListDisplayConfig(c *gin.Context) {
	settings, err := ctl.settings.GetFileListDisplaySettings(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}
	response.Success(c, http.StatusOK, "ok", settings)
}

func (ctl *PublicFileController) SiteContentConfig(c *gin.Context) {
	settings, err := ctl.settings.GetSiteContentSettings(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}
	response.Success(c, http.StatusOK, "ok", settings)
}

func (ctl *PublicFileController) Get(c *gin.Context) {
	file, err := ctl.files.GetPublic(c.Request.Context(), parseUintParam(c, "id"))
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			response.Error(c, http.StatusNotFound, "file not found")
			return
		}
		response.Error(c, http.StatusServiceUnavailable, "file service is temporarily unavailable")
		return
	}

	response.Success(c, http.StatusOK, "ok", file)
}

func (ctl *PublicFileController) Download(c *gin.Context) {
	fileID := parseUintParam(c, "id")
	userID := c.GetUint("userID")
	settings, settingsErr := ctl.settings.GetDownloadSettings(c.Request.Context())
	if settingsErr != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}
	if userID == 0 && !settings.GuestDownloadAllowed {
		response.Error(c, http.StatusForbidden, "guest downloads are disabled")
		return
	}
	if settings.CaptchaEnabled {
		ok, verifyErr := ctl.captcha.Verify(c.Request.Context(), c.Query("captchaId"), c.Query("captchaAnswer"))
		if verifyErr != nil {
			response.Error(c, http.StatusServiceUnavailable, "captcha service is temporarily unavailable")
			return
		}
		if !ok {
			response.Error(c, http.StatusBadRequest, "captcha verification failed")
			return
		}
	}
	result, err := ctl.files.GenerateDownload(c.Request.Context(), fileID, userID > 0)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "file not found")
		case errors.Is(err, service.ErrForbidden):
			response.Error(c, http.StatusForbidden, "guest downloads are disabled")
		case errors.Is(err, service.ErrDependencyUnavailable):
			response.Error(c, http.StatusServiceUnavailable, "download service is temporarily unavailable")
		default:
			response.Error(c, http.StatusInternalServerError, "failed to create download link")
		}
		return
	}

	if ctl.users != nil {
		var recordUserID *uint
		if userID > 0 {
			recordUserID = &userID
		}
		_ = ctl.users.RecordDownload(c.Request.Context(), service.RecordDownloadInput{
			UserID:    recordUserID,
			FileID:    fileID,
			IP:        c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
		})
	}

	response.Success(c, http.StatusOK, "download url generated", result)
}

func parseInt(value string, fallback int) int {
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func parseUintParam(c *gin.Context, key string) uint {
	value, _ := strconv.ParseUint(c.Param(key), 10, 64)
	return uint(value)
}

func splitCSVQuery(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, item := range parts {
		if trimmed := strings.TrimSpace(item); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	if len(result) == 0 {
		return nil
	}
	return result
}
