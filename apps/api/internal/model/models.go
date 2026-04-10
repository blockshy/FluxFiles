package model

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID                uint                  `gorm:"primaryKey" json:"id"`
	Username          string                `gorm:"size:64;uniqueIndex;not null" json:"username"`
	Email             string                `gorm:"size:128;uniqueIndex;not null" json:"email"`
	DisplayName       string                `gorm:"size:128;not null" json:"displayName"`
	AvatarURL         string                `gorm:"type:text;not null;default:''" json:"avatarUrl"`
	Bio               string                `gorm:"type:text;not null;default:''" json:"bio"`
	PasswordHash      string                `gorm:"size:255;not null" json:"-"`
	Role              string                `gorm:"size:32;not null;default:user" json:"role"`
	Permissions       []string              `gorm:"type:jsonb;serializer:json;not null;default:'[]'" json:"permissions"`
	ProfileVisibility UserProfileVisibility `gorm:"type:jsonb;serializer:json;not null;default:'{}'" json:"profileVisibility"`
	IsEnabled         bool                  `gorm:"not null;default:true" json:"isEnabled"`
	LastLoginAt       *time.Time            `json:"lastLoginAt,omitempty"`
	CreatedAt         time.Time             `json:"createdAt"`
	UpdatedAt         time.Time             `json:"updatedAt"`
	DeletedAt         gorm.DeletedAt        `gorm:"index" json:"-"`
}

type UserProfileVisibility struct {
	ShowBio            bool `json:"showBio"`
	ShowStats          bool `json:"showStats"`
	ShowPublishedFiles bool `json:"showPublishedFiles"`
	ShowFavorites      bool `json:"showFavorites"`
}

type File struct {
	ID                   uint           `gorm:"primaryKey" json:"id"`
	Name                 string         `gorm:"size:255;index;not null" json:"name"`
	OriginalName         string         `gorm:"size:255;not null" json:"originalName"`
	ObjectKey            string         `gorm:"size:512;uniqueIndex;not null" json:"objectKey"`
	Size                 int64          `gorm:"not null" json:"size"`
	MimeType             string         `gorm:"size:128;not null" json:"mimeType"`
	Description          string         `gorm:"type:text" json:"description"`
	Category             string         `gorm:"size:128;index" json:"category"`
	Tags                 []string       `gorm:"type:jsonb;serializer:json" json:"tags"`
	IsPublic             bool           `gorm:"not null;default:true;index" json:"isPublic"`
	DownloadCount        int64          `gorm:"not null;default:0" json:"downloadCount"`
	CreatedBy            *uint          `json:"createdBy,omitempty"`
	CreatedByUsername    string         `gorm:"->;column:created_by_username;-:migration" json:"createdByUsername,omitempty"`
	CreatedByDisplayName string         `gorm:"->;column:created_by_display_name;-:migration" json:"createdByDisplayName,omitempty"`
	CreatedByAvatarURL   string         `gorm:"->;column:created_by_avatar_url;-:migration" json:"createdByAvatarUrl,omitempty"`
	CreatedAt            time.Time      `json:"createdAt"`
	UpdatedAt            time.Time      `json:"updatedAt"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`
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

type Category struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	Name              string         `gorm:"size:128;uniqueIndex;not null" json:"name"`
	CreatedBy         uint           `gorm:"not null;index" json:"createdBy"`
	UpdatedBy         uint           `gorm:"not null;index" json:"updatedBy"`
	CreatedByUsername string         `gorm:"->;column:created_by_username;-:migration" json:"createdByUsername,omitempty"`
	UpdatedByUsername string         `gorm:"->;column:updated_by_username;-:migration" json:"updatedByUsername,omitempty"`
	UsageCount        int64          `gorm:"->;column:usage_count;-:migration" json:"usageCount"`
	CreatedAt         time.Time      `json:"createdAt"`
	UpdatedAt         time.Time      `json:"updatedAt"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

type Tag struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	Name              string         `gorm:"size:128;uniqueIndex;not null" json:"name"`
	CreatedBy         uint           `gorm:"not null;index" json:"createdBy"`
	UpdatedBy         uint           `gorm:"not null;index" json:"updatedBy"`
	CreatedByUsername string         `gorm:"->;column:created_by_username;-:migration" json:"createdByUsername,omitempty"`
	UpdatedByUsername string         `gorm:"->;column:updated_by_username;-:migration" json:"updatedByUsername,omitempty"`
	UsageCount        int64          `gorm:"->;column:usage_count;-:migration" json:"usageCount"`
	CreatedAt         time.Time      `json:"createdAt"`
	UpdatedAt         time.Time      `json:"updatedAt"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

type TaxonomyChangeLog struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	TaxonomyType  string    `gorm:"size:32;index;not null" json:"taxonomyType"`
	TaxonomyID    uint      `gorm:"not null;index" json:"taxonomyId"`
	Action        string    `gorm:"size:32;not null" json:"action"`
	BeforeData    string    `gorm:"type:text;not null;default:''" json:"beforeData"`
	AfterData     string    `gorm:"type:text;not null;default:''" json:"afterData"`
	AdminUserID   uint      `gorm:"not null;index" json:"adminUserId"`
	AdminUsername string    `gorm:"->;column:admin_username;-:migration" json:"adminUsername,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
}

type UserFavorite struct {
	ID        uint      `gorm:"primaryKey"`
	UserID    uint      `gorm:"not null;index:idx_user_favorites_user_file,unique"`
	FileID    uint      `gorm:"not null;index:idx_user_favorites_user_file,unique"`
	CreatedAt time.Time `json:"createdAt"`
}

type UserDownloadRecord struct {
	ID           uint      `gorm:"primaryKey"`
	UserID       uint      `gorm:"not null;index"`
	FileID       uint      `gorm:"not null;index"`
	DownloadedAt time.Time `gorm:"not null;index" json:"downloadedAt"`
}

type SystemSetting struct {
	Key       string    `gorm:"primaryKey;size:128" json:"key"`
	Value     string    `gorm:"type:text;not null" json:"value"`
	UpdatedAt time.Time `json:"updatedAt"`
}
