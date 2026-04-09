package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Envelope struct {
	Success   bool   `json:"success"`
	Message   string `json:"message"`
	RequestID string `json:"requestId,omitempty"`
	Data      any    `json:"data,omitempty"`
}

type Pagination struct {
	Page     int   `json:"page"`
	PageSize int   `json:"pageSize"`
	Total    int64 `json:"total"`
}

func Success(c *gin.Context, status int, message string, data any) {
	c.JSON(status, Envelope{
		Success:   true,
		Message:   message,
		RequestID: requestID(c),
		Data:      data,
	})
}

func Paginated(c *gin.Context, message string, items any, page, pageSize int, total int64) {
	Success(c, http.StatusOK, message, gin.H{
		"items": items,
		"pagination": Pagination{
			Page:     page,
			PageSize: pageSize,
			Total:    total,
		},
	})
}

func Error(c *gin.Context, status int, message string) {
	c.JSON(status, Envelope{
		Success:   false,
		Message:   message,
		RequestID: requestID(c),
	})
}

func requestID(c *gin.Context) string {
	value, ok := c.Get("requestID")
	if !ok {
		return ""
	}
	requestID, _ := value.(string)
	return requestID
}
