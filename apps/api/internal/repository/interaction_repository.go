package repository

import (
	"context"
	"errors"
	"strings"

	"fluxfiles/api/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type NotificationListQuery struct {
	Page     int
	PageSize int
	Types    []string
}

type CommentListQuery struct {
	Page     int
	PageSize int
}

type InteractionRepository struct {
	db *gorm.DB
}

func NewInteractionRepository(db *gorm.DB) *InteractionRepository {
	return &InteractionRepository{db: db}
}

func (r *InteractionRepository) CreateComment(ctx context.Context, comment *model.FileComment) error {
	return r.db.WithContext(ctx).Create(comment).Error
}

func (r *InteractionRepository) GetCommentByID(ctx context.Context, id uint, currentUserID *uint) (*model.FileComment, error) {
	query := r.commentBaseQuery(ctx, currentUserID, false).
		Where("file_comments.id = ?", id)

	var comment model.FileComment
	if err := query.First(&comment).Error; err != nil {
		return nil, err
	}
	return &comment, nil
}

func (r *InteractionRepository) CountFileComments(ctx context.Context, fileID uint) (int64, error) {
	var total int64
	err := r.db.WithContext(ctx).
		Model(&model.FileComment{}).
		Where("file_id = ?", fileID).
		Count(&total).Error
	return total, err
}

