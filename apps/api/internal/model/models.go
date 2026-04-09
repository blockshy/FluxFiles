package model

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Username     string         `gorm:"size:64;uniqueIndex;not null" json:"username"`
	PasswordHash string         `gorm:"size:255;not null" json:"-"`
	Role         string         `gorm:"size:32;not null;default:admin" json:"role"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

type File struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	Name          string         `gorm:"size:255;index;not null" json:"name"`
	OriginalName  string         `gorm:"size:255;not null" json:"originalName"`
	ObjectKey     string         `gorm:"size:512;uniqueIndex;not null" json:"objectKey"`
	Size          int64          `gorm:"not null" json:"size"`
	MimeType      string         `gorm:"size:128;not null" json:"mimeType"`
	Description   string         `gorm:"type:text" json:"description"`
	Category      string         `gorm:"size:128;index" json:"category"`
	Tags          []string       `gorm:"type:jsonb;serializer:json" json:"tags"`
	IsPublic      bool           `gorm:"not null;default:true;index" json:"isPublic"`
	DownloadCount int64          `gorm:"not null;default:0" json:"downloadCount"`
	CreatedBy     *uint          `json:"createdBy,omitempty"`
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

type OperationLog struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	AdminUserID uint      `gorm:"not null;index" json:"adminUserId"`
	Action      string    `gorm:"size:64;not null" json:"action"`
	TargetType  string    `gorm:"size:64;not null" json:"targetType"`
	TargetID    string    `gorm:"size:128;not null" json:"targetId"`
	Detail      string    `gorm:"type:text" json:"detail"`
	IP          string    `gorm:"size:64" json:"ip"`
	CreatedAt   time.Time `json:"createdAt"`
}
