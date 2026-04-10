package controller

import (
	"errors"
	"net/http"
	"strconv"

	"fluxfiles/api/internal/service"
	"fluxfiles/api/pkg/response"

	"github.com/gin-gonic/gin"
)

type PublicInteractionController struct {
	interactions *service.InteractionService
}

func NewPublicInteractionController(interactions *service.InteractionService) *PublicInteractionController {
	return &PublicInteractionController{interactions: interactions}
}

func (ctl *PublicInteractionController) ListComments(c *gin.Context) {
	var currentUserID *uint
	if userID := c.GetUint("userID"); userID > 0 {
		currentUserID = &userID
	}

	var rootID *uint
	if raw := c.Query("rootId"); raw != "" {
		if parsed, err := strconv.ParseUint(raw, 10, 64); err == nil && parsed > 0 {
			value := uint(parsed)
			rootID = &value
		}
	}

	result, err := ctl.interactions.ListComments(
		c.Request.Context(),
		parseUintParam(c, "id"),
		currentUserID,
		rootID,
		parseInt(c.DefaultQuery("page", "1"), 1),
		parseInt(c.DefaultQuery("pageSize", "10"), 10),
	)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "file not found")
		default:
			response.Error(c, http.StatusServiceUnavailable, "comment service is temporarily unavailable")
		}
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
		"overallTotal": result.Overall,
	})
}
