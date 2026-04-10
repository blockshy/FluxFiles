package controller

import (
	"errors"
	"net/http"

	"fluxfiles/api/internal/dto"
	"fluxfiles/api/internal/model"
	"fluxfiles/api/internal/service"
	"fluxfiles/api/pkg/response"

	"github.com/gin-gonic/gin"
)

type PublicAuthController struct {
	auth     *service.AuthService
	users    *service.UserService
	settings *service.SettingsService
	captcha  *service.CaptchaService
}

func NewPublicAuthController(auth *service.AuthService, users *service.UserService, settings *service.SettingsService, captcha *service.CaptchaService) *PublicAuthController {
	return &PublicAuthController{auth: auth, users: users, settings: settings, captcha: captcha}
}

func (ctl *PublicAuthController) Register(c *gin.Context) {
	enabled, err := ctl.settings.IsRegistrationOpen(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}
	if !enabled {
		response.Error(c, http.StatusForbidden, "registration is currently disabled")
		return
	}

	var req dto.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid register payload")
		return
	}
	captchaSettings, err := ctl.settings.GetCaptchaSettings(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}
	if captchaSettings.RegistrationEnabled {
		ok, verifyErr := ctl.captcha.Verify(c.Request.Context(), req.CaptchaID, req.CaptchaAnswer)
		if verifyErr != nil {
			response.Error(c, http.StatusServiceUnavailable, "captcha service is temporarily unavailable")
			return
		}
		if !ok {
			response.Error(c, http.StatusBadRequest, "captcha verification failed")
			return
		}
	}

	user, err := ctl.users.Register(c.Request.Context(), service.RegisterInput{
		Username:    req.Username,
		Email:       req.Email,
		DisplayName: req.DisplayName,
		Password:    req.Password,
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

	response.Success(c, http.StatusCreated, "registration successful", user)
}

func (ctl *PublicAuthController) RegisterConfig(c *gin.Context) {
	enabled, err := ctl.settings.IsRegistrationOpen(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}
	captchaSettings, err := ctl.settings.GetCaptchaSettings(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}
	response.Success(c, http.StatusOK, "ok", gin.H{
		"registrationEnabled": enabled,
		"captcha":             captchaSettings,
	})
}

func (ctl *PublicAuthController) Login(c *gin.Context) {
	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid login payload")
		return
	}
	captchaSettings, err := ctl.settings.GetCaptchaSettings(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "settings service is temporarily unavailable")
		return
	}
	if captchaSettings.LoginEnabled {
		ok, verifyErr := ctl.captcha.Verify(c.Request.Context(), req.CaptchaID, req.CaptchaAnswer)
		if verifyErr != nil {
			response.Error(c, http.StatusServiceUnavailable, "captcha service is temporarily unavailable")
			return
		}
		if !ok {
			response.Error(c, http.StatusBadRequest, "captcha verification failed")
			return
		}
	}

	result, err := ctl.auth.Login(c.Request.Context(), req.Username, req.Password, c.ClientIP())
	if err != nil {
		switch {
		case errors.Is(err, service.ErrUnauthorized):
			response.Error(c, http.StatusUnauthorized, "username or password is incorrect")
		case errors.Is(err, service.ErrTooManyAttempts):
			response.Error(c, http.StatusTooManyRequests, "too many failed login attempts")
		case errors.Is(err, service.ErrForbidden):
			response.Error(c, http.StatusForbidden, "user account is disabled")
		default:
			response.Error(c, http.StatusInternalServerError, "failed to login")
		}
		return
	}

	response.Success(c, http.StatusOK, "login successful", result)
}

func (ctl *PublicAuthController) Captcha(c *gin.Context) {
	challenge, err := ctl.captcha.Generate(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "captcha service is temporarily unavailable")
		return
	}
	response.Success(c, http.StatusOK, "ok", challenge)
}

func (ctl *PublicAuthController) Me(c *gin.Context) {
	user, err := ctl.users.GetByID(c.Request.Context(), c.GetUint("userID"))
	if err != nil {
		response.Error(c, http.StatusNotFound, "user not found")
		return
	}
	response.Success(c, http.StatusOK, "ok", user)
}

func (ctl *PublicAuthController) UpdateProfile(c *gin.Context) {
	var req dto.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid profile payload")
		return
	}

	user, err := ctl.users.UpdateProfile(c.Request.Context(), c.GetUint("userID"), service.UpdateProfileInput{
		Email:       req.Email,
		DisplayName: req.DisplayName,
		Bio:         req.Bio,
		ProfileVisibility: model.UserProfileVisibility{
			ShowBio:            req.ProfileVisibility.ShowBio,
			ShowStats:          req.ProfileVisibility.ShowStats,
			ShowPublishedFiles: req.ProfileVisibility.ShowPublishedFiles,
			ShowFavorites:      req.ProfileVisibility.ShowFavorites,
		},
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

	response.Success(c, http.StatusOK, "profile updated", user)
}

func (ctl *PublicAuthController) PublicProfile(c *gin.Context) {
	profile, err := ctl.users.GetPublicProfile(c.Request.Context(), c.Param("username"))
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			response.Error(c, http.StatusNotFound, "user not found")
			return
		}
		response.Error(c, http.StatusServiceUnavailable, "user service is temporarily unavailable")
		return
	}
	response.Success(c, http.StatusOK, "ok", profile)
}

func (ctl *PublicAuthController) ChangePassword(c *gin.Context) {
	var req dto.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid password payload")
		return
	}

	err := ctl.users.ChangePassword(c.Request.Context(), c.GetUint("userID"), service.ChangePasswordInput{
		CurrentPassword: req.CurrentPassword,
		NewPassword:     req.NewPassword,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, "invalid password payload")
		case errors.Is(err, service.ErrUnauthorized):
			response.Error(c, http.StatusUnauthorized, "current password is incorrect")
		default:
			response.Error(c, http.StatusServiceUnavailable, "user service is temporarily unavailable")
		}
		return
	}

	response.Success(c, http.StatusOK, "password updated", nil)
}
