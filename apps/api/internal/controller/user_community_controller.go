package controller

import (
	"errors"
	"net/http"

	"fluxfiles/api/internal/dto"
	"fluxfiles/api/internal/service"
	"fluxfiles/api/pkg/response"

	"github.com/gin-gonic/gin"
)

type UserCommunityController struct {
	community *service.CommunityService
}

func NewUserCommunityController(community *service.CommunityService) *UserCommunityController {
	return &UserCommunityController{community: community}
}

func (ctl *UserCommunityController) CreatePost(c *gin.Context) {
	var req dto.CreateCommunityPostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid community post payload")
		return
	}

	item, err := ctl.community.CreatePost(c.Request.Context(), c.GetUint("userID"), req.Title, req.ContentHTML)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, "invalid community post payload")
		default:
			response.Error(c, http.StatusServiceUnavailable, "community service is temporarily unavailable")
		}
		return
	}
	response.Success(c, http.StatusCreated, "community post created", item)
}

func (ctl *UserCommunityController) UpdatePost(c *gin.Context) {
	var req dto.UpdateCommunityPostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid community post payload")
		return
	}

	item, err := ctl.community.UpdatePost(c.Request.Context(), c.GetUint("userID"), parseUintParam(c, "id"), req.Title, req.ContentHTML)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "community post not found")
		case errors.Is(err, service.ErrForbidden):
			response.Error(c, http.StatusForbidden, "insufficient permissions")
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, "invalid community post payload")
		default:
			response.Error(c, http.StatusServiceUnavailable, "community service is temporarily unavailable")
		}
		return
	}
	response.Success(c, http.StatusOK, "community post updated", item)
}

func (ctl *UserCommunityController) DeletePost(c *gin.Context) {
	err := ctl.community.DeletePost(c.Request.Context(), c.GetUint("userID"), parseUintParam(c, "id"))
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "community post not found")
		case errors.Is(err, service.ErrForbidden):
			response.Error(c, http.StatusForbidden, "insufficient permissions")
		default:
			response.Error(c, http.StatusServiceUnavailable, "community service is temporarily unavailable")
		}
		return
	}
	response.Success(c, http.StatusOK, "community post deleted", nil)
}

func (ctl *UserCommunityController) CreateReply(c *gin.Context) {
	var req dto.CreateCommunityReplyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "invalid community reply payload")
		return
	}

	item, err := ctl.community.CreateReply(c.Request.Context(), c.GetUint("userID"), parseUintParam(c, "id"), req.ParentID, req.Content)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "community post not found")
		case errors.Is(err, service.ErrValidation):
			response.Error(c, http.StatusBadRequest, "invalid community reply payload")
		default:
			response.Error(c, http.StatusServiceUnavailable, "community service is temporarily unavailable")
		}
		return
	}
	response.Success(c, http.StatusCreated, "community reply created", item)
}

func (ctl *UserCommunityController) DeleteReply(c *gin.Context) {
	err := ctl.community.DeleteReply(c.Request.Context(), c.GetUint("userID"), parseUintParam(c, "id"), false)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrNotFound):
			response.Error(c, http.StatusNotFound, "community reply not found")
		case errors.Is(err, service.ErrForbidden):
			response.Error(c, http.StatusForbidden, "insufficient permissions")
		default:
			response.Error(c, http.StatusServiceUnavailable, "community service is temporarily unavailable")
		}
		return
	}
	response.Success(c, http.StatusOK, "community reply deleted", nil)
}
