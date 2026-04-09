package controller

import (
	"errors"
	"net/http"

	"fluxfiles/api/internal/dto"
	"fluxfiles/api/internal/service"
	"fluxfiles/api/pkg/response"

	"github.com/gin-gonic/gin"
)

type AdminAuthController struct {
	authService *service.AuthService
}

func NewAdminAuthController(authService *service.AuthService) *AdminAuthController {
	return &AdminAuthController{authService: authService}
}

func (ctl *AdminAuthController) Login(c *gin.Context) {
	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid login payload")
		return
	}

	result, err := ctl.authService.Login(c.Request.Context(), req.Username, req.Password, c.ClientIP())
	if err != nil {
		switch {
		case errors.Is(err, service.ErrUnauthorized):
			response.Error(c, http.StatusUnauthorized, "username or password is incorrect")
		case errors.Is(err, service.ErrTooManyAttempts):
			response.Error(c, http.StatusTooManyRequests, "too many failed login attempts")
		case errors.Is(err, service.ErrDependencyUnavailable):
			response.Error(c, http.StatusServiceUnavailable, "authentication service is temporarily unavailable")
		default:
			response.Error(c, http.StatusInternalServerError, "failed to login")
		}
		return
	}
	if result.User == nil || result.User.Role != "admin" {
		response.Error(c, http.StatusForbidden, "admin privileges required")
		return
	}

	response.Success(c, http.StatusOK, "login successful", result)
}

func (ctl *AdminAuthController) Me(c *gin.Context) {
	response.Success(c, http.StatusOK, "ok", gin.H{
		"id":          c.GetUint("adminUserID"),
		"username":    c.GetString("adminUsername"),
		"role":        "admin",
		"permissions": c.GetStringSlice("userPermissions"),
	})
}
