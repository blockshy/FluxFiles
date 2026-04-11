package controller

import (
	"errors"
	"net/http"

	"fluxfiles/api/internal/dto"
	"fluxfiles/api/internal/service"
	"fluxfiles/api/pkg/response"

	"github.com/gin-gonic/gin"
)

type AdminUserController struct {
	admins *service.AdminService
}

func NewAdminUserController(admins *service.AdminService) *AdminUserController {
	return &AdminUserController{admins: admins}
}

func (ctl *AdminUserController) List(c *gin.Context) {
	result, err := ctl.admins.ListUsers(c.Request.Context(), service.ListManagedUsersInput{
		Page:     parseInt(c.DefaultQuery("page", "1"), 1),
		PageSize: parseInt(c.DefaultQuery("pageSize", "20"), 20),
		Search:   c.Query("search"),
	})
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "user service is temporarily unavailable")
		return
	}

	response.Success(c, http.StatusOK, "ok", gin.H{
		"items": result.Items,
		"pagination": gin.H{
			"page":       result.Page,
			"pageSize":   result.PageSize,
			"total":      result.Total,
			"totalPages": result.TotalPages,
		},
	})
}

func (ctl *AdminUserController) Create(c *gin.Context) {
	if !service.HasPermission(currentPermissions(c), service.PermissionAdminUsersCreate) {
		response.Error(c, http.StatusForbidden, "insufficient permissions")
		return
	}

	var req dto.CreateManagedUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid user payload")
		return
	}

	user, err := ctl.admins.CreateUser(c.Request.Context(), c.GetUint("adminUserID"), c.ClientIP(), service.CreateManagedUserInput{
		Username:    req.Username,
		Email:       req.Email,
		DisplayName: req.DisplayName,
		Password:    req.Password,
		Role:        req.Role,
		Permissions: req.Permissions,
		IsEnabled:   req.IsEnabled,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, err.Error())
		default:
			response.Error(c, http.StatusServiceUnavailable, "user service is temporarily unavailable")
		}
		return
	}

	response.Success(c, http.StatusCreated, "user created", user)
}

func (ctl *AdminUserController) Update(c *gin.Context) {
	if !service.HasPermission(currentPermissions(c), service.PermissionAdminUsersEdit) {
		response.Error(c, http.StatusForbidden, "insufficient permissions")
		return
	}

	var req dto.UpdateManagedUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid user payload")
		return
	}

	user, err := ctl.admins.UpdateUser(c.Request.Context(), c.GetUint("adminUserID"), parseUintParam(c, "id"), c.ClientIP(), service.UpdateManagedUserInput{
		Email:       req.Email,
		DisplayName: req.DisplayName,
		Role:        req.Role,
		Permissions: req.Permissions,
		IsEnabled:   req.IsEnabled,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "user not found")
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, err.Error())
		default:
			response.Error(c, http.StatusServiceUnavailable, "user service is temporarily unavailable")
		}
		return
	}

	response.Success(c, http.StatusOK, "user updated", user)
}

func (ctl *AdminUserController) UpdateEnabled(c *gin.Context) {
	if !service.HasPermission(currentPermissions(c), service.PermissionAdminUsersEdit) {
		response.Error(c, http.StatusForbidden, "insufficient permissions")
		return
	}

	var req dto.UpdateUserEnabledRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid user payload")
		return
	}

	user, err := ctl.admins.SetUserEnabled(c.Request.Context(), c.GetUint("adminUserID"), parseUintParam(c, "id"), c.ClientIP(), req.IsEnabled)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "user not found")
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, err.Error())
		default:
			response.Error(c, http.StatusServiceUnavailable, "user service is temporarily unavailable")
		}
		return
	}

	response.Success(c, http.StatusOK, "user updated", user)
}

