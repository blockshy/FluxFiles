package controller

import (
	"errors"
	"net/http"
	"strings"

	"fluxfiles/api/internal/dto"
	"fluxfiles/api/internal/repository"
	"fluxfiles/api/internal/service"
	"fluxfiles/api/pkg/response"

	"github.com/gin-gonic/gin"
)

type AdminFileController struct {
	files *service.FileService
}

func NewAdminFileController(files *service.FileService) *AdminFileController {
	return &AdminFileController{files: files}
}

func (ctl *AdminFileController) List(c *gin.Context) {
	params := repository.FileListParams{
		Page:      parseInt(c.DefaultQuery("page", "1"), 1),
		PageSize:  parseInt(c.DefaultQuery("pageSize", "10"), 10),
		Search:    c.Query("search"),
		SortBy:    c.DefaultQuery("sortBy", "createdAt"),
		SortOrder: c.DefaultQuery("sortOrder", "desc"),
	}

	items, total, err := ctl.files.ListAdmin(c.Request.Context(), params)
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "file service is temporarily unavailable")
		return
	}

	response.Paginated(c, "ok", items, params.Page, params.PageSize, total)
}

func (ctl *AdminFileController) Get(c *gin.Context) {
	file, err := ctl.files.GetAdmin(c.Request.Context(), parseUintParam(c, "id"))
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

func (ctl *AdminFileController) Create(c *gin.Context) {
	var req dto.CompleteUploadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}

	file, err := ctl.files.Create(c.Request.Context(), service.CompleteUploadInput{
		ObjectKey:    req.ObjectKey,
		OriginalName: req.OriginalName,
		Name:         req.Name,
		Description:  req.Description,
		Category:     req.Category,
		Tags:         req.Tags,
		IsPublic:     req.IsPublic,
		AdminID:      c.GetUint("adminUserID"),
		IP:           c.ClientIP(),
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrDependencyUnavailable):
			response.Error(c, http.StatusServiceUnavailable, "storage service is temporarily unavailable")
		default:
			response.Error(c, http.StatusInternalServerError, "failed to upload file")
		}
		return
	}

	response.Success(c, http.StatusCreated, "file uploaded", file)
}

func (ctl *AdminFileController) PrepareUpload(c *gin.Context) {
	var req dto.PrepareUploadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request payload: "+err.Error())
		return
	}

	result, err := ctl.files.PrepareUpload(c.Request.Context(), service.PrepareUploadInput{
		OriginalName: req.OriginalName,
		Size:         req.Size,
		MimeType:     req.MimeType,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrDependencyUnavailable):
			response.Error(c, http.StatusServiceUnavailable, "storage service is temporarily unavailable")
		default:
			response.Error(c, http.StatusInternalServerError, "failed to prepare upload")
		}
		return
	}

	response.Success(c, http.StatusOK, "upload prepared", result)
}

func (ctl *AdminFileController) Update(c *gin.Context) {
	var req dto.UpdateFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid request payload")
		return
	}

	values := map[string]any{
		"name":        strings.TrimSpace(req.Name),
		"description": strings.TrimSpace(req.Description),
		"category":    strings.TrimSpace(req.Category),
		"tags":        req.Tags,
		"is_public":   req.IsPublic,
	}

	file, err := ctl.files.Update(c.Request.Context(), parseUintParam(c, "id"), c.GetUint("adminUserID"), c.ClientIP(), values)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "file not found")
		case errors.Is(err, service.ErrDependencyUnavailable):
			response.Error(c, http.StatusServiceUnavailable, "file service is temporarily unavailable")
		default:
			response.Error(c, http.StatusInternalServerError, "failed to update file")
		}
		return
	}

	response.Success(c, http.StatusOK, "file updated", file)
}

func (ctl *AdminFileController) Delete(c *gin.Context) {
	if err := ctl.files.Delete(c.Request.Context(), parseUintParam(c, "id"), c.GetUint("adminUserID"), c.ClientIP()); err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "file not found")
		case errors.Is(err, service.ErrDependencyUnavailable):
			response.Error(c, http.StatusServiceUnavailable, "file service is temporarily unavailable")
		default:
			response.Error(c, http.StatusInternalServerError, "failed to delete file")
		}
		return
	}

	response.Success(c, http.StatusOK, "file deleted", nil)
}

func (ctl *AdminFileController) Stats(c *gin.Context) {
	stats, err := ctl.files.DashboardStats(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "statistics service is temporarily unavailable")
		return
	}

	response.Success(c, http.StatusOK, "ok", stats)
}
