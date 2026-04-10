package repository

import (
	"context"

	"fluxfiles/api/internal/model"

	"gorm.io/gorm"
)

type TaxonomyLogRepository struct {
	db *gorm.DB
}

func NewTaxonomyLogRepository(db *gorm.DB) *TaxonomyLogRepository {
	return &TaxonomyLogRepository{db: db}
}

func (r *TaxonomyLogRepository) Create(ctx context.Context, item *model.TaxonomyChangeLog) error {
	return r.db.WithContext(ctx).Create(item).Error
}

func (r *TaxonomyLogRepository) List(ctx context.Context, taxonomyType string, taxonomyID uint, page, pageSize int) ([]model.TaxonomyChangeLog, int64, error) {
	scope := r.db.WithContext(ctx).
		Table("taxonomy_change_logs").
		Select("taxonomy_change_logs.*, users.username AS admin_username").
		Joins("LEFT JOIN users ON users.id = taxonomy_change_logs.admin_user_id").
		Where("taxonomy_change_logs.taxonomy_type = ? AND taxonomy_change_logs.taxonomy_id = ?", taxonomyType, taxonomyID)

	var total int64
	if err := scope.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	var items []model.TaxonomyChangeLog
	if err := scope.Order("taxonomy_change_logs.created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}
