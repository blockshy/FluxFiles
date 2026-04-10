package repository

import (
	"context"
	"fmt"
	"strings"

	"fluxfiles/api/internal/model"

	"gorm.io/gorm"
)

type FileListParams struct {
	Page           int
	PageSize       int
	Search         string
	SortBy         string
	SortOrder      string
	PublicOnly     bool
	IncludeDeleted bool
	OwnerID        *uint
}

type DashboardStats struct {
	TotalFiles     int64 `json:"totalFiles"`
	PublicFiles    int64 `json:"publicFiles"`
	TotalDownloads int64 `json:"totalDownloads"`
	TotalStorage   int64 `json:"totalStorage"`
}

type FileRepository struct {
	db *gorm.DB
}

func NewFileRepository(db *gorm.DB) *FileRepository {
	return &FileRepository{db: db}
}

func (r *FileRepository) Create(ctx context.Context, file *model.File) error {
	return r.db.WithContext(ctx).Create(file).Error
}

func (r *FileRepository) Update(ctx context.Context, file *model.File, values map[string]any) error {
	if name, ok := values["name"].(string); ok {
		file.Name = name
	}
	if description, ok := values["description"].(string); ok {
		file.Description = description
	}
	if category, ok := values["category"].(string); ok {
		file.Category = category
	}
	if isPublic, ok := values["is_public"].(bool); ok {
		file.IsPublic = isPublic
	}
	if tags, ok := values["tags"].([]string); ok {
		file.Tags = tags
	}

	return r.db.WithContext(ctx).Save(file).Error
}

func (r *FileRepository) IncrementDownload(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).
		Model(&model.File{}).
		Where("id = ?", id).
		UpdateColumn("download_count", gorm.Expr("download_count + 1")).Error
}

func (r *FileRepository) SoftDelete(ctx context.Context, file *model.File) error {
	return r.db.WithContext(ctx).Delete(file).Error
}

func (r *FileRepository) GetByID(ctx context.Context, id uint, includeDeleted bool) (*model.File, error) {
	lookup := r.db.WithContext(ctx)
	if includeDeleted {
		lookup = lookup.Unscoped()
	}

	var file model.File
	if err := lookup.
		Table("files").
		Select("files.*, uploader.username AS created_by_username, uploader.display_name AS created_by_display_name, uploader.avatar_url AS created_by_avatar_url").
		Joins("LEFT JOIN users uploader ON uploader.id = files.created_by").
		Where("files.id = ?", id).
		First(&file).Error; err != nil {
		return nil, err
	}
	return &file, nil
}

func (r *FileRepository) GetPublicByID(ctx context.Context, id uint) (*model.File, error) {
	var file model.File
	if err := r.db.WithContext(ctx).
		Table("files").
		Select("files.*, uploader.username AS created_by_username, uploader.display_name AS created_by_display_name, uploader.avatar_url AS created_by_avatar_url").
		Joins("LEFT JOIN users uploader ON uploader.id = files.created_by").
		Where("files.id = ? AND files.is_public = ?", id, true).
		First(&file).Error; err != nil {
		return nil, err
	}
	return &file, nil
}

func (r *FileRepository) List(ctx context.Context, params FileListParams) ([]model.File, int64, error) {
	page := params.Page
	if page <= 0 {
		page = 1
	}

	pageSize := params.PageSize
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 10
	}

	query := r.db.WithContext(ctx).Model(&model.File{})
	if params.IncludeDeleted {
		query = query.Unscoped()
	}

	if params.PublicOnly {
		query = query.Where("is_public = ?", true)
	}
	if params.OwnerID != nil {
		query = query.Where("files.created_by = ?", *params.OwnerID)
	}

	if keyword := strings.TrimSpace(strings.ToLower(params.Search)); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where(
			"LOWER(name) LIKE ? OR LOWER(original_name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(category) LIKE ?",
			like, like, like, like,
		)
	}

	sortColumn := "created_at"
	switch params.SortBy {
	case "name":
		sortColumn = "name"
	case "downloadCount":
		sortColumn = "download_count"
	case "size":
		sortColumn = "size"
	case "createdAt":
		sortColumn = "created_at"
	}

	order := "desc"
	if strings.EqualFold(params.SortOrder, "asc") {
		order = "asc"
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var files []model.File
	if err := query.
		Select("files.*, uploader.username AS created_by_username, uploader.display_name AS created_by_display_name, uploader.avatar_url AS created_by_avatar_url").
		Joins("LEFT JOIN users uploader ON uploader.id = files.created_by").
		Order(fmt.Sprintf("%s %s", sortColumn, order)).
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&files).Error; err != nil {
		return nil, 0, err
	}

	return files, total, nil
}

func (r *FileRepository) DashboardStats(ctx context.Context, ownerID *uint) (*DashboardStats, error) {
	stats := &DashboardStats{}

	baseQuery := r.db.WithContext(ctx).Model(&model.File{})
	if ownerID != nil {
		baseQuery = baseQuery.Where("created_by = ?", *ownerID)
	}

	if err := baseQuery.Count(&stats.TotalFiles).Error; err != nil {
		return nil, err
	}

	if err := baseQuery.Where("is_public = ?", true).Count(&stats.PublicFiles).Error; err != nil {
		return nil, err
	}

	if err := baseQuery.Select("COALESCE(SUM(download_count), 0)").Scan(&stats.TotalDownloads).Error; err != nil {
		return nil, err
	}

	if err := baseQuery.Select("COALESCE(SUM(size), 0)").Scan(&stats.TotalStorage).Error; err != nil {
		return nil, err
	}

	return stats, nil
}