func (r *InteractionRepository) ListTopLevelComments(ctx context.Context, fileID uint, currentUserID *uint, query CommentListQuery) ([]model.FileComment, int64, error) {
	scope := r.commentBaseQuery(ctx, currentUserID, true).
		Where("file_comments.file_id = ?", fileID).
		Where("file_comments.parent_id IS NULL")

	var total int64
	if err := scope.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page, pageSize := normalizePage(query.Page, query.PageSize, 10, 100)
	var items []model.FileComment
	if err := scope.
		Order("file_comments.created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *InteractionRepository) ListThreadReplies(ctx context.Context, fileID, rootID uint, currentUserID *uint, query CommentListQuery) ([]model.FileComment, int64, error) {
	scope := r.commentBaseQuery(ctx, currentUserID, false).
		Where("file_comments.file_id = ?", fileID).
		Where("file_comments.root_id = ?", rootID)

	var total int64
	if err := scope.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page, pageSize := normalizePage(query.Page, query.PageSize, 5, 100)
	var items []model.FileComment
	if err := scope.
		Order("file_comments.created_at ASC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *InteractionRepository) ListUserComments(ctx context.Context, userID uint, currentUserID *uint, query CommentListQuery) ([]model.FileComment, int64, error) {
	scope := r.commentBaseQuery(ctx, currentUserID, false).
		Where("file_comments.user_id = ?", userID)

	var total int64
	if err := scope.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page, pageSize := normalizePage(query.Page, query.PageSize, 20, 100)
	var items []model.FileComment
	if err := scope.
		Order("file_comments.created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *InteractionRepository) DeleteCommentTree(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(`
			WITH RECURSIVE comment_tree AS (
				SELECT id FROM file_comments WHERE id = ?
				UNION ALL
				SELECT fc.id
				FROM file_comments fc
				INNER JOIN comment_tree ct ON fc.parent_id = ct.id
			)
			DELETE FROM comment_votes
			WHERE comment_id IN (SELECT id FROM comment_tree)
		`, id).Error; err != nil {
			return err
		}

		return tx.Exec(`
			WITH RECURSIVE comment_tree AS (
				SELECT id FROM file_comments WHERE id = ?
				UNION ALL
				SELECT fc.id
				FROM file_comments fc
				INNER JOIN comment_tree ct ON fc.parent_id = ct.id
			)
			DELETE FROM file_comments
			WHERE id IN (SELECT id FROM comment_tree)
		`, id).Error
	})
}

func (r *InteractionRepository) SetCommentVote(ctx context.Context, commentID, userID uint, value int) (int, error) {
	finalVote := value
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var comment model.FileComment
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&comment, commentID).Error; err != nil {
			return err
		}

		var existing model.CommentVote
		err := tx.Where("comment_id = ? AND user_id = ?", commentID, userID).First(&existing).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		before := 0
		if err == nil {
			before = existing.Value
		}

		if before == value {
			if err := tx.Delete(&existing).Error; err != nil {
				return err
			}
			finalVote = 0
		} else if before == 0 {
			vote := &model.CommentVote{CommentID: commentID, UserID: userID, Value: value}
			if err := tx.Create(vote).Error; err != nil {
				return err
			}
		} else {
			existing.Value = value
			if err := tx.Save(&existing).Error; err != nil {
				return err
			}
		}

		likeDelta := voteCounterDelta(before, finalVote, 1)
		dislikeDelta := voteCounterDelta(before, finalVote, -1)
		return tx.Model(&model.FileComment{}).
			Where("id = ?", commentID).
			Updates(map[string]any{
				"like_count":    gorm.Expr("GREATEST(like_count + ?, 0)", likeDelta),
				"dislike_count": gorm.Expr("GREATEST(dislike_count + ?, 0)", dislikeDelta),
				"updated_at":    gorm.Expr("NOW()"),
			}).Error
	})
	return finalVote, err
}

func (r *InteractionRepository) CreateNotification(ctx context.Context, notification *model.UserNotification) error {
	return r.db.WithContext(ctx).Create(notification).Error
}

func (r *InteractionRepository) ListNotifications(ctx context.Context, userID uint, query NotificationListQuery) ([]model.UserNotification, int64, error) {
	scope := r.notificationBaseQuery(ctx).
		Where("user_notifications.user_id = ?", userID)
	if len(query.Types) > 0 {
		scope = scope.Where("user_notifications.type IN ?", query.Types)
	}

	var total int64
	if err := scope.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page, pageSize := normalizePage(query.Page, query.PageSize, 20, 100)
	var items []model.UserNotification
	if err := scope.
		Order("user_notifications.created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *InteractionRepository) CountUnreadNotifications(ctx context.Context, userID uint) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&model.UserNotification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Count(&count).Error
	return count, err
}

func (r *InteractionRepository) MarkNotificationRead(ctx context.Context, userID, id uint) error {
	return r.db.WithContext(ctx).
		Model(&model.UserNotification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("is_read", true).Error
}

func (r *InteractionRepository) MarkNotificationsReadByType(ctx context.Context, userID uint, types []string) error {
	if len(types) == 0 {
		return r.db.WithContext(ctx).
			Model(&model.UserNotification{}).
			Where("user_id = ?", userID).
			Update("is_read", true).Error
	}
	return r.db.WithContext(ctx).
		Model(&model.UserNotification{}).
		Where("user_id = ? AND type IN ?", userID, types).
		Update("is_read", true).Error
}

func (r *InteractionRepository) commentBaseQuery(ctx context.Context, currentUserID *uint, includeReplyCount bool) *gorm.DB {
	selects := []string{
		"file_comments.*",
		"users.username AS user_username",
		"users.display_name AS user_display_name",
		"users.avatar_url AS user_avatar_url",
		"parent_user.username AS parent_username",
		"parent_user.display_name AS parent_display_name",
	}
	if currentUserID != nil && *currentUserID > 0 {
		selects = append(selects, "COALESCE(comment_votes.value, 0) AS current_user_vote")
	} else {
		selects = append(selects, "0 AS current_user_vote")
	}
	if includeReplyCount {
		selects = append(selects, `
			(
				SELECT COUNT(*)
				FROM file_comments reply_comments
				WHERE reply_comments.root_id = file_comments.id
				  AND reply_comments.deleted_at IS NULL
			) AS reply_count
		`)
	} else {
		selects = append(selects, "0 AS reply_count")
	}

	query := r.db.WithContext(ctx).
		Table("file_comments").
		Select(strings.Join(selects, ", ")).
		Joins("JOIN users ON users.id = file_comments.user_id").
		Joins("LEFT JOIN file_comments parent_comment ON parent_comment.id = file_comments.parent_id").
		Joins("LEFT JOIN users parent_user ON parent_user.id = parent_comment.user_id").
		Where("file_comments.deleted_at IS NULL")

	if currentUserID != nil && *currentUserID > 0 {
		query = query.Joins("LEFT JOIN comment_votes ON comment_votes.comment_id = file_comments.id AND comment_votes.user_id = ?", *currentUserID)
	}
	return query
}

func (r *InteractionRepository) notificationBaseQuery(ctx context.Context) *gorm.DB {
	return r.db.WithContext(ctx).
		Table("user_notifications").
		Select(`
			user_notifications.*,
			actor.username AS actor_username,
			actor.display_name AS actor_display_name,
			actor.avatar_url AS actor_avatar_url,
			COALESCE((user_notifications.data->>'commentId')::bigint, 0) AS related_comment_id,
			COALESCE((user_notifications.data->>'fileId')::bigint, 0) AS related_comment_file_id,
			COALESCE(user_notifications.data->>'commentContent', '') AS related_comment_body
		`).
		Joins("LEFT JOIN users actor ON actor.id = user_notifications.actor_user_id")
}

func voteCounterDelta(before, after, target int) int {
	delta := 0
	if before == target {
		delta--
	}
	if after == target {
		delta++
	}
	return delta
}

func normalizePage(page, pageSize, defaultPageSize, maxPageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = defaultPageSize
	}
	if pageSize > maxPageSize {
		pageSize = maxPageSize
	}
	return page, pageSize
}
