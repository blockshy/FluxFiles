package controller

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"fluxfiles/api/internal/service"
	"fluxfiles/api/pkg/response"

	"github.com/gin-gonic/gin"
)

type AdminDownloadController struct {
	users *service.UserService
}

func NewAdminDownloadController(users *service.UserService) *AdminDownloadController {
	return &AdminDownloadController{users: users}
}

func (ctl *AdminDownloadController) List(c *gin.Context) {
	ctl.list(c, nil)
}

func (ctl *AdminDownloadController) ListForFile(c *gin.Context) {
	fileID := parseUintParam(c, "id")
	ctl.list(c, &fileID)
}

func (ctl *AdminDownloadController) list(c *gin.Context, fileID *uint) {
	startAt, err := parseOptionalTime(c.Query("startAt"), false)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid startAt")
		return
	}
	endAt, err := parseOptionalTime(c.Query("endAt"), true)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid endAt")
		return
	}

	items, total, err := ctl.users.ListDownloadRecords(c.Request.Context(), c.GetUint("adminUserID"), currentPermissions(c), service.ListDownloadRecordsInput{
		Page:       parseInt(c.DefaultQuery("page", "1"), 1),
		PageSize:   parseInt(c.DefaultQuery("pageSize", "20"), 20),
		FileID:     fileID,
		Search:     c.Query("search"),
		UserSearch: c.Query("userSearch"),
		IP:         c.Query("ip"),
		AuthStatus: c.Query("authStatus"),
		StartAt:    startAt,
		EndAt:      endAt,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrForbidden):
			response.Error(c, http.StatusForbidden, "insufficient permissions")
		default:
			response.Error(c, http.StatusServiceUnavailable, "download record service is temporarily unavailable")
		}
		return
	}

	response.Paginated(c, "ok", items, parseInt(c.DefaultQuery("page", "1"), 1), parseInt(c.DefaultQuery("pageSize", "20"), 20), total)
}

func parseOptionalTime(value string, endOfDay bool) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return &parsed, nil
	}
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		return nil, err
	}
	if endOfDay {
		parsed = parsed.Add(24*time.Hour - time.Nanosecond)
	}
	return &parsed, nil
}
