package repository

import (
	"context"

	"fluxfiles/api/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SystemSettingRepository struct {
	db *gorm.DB
}

func NewSystemSettingRepository(db *gorm.DB) *SystemSettingRepository {
	return &SystemSettingRepository{db: db}
}

func (r *SystemSettingRepository) GetByKey(ctx context.Context, key string) (*model.SystemSetting, error) {
	var item model.SystemSetting
	if err := r.db.WithContext(ctx).First(&item, "key = ?", key).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *SystemSettingRepository) Upsert(ctx context.Context, key, value string) error {
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "key"}},
		DoUpdates: clause.Assignments(map[string]any{
			"value":      value,
			"updated_at": gorm.Expr("NOW()"),
		}),
	}).Create(&model.SystemSetting{
		Key:   key,
		Value: value,
	}).Error
}
