package repository

import (
	"context"
	"time"

	"fluxfiles/api/internal/model"

	"gorm.io/gorm"
)

type UserDownloadItem struct {
	model.File
	DownloadedAt time.Time `json:"downloadedAt"`
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
		Select("files.*, uploader.username AS created_by_username, uploader.display_name AS created_by_display_name").
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
		Select("files.*, uploader.username AS created_by_username, uploader.display_name AS created_by_display_name").
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

func (r *UserLibraryRepository) RecordDownload(ctx context.Context, userID, fileID uint) error {
	record := &model.UserDownloadRecord{
		UserID:       userID,
		FileID:       fileID,
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
		Select("files.*, user_download_records.downloaded_at").
		Joins("JOIN files ON files.id = user_download_records.file_id").
		Where("user_download_records.user_id = ?", userID).
		Order("user_download_records.downloaded_at DESC").
		Limit(limit).
		Scan(&items).Error
	return items, err
}
