package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"fluxfiles/api/pkg/resilience"
	"fluxfiles/api/pkg/response"

	"github.com/gin-gonic/gin"
)

func RateLimit(limiter *resilience.RateLimiter, rule resilience.RateRule) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := fmt.Sprintf("%s:%s", c.ClientIP(), c.FullPath())
		decision := limiter.Allow(c.Request.Context(), key, rule)
		if !decision.Allowed {
			c.Header("Retry-After", strconv.Itoa(int(decision.RetryAfter/time.Second)+1))
			response.Error(c, http.StatusTooManyRequests, "rate limit exceeded, please retry later")
			c.Abort()
			return
		}

		c.Header("X-RateLimit-Remaining", strconv.Itoa(decision.Remaining))
		c.Next()
	}
}
