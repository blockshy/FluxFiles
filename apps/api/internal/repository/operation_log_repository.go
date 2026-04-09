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
	AdminUsername string `json:"adminUsername"`
}

func (r *OperationLogRepository) List(ctx context.Context, query OperationLogListQuery) ([]OperationLogItem, int64, error) {
	scope := r.db.WithContext(ctx).
		Table("operation_logs").
		Select("operation_logs.*, users.username AS admin_username").
		Joins("LEFT JOIN users ON users.id = operation_logs.admin_user_id")

	if search := strings.TrimSpace(query.Search); search != "" {
		like := "%" + strings.ToLower(search) + "%"
		scope = scope.Where(
			"LOWER(operation_logs.detail) LIKE ? OR LOWER(operation_logs.target_id) LIKE ? OR LOWER(COALESCE(users.username, '')) LIKE ?",
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
