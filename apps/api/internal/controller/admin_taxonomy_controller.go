package controller

import (
	"errors"
	"net/http"

	"fluxfiles/api/internal/dto"
	"fluxfiles/api/internal/repository"
	"fluxfiles/api/internal/service"
	"fluxfiles/api/pkg/response"

	"github.com/gin-gonic/gin"
)

type AdminTaxonomyController struct {
	taxonomies *service.TaxonomyService
}

func NewAdminTaxonomyController(taxonomies *service.TaxonomyService) *AdminTaxonomyController {
	return &AdminTaxonomyController{taxonomies: taxonomies}
}

func (ctl *AdminTaxonomyController) ListCategories(c *gin.Context) {
	ctl.list(c, repository.TaxonomyKindCategory)
}

func (ctl *AdminTaxonomyController) ListTags(c *gin.Context) {
	ctl.list(c, repository.TaxonomyKindTag)
}

func (ctl *AdminTaxonomyController) CategoryOptions(c *gin.Context) {
	ctl.options(c, repository.TaxonomyKindCategory)
}

func (ctl *AdminTaxonomyController) TagOptions(c *gin.Context) {
	ctl.options(c, repository.TaxonomyKindTag)
}

func (ctl *AdminTaxonomyController) CreateCategory(c *gin.Context) {
	ctl.create(c, repository.TaxonomyKindCategory)
}

func (ctl *AdminTaxonomyController) CreateTag(c *gin.Context) {
	ctl.create(c, repository.TaxonomyKindTag)
}

func (ctl *AdminTaxonomyController) UpdateCategory(c *gin.Context) {
	ctl.update(c, repository.TaxonomyKindCategory)
}

func (ctl *AdminTaxonomyController) UpdateTag(c *gin.Context) {
	ctl.update(c, repository.TaxonomyKindTag)
}

func (ctl *AdminTaxonomyController) DeleteCategory(c *gin.Context) {
	ctl.remove(c, repository.TaxonomyKindCategory)
}

func (ctl *AdminTaxonomyController) DeleteTag(c *gin.Context) {
	ctl.remove(c, repository.TaxonomyKindTag)
}

func (ctl *AdminTaxonomyController) CategoryLogs(c *gin.Context) {
	ctl.logs(c, repository.TaxonomyKindCategory)
}

func (ctl *AdminTaxonomyController) TagLogs(c *gin.Context) {
	ctl.logs(c, repository.TaxonomyKindTag)
}

func (ctl *AdminTaxonomyController) list(c *gin.Context, kind repository.TaxonomyKind) {
	if !service.HasPermission(currentPermissions(c), taxonomyPermission(kind, "view")) {
		response.Error(c, http.StatusForbidden, "insufficient permissions")
		return
	}
	result, err := ctl.taxonomies.List(c.Request.Context(), kind, service.ListTaxonomiesInput{
		Page:     parseInt(c.DefaultQuery("page", "1"), 1),
		PageSize: parseInt(c.DefaultQuery("pageSize", "20"), 20),
		Search:   c.Query("search"),
	})
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "taxonomy service is temporarily unavailable")
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

func (ctl *AdminTaxonomyController) options(c *gin.Context, kind repository.TaxonomyKind) {
	permissions := currentPermissions(c)
	if !service.HasPermission(permissions, taxonomyPermission(kind, "view")) &&
		!service.HasAnyPermission(permissions, service.PermissionAdminFilesUpload, service.PermissionAdminFilesEdit, service.PermissionAdminFilesOwn, service.PermissionAdminFilesAll) {
		response.Error(c, http.StatusForbidden, "insufficient permissions")
		return
	}
	items, err := ctl.taxonomies.ListOptions(c.Request.Context(), kind)
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "taxonomy service is temporarily unavailable")
		return
	}
	response.Success(c, http.StatusOK, "ok", gin.H{"items": items})
}

func (ctl *AdminTaxonomyController) create(c *gin.Context, kind repository.TaxonomyKind) {
	if !service.HasPermission(currentPermissions(c), taxonomyPermission(kind, "create")) {
		response.Error(c, http.StatusForbidden, "insufficient permissions")
		return
	}
	var req dto.SaveTaxonomyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid taxonomy payload")
		return
	}
	item, err := ctl.taxonomies.Create(c.Request.Context(), kind, c.GetUint("adminUserID"), c.ClientIP(), service.SaveTaxonomyInput{Name: req.Name})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, err.Error())
		default:
			response.Error(c, http.StatusServiceUnavailable, "taxonomy service is temporarily unavailable")
		}
		return
	}
	response.Success(c, http.StatusCreated, "created", item)
}

func (ctl *AdminTaxonomyController) update(c *gin.Context, kind repository.TaxonomyKind) {
	if !service.HasPermission(currentPermissions(c), taxonomyPermission(kind, "edit")) {
		response.Error(c, http.StatusForbidden, "insufficient permissions")
		return
	}
	var req dto.SaveTaxonomyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid taxonomy payload")
		return
	}
	item, err := ctl.taxonomies.Update(c.Request.Context(), kind, parseUintParam(c, "id"), c.GetUint("adminUserID"), c.ClientIP(), service.SaveTaxonomyInput{Name: req.Name})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "taxonomy not found")
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, err.Error())
		default:
			response.Error(c, http.StatusServiceUnavailable, "taxonomy service is temporarily unavailable")
		}
		return
	}
	response.Success(c, http.StatusOK, "updated", item)
}

func (ctl *AdminTaxonomyController) remove(c *gin.Context, kind repository.TaxonomyKind) {
	if !service.HasPermission(currentPermissions(c), taxonomyPermission(kind, "delete")) {
		response.Error(c, http.StatusForbidden, "insufficient permissions")
		return
	}
	err := ctl.taxonomies.Delete(c.Request.Context(), kind, parseUintParam(c, "id"), c.GetUint("adminUserID"), c.ClientIP())
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "taxonomy not found")
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, err.Error())
		default:
			response.Error(c, http.StatusServiceUnavailable, "taxonomy service is temporarily unavailable")
		}
		return
	}
	response.Success(c, http.StatusOK, "deleted", nil)
}

func (ctl *AdminTaxonomyController) logs(c *gin.Context, kind repository.TaxonomyKind) {
	if !service.HasPermission(currentPermissions(c), taxonomyPermission(kind, "logs")) {
		response.Error(c, http.StatusForbidden, "insufficient permissions")
		return
	}
	result, err := ctl.taxonomies.ListLogs(c.Request.Context(), kind, parseUintParam(c, "id"), parseInt(c.DefaultQuery("page", "1"), 1), parseInt(c.DefaultQuery("pageSize", "20"), 20))
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "taxonomy service is temporarily unavailable")
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

func taxonomyPermission(kind repository.TaxonomyKind, action string) string {
	switch kind {
	case repository.TaxonomyKindCategory:
		switch action {
		case "view":
			return service.PermissionAdminCategoriesView
		case "create":
			return service.PermissionAdminCategoriesCreate
		case "edit":
			return service.PermissionAdminCategoriesEdit
		case "delete":
			return service.PermissionAdminCategoriesDelete
		case "logs":
			return service.PermissionAdminCategoriesLogs
		}
	case repository.TaxonomyKindTag:
		switch action {
		case "view":
			return service.PermissionAdminTagsView
		case "create":
			return service.PermissionAdminTagsCreate
		case "edit":
			return service.PermissionAdminTagsEdit
		case "delete":
			return service.PermissionAdminTagsDelete
		case "logs":
			return service.PermissionAdminTagsLogs
		}
	}
	return ""
}
