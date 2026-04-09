package resilience

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type RateRule struct {
	Name   string
	Limit  int
	Window time.Duration
}

type RateDecision struct {
	Allowed    bool
	RetryAfter time.Duration
	Remaining  int
}

type RateLimiter struct {
	redis    *redis.Client
	log      *slog.Logger
	prefix   string
	fallback sync.Map
}

type localWindow struct {
	mu      sync.Mutex
	count   int
	resetAt time.Time
}

func NewRateLimiter(redisClient *redis.Client, log *slog.Logger, prefix string) *RateLimiter {
	return &RateLimiter{
		redis:  redisClient,
		log:    log,
		prefix: prefix,
	}
}

func (l *RateLimiter) Allow(ctx context.Context, key string, rule RateRule) RateDecision {
	if rule.Limit <= 0 || rule.Window <= 0 {
		return RateDecision{Allowed: true}
	}

	namespacedKey := fmt.Sprintf("%s:ratelimit:%s:%s", l.prefix, rule.Name, key)
	if l.redis != nil {
		script := redis.NewScript(`
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[2])
end
local ttl = redis.call("PTTL", KEYS[1])
return {current, ttl}
`)

		result, err := script.Run(ctx, l.redis, []string{namespacedKey}, rule.Limit, rule.Window.Milliseconds()).Result()
		if err == nil {
			values, ok := result.([]any)
			if ok && len(values) == 2 {
				current := toInt(values[0])
				ttl := time.Duration(toInt(values[1])) * time.Millisecond
				remaining := rule.Limit - current
				if remaining < 0 {
					remaining = 0
				}

				return RateDecision{
					Allowed:    current <= rule.Limit,
					RetryAfter: ttl,
					Remaining:  remaining,
				}
			}
		} else {
			l.log.Warn("redis rate limit fallback engaged", "key", rule.Name, "error", err)
		}
	}

	return l.localAllow(namespacedKey, rule)
}

func (l *RateLimiter) localAllow(key string, rule RateRule) RateDecision {
	windowAny, _ := l.fallback.LoadOrStore(key, &localWindow{})
	window := windowAny.(*localWindow)

	window.mu.Lock()
	defer window.mu.Unlock()

	now := time.Now()
	if window.resetAt.IsZero() || now.After(window.resetAt) {
		window.count = 0
		window.resetAt = now.Add(rule.Window)
	}

	window.count++
	remaining := rule.Limit - window.count
	if remaining < 0 {
		remaining = 0
	}

	return RateDecision{
		Allowed:    window.count <= rule.Limit,
		RetryAfter: time.Until(window.resetAt),
		Remaining:  remaining,
	}
}

func toInt(value any) int {
	switch typed := value.(type) {
	case int64:
		return int(typed)
	case int:
		return typed
	default:
		return 0
	}
}
