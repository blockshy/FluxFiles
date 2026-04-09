package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type CaptchaChallenge struct {
	ID       string `json:"id"`
	Question string `json:"question"`
}

type captchaEntry struct {
	Answer    string
	ExpiresAt time.Time
}

type CaptchaService struct {
	redis  *redis.Client
	prefix string
	ttl    time.Duration
	store  sync.Map
}

func NewCaptchaService(redisClient *redis.Client, prefix string) *CaptchaService {
	return &CaptchaService{
		redis:  redisClient,
		prefix: prefix,
		ttl:    5 * time.Minute,
	}
}

func (s *CaptchaService) Generate(ctx context.Context) (*CaptchaChallenge, error) {
	left, err := randomInt(1, 9)
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	right, err := randomInt(1, 9)
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	if left < right {
		left, right = right, left
	}
	useAdd, err := randomInt(0, 1)
	if err != nil {
		return nil, ErrDependencyUnavailable
	}

	operator := "+"
	answer := left + right
	if useAdd == 0 {
		operator = "-"
		answer = left - right
	}

	id, err := randomToken(16)
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	if err := s.save(ctx, id, strconv.Itoa(answer)); err != nil {
		return nil, err
	}

	return &CaptchaChallenge{
		ID:       id,
		Question: fmt.Sprintf("%d %s %d = ?", left, operator, right),
	}, nil
}

func (s *CaptchaService) Verify(ctx context.Context, id, answer string) (bool, error) {
	id = strings.TrimSpace(id)
	answer = strings.TrimSpace(answer)
	if id == "" || answer == "" {
		return false, nil
	}

	expected, ok, err := s.loadAndDelete(ctx, id)
	if err != nil {
		return false, err
	}
	if !ok {
		return false, nil
	}
	return expected == answer, nil
}

func (s *CaptchaService) save(ctx context.Context, id, answer string) error {
	if s.redis != nil {
		if err := s.redis.Set(ctx, s.redisKey(id), answer, s.ttl).Err(); err != nil {
			return ErrDependencyUnavailable
		}
		return nil
	}

	s.store.Store(id, captchaEntry{
		Answer:    answer,
		ExpiresAt: time.Now().Add(s.ttl),
	})
	return nil
}

func (s *CaptchaService) loadAndDelete(ctx context.Context, id string) (string, bool, error) {
	if s.redis != nil {
		value, err := s.redis.Get(ctx, s.redisKey(id)).Result()
		if err == redis.Nil {
			return "", false, nil
		}
		if err != nil {
			return "", false, ErrDependencyUnavailable
		}
		if err := s.redis.Del(ctx, s.redisKey(id)).Err(); err != nil {
			return "", false, ErrDependencyUnavailable
		}
		return value, true, nil
	}

	raw, ok := s.store.Load(id)
	if !ok {
		return "", false, nil
	}
	s.store.Delete(id)
	entry, castOK := raw.(captchaEntry)
	if !castOK || time.Now().After(entry.ExpiresAt) {
		return "", false, nil
	}
	return entry.Answer, true, nil
}

func (s *CaptchaService) redisKey(id string) string {
	return fmt.Sprintf("%s:captcha:%s", s.prefix, id)
}

func randomToken(size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func randomInt(min, max int) (int, error) {
	if max <= min {
		return min, nil
	}
	var b [1]byte
	if _, err := rand.Read(b[:]); err != nil {
		return 0, err
	}
	return min + int(b[0])%(max-min+1), nil
}
