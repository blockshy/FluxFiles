package repository

import (
	"context"
	"fmt"
	"strings"

	"fluxfiles/api/internal/model"

	"gorm.io/gorm"
)

type TaxonomyKind string

const (
	TaxonomyKindCategory TaxonomyKind = "category"
	TaxonomyKindTag      TaxonomyKind = "tag"
)

type TaxonomyListQuery struct {
	Page     int
	PageSize int
	Search   string
}

type TaxonomyRepository struct {
	db *gorm.DB
}

func NewTaxonomyRepository(db *gorm.DB) *TaxonomyRepository {
	return &TaxonomyRepository{db: db}
}

func (r *TaxonomyRepository) List(ctx context.Context, kind TaxonomyKind, query TaxonomyListQuery) ([]model.Category, int64, error) {
	table, usageExpr, err := taxonomyTable(kind)
	if err != nil {
		return nil, 0, err
	}

	scope := r.db.WithContext(ctx).
		Table(table).
		Select(fmt.Sprintf(
			"%s.*, creator.username AS created_by_username, updater.username AS updated_by_username, %s AS usage_count",
			table,
			usageExpr,
		)).
		Joins(fmt.Sprintf("LEFT JOIN users creator ON creator.id = %s.created_by", table)).
		Joins(fmt.Sprintf("LEFT JOIN users updater ON updater.id = %s.updated_by", table)).
		Where(fmt.Sprintf("%s.deleted_at IS NULL", table))

	if search := strings.TrimSpace(strings.ToLower(query.Search)); search != "" {
		like := "%" + search + "%"
		scope = scope.Where(fmt.Sprintf("LOWER(%s.name) LIKE ?", table), like)
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

	var items []model.Category
	if err := scope.Order(fmt.Sprintf("%s.name ASC", table)).Offset((page - 1) * pageSize).Limit(pageSize).Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *TaxonomyRepository) ListOptions(ctx context.Context, kind TaxonomyKind) ([]model.Category, error) {
	table, usageExpr, err := taxonomyTable(kind)
	if err != nil {
		return nil, err
	}

	var items []model.Category
	if err := r.db.WithContext(ctx).
		Table(table).
		Select(fmt.Sprintf(
			"%s.*, creator.username AS created_by_username, updater.username AS updated_by_username, %s AS usage_count",
			table,
			usageExpr,
		)).
		Joins(fmt.Sprintf("LEFT JOIN users creator ON creator.id = %s.created_by", table)).
		Joins(fmt.Sprintf("LEFT JOIN users updater ON updater.id = %s.updated_by", table)).
		Where(fmt.Sprintf("%s.deleted_at IS NULL", table)).
		Order(fmt.Sprintf("%s.name ASC", table)).
		Scan(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *TaxonomyRepository) GetByID(ctx context.Context, kind TaxonomyKind, id uint) (*model.Category, error) {
	table, usageExpr, err := taxonomyTable(kind)
	if err != nil {
		return nil, err
	}

	var item model.Category
	if err := r.db.WithContext(ctx).
		Table(table).
		Select(fmt.Sprintf(
			"%s.*, creator.username AS created_by_username, updater.username AS updated_by_username, %s AS usage_count",
			table,
			usageExpr,
		)).
		Joins(fmt.Sprintf("LEFT JOIN users creator ON creator.id = %s.created_by", table)).
		Joins(fmt.Sprintf("LEFT JOIN users updater ON updater.id = %s.updated_by", table)).
		Where(fmt.Sprintf("%s.id = ? AND %s.deleted_at IS NULL", table, table), id).
		First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *TaxonomyRepository) GetByName(ctx context.Context, kind TaxonomyKind, name string) (*model.Category, error) {
	table, usageExpr, err := taxonomyTable(kind)
	if err != nil {
		return nil, err
	}

	var item model.Category
	if err := r.db.WithContext(ctx).
		Table(table).
		Select(fmt.Sprintf(
			"%s.*, creator.username AS created_by_username, updater.username AS updated_by_username, %s AS usage_count",
			table,
			usageExpr,
		)).
		Joins(fmt.Sprintf("LEFT JOIN users creator ON creator.id = %s.created_by", table)).
		Joins(fmt.Sprintf("LEFT JOIN users updater ON updater.id = %s.updated_by", table)).
		Where(fmt.Sprintf("LOWER(%s.name) = ? AND %s.deleted_at IS NULL", table, table), strings.ToLower(strings.TrimSpace(name))).
		First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *TaxonomyRepository) Create(ctx context.Context, kind TaxonomyKind, item *model.Category) error {
	table, _, err := taxonomyTable(kind)
	if err != nil {
		return err
	}
	return r.db.WithContext(ctx).Table(table).Create(item).Error
}

func (r *TaxonomyRepository) Update(ctx context.Context, kind TaxonomyKind, item *model.Category, values map[string]any) error {
	table, _, err := taxonomyTable(kind)
	if err != nil {
		return err
	}
	return r.db.WithContext(ctx).Table(table).Where("id = ? AND deleted_at IS NULL", item.ID).Updates(values).Error
}

func (r *TaxonomyRepository) Delete(ctx context.Context, kind TaxonomyKind, id uint) error {
	table, _, err := taxonomyTable(kind)
	if err != nil {
		return err
	}
	return r.db.WithContext(ctx).Table(table).Where("id = ? AND deleted_at IS NULL", id).Updates(map[string]any{
		"deleted_at": gorm.Expr("NOW()"),
		"updated_at": gorm.Expr("NOW()"),
	}).Error
}

func taxonomyTable(kind TaxonomyKind) (string, string, error) {
	switch kind {
	case TaxonomyKindCategory:
		return "categories", "(SELECT COUNT(*) FROM files WHERE files.category = categories.name AND files.deleted_at IS NULL)", nil
	case TaxonomyKindTag:
		return "tags", "(SELECT COUNT(*) FROM files WHERE jsonb_exists(files.tags, tags.name) AND files.deleted_at IS NULL)", nil
	default:
		return "", "", fmt.Errorf("invalid taxonomy kind")
	}
}