func (ctl *AdminUserController) Delete(c *gin.Context) {
	if !service.HasPermission(currentPermissions(c), service.PermissionAdminUsersEdit) {
		response.Error(c, http.StatusForbidden, "insufficient permissions")
		return
	}

	if err := ctl.admins.DeleteUser(c.Request.Context(), c.GetUint("adminUserID"), parseUintParam(c, "id"), c.ClientIP()); err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "user not found")
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, err.Error())
		default:
			response.Error(c, http.StatusServiceUnavailable, "user service is temporarily unavailable")
		}
		return
	}

	response.Success(c, http.StatusOK, "user deleted", nil)
}

func (ctl *AdminUserController) GetSettings(c *gin.Context) {
	enabled, err := ctl.admins.GetRegistrationSettings(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}
	guestDownloadAllowed, err := ctl.admins.GetGuestDownloadAllowed(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}
	downloadSettings, err := ctl.admins.GetDownloadSettings(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}
	captcha, err := ctl.admins.GetCaptchaSettings(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}
	rateLimits, err := ctl.admins.GetRateLimitSettings(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}
	uploadSettings, err := ctl.admins.GetUploadSettings(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}
	fileListDisplay, err := ctl.admins.GetFileListDisplaySettings(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}

	response.Success(c, http.StatusOK, "ok", gin.H{
		"registrationEnabled":  enabled,
		"guestDownloadAllowed": guestDownloadAllowed,
		"downloadSettings":     downloadSettings,
		"captcha":              captcha,
		"rateLimits":           rateLimits,
		"uploadSettings":       uploadSettings,
		"fileListDisplay":      fileListDisplay,
	})
}

func (ctl *AdminUserController) UpdateDownloadSettings(c *gin.Context) {
	var req dto.UpdateDownloadSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid download settings payload")
		return
	}

	settings, err := ctl.admins.UpdateDownloadSettings(c.Request.Context(), c.GetUint("adminUserID"), c.ClientIP(), service.DownloadSettings{
		GuestDownloadAllowed: req.GuestDownloadAllowed,
		CaptchaEnabled:       req.CaptchaEnabled,
		URLExpiresSeconds:    req.URLExpiresSeconds,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, err.Error())
		default:
			response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		}
		return
	}

	response.Success(c, http.StatusOK, "download settings updated", gin.H{
		"downloadSettings": settings,
	})
}

func (ctl *AdminUserController) UpdateFileListDisplaySettings(c *gin.Context) {
	var req dto.UpdateFileListDisplaySettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid file list display payload")
		return
	}

	settings, err := ctl.admins.UpdateFileListDisplaySettings(c.Request.Context(), c.GetUint("adminUserID"), c.ClientIP(), service.FileListDisplaySettings{
		CategoryMode: req.CategoryMode,
		TagMode:      req.TagMode,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, err.Error())
		default:
			response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		}
		return
	}

	response.Success(c, http.StatusOK, "file list display settings updated", gin.H{
		"fileListDisplay": settings,
	})
}

func (ctl *AdminUserController) UpdateSettings(c *gin.Context) {
	var req dto.UpdateRegistrationSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid settings payload")
		return
	}

	if err := ctl.admins.UpdateRegistrationSettings(c.Request.Context(), c.GetUint("adminUserID"), c.ClientIP(), req.RegistrationEnabled); err != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}

	response.Success(c, http.StatusOK, "settings updated", gin.H{
		"registrationEnabled": req.RegistrationEnabled,
	})
}

func (ctl *AdminUserController) UpdateGuestDownloadSettings(c *gin.Context) {
	var req dto.UpdateGuestDownloadSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid settings payload")
		return
	}

	if err := ctl.admins.UpdateGuestDownloadAllowed(c.Request.Context(), c.GetUint("adminUserID"), c.ClientIP(), req.GuestDownloadAllowed); err != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}

	response.Success(c, http.StatusOK, "settings updated", gin.H{
		"guestDownloadAllowed": req.GuestDownloadAllowed,
	})
}

