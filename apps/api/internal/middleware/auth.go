package middleware

import (
	"net/http"
	"strings"

	"fluxfiles/api/internal/service"
	"fluxfiles/api/pkg/response"

	"github.com/gin-gonic/gin"
)

func RequireAuth(authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, err := parseClaims(c, authService)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "invalid or expired token")
			c.Abort()
			return
		}

		setClaims(c, claims)
		c.Next()
	}
}

func OptionalAuth(authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, err := parseClaims(c, authService)
		if err == nil && claims != nil {
			setClaims(c, claims)
		}
		c.Next()
	}
}

func RequireAdmin(authService *service.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, err := parseClaims(c, authService)
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

		setClaims(c, claims)
		c.Set("adminUserID", claims.UserID)
		c.Set("adminUsername", claims.Username)
		c.Next()
	}
}

func RequirePermission(authService *service.AuthService, permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, err := parseClaims(c, authService)
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
		if !service.HasPermission(claims.Permissions, permission) {
			response.Error(c, http.StatusForbidden, "insufficient permissions")
			c.Abort()
			return
		}

		setClaims(c, claims)
		c.Set("adminUserID", claims.UserID)
		c.Set("adminUsername", claims.Username)
		c.Next()
	}
}

func RequireAnyPermission(authService *service.AuthService, permissions ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, err := parseClaims(c, authService)
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
		if !service.HasAnyPermission(claims.Permissions, permissions...) {
			response.Error(c, http.StatusForbidden, "insufficient permissions")
			c.Abort()
			return
		}

		setClaims(c, claims)
		c.Set("adminUserID", claims.UserID)
		c.Set("adminUsername", claims.Username)
		c.Next()
	}
}

func parseClaims(c *gin.Context, authService *service.AuthService) (anyClaims *serviceClaims, err error) {
	header := strings.TrimSpace(c.GetHeader("Authorization"))
	if !strings.HasPrefix(strings.ToLower(header), "bearer ") {
		return nil, http.ErrNoCookie
	}

	token := strings.TrimSpace(header[7:])
	claims, err := authService.ParseToken(token)
	if err != nil {
		return nil, err
	}
	user, err := authService.GetUserByID(c.Request.Context(), claims.UserID)
	if err != nil {
		return nil, err
	}

	return &serviceClaims{
		UserID:      user.ID,
		Username:    user.Username,
		Role:        user.Role,
		Permissions: append([]string(nil), user.Permissions...),
	}, nil
}

type serviceClaims struct {
	UserID      uint
	Username    string
	Role        string
	Permissions []string
}

func setClaims(c *gin.Context, claims *serviceClaims) {
	c.Set("userID", claims.UserID)
	c.Set("username", claims.Username)
	c.Set("userRole", claims.Role)
	c.Set("userPermissions", claims.Permissions)
}
