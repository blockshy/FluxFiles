package controller

import (
	"errors"
	"net/http"

	"fluxfiles/api/internal/dto"
	"fluxfiles/api/internal/service"
	"fluxfiles/api/pkg/response"

	"github.com/gin-gonic/gin"
)

type AdminCommunityController struct {
	community *service.CommunityService
}

func NewAdminCommunityController(community *service.CommunityService) *AdminCommunityController {
	return &AdminCommunityController{community: community}
}

func (ctl *AdminCommunityController) ListPosts(c *gin.Context) {
	result, err := ctl.community.ListPosts(
		c.Request.Context(),
		nil,
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

func (ctl *AdminCommunityController) ModeratePost(c *gin.Context) {
	var req dto.ModerateCommunityPostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid community moderation payload")
		return
	}

	err := ctl.community.ModeratePost(
		c.Request.Context(),
		c.GetUint("userID"),
		parseUintParam(c, "id"),
		req.IsPinned,
		req.IsLocked,
		req.Delete,
		c.ClientIP(),
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

	response.Success(c, http.StatusOK, "community post updated", nil)
}
