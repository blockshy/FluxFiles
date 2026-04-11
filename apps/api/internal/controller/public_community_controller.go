package controller

import (
	"errors"
	"net/http"

	"fluxfiles/api/internal/service"
	"fluxfiles/api/pkg/response"

	"github.com/gin-gonic/gin"
)

type PublicCommunityController struct {
	community *service.CommunityService
}

func NewPublicCommunityController(community *service.CommunityService) *PublicCommunityController {
	return &PublicCommunityController{community: community}
}

func (ctl *PublicCommunityController) ListPosts(c *gin.Context) {
	var currentUserID *uint
	if userID := c.GetUint("userID"); userID > 0 {
		currentUserID = &userID
	}

	result, err := ctl.community.ListPosts(
		c.Request.Context(),
		currentUserID,
		parseInt(c.DefaultQuery("page", "1"), 1),
		parseInt(c.DefaultQuery("pageSize", "20"), 20),
		c.Query("search"),
	)
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "community service is temporarily unavailable")
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

func (ctl *PublicCommunityController) GetPost(c *gin.Context) {
	var currentUserID *uint
	if userID := c.GetUint("userID"); userID > 0 {
		currentUserID = &userID
	}

	item, err := ctl.community.GetPost(c.Request.Context(), parseUintParam(c, "id"), currentUserID, true)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "community post not found")
		default:
			response.Error(c, http.StatusServiceUnavailable, "community service is temporarily unavailable")
		}
		return
	}
	response.Success(c, http.StatusOK, "ok", item)
}

func (ctl *PublicCommunityController) ListReplies(c *gin.Context) {
	var currentUserID *uint
	if userID := c.GetUint("userID"); userID > 0 {
		currentUserID = &userID
	}

	result, err := ctl.community.ListReplies(
		c.Request.Context(),
		parseUintParam(c, "id"),
		currentUserID,
		parseInt(c.DefaultQuery("page", "1"), 1),
		parseInt(c.DefaultQuery("pageSize", "20"), 20),
	)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "community post not found")
		default:
			response.Error(c, http.StatusServiceUnavailable, "community service is temporarily unavailable")
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
	})
}
