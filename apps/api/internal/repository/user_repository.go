package repository

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"fluxfiles/api/internal/model"

	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) GetByID(ctx context.Context, id uint) (*model.User, error) {
	var user model.User
	if err := r.db.WithContext(ctx).First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetEnabledPublicByUsername(ctx context.Context, username string) (*model.User, error) {
	var user model.User
	if err := r.db.WithContext(ctx).
		Where("LOWER(username) = ? AND is_enabled = ?", strings.ToLower(username), true).
		First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetByUsername(ctx context.Context, username string) (*model.User, error) {
	var user model.User
	if err := r.db.WithContext(ctx).Where("LOWER(username) = ?", strings.ToLower(username)).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	var user model.User
	if err := r.db.WithContext(ctx).Where("LOWER(email) = ?", strings.ToLower(email)).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) CountAdmins(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.User{}).Where("role = ?", "admin").Count(&count).Error
	return count, err
}

type UserListQuery struct {
	Page     int
	PageSize int
	Search   string
}

func (r *UserRepository) List(ctx context.Context, query UserListQuery) ([]model.User, int64, error) {
	scope := r.db.WithContext(ctx).Model(&model.User{})

	if search := strings.TrimSpace(query.Search); search != "" {
		like := "%" + strings.ToLower(search) + "%"
		scope = scope.Where(
			"LOWER(username) LIKE ? OR LOWER(email) LIKE ? OR LOWER(display_name) LIKE ?",
			like,
			like,
			like,
		)
	}

	var total int64
	if err := scope.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page := query.Page
	if page < 1 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	var users []model.User
	if err := scope.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&users).Error; err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

func (r *UserRepository) CountEnabledAdminsExcluding(ctx context.Context, excludeUserID uint) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&model.User{}).
		Where("role = ? AND is_enabled = ? AND id <> ?", "admin", true, excludeUserID).
		Count(&count).Error
	return count, err
}

func (r *UserRepository) CountEnabledAdminsWithPermissionExcluding(ctx context.Context, excludeUserID uint, permission string) (int64, error) {
	var count int64
	permissionJSON, err := json.Marshal([]string{permission})
	if err != nil {
		return 0, err
	}

	err = r.db.WithContext(ctx).
		Model(&model.User{}).
		Where("role = ? AND is_enabled = ? AND id <> ? AND permissions @> ?::jsonb", "admin", true, excludeUserID, string(permissionJSON)).
		Count(&count).Error
	return count, err
}

func (r *UserRepository) Create(ctx context.Context, user *model.User) error {
	return r.db.WithContext(ctx).Create(user).Error
}

func (r *UserRepository) Update(ctx context.Context, user *model.User, values map[string]any) error {
	if displayName, ok := values["display_name"].(string); ok {
		user.DisplayName = displayName
	}
	if email, ok := values["email"].(string); ok {
		user.Email = email
	}
	if bio, ok := values["bio"].(string); ok {
		user.Bio = bio
	}
	if avatarURL, ok := values["avatar_url"].(string); ok {
		user.AvatarURL = avatarURL
	}
	if role, ok := values["role"].(string); ok {
		user.Role = role
	}
	if permissions, ok := values["permissions"].([]string); ok {
		user.Permissions = permissions
	}
	if profileVisibility, ok := values["profile_visibility"].(model.UserProfileVisibility); ok {
		user.ProfileVisibility = profileVisibility
	}
	if isEnabled, ok := values["is_enabled"].(bool); ok {
		user.IsEnabled = isEnabled
	}
	if passwordHash, ok := values["password_hash"].(string); ok {
		user.PasswordHash = passwordHash
	}

	return r.db.WithContext(ctx).Save(user).Error
}

func (r *UserRepository) TouchLastLogin(ctx context.Context, userID uint) error {
	return r.db.WithContext(ctx).
		Model(&model.User{}).
		Where("id = ?", userID).
		Update("last_login_at", time.Now().UTC()).Error
}
