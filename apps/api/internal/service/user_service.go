package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"fluxfiles/api/internal/model"
	"fluxfiles/api/internal/repository"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var emailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

type RegisterInput struct {
	Username    string
	Email       string
	DisplayName string
	Password    string
}

type UpdateProfileInput struct {
	DisplayName string
	Email       string
}

type ChangePasswordInput struct {
	CurrentPassword string
	NewPassword     string
}

type UserService struct {
	users   *repository.UserRepository
	library *repository.UserLibraryRepository
}

func NewUserService(users *repository.UserRepository, library *repository.UserLibraryRepository) *UserService {
	return &UserService{
		users:   users,
		library: library,
	}
}

func (s *UserService) Register(ctx context.Context, input RegisterInput) (*model.User, error) {
	username := strings.TrimSpace(input.Username)
	email := strings.ToLower(strings.TrimSpace(input.Email))
	displayName := strings.TrimSpace(input.DisplayName)
	password := strings.TrimSpace(input.Password)

	if username == "" || email == "" || displayName == "" || password == "" {
		return nil, ErrValidation
	}
	if !emailPattern.MatchString(email) {
		return nil, fmt.Errorf("%w: invalid email format", ErrValidation)
	}

	if _, err := s.users.GetByUsername(ctx, username); err == nil {
		return nil, fmt.Errorf("%w: username already exists", ErrValidation)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrDependencyUnavailable
	}

	if _, err := s.users.GetByEmail(ctx, email); err == nil {
		return nil, fmt.Errorf("%w: email already exists", ErrValidation)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrDependencyUnavailable
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, ErrDependencyUnavailable
	}

	user := &model.User{
		Username:     username,
		Email:        email,
		DisplayName:  displayName,
		PasswordHash: string(hash),
		Role:         "user",
		IsEnabled:    true,
	}
	if err := s.users.Create(ctx, user); err != nil {
		return nil, ErrDependencyUnavailable
	}
	return user, nil
}

func (s *UserService) GetByID(ctx context.Context, id uint) (*model.User, error) {
	user, err := s.users.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, ErrDependencyUnavailable
	}
	return user, nil
}

func (s *UserService) UpdateProfile(ctx context.Context, userID uint, input UpdateProfileInput) (*model.User, error) {
	user, err := s.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	values := map[string]any{}
	if displayName := strings.TrimSpace(input.DisplayName); displayName != "" && displayName != user.DisplayName {
		values["display_name"] = displayName
	}

	if email := strings.ToLower(strings.TrimSpace(input.Email)); email != "" && email != user.Email {
		if !emailPattern.MatchString(email) {
			return nil, fmt.Errorf("%w: invalid email format", ErrValidation)
		}
		if existing, err := s.users.GetByEmail(ctx, email); err == nil && existing.ID != userID {
			return nil, fmt.Errorf("%w: email already exists", ErrValidation)
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDependencyUnavailable
		}
		values["email"] = email
	}

	if len(values) == 0 {
		return user, nil
	}
	if err := s.users.Update(ctx, user, values); err != nil {
		return nil, ErrDependencyUnavailable
	}
	return s.GetByID(ctx, userID)
}

func (s *UserService) ChangePassword(ctx context.Context, userID uint, input ChangePasswordInput) error {
	user, err := s.GetByID(ctx, userID)
	if err != nil {
		return err
	}

	if strings.TrimSpace(input.CurrentPassword) == "" || strings.TrimSpace(input.NewPassword) == "" {
		return ErrValidation
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.CurrentPassword)); err != nil {
		return ErrUnauthorized
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return ErrDependencyUnavailable
	}
	if err := s.users.Update(ctx, user, map[string]any{"password_hash": string(hash)}); err != nil {
		return ErrDependencyUnavailable
	}
	return nil
}

func (s *UserService) AddFavorite(ctx context.Context, userID, fileID uint) error {
	if err := s.library.AddFavorite(ctx, userID, fileID); err != nil {
		return ErrDependencyUnavailable
	}
	return nil
}

func (s *UserService) RemoveFavorite(ctx context.Context, userID, fileID uint) error {
	if err := s.library.RemoveFavorite(ctx, userID, fileID); err != nil {
		return ErrDependencyUnavailable
	}
	return nil
}

func (s *UserService) ListFavorites(ctx context.Context, userID uint) ([]model.File, error) {
	items, err := s.library.ListFavorites(ctx, userID)
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	return items, nil
}

func (s *UserService) RecordDownload(ctx context.Context, userID, fileID uint) error {
	if err := s.library.RecordDownload(ctx, userID, fileID); err != nil {
		return ErrDependencyUnavailable
	}
	return nil
}

func (s *UserService) ListDownloads(ctx context.Context, userID uint, limit int) ([]repository.UserDownloadItem, error) {
	items, err := s.library.ListDownloads(ctx, userID, limit)
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	return items, nil
}
