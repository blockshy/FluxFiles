package resilience

import (
	"log/slog"
	"time"

	"github.com/sony/gobreaker/v2"
)

type Breakers struct {
	OSS *gobreaker.CircuitBreaker[any]
	DB  *gobreaker.CircuitBreaker[any]
}

func NewBreakers(log *slog.Logger) *Breakers {
	return &Breakers{
		OSS: newBreaker("oss", log),
		DB:  newBreaker("database", log),
	}
}

func newBreaker(name string, log *slog.Logger) *gobreaker.CircuitBreaker[any] {
	settings := gobreaker.Settings{
		Name:        name,
		MaxRequests: 2,
		Interval:    30 * time.Second,
		Timeout:     15 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= 5
		},
		OnStateChange: func(name string, from, to gobreaker.State) {
			log.Warn("circuit breaker state changed", "name", name, "from", from.String(), "to", to.String())
		},
	}
	return gobreaker.NewCircuitBreaker[any](settings)
}
