package repository

import (
	"context"
	"strings"
	"time"

	"fluxfiles/api/internal/model"

	"gorm.io/gorm"
)

type UserDownloadItem struct {
	model.File
	DownloadedAt time.Time `json:"downloadedAt"`
}

type DownloadRecordQuery struct {
	Page       int
	PageSize   int
	FileID     *uint
	Search     string
	UserSearch string
	IP         string
	AuthStatus string
	StartAt    *time.Time
	EndAt      *time.Time
	OwnerID    *uint
}

type AdminDownloadRecord struct {
	ID                       uint      `json:"id"`
	FileID                   uint      `json:"fileId"`
	FileName                 string    `gorm:"column:file_name" json:"fileName"`
	OriginalName             string    `json:"originalName"`
	Size                     int64     `json:"size"`
	MimeType                 string    `json:"mimeType"`
	Category                 string    `json:"category"`
	Tags                     []string  `gorm:"type:jsonb;serializer:json" json:"tags"`
	IsPublic                 bool      `json:"isPublic"`
	DownloadCount            int64     `json:"downloadCount"`
	FileCreatedBy            *uint     `json:"fileCreatedBy,omitempty"`
	FileCreatedByUsername    string    `gorm:"column:file_created_by_username" json:"fileCreatedByUsername,omitempty"`
	FileCreatedByDisplayName string    `gorm:"column:file_created_by_display_name" json:"fileCreatedByDisplayName,omitempty"`
	UserID                   *uint     `json:"userId,omitempty"`
	UserUsername             string    `gorm:"column:user_username" json:"userUsername,omitempty"`
	UserDisplayName          string    `gorm:"column:user_display_name" json:"userDisplayName,omitempty"`
	UserAvatarURL            string    `gorm:"column:user_avatar_url" json:"userAvatarUrl,omitempty"`
	IP                       string    `json:"ip"`
	UserAgent                string    `json:"userAgent"`
	DownloadedAt             time.Time `json:"downloadedAt"`
}

type UserLibraryRepository struct {
	db *gorm.DB
}

func NewUserLibraryRepository(db *gorm.DB) *UserLibraryRepository {
	return &UserLibraryRepository{db: db}
}

func (r *UserLibraryRepository) AddFavorite(ctx context.Context, userID, fileID uint) error {
	favorite := &model.UserFavorite{
		UserID: userID,
		FileID: fileID,
	}
	return r.db.WithContext(ctx).Where(model.UserFavorite{UserID: userID, FileID: fileID}).FirstOrCreate(favorite).Error
}

func (r *UserLibraryRepository) RemoveFavorite(ctx context.Context, userID, fileID uint) error {
	return r.db.WithContext(ctx).Where("user_id = ? AND file_id = ?", userID, fileID).Delete(&model.UserFavorite{}).Error
}

func (r *UserLibraryRepository) ListFavorites(ctx context.Context, userID uint) ([]model.File, error) {
	var files []model.File
	err := r.db.WithContext(ctx).
		Model(&model.File{}).
		Select("files.*, uploader.username AS created_by_username, uploader.display_name AS created_by_display_name, uploader.avatar_url AS created_by_avatar_url").
		Joins("LEFT JOIN users uploader ON uploader.id = files.created_by").
		Joins("JOIN user_favorites ON user_favorites.file_id = files.id").
		Where("user_favorites.user_id = ?", userID).
		Order("user_favorites.created_at DESC").
		Find(&files).Error
	return files, err
}

func (r *UserLibraryRepository) ListPublicFavorites(ctx context.Context, userID uint, limit int) ([]model.File, error) {
	if limit <= 0 || limit > 50 {
		limit = 10
	}

	var files []model.File
	err := r.db.WithContext(ctx).
		Model(&model.File{}).
		Select("files.*, uploader.username AS created_by_username, uploader.display_name AS created_by_display_name, uploader.avatar_url AS created_by_avatar_url").
		Joins("LEFT JOIN users uploader ON uploader.id = files.created_by").
		Joins("JOIN user_favorites ON user_favorites.file_id = files.id").
		Where("user_favorites.user_id = ? AND files.is_public = ?", userID, true).
		Order("user_favorites.created_at DESC").
		Limit(limit).
		Find(&files).Error
	return files, err
}

func (r *UserLibraryRepository) CountPublicFavorites(ctx context.Context, userID uint) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&model.UserFavorite{}).
		Joins("JOIN files ON files.id = user_favorites.file_id").
		Where("user_favorites.user_id = ? AND files.is_public = ?", userID, true).
		Count(&count).Error
	return count, err
}

