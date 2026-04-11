package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

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
	DisplayName       string
	Email             string
	AvatarURL         string
	Bio               string
	ProfileVisibility model.UserProfileVisibility
}

type ChangePasswordInput struct {
	CurrentPassword string
	NewPassword     string
}

type UserService struct {
	users   *repository.UserRepository
	library *repository.UserLibraryRepository
	files   *repository.FileRepository
}

type PublicProfileStats struct {
	PublishedFiles int64 `json:"publishedFiles"`
	Favorites      int64 `json:"favorites"`
}

type PublicUserProfile struct {
	ID                uint                        `json:"id"`
	Username          string                      `json:"username"`
	DisplayName       string                      `json:"displayName"`
	AvatarURL         string                      `json:"avatarUrl"`
	Bio               string                      `json:"bio"`
	CreatedAt         string                      `json:"createdAt"`
	ProfileVisibility model.UserProfileVisibility `json:"profileVisibility"`
	Stats             *PublicProfileStats         `json:"stats,omitempty"`
	PublishedFiles    []model.File                `json:"publishedFiles,omitempty"`
	Favorites         []model.File                `json:"favorites,omitempty"`
}

func NewUserService(users *repository.UserRepository, library *repository.UserLibraryRepository, files *repository.FileRepository) *UserService {
	return &UserService{
		users:   users,
		library: library,
		files:   files,
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
		AvatarURL:    buildDefaultAvatarDataURL(username, displayName),
		PasswordHash: string(hash),
		Role:         "user",
		IsEnabled:    true,
	}
	if err := s.users.Create(ctx, user); err != nil {
		return nil, ErrDependencyUnavailable
	}
	applyResolvedAvatar(user)
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
	applyResolvedAvatar(user)
	return user, nil
}

func (s *UserService) UpdateProfile(ctx context.Context, userID uint, input UpdateProfileInput) (*model.User, error) {
	user, err := s.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	values := map[string]any{}
	displayName := strings.TrimSpace(input.DisplayName)
	if displayName != "" && displayName != user.DisplayName {
		values["display_name"] = displayName
	}
	nextDisplayName := user.DisplayName
	if displayName != "" {
		nextDisplayName = displayName
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
	if bio := strings.TrimSpace(input.Bio); bio != user.Bio {
		values["bio"] = bio
	}
	if avatarURL := resolveAvatarURL(user.Username, nextDisplayName, input.AvatarURL); avatarURL != user.AvatarURL {
		values["avatar_url"] = avatarURL
	}
	if input.ProfileVisibility != user.ProfileVisibility {
		values["profile_visibility"] = input.ProfileVisibility
	}

	if len(values) == 0 {
		return user, nil
	}
	if err := s.users.Update(ctx, user, values); err != nil {
		return nil, ErrDependencyUnavailable
	}
	return s.GetByID(ctx, userID)
}

func (s *UserService) GetPublicProfile(ctx context.Context, username string) (*PublicUserProfile, error) {
	user, err := s.users.GetEnabledPublicByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, ErrDependencyUnavailable
	}

	profile := &PublicUserProfile{
		ID:                user.ID,
		Username:          user.Username,
		DisplayName:       user.DisplayName,
		AvatarURL:         resolveAvatarURL(user.Username, user.DisplayName, user.AvatarURL),
		CreatedAt:         user.CreatedAt.Format(time.RFC3339),
		ProfileVisibility: user.ProfileVisibility,
	}

	if user.ProfileVisibility.ShowBio {
		profile.Bio = user.Bio
	}

	if user.ProfileVisibility.ShowStats {
		publishedCount := int64(0)
		favoritesCount := int64(0)
		if _, total, err := s.files.List(ctx, repository.FileListParams{Page: 1, PageSize: 1, PublicOnly: true, OwnerID: &user.ID}); err == nil {
			publishedCount = total
		} else {
			return nil, ErrDependencyUnavailable
		}
		if total, err := s.library.CountPublicFavorites(ctx, user.ID); err == nil {
			favoritesCount = total
		} else {
			return nil, ErrDependencyUnavailable
		}
		profile.Stats = &PublicProfileStats{
			PublishedFiles: publishedCount,
			Favorites:      favoritesCount,
		}
	}

	if user.ProfileVisibility.ShowPublishedFiles {
		items, _, err := s.files.List(ctx, repository.FileListParams{
			Page:       1,
			PageSize:   12,
			PublicOnly: true,
			OwnerID:    &user.ID,
			SortBy:     "createdAt",
			SortOrder:  "desc",
		})
		if err != nil {
			return nil, ErrDependencyUnavailable
		}
		applyResolvedFileUploaderAvatars(items)
		profile.PublishedFiles = items
	}

	if user.ProfileVisibility.ShowFavorites {
		items, err := s.library.ListPublicFavorites(ctx, user.ID, 12)
		if err != nil {
			return nil, ErrDependencyUnavailable
		}
		applyResolvedFileUploaderAvatars(items)
		profile.Favorites = items
	}

	return profile, nil
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
	applyResolvedFileUploaderAvatars(items)
	return items, nil
}

type RecordDownloadInput struct {
	UserID    *uint
	FileID    uint
	IP        string
	UserAgent string
}

type ListDownloadRecordsInput struct {
	Page       int
	PageSize   int
	FileID     *uint
	Search     string
	UserSearch string
	IP         string
	AuthStatus string
	StartAt    *time.Time
	EndAt      *time.Time
}

func (s *UserService) RecordDownload(ctx context.Context, input RecordDownloadInput) error {
	if err := s.library.RecordDownload(ctx, input.UserID, input.FileID, input.IP, input.UserAgent); err != nil {
		return ErrDependencyUnavailable
	}
	return nil
}

func (s *UserService) ListDownloads(ctx context.Context, userID uint, limit int) ([]repository.UserDownloadItem, error) {
	items, err := s.library.ListDownloads(ctx, userID, limit)
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	for index := range items {
		applyResolvedFileUploaderAvatar(&items[index].File)
	}
	return items, nil
}

func (s *UserService) ListDownloadRecords(ctx context.Context, actorID uint, permissions []string, input ListDownloadRecordsInput) ([]repository.AdminDownloadRecord, int64, error) {
	if !HasPermission(permissions, PermissionAdminDownloadsView) {
		return nil, 0, ErrForbidden
	}
	var ownerID *uint
	if !HasPermission(permissions, PermissionAdminFilesAll) {
		if !HasPermission(permissions, PermissionAdminFilesOwn) {
			return nil, 0, ErrForbidden
		}
		ownerID = &actorID
	}

	items, total, err := s.library.ListAdminDownloads(ctx, repository.DownloadRecordQuery{
		Page:       input.Page,
		PageSize:   input.PageSize,
		FileID:     input.FileID,
		Search:     input.Search,
		UserSearch: input.UserSearch,
		IP:         input.IP,
		AuthStatus: input.AuthStatus,
		StartAt:    input.StartAt,
		EndAt:      input.EndAt,
		OwnerID:    ownerID,
	})
	if err != nil {
		return nil, 0, ErrDependencyUnavailable
	}
	return items, total, nil
}