func (ctl *AdminUserController) UpdateRateLimitSettings(c *gin.Context) {
	var req dto.UpdateRateLimitSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid rate limit payload")
		return
	}

	settings, err := ctl.admins.UpdateRateLimitSettings(c.Request.Context(), c.GetUint("adminUserID"), c.ClientIP(), service.RateLimitSettings{
		Login: service.SplitRateLimitRuleSettings{
			Guest: service.RateLimitRuleSettings{
				Limit:         req.Login.Guest.Limit,
				WindowSeconds: req.Login.Guest.WindowSeconds,
			},
			Authenticated: service.RateLimitRuleSettings{
				Limit:         req.Login.Authenticated.Limit,
				WindowSeconds: req.Login.Authenticated.WindowSeconds,
			},
		},
		Download: service.RateLimitRuleSettings{
			Limit:         req.Download.Limit,
			WindowSeconds: req.Download.WindowSeconds,
		},
		Upload: service.RateLimitRuleSettings{
			Limit:         req.Upload.Limit,
			WindowSeconds: req.Upload.WindowSeconds,
		},
		List: service.SplitRateLimitRuleSettings{
			Guest: service.RateLimitRuleSettings{
				Limit:         req.List.Guest.Limit,
				WindowSeconds: req.List.Guest.WindowSeconds,
			},
			Authenticated: service.RateLimitRuleSettings{
				Limit:         req.List.Authenticated.Limit,
				WindowSeconds: req.List.Authenticated.WindowSeconds,
			},
		},
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, err.Error())
		default:
			response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		}
		return
	}

	response.Success(c, http.StatusOK, "rate limits updated", gin.H{
		"rateLimits": settings,
	})
}

func (ctl *AdminUserController) UpdateCaptchaSettings(c *gin.Context) {
	var req dto.UpdateCaptchaSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid captcha payload")
		return
	}

	settings, err := ctl.admins.UpdateCaptchaSettings(c.Request.Context(), c.GetUint("adminUserID"), c.ClientIP(), service.CaptchaSettings{
		LoginEnabled:        req.LoginEnabled,
		RegistrationEnabled: req.RegistrationEnabled,
	})
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}

	response.Success(c, http.StatusOK, "captcha settings updated", gin.H{
		"captcha": settings,
	})
}

func (ctl *AdminUserController) UpdateUploadSettings(c *gin.Context) {
	var req dto.UpdateUploadSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid upload settings payload")
		return
	}

	settings, err := ctl.admins.UpdateUploadSettings(c.Request.Context(), c.GetUint("adminUserID"), c.ClientIP(), service.UploadSettings{
		RestrictFileSize:  req.RestrictFileSize,
		MaxSizeBytes:      req.MaxSizeBytes,
		RestrictFileTypes: req.RestrictFileTypes,
		AllowedExtensions: req.AllowedExtensions,
		AllowedMimeTypes:  req.AllowedMimeTypes,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, err.Error())
		default:
			response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		}
		return
	}

	response.Success(c, http.StatusOK, "upload settings updated", gin.H{
		"uploadSettings": settings,
	})
}

func (ctl *AdminUserController) GetPermissionTemplates(c *gin.Context) {
	items, err := ctl.admins.GetPermissionTemplates(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}
	response.Success(c, http.StatusOK, "ok", gin.H{"templates": items})
}

func (ctl *AdminUserController) UpdatePermissionTemplates(c *gin.Context) {
	var req dto.UpdatePermissionTemplatesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid permission templates payload")
		return
	}

	templates := make([]service.PermissionTemplate, 0, len(req.Templates))
	for _, item := range req.Templates {
		templates = append(templates, service.PermissionTemplate{
			Key:         item.Key,
			Name:        item.Name,
			Description: item.Description,
			Permissions: item.Permissions,
		})
	}

	if err := ctl.admins.UpdatePermissionTemplates(c.Request.Context(), c.GetUint("adminUserID"), c.ClientIP(), templates); err != nil {
		switch {
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, err.Error())
		default:
			response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		}
		return
	}

	response.Success(c, http.StatusOK, "permission templates updated", gin.H{"templates": templates})
}
