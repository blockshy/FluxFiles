package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"fluxfiles/api/internal/config"
	"fluxfiles/api/internal/model"
	"fluxfiles/api/internal/repository"
	"fluxfiles/api/pkg/auth"

	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthService struct {
	cfg        config.SecurityConfig
	users      *repository.UserRepository
	redis      *redis.Client
	jwtManager *auth.JWTManager
}

type LoginResult struct {
	Token     string      `json:"token"`
	ExpiresAt time.Time   `json:"expiresAt"`
	User      *model.User `json:"user"`
}

func NewAuthService(
	cfg config.SecurityConfig,
	users *repository.UserRepository,
	redisClient *redis.Client,
	jwtManager *auth.JWTManager,
) *AuthService {
	return &AuthService{
		cfg:        cfg,
		users:      users,
		redis:      redisClient,
		jwtManager: jwtManager,
	}
}

func (s *AuthService) EnsureBootstrapAdmin(ctx context.Context) error {
	if s.cfg.AdminBootstrapUser == "" || s.cfg.AdminBootstrapPass == "" {
		return nil
	}

	count, err := s.users.CountAdmins(ctx)
	if err != nil {
		return err
	}

	if count > 0 {
		return nil
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(s.cfg.AdminBootstrapPass), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	return s.users.Create(ctx, &model.User{
		Username:     s.cfg.AdminBootstrapUser,
		Email:        fmt.Sprintf("%s@local.fluxfiles", strings.ToLower(s.cfg.AdminBootstrapUser)),
		DisplayName:  s.cfg.AdminBootstrapUser,
		AvatarURL:    buildDefaultAvatarDataURL(s.cfg.AdminBootstrapUser, s.cfg.AdminBootstrapUser),
		PasswordHash: string(passwordHash),
		Role:         "admin",
		Permissions:  append([]string(nil), AllPermissions...),
		IsEnabled:    true,
	})
}

func (s *AuthService) Login(ctx context.Context, username, password, ip string) (*LoginResult, error) {
	username = strings.TrimSpace(username)
	if username == "" || password == "" {
		return nil, ErrValidation
	}

	blocked, err := s.isBlocked(ctx, username, ip)
	if err != nil {
		return nil, err
	}
	if blocked {
		return nil, ErrTooManyAttempts
	}

	user, err := s.users.GetByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			s.recordFailure(ctx, username, ip)
			return nil, ErrUnauthorized
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		s.recordFailure(ctx, username, ip)
		return nil, ErrUnauthorized
	}
	if !user.IsEnabled {
		return nil, ErrForbidden
	}

	if err := s.clearFailures(ctx, username, ip); err != nil {
		return nil, err
	}

	token, expiresAt, err := s.jwtManager.Generate(user.ID, user.Username, user.Role)
	if err != nil {
		return nil, err
	}
	_ = s.users.TouchLastLogin(ctx, user.ID)
	applyResolvedAvatar(user)

	return &LoginResult{
		Token:     token,
		ExpiresAt: expiresAt,
		User:      user,
	}, nil
}

func (s *AuthService) ParseToken(token string) (*auth.Claims, error) {
	return s.jwtManager.Parse(token)
}

func (s *AuthService) GetUserByID(ctx context.Context, userID uint) (*model.User, error) {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUnauthorized
		}
		return nil, ErrDependencyUnavailable
	}
	if !user.IsEnabled {
		return nil, ErrForbidden
	}
	applyResolvedAvatar(user)
	return user, nil
}

func (s *AuthService) isBlocked(ctx context.Context, username, ip string) (bool, error) {
	if s.redis == nil {
		return false, nil
	}

	count, err := s.redis.Get(ctx, s.failureKey(username, ip)).Int()
	if err != nil && !errors.Is(err, redis.Nil) {
		return false, fmt.Errorf("%w: failed to read login failure counter", ErrDependencyUnavailable)
	}

	return count >= s.cfg.LoginFailureLimit, nil
}

func (s *AuthService) recordFailure(ctx context.Context, username, ip string) {
	if s.redis == nil {
		return
	}

	key := s.failureKey(username, ip)
	ttl := time.Duration(s.cfg.LoginBlockMinutes) * time.Minute

	pipe := s.redis.TxPipeline()
	pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, ttl)
	_, _ = pipe.Exec(ctx)
}

func (s *AuthService) clearFailures(ctx context.Context, username, ip string) error {
	if s.redis == nil {
		return nil
	}
	return s.redis.Del(ctx, s.failureKey(username, ip)).Err()
}

func (s *AuthService) failureKey(username, ip string) string {
	return fmt.Sprintf("fluxfiles:login_failures:%s:%s", strings.ToLower(username), ip)
}
