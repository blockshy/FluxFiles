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
	CategoryPath         string         `gorm:"->;column:category_path;-:migration" json:"categoryPath,omitempty"`
	TagPaths             []string       `gorm:"-" json:"tagPaths,omitempty"`
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
	ParentID          *uint          `gorm:"index" json:"parentId,omitempty"`
	CategoryID        *uint          `gorm:"index" json:"categoryId,omitempty"`
	SortOrder         int            `gorm:"column:sort_order;not null;default:0" json:"sortOrder"`
	CreatedBy         uint           `gorm:"not null;index" json:"createdBy"`
	UpdatedBy         uint           `gorm:"not null;index" json:"updatedBy"`
	ParentName        string         `gorm:"->;column:parent_name;-:migration" json:"parentName,omitempty"`
	CategoryName      string         `gorm:"->;column:category_name;-:migration" json:"categoryName,omitempty"`
	CreatedByUsername string         `gorm:"->;column:created_by_username;-:migration" json:"createdByUsername,omitempty"`
	UpdatedByUsername string         `gorm:"->;column:updated_by_username;-:migration" json:"updatedByUsername,omitempty"`
	UsageCount        int64          `gorm:"->;column:usage_count;-:migration" json:"usageCount"`
	ChildCount        int64          `gorm:"-" json:"childCount,omitempty"`
	TagCount          int64          `gorm:"-" json:"tagCount,omitempty"`
	FullPath          string         `gorm:"-" json:"fullPath,omitempty"`
	Depth             int            `gorm:"-" json:"depth,omitempty"`
	CategoryPath      string         `gorm:"-" json:"categoryPath,omitempty"`
	CreatedAt         time.Time      `json:"createdAt"`
	UpdatedAt         time.Time      `json:"updatedAt"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

type Tag struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	Name              string         `gorm:"size:128;uniqueIndex;not null" json:"name"`
	CategoryID        *uint          `gorm:"index" json:"categoryId,omitempty"`
	SortOrder         int            `gorm:"column:sort_order;not null;default:0" json:"sortOrder"`
	CreatedBy         uint           `gorm:"not null;index" json:"createdBy"`
	UpdatedBy         uint           `gorm:"not null;index" json:"updatedBy"`
	CategoryName      string         `gorm:"->;column:category_name;-:migration" json:"categoryName,omitempty"`
	CreatedByUsername string         `gorm:"->;column:created_by_username;-:migration" json:"createdByUsername,omitempty"`
	UpdatedByUsername string         `gorm:"->;column:updated_by_username;-:migration" json:"updatedByUsername,omitempty"`
	UsageCount        int64          `gorm:"->;column:usage_count;-:migration" json:"usageCount"`
	CategoryPath      string         `gorm:"-" json:"categoryPath,omitempty"`
	FullPath          string         `gorm:"-" json:"fullPath,omitempty"`
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
	UserID       *uint     `gorm:"index" json:"userId,omitempty"`
	FileID       uint      `gorm:"not null;index"`
	IP           string    `gorm:"size:64;not null;default:''" json:"ip"`
	UserAgent    string    `gorm:"type:text;not null;default:''" json:"userAgent"`
	DownloadedAt time.Time `gorm:"not null;index" json:"downloadedAt"`
}

type FileComment struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	FileID            uint           `gorm:"not null;index" json:"fileId"`
	UserID            uint           `gorm:"not null;index" json:"userId"`
	ParentID          *uint          `gorm:"index" json:"parentId,omitempty"`
	RootID            *uint          `gorm:"index" json:"rootId,omitempty"`
	Content           string         `gorm:"type:text;not null" json:"content"`
	LikeCount         int64          `gorm:"not null;default:0" json:"likeCount"`
	DislikeCount      int64          `gorm:"not null;default:0" json:"dislikeCount"`
	UserUsername      string         `gorm:"->;column:user_username;-:migration" json:"userUsername,omitempty"`
	UserDisplayName   string         `gorm:"->;column:user_display_name;-:migration" json:"userDisplayName,omitempty"`
	UserAvatarURL     string         `gorm:"->;column:user_avatar_url;-:migration" json:"userAvatarUrl,omitempty"`
	ParentUsername    string         `gorm:"->;column:parent_username;-:migration" json:"parentUsername,omitempty"`
	ParentDisplayName string         `gorm:"->;column:parent_display_name;-:migration" json:"parentDisplayName,omitempty"`
	CurrentUserVote   int            `gorm:"->;column:current_user_vote;-:migration" json:"currentUserVote,omitempty"`
	ReplyCount        int64          `gorm:"->;column:reply_count;-:migration" json:"replyCount,omitempty"`
	CreatedAt         time.Time      `json:"createdAt"`
	UpdatedAt         time.Time      `json:"updatedAt"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

type CommentVote struct {
	ID        uint      `gorm:"primaryKey"`
	CommentID uint      `gorm:"not null;index:idx_comment_votes_comment_user,unique"`
	UserID    uint      `gorm:"not null;index:idx_comment_votes_comment_user,unique"`
	Value     int       `gorm:"not null" json:"value"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type UserNotification struct {
	ID                   uint           `gorm:"primaryKey" json:"id"`
	UserID               uint           `gorm:"not null;index" json:"userId"`
	ActorUserID          *uint          `gorm:"index" json:"actorUserId,omitempty"`
	Type                 string         `gorm:"size:64;not null;index" json:"type"`
	Title                string         `gorm:"size:255;not null" json:"title"`
	Content              string         `gorm:"type:text;not null;default:''" json:"content"`
	Data                 map[string]any `gorm:"type:jsonb;serializer:json;not null;default:'{}'" json:"data"`
	IsRead               bool           `gorm:"not null;default:false;index" json:"isRead"`
	ActorUsername        string         `gorm:"->;column:actor_username;-:migration" json:"actorUsername,omitempty"`
	ActorDisplayName     string         `gorm:"->;column:actor_display_name;-:migration" json:"actorDisplayName,omitempty"`
	ActorAvatarURL       string         `gorm:"->;column:actor_avatar_url;-:migration" json:"actorAvatarUrl,omitempty"`
	RelatedCommentID     uint           `gorm:"->;column:related_comment_id;-:migration" json:"relatedCommentId,omitempty"`
	RelatedCommentBody   string         `gorm:"->;column:related_comment_body;-:migration" json:"relatedCommentBody,omitempty"`
	RelatedCommentFileID uint           `gorm:"->;column:related_comment_file_id;-:migration" json:"relatedCommentFileId,omitempty"`
	CreatedAt            time.Time      `json:"createdAt"`
}

type SystemSetting struct {
	Key       string    `gorm:"primaryKey;size:128" json:"key"`
	Value     string    `gorm:"type:text;not null" json:"value"`
	UpdatedAt time.Time `json:"updatedAt"`
}
