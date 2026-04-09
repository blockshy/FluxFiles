package middleware

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	"fluxfiles/api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if strings.TrimSpace(requestID) == "" {
			requestID = uuid.NewString()
		}

		c.Set("requestID", requestID)
		c.Writer.Header().Set("X-Request-ID", requestID)
		c.Next()
	}
}

func AccessLog(log *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}

		log.Info("request completed",
			"method", c.Request.Method,
			"path", path,
			"status", c.Writer.Status(),
			"latency_ms", time.Since(start).Milliseconds(),
			"client_ip", c.ClientIP(),
			"request_id", c.GetString("requestID"),
		)
	}
}

func ErrorRecovery(log *slog.Logger) gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered any) {
		log.Error("panic recovered", "error", recovered, "request_id", c.GetString("requestID"))
		response.Error(c, http.StatusInternalServerError, "internal server error")
	})
}

func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Frame-Options", "SAMEORIGIN")
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		c.Next()
	}
}

func Blacklist(ips []string) gin.HandlerFunc {
	blocked := make(map[string]struct{}, len(ips))
	for _, ip := range ips {
		blocked[ip] = struct{}{}
	}

	return func(c *gin.Context) {
		if _, exists := blocked[c.ClientIP()]; exists {
			response.Error(c, http.StatusForbidden, "access denied")
			c.Abort()
			return
		}
		c.Next()
	}
}
