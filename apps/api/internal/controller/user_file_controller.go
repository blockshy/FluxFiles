package controller

import (
	"net/http"

	"fluxfiles/api/internal/service"
	"fluxfiles/api/pkg/response"

	"github.com/gin-gonic/gin"
)

type UserFileController struct {
	users *service.UserService
}

func NewUserFileController(users *service.UserService) *UserFileController {
	return &UserFileController{users: users}
}

func (ctl *UserFileController) ListFavorites(c *gin.Context) {
	items, err := ctl.users.ListFavorites(c.Request.Context(), c.GetUint("userID"))
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "favorite service is temporarily unavailable")
		return
	}
	response.Success(c, http.StatusOK, "ok", items)
}

func (ctl *UserFileController) AddFavorite(c *gin.Context) {
	if err := ctl.users.AddFavorite(c.Request.Context(), c.GetUint("userID"), parseUintParam(c, "id")); err != nil {
		response.Error(c, http.StatusServiceUnavailable, "favorite service is temporarily unavailable")
		return
	}
	response.Success(c, http.StatusOK, "favorite added", nil)
}

func (ctl *UserFileController) RemoveFavorite(c *gin.Context) {
	if err := ctl.users.RemoveFavorite(c.Request.Context(), c.GetUint("userID"), parseUintParam(c, "id")); err != nil {
		response.Error(c, http.StatusServiceUnavailable, "favorite service is temporarily unavailable")
		return
	}
	response.Success(c, http.StatusOK, "favorite removed", nil)
}

func (ctl *UserFileController) ListDownloads(c *gin.Context) {
	items, err := ctl.users.ListDownloads(c.Request.Context(), c.GetUint("userID"), parseInt(c.DefaultQuery("limit", "50"), 50))
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "download history service is temporarily unavailable")
		return
	}
	response.Success(c, http.StatusOK, "ok", items)
}
