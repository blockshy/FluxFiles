package repository

import (
	"context"
	"strings"

	"fluxfiles/api/internal/model"

	"gorm.io/gorm"
)

type OperationLogRepository struct {
	db *gorm.DB
}

func NewOperationLogRepository(db *gorm.DB) *OperationLogRepository {
	return &OperationLogRepository{db: db}
}

func (r *OperationLogRepository) Create(ctx context.Context, log *model.OperationLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

type OperationLogListQuery struct {
	Page       int
	PageSize   int
	Search     string
	Action     string
	TargetType string
}

type OperationLogItem struct {
	model.OperationLog
	AdminUsername       string   `json:"adminUsername"`
	AdminDisplayName    string   `json:"adminDisplayName"`
	AdminAvatarURL      string   `json:"adminAvatarUrl"`
	AdminIsEnabled      bool     `json:"adminIsEnabled"`
	TargetUserID        uint     `json:"targetUserId,omitempty"`
	TargetUsername      string   `json:"targetUsername,omitempty"`
	TargetDisplayName   string   `json:"targetDisplayName,omitempty"`
	TargetEmail         string   `json:"targetEmail,omitempty"`
	TargetRole          string   `json:"targetRole,omitempty"`
	TargetAvatarURL     string   `json:"targetAvatarUrl,omitempty"`
	TargetPermissions   []string `gorm:"serializer:json" json:"targetPermissions,omitempty"`
	TargetUserIsEnabled bool     `json:"targetUserIsEnabled"`
}

func (r *OperationLogRepository) List(ctx context.Context, query OperationLogListQuery) ([]OperationLogItem, int64, error) {
	scope := r.db.WithContext(ctx).
		Table("operation_logs").
		Select(`
			operation_logs.*,
			admin_user.username AS admin_username,
			admin_user.display_name AS admin_display_name,
			admin_user.avatar_url AS admin_avatar_url,
			COALESCE(admin_user.is_enabled, FALSE) AS admin_is_enabled,
			COALESCE(target_user.id, 0) AS target_user_id,
			COALESCE(target_user.username, '') AS target_username,
			COALESCE(target_user.display_name, '') AS target_display_name,
			COALESCE(target_user.email, '') AS target_email,
			COALESCE(target_user.role, '') AS target_role,
			COALESCE(target_user.avatar_url, '') AS target_avatar_url,
			COALESCE(target_user.permissions, '[]'::jsonb) AS target_permissions,
			COALESCE(target_user.is_enabled, FALSE) AS target_user_is_enabled
		`).
		Joins("LEFT JOIN users admin_user ON admin_user.id = operation_logs.admin_user_id").
		Joins("LEFT JOIN users target_user ON operation_logs.target_type = 'user' AND operation_logs.target_id ~ '^[0-9]+$' AND target_user.id = CAST(operation_logs.target_id AS BIGINT)")

	if search := strings.TrimSpace(query.Search); search != "" {
		like := "%" + strings.ToLower(search) + "%"
		scope = scope.Where(
			`LOWER(operation_logs.detail) LIKE ?
				OR LOWER(operation_logs.target_id) LIKE ?
				OR LOWER(COALESCE(admin_user.username, '')) LIKE ?
				OR LOWER(COALESCE(admin_user.display_name, '')) LIKE ?
				OR LOWER(COALESCE(target_user.username, '')) LIKE ?
				OR LOWER(COALESCE(target_user.display_name, '')) LIKE ?`,
			like,
			like,
			like,
			like,
			like,
			like,
		)
	}
	if action := strings.TrimSpace(query.Action); action != "" {
		scope = scope.Where("operation_logs.action = ?", action)
	}
	if targetType := strings.TrimSpace(query.TargetType); targetType != "" {
		scope = scope.Where("operation_logs.target_type = ?", targetType)
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

	var items []OperationLogItem
	if err := scope.Order("operation_logs.created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}
