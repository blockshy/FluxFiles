package controller

import (
	"errors"
	"net/http"
	"strings"

	"fluxfiles/api/internal/dto"
	"fluxfiles/api/internal/service"
	"fluxfiles/api/pkg/response"

	"github.com/gin-gonic/gin"
)

type UserInteractionController struct {
	interactions *service.InteractionService
}

func NewUserInteractionController(interactions *service.InteractionService) *UserInteractionController {
	return &UserInteractionController{interactions: interactions}
}

func (ctl *UserInteractionController) CreateComment(c *gin.Context) {
	var req dto.CreateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid comment payload")
		return
	}
	requiredPermission := service.PermissionPublicCommentsCreate
	if req.ParentID != nil {
		requiredPermission = service.PermissionPublicCommentsReply
	}
	if !service.HasPermission(currentPermissions(c), requiredPermission) {
		response.Error(c, http.StatusForbidden, "insufficient permissions")
		return
	}

	item, err := ctl.interactions.CreateComment(c.Request.Context(), c.GetUint("userID"), parseUintParam(c, "id"), req.ParentID, req.Content)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "target not found")
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, "invalid comment payload")
		default:
			response.Error(c, http.StatusServiceUnavailable, "comment service is temporarily unavailable")
		}
		return
	}

	response.Success(c, http.StatusCreated, "comment created", item)
}

func (ctl *UserInteractionController) DeleteComment(c *gin.Context) {
	err := ctl.interactions.DeleteComment(c.Request.Context(), c.GetUint("userID"), parseUintParam(c, "id"))
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "comment not found")
		case errors.Is(err, service.ErrForbidden):
			response.Error(c, http.StatusForbidden, "insufficient permissions")
		default:
			response.Error(c, http.StatusServiceUnavailable, "comment service is temporarily unavailable")
		}
		return
	}
	response.Success(c, http.StatusOK, "comment deleted", nil)
}

func (ctl *UserInteractionController) VoteComment(c *gin.Context) {
	var req dto.VoteCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid vote payload")
		return
	}

	finalVote, err := ctl.interactions.VoteComment(c.Request.Context(), c.GetUint("userID"), parseUintParam(c, "id"), req.Value)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "comment not found")
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, "invalid vote payload")
		case errors.Is(err, service.ErrForbidden):
			response.Error(c, http.StatusForbidden, "cannot vote on your own comment")
		default:
			response.Error(c, http.StatusServiceUnavailable, "vote service is temporarily unavailable")
		}
		return
	}

	response.Success(c, http.StatusOK, "vote updated", gin.H{"currentVote": finalVote})
}

func (ctl *UserInteractionController) ListNotifications(c *gin.Context) {
	types := parseNotificationTypes(c.Query("type"))
	result, err := ctl.interactions.ListNotifications(c.Request.Context(), c.GetUint("userID"), parseInt(c.DefaultQuery("page", "1"), 1), parseInt(c.DefaultQuery("pageSize", "20"), 20), types)
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "notification service is temporarily unavailable")
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
		"unread": result.Unread,
	})
}

func (ctl *UserInteractionController) MarkNotificationRead(c *gin.Context) {
	if err := ctl.interactions.MarkNotificationRead(c.Request.Context(), c.GetUint("userID"), parseUintParam(c, "id")); err != nil {
		response.Error(c, http.StatusServiceUnavailable, "notification service is temporarily unavailable")
		return
	}
	response.Success(c, http.StatusOK, "notification updated", nil)
}

func (ctl *UserInteractionController) MarkNotificationsRead(c *gin.Context) {
	types := parseNotificationTypes(c.Query("type"))
	if err := ctl.interactions.MarkAllNotificationsRead(c.Request.Context(), c.GetUint("userID"), types); err != nil {
		response.Error(c, http.StatusServiceUnavailable, "notification service is temporarily unavailable")
		return
	}
	response.Success(c, http.StatusOK, "notifications updated", nil)
}

func (ctl *UserInteractionController) ListMyComments(c *gin.Context) {
	result, total, err := ctl.interactions.ListMyComments(c.Request.Context(), c.GetUint("userID"), parseInt(c.DefaultQuery("page", "1"), 1), parseInt(c.DefaultQuery("pageSize", "20"), 20))
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "comment service is temporarily unavailable")
		return
	}
	page := parseInt(c.DefaultQuery("page", "1"), 1)
	pageSize := parseInt(c.DefaultQuery("pageSize", "20"), 20)
	totalPages := 0
	if pageSize > 0 {
		totalPages = int((total + int64(pageSize) - 1) / int64(pageSize))
	}
	response.Success(c, http.StatusOK, "ok", gin.H{
		"items": result.Items,
		"pagination": gin.H{
			"page":       page,
			"pageSize":   pageSize,
			"total":      total,
			"totalPages": totalPages,
		},
	})
}

func parseNotificationTypes(raw string) []string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil
	}
	items := strings.Split(value, ",")
	result := make([]string, 0, len(items))
	for _, item := range items {
		normalized := strings.TrimSpace(item)
		if normalized != "" {
			result = append(result, normalized)
		}
	}
	return result
}
