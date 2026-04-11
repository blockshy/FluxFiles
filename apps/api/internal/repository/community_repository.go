package repository

import (
	"context"
	"strings"
	"time"

	"fluxfiles/api/internal/model"

	"gorm.io/gorm"
)

type CommunityListQuery struct {
	Page     int
	PageSize int
	Search   string
}

type CommunityRepository struct {
	db *gorm.DB
}

func NewCommunityRepository(db *gorm.DB) *CommunityRepository {
	return &CommunityRepository{db: db}
}

func (r *CommunityRepository) ListPosts(ctx context.Context, query CommunityListQuery) ([]model.CommunityPost, int64, error) {
	scope := r.postBaseQuery(ctx)
	if search := strings.TrimSpace(strings.ToLower(query.Search)); search != "" {
		like := "%" + search + "%"
		scope = scope.Where("LOWER(community_posts.title) LIKE ? OR LOWER(community_posts.content_text) LIKE ? OR LOWER(COALESCE(author.username, '')) LIKE ? OR LOWER(COALESCE(author.display_name, '')) LIKE ?", like, like, like, like)
	}

	var total int64
	if err := scope.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page, pageSize := normalizePage(query.Page, query.PageSize, 20, 100)
	var items []model.CommunityPost
	if err := scope.
		Order("community_posts.is_pinned DESC").
		Order("COALESCE(community_posts.last_replied_at, community_posts.created_at) DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *CommunityRepository) GetPostByID(ctx context.Context, id uint) (*model.CommunityPost, error) {
	var item model.CommunityPost
	if err := r.postBaseQuery(ctx).Where("community_posts.id = ?", id).First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *CommunityRepository) CreatePost(ctx context.Context, post *model.CommunityPost) error {
	return r.db.WithContext(ctx).Create(post).Error
}

func (r *CommunityRepository) UpdatePost(ctx context.Context, post *model.CommunityPost, values map[string]any) error {
	return r.db.WithContext(ctx).Model(post).Updates(values).Error
}

func (r *CommunityRepository) DeletePost(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`DELETE FROM user_notifications WHERE COALESCE((data->>'postId')::bigint, 0) = ?`, id).Error; err != nil {
			return err
		}
		return tx.Unscoped().Delete(&model.CommunityPost{}, id).Error
	})
}

func (r *CommunityRepository) IncrementPostView(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Model(&model.CommunityPost{}).Where("id = ?", id).UpdateColumn("view_count", gorm.Expr("view_count + 1")).Error
}

func (r *CommunityRepository) TouchPostReplyTime(ctx context.Context, id uint, at time.Time) error {
	return r.db.WithContext(ctx).Model(&model.CommunityPost{}).Where("id = ?", id).Updates(map[string]any{
		"last_replied_at": at.UTC(),
		"updated_at":      gorm.Expr("NOW()"),
	}).Error
}

func (r *CommunityRepository) CreateReply(ctx context.Context, reply *model.CommunityReply) error {
	return r.db.WithContext(ctx).Create(reply).Error
}

func (r *CommunityRepository) GetReplyByID(ctx context.Context, id uint) (*model.CommunityReply, error) {
	var item model.CommunityReply
	if err := r.replyBaseQuery(ctx).Where("community_replies.id = ?", id).First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *CommunityRepository) ListReplies(ctx context.Context, postID uint, page, pageSize int) ([]model.CommunityReply, int64, error) {
	scope := r.replyBaseQuery(ctx).Where("community_replies.post_id = ?", postID)

	var total int64
	if err := scope.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page, pageSize = normalizePage(page, pageSize, 20, 100)
	var items []model.CommunityReply
	if err := scope.
		Order("community_replies.created_at ASC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *CommunityRepository) DeleteReply(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`DELETE FROM user_notifications WHERE COALESCE((data->>'replyId')::bigint, 0) = ?`, id).Error; err != nil {
			return err
		}
		return tx.Unscoped().Delete(&model.CommunityReply{}, id).Error
	})
}

func (r *CommunityRepository) postBaseQuery(ctx context.Context) *gorm.DB {
	return r.db.WithContext(ctx).
		Table("community_posts").
		Select(`
			community_posts.*,
			author.username AS author_username,
			author.display_name AS author_display_name,
			author.avatar_url AS author_avatar_url,
			(
				SELECT COUNT(*)
				FROM community_replies
				WHERE community_replies.post_id = community_posts.id
				  AND community_replies.deleted_at IS NULL
			) AS reply_count
		`).
		Joins("LEFT JOIN users author ON author.id = community_posts.author_id").
		Where("community_posts.deleted_at IS NULL")
}

func (r *CommunityRepository) replyBaseQuery(ctx context.Context) *gorm.DB {
	return r.db.WithContext(ctx).
		Table("community_replies").
		Select(`
			community_replies.*,
			users.username AS user_username,
			users.display_name AS user_display_name,
			users.avatar_url AS user_avatar_url,
			parent_user.username AS parent_username,
			parent_user.display_name AS parent_display_name
		`).
		Joins("JOIN users ON users.id = community_replies.user_id").
		Joins("LEFT JOIN community_replies parent_reply ON parent_reply.id = community_replies.parent_id").
		Joins("LEFT JOIN users parent_user ON parent_user.id = parent_reply.user_id").
		Where("community_replies.deleted_at IS NULL")
}
