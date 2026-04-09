package controller

import (
	"net/http"

	"fluxfiles/api/internal/service"
	"fluxfiles/api/pkg/response"

	"github.com/gin-gonic/gin"
)

type AdminLogController struct {
	logs *service.OperationLogService
}

func NewAdminLogController(logs *service.OperationLogService) *AdminLogController {
	return &AdminLogController{logs: logs}
}

func (ctl *AdminLogController) List(c *gin.Context) {
	result, err := ctl.logs.List(c.Request.Context(), service.ListOperationLogsInput{
		Page:       parseInt(c.DefaultQuery("page", "1"), 1),
		PageSize:   parseInt(c.DefaultQuery("pageSize", "20"), 20),
		Search:     c.Query("search"),
		Action:     c.Query("action"),
		TargetType: c.Query("targetType"),
	})
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "operation log service is temporarily unavailable")
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
