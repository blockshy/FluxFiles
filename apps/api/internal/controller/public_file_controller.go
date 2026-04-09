package controller

import (
	"errors"
	"net/http"
	"strconv"

	"fluxfiles/api/internal/repository"
	"fluxfiles/api/internal/service"
	"fluxfiles/api/pkg/response"

	"github.com/gin-gonic/gin"
)

type PublicFileController struct {
	files *service.FileService
	users *service.UserService
}

func NewPublicFileController(files *service.FileService, users *service.UserService) *PublicFileController {
	return &PublicFileController{files: files, users: users}
}

func (ctl *PublicFileController) List(c *gin.Context) {
	params := repository.FileListParams{
		Page:       parseInt(c.DefaultQuery("page", "1"), 1),
		PageSize:   parseInt(c.DefaultQuery("pageSize", "10"), 10),
		Search:     c.Query("search"),
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
	result, err := ctl.files.GenerateDownload(c.Request.Context(), fileID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "file not found")
		case errors.Is(err, service.ErrDependencyUnavailable):
			response.Error(c, http.StatusServiceUnavailable, "download service is temporarily unavailable")
		default:
			response.Error(c, http.StatusInternalServerError, "failed to create download link")
		}
		return
	}

	if userID := c.GetUint("userID"); userID > 0 && ctl.users != nil {
		_ = ctl.users.RecordDownload(c.Request.Context(), userID, fileID)
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
