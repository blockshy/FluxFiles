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
	TaxonomyKindCategory    TaxonomyKind = "category"
	TaxonomyKindTagCategory TaxonomyKind = "tag_category"
	TaxonomyKindTag         TaxonomyKind = "tag"
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
	table, usageExpr, searchExpr, err := taxonomyTable(kind)
	if err != nil {
		return nil, 0, err
	}

	scope := r.db.WithContext(ctx).
		Table(table).
		Select(selectClause(kind, table, usageExpr)).
		Joins(fmt.Sprintf("LEFT JOIN users creator ON creator.id = %s.created_by", table)).
		Joins(fmt.Sprintf("LEFT JOIN users updater ON updater.id = %s.updated_by", table)).
		Joins(extraJoinClause(kind, table)).
		Where(fmt.Sprintf("%s.deleted_at IS NULL", table))

	if search := strings.TrimSpace(strings.ToLower(query.Search)); search != "" {
		like := "%" + search + "%"
		scope = scope.Where(searchExpr, like, like)
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
	if err := scope.Order(orderClause(kind, table)).Offset((page - 1) * pageSize).Limit(pageSize).Scan(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *TaxonomyRepository) ListOptions(ctx context.Context, kind TaxonomyKind) ([]model.Category, error) {
	table, usageExpr, _, err := taxonomyTable(kind)
	if err != nil {
		return nil, err
	}

	var items []model.Category
	if err := r.db.WithContext(ctx).
		Table(table).
		Select(selectClause(kind, table, usageExpr)).
		Joins(fmt.Sprintf("LEFT JOIN users creator ON creator.id = %s.created_by", table)).
		Joins(fmt.Sprintf("LEFT JOIN users updater ON updater.id = %s.updated_by", table)).
		Joins(extraJoinClause(kind, table)).
		Where(fmt.Sprintf("%s.deleted_at IS NULL", table)).
		Order(orderClause(kind, table)).
		Scan(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (r *TaxonomyRepository) GetByID(ctx context.Context, kind TaxonomyKind, id uint) (*model.Category, error) {
	table, usageExpr, _, err := taxonomyTable(kind)
	if err != nil {
		return nil, err
	}

	var item model.Category
	if err := r.db.WithContext(ctx).
		Table(table).
		Select(selectClause(kind, table, usageExpr)).
		Joins(fmt.Sprintf("LEFT JOIN users creator ON creator.id = %s.created_by", table)).
		Joins(fmt.Sprintf("LEFT JOIN users updater ON updater.id = %s.updated_by", table)).
		Joins(extraJoinClause(kind, table)).
		Where(fmt.Sprintf("%s.id = ? AND %s.deleted_at IS NULL", table, table), id).
		First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *TaxonomyRepository) GetByName(ctx context.Context, kind TaxonomyKind, name string) (*model.Category, error) {
	table, usageExpr, _, err := taxonomyTable(kind)
	if err != nil {
		return nil, err
	}

	var item model.Category
	if err := r.db.WithContext(ctx).
		Table(table).
		Select(selectClause(kind, table, usageExpr)).
		Joins(fmt.Sprintf("LEFT JOIN users creator ON creator.id = %s.created_by", table)).
		Joins(fmt.Sprintf("LEFT JOIN users updater ON updater.id = %s.updated_by", table)).
		Joins(extraJoinClause(kind, table)).
		Where(fmt.Sprintf("LOWER(%s.name) = ? AND %s.deleted_at IS NULL", table, table), strings.ToLower(strings.TrimSpace(name))).
		First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *TaxonomyRepository) Create(ctx context.Context, kind TaxonomyKind, item *model.Category) error {
	table, _, _, err := taxonomyTable(kind)
	if err != nil {
		return err
	}
	switch kind {
	case TaxonomyKindCategory, TaxonomyKindTagCategory:
		row := struct {
			ID        uint   `gorm:"column:id"`
			Name      string `gorm:"column:name"`
			ParentID  *uint  `gorm:"column:parent_id"`
			SortOrder int    `gorm:"column:sort_order"`
			CreatedBy uint   `gorm:"column:created_by"`
			UpdatedBy uint   `gorm:"column:updated_by"`
		}{
			Name:      item.Name,
			ParentID:  item.ParentID,
			SortOrder: item.SortOrder,
			CreatedBy: item.CreatedBy,
			UpdatedBy: item.UpdatedBy,
		}
		if err := r.db.WithContext(ctx).Table(table).Create(&row).Error; err != nil {
			return err
		}
		item.ID = row.ID
		return nil
	case TaxonomyKindTag:
		row := struct {
			ID            uint   `gorm:"column:id"`
			Name          string `gorm:"column:name"`
			TagCategoryID *uint  `gorm:"column:tag_category_id"`
			SortOrder     int    `gorm:"column:sort_order"`
			CreatedBy     uint   `gorm:"column:created_by"`
			UpdatedBy     uint   `gorm:"column:updated_by"`
		}{
			Name:          item.Name,
			TagCategoryID: item.CategoryID,
			SortOrder:     item.SortOrder,
			CreatedBy:     item.CreatedBy,
			UpdatedBy:     item.UpdatedBy,
		}
		if err := r.db.WithContext(ctx).Table(table).Create(&row).Error; err != nil {
			return err
		}
		item.ID = row.ID
		return nil
	default:
		return fmt.Errorf("invalid taxonomy kind")
	}
}

func (r *TaxonomyRepository) Update(ctx context.Context, kind TaxonomyKind, item *model.Category, values map[string]any) error {
	table, _, _, err := taxonomyTable(kind)
	if err != nil {
		return err
	}
	return r.db.WithContext(ctx).Table(table).Where("id = ? AND deleted_at IS NULL", item.ID).Updates(values).Error
}

func (r *TaxonomyRepository) Delete(ctx context.Context, kind TaxonomyKind, id uint) error {
	table, _, _, err := taxonomyTable(kind)
	if err != nil {
		return err
	}
	return r.db.WithContext(ctx).Table(table).Where("id = ? AND deleted_at IS NULL", id).Delete(nil).Error
}

func (r *TaxonomyRepository) NextSortOrder(ctx context.Context, kind TaxonomyKind, parentID *uint) (int, error) {
	table, _, _, err := taxonomyTable(kind)
	if err != nil {
		return 0, err
	}
	column := relationColumn(kind)
	scope := r.db.WithContext(ctx).Table(table).Where("deleted_at IS NULL")
	if parentID == nil {
		scope = scope.Where(fmt.Sprintf("%s IS NULL", column))
	} else {
		scope = scope.Where(fmt.Sprintf("%s = ?", column), *parentID)
	}
	var maxValue int
	if err := scope.Select("COALESCE(MAX(sort_order), 0)").Scan(&maxValue).Error; err != nil {
		return 0, err
	}
	return maxValue + 1, nil
}

func (r *TaxonomyRepository) CountCategoryChildren(ctx context.Context, kind TaxonomyKind, id uint) (int64, int64, error) {
	switch kind {
	case TaxonomyKindCategory:
		var childCategories int64
		if err := r.db.WithContext(ctx).Table("categories").Where("parent_id = ? AND deleted_at IS NULL", id).Count(&childCategories).Error; err != nil {
			return 0, 0, err
		}
		return childCategories, 0, nil
	case TaxonomyKindTagCategory:
		var childCategories int64
		if err := r.db.WithContext(ctx).Table("tag_categories").Where("parent_id = ? AND deleted_at IS NULL", id).Count(&childCategories).Error; err != nil {
			return 0, 0, err
		}
		var childTags int64
		if err := r.db.WithContext(ctx).Table("tags").Where("tag_category_id = ? AND deleted_at IS NULL", id).Count(&childTags).Error; err != nil {
			return 0, 0, err
		}
		return childCategories, childTags, nil
	default:
		return 0, 0, nil
	}
}

func (r *TaxonomyRepository) Move(ctx context.Context, kind TaxonomyKind, id uint, direction string) error {
	item, err := r.GetByID(ctx, kind, id)
	if err != nil {
		return err
	}
	table, _, _, err := taxonomyTable(kind)
	if err != nil {
		return err
	}
	column := relationColumn(kind)
	parentID := relationID(kind, item)
	scope := r.db.WithContext(ctx).Table(table).Where("deleted_at IS NULL")
	if parentID == nil {
		scope = scope.Where(fmt.Sprintf("%s IS NULL", column))
	} else {
		scope = scope.Where(fmt.Sprintf("%s = ?", column), *parentID)
	}

	compare := "<"
	order := "DESC"
	if strings.EqualFold(direction, "down") {
		compare = ">"
		order = "ASC"
	}

	var sibling model.Category
	if err := scope.
		Where(fmt.Sprintf("sort_order %s ?", compare), item.SortOrder).
		Order(fmt.Sprintf("sort_order %s", order)).
		Limit(1).
		Scan(&sibling).Error; err != nil {
		return err
	}
	if sibling.ID == 0 {
		return nil
	}

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Table(table).Where("id = ?", item.ID).Update("sort_order", sibling.SortOrder).Error; err != nil {
			return err
		}
		if err := tx.Table(table).Where("id = ?", sibling.ID).Update("sort_order", item.SortOrder).Error; err != nil {
			return err
		}
		return nil
	})
}

func taxonomyTable(kind TaxonomyKind) (string, string, string, error) {
	switch kind {
	case TaxonomyKindCategory:
		return "categories", "(SELECT COUNT(*) FROM files WHERE files.category = categories.name AND files.deleted_at IS NULL)", "LOWER(categories.name) LIKE ? OR LOWER(COALESCE(parent.name, '')) LIKE ?", nil
	case TaxonomyKindTagCategory:
		return "tag_categories", "0", "LOWER(tag_categories.name) LIKE ? OR LOWER(COALESCE(parent.name, '')) LIKE ?", nil
	case TaxonomyKindTag:
		return "tags", "(SELECT COUNT(*) FROM files WHERE jsonb_exists(files.tags, tags.name) AND files.deleted_at IS NULL)", "LOWER(tags.name) LIKE ? OR LOWER(COALESCE(category.name, '')) LIKE ?", nil
	default:
		return "", "", "", fmt.Errorf("invalid taxonomy kind")
	}
}

func selectClause(kind TaxonomyKind, table, usageExpr string) string {
	switch kind {
	case TaxonomyKindCategory, TaxonomyKindTagCategory:
		return fmt.Sprintf(
			"%s.*, parent.name AS parent_name, creator.username AS created_by_username, updater.username AS updated_by_username, %s AS usage_count",
			table,
			usageExpr,
		)
	case TaxonomyKindTag:
		return fmt.Sprintf(
			"%s.id, %s.name, %s.tag_category_id AS category_id, %s.sort_order, %s.created_by, %s.updated_by, %s.created_at, %s.updated_at, %s.deleted_at, category.name AS category_name, creator.username AS created_by_username, updater.username AS updated_by_username, %s AS usage_count",
			table, table, table, table, table, table, table, table, table, usageExpr,
		)
	default:
		return table + ".*"
	}
}

func extraJoinClause(kind TaxonomyKind, table string) string {
	switch kind {
	case TaxonomyKindCategory:
		return fmt.Sprintf("LEFT JOIN categories parent ON parent.id = %s.parent_id AND parent.deleted_at IS NULL", table)
	case TaxonomyKindTagCategory:
		return fmt.Sprintf("LEFT JOIN tag_categories parent ON parent.id = %s.parent_id AND parent.deleted_at IS NULL", table)
	case TaxonomyKindTag:
		return fmt.Sprintf("LEFT JOIN tag_categories category ON category.id = %s.tag_category_id AND category.deleted_at IS NULL", table)
	default:
		return ""
	}
}

func orderClause(kind TaxonomyKind, table string) string {
	switch kind {
	case TaxonomyKindCategory, TaxonomyKindTagCategory:
		return fmt.Sprintf("%s.sort_order ASC, %s.name ASC", table, table)
	case TaxonomyKindTag:
		return "category.sort_order ASC NULLS FIRST, category.name ASC NULLS FIRST, tags.sort_order ASC, tags.name ASC"
	default:
		return fmt.Sprintf("%s.name ASC", table)
	}
}

func relationColumn(kind TaxonomyKind) string {
	switch kind {
	case TaxonomyKindCategory, TaxonomyKindTagCategory:
		return "parent_id"
	case TaxonomyKindTag:
		return "tag_category_id"
	default:
		return "parent_id"
	}
}

func relationID(kind TaxonomyKind, item *model.Category) *uint {
	switch kind {
	case TaxonomyKindCategory, TaxonomyKindTagCategory:
		return item.ParentID
	case TaxonomyKindTag:
		return item.CategoryID
	default:
		return nil
	}
}