func (r *UserLibraryRepository) RecordDownload(ctx context.Context, userID *uint, fileID uint, ip, userAgent string) error {
	record := &model.UserDownloadRecord{
		UserID:       userID,
		FileID:       fileID,
		IP:           trimForStorage(ip, 64),
		UserAgent:    trimForStorage(userAgent, 1000),
		DownloadedAt: time.Now().UTC(),
	}
	return r.db.WithContext(ctx).Create(record).Error
}

func (r *UserLibraryRepository) ListDownloads(ctx context.Context, userID uint, limit int) ([]UserDownloadItem, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	var items []UserDownloadItem
	err := r.db.WithContext(ctx).
		Table("user_download_records").
		Select("files.*, uploader.username AS created_by_username, uploader.display_name AS created_by_display_name, uploader.avatar_url AS created_by_avatar_url, user_download_records.downloaded_at").
		Joins("JOIN files ON files.id = user_download_records.file_id").
		Joins("LEFT JOIN users uploader ON uploader.id = files.created_by").
		Where("user_download_records.user_id = ?", userID).
		Order("user_download_records.downloaded_at DESC").
		Limit(limit).
		Scan(&items).Error
	return items, err
}

func (r *UserLibraryRepository) ListAdminDownloads(ctx context.Context, params DownloadRecordQuery) ([]AdminDownloadRecord, int64, error) {
	page := params.Page
	if page <= 0 {
		page = 1
	}
	pageSize := params.PageSize
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	query := r.db.WithContext(ctx).
		Table("user_download_records AS records").
		Joins("JOIN files ON files.id = records.file_id").
		Joins("LEFT JOIN users downloader ON downloader.id = records.user_id").
		Joins("LEFT JOIN users uploader ON uploader.id = files.created_by")

	if params.FileID != nil {
		query = query.Where("records.file_id = ?", *params.FileID)
	}
	if params.OwnerID != nil {
		query = query.Where("files.created_by = ?", *params.OwnerID)
	}
	if keyword := strings.TrimSpace(strings.ToLower(params.Search)); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where(
			"LOWER(files.name) LIKE ? OR LOWER(files.original_name) LIKE ? OR LOWER(files.category) LIKE ? OR LOWER(COALESCE(downloader.username, '')) LIKE ? OR LOWER(COALESCE(downloader.display_name, '')) LIKE ? OR LOWER(records.ip) LIKE ? OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(files.tags) AS tag(value) WHERE LOWER(tag.value) LIKE ?)",
			like, like, like, like, like, like, like,
		)
	}
	if userSearch := strings.TrimSpace(strings.ToLower(params.UserSearch)); userSearch != "" {
		like := "%" + userSearch + "%"
		query = query.Where("LOWER(COALESCE(downloader.username, '')) LIKE ? OR LOWER(COALESCE(downloader.display_name, '')) LIKE ?", like, like)
	}
	if ip := strings.TrimSpace(params.IP); ip != "" {
		query = query.Where("records.ip LIKE ?", "%"+ip+"%")
	}
	switch params.AuthStatus {
	case "guest":
		query = query.Where("records.user_id IS NULL")
	case "user":
		query = query.Where("records.user_id IS NOT NULL")
	}
	if params.StartAt != nil {
		query = query.Where("records.downloaded_at >= ?", *params.StartAt)
	}
	if params.EndAt != nil {
		query = query.Where("records.downloaded_at <= ?", *params.EndAt)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var items []AdminDownloadRecord
	err := query.
		Select(`
			records.id,
			records.file_id,
			files.name AS file_name,
			files.original_name,
			files.size,
			files.mime_type,
			files.category,
			files.tags,
			files.is_public,
			files.download_count,
			files.created_by AS file_created_by,
			uploader.username AS file_created_by_username,
			uploader.display_name AS file_created_by_display_name,
			records.user_id,
			downloader.username AS user_username,
			downloader.display_name AS user_display_name,
			downloader.avatar_url AS user_avatar_url,
			records.ip,
			records.user_agent,
			records.downloaded_at
		`).
		Order("records.downloaded_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Scan(&items).Error
	return items, total, err
}

func trimForStorage(value string, limit int) string {
	value = strings.TrimSpace(value)
	if limit <= 0 || len(value) <= limit {
		return value
	}
	return value[:limit]
}
