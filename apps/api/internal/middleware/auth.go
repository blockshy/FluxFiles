package middleware

import (
	"net/http"
	"strings"

	"fluxfiles/api/internal/service"
	"fluxfiles/api/pkg/response"

	"github.com/gin-gonic/gin"
)

func RequireAdmin(authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := strings.TrimSpace(c.GetHeader("Authorization"))
		if !strings.HasPrefix(strings.ToLower(header), "bearer ") {
			response.Error(c, http.StatusUnauthorized, "missing authorization token")
			c.Abort()
			return
		}

		token := strings.TrimSpace(header[7:])
		claims, err := authService.ParseToken(token)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "invalid or expired token")
			c.Abort()
			return
		}

		if claims.Role != "admin" {
			response.Error(c, http.StatusForbidden, "admin privileges required")
			c.Abort()
			return
		}

		c.Set("adminUserID", claims.UserID)
		c.Set("adminUsername", claims.Username)
		c.Next()
	}
}
