package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"fluxfiles/api/internal/model"
	"fluxfiles/api/internal/repository"

	"gorm.io/gorm"
)

const (
	NotificationTypeFileComment    = "file.comment"
	NotificationTypeCommentReply   = "comment.reply"
	NotificationTypeCommentLike    = "comment.like"
	NotificationTypeCommentDislike = "comment.dislike"
)

type CommentAuthor struct {
	ID          uint   `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	AvatarURL   string `json:"avatarUrl"`
}

type CommentItem struct {
	ID              uint           `json:"id"`
	FileID          uint           `json:"fileId"`
	ParentID        *uint          `json:"parentId,omitempty"`
	RootID          *uint          `json:"rootId,omitempty"`
	Content         string         `json:"content"`
	LikeCount       int64          `json:"likeCount"`
	DislikeCount    int64          `json:"dislikeCount"`
	CurrentUserVote int            `json:"currentUserVote"`
	CreatedAt       string         `json:"createdAt"`
	UpdatedAt       string         `json:"updatedAt"`
	CanDelete       bool           `json:"canDelete"`
	ReplyCount      int64          `json:"replyCount"`
	Author          CommentAuthor  `json:"author"`
	ReplyTo         *CommentAuthor `json:"replyTo,omitempty"`
}

type CommentListResult struct {
	Items      []CommentItem `json:"items"`
	Page       int           `json:"page"`
	PageSize   int           `json:"pageSize"`
	Total      int64         `json:"total"`
	TotalPages int           `json:"totalPages"`
	Overall    int64         `json:"overallTotal"`
}

type NotificationListResult struct {
	Items      []model.UserNotification `json:"items"`
	Page       int                      `json:"page"`
	PageSize   int                      `json:"pageSize"`
	Total      int64                    `json:"total"`
	TotalPages int                      `json:"totalPages"`
	Unread     int64                    `json:"unread"`
}

type InteractionService struct {
	files        *repository.FileRepository
	interactions *repository.InteractionRepository
	users        *repository.UserRepository
	library      *repository.UserLibraryRepository
}

func NewInteractionService(
	files *repository.FileRepository,
	interactions *repository.InteractionRepository,
	users *repository.UserRepository,
	library *repository.UserLibraryRepository,
) *InteractionService {
	return &InteractionService{
		files:        files,
		interactions: interactions,
		users:        users,
		library:      library,
	}
}

func (s *InteractionService) ListComments(ctx context.Context, fileID uint, currentUserID *uint, rootID *uint, page, pageSize int) (*CommentListResult, error) {
	if _, err := s.files.GetPublicByID(ctx, fileID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, ErrDependencyUnavailable
	}

	overallTotal, err := s.interactions.CountFileComments(ctx, fileID)
	if err != nil {
		return nil, ErrDependencyUnavailable
	}

	page, pageSize = normalizePagination(page, pageSize, 10, 100)
	var items []model.FileComment
	var total int64

	if rootID != nil && *rootID > 0 {
		rootComment, getErr := s.interactions.GetCommentByID(ctx, *rootID, currentUserID)
		if getErr != nil {
			if errors.Is(getErr, gorm.ErrRecordNotFound) {
				return nil, ErrNotFound
			}
			return nil, ErrDependencyUnavailable
		}
		if rootComment.FileID != fileID {
			return nil, ErrNotFound
		}
		threadRootID := rootComment.ID
		if rootComment.RootID != nil && *rootComment.RootID > 0 {
			threadRootID = *rootComment.RootID
		}
		items, total, err = s.interactions.ListThreadReplies(ctx, fileID, threadRootID, currentUserID, repository.CommentListQuery{
			Page:     page,
			PageSize: pageSize,
		})
	} else {
		items, total, err = s.interactions.ListTopLevelComments(ctx, fileID, currentUserID, repository.CommentListQuery{
			Page:     page,
			PageSize: pageSize,
		})
	}
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	applyResolvedCommentAvatars(items)
	out := make([]CommentItem, 0, len(items))
	for index := range items {
		out = append(out, toCommentItem(&items[index], currentUserID))
	}
	totalPages := 0
	if pageSize > 0 {
		totalPages = int((total + int64(pageSize) - 1) / int64(pageSize))
	}
	return &CommentListResult{
		Items:      out,
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: totalPages,
		Overall:    overallTotal,
	}, nil
}

func (s *InteractionService) CreateComment(ctx context.Context, userID, fileID uint, parentID *uint, content string) (*CommentItem, error) {
	file, err := s.files.GetPublicByID(ctx, fileID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, ErrDependencyUnavailable
	}

	body := strings.TrimSpace(content)
	if body == "" || len([]rune(body)) > 2000 {
		return nil, ErrValidation
	}

	var parent *model.FileComment
	var rootID *uint
	if parentID != nil && *parentID > 0 {
		parent, err = s.interactions.GetCommentByID(ctx, *parentID, nil)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, ErrNotFound
			}
			return nil, ErrDependencyUnavailable
		}
		if parent.FileID != fileID {
			return nil, ErrValidation
		}
		if parent.RootID != nil {
			rootID = parent.RootID
		} else {
			rootID = &parent.ID
		}
	}

	comment := &model.FileComment{
		FileID:   fileID,
		UserID:   userID,
		ParentID: parentID,
		RootID:   rootID,
		Content:  body,
	}
	if err := s.interactions.CreateComment(ctx, comment); err != nil {
		return nil, ErrDependencyUnavailable
	}

	created, err := s.interactions.GetCommentByID(ctx, comment.ID, &userID)
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	applyResolvedCommentAvatar(created)
	item := toCommentItem(created, &userID)

	if parent != nil {
		if parent.UserID != userID {
			_ = s.interactions.CreateNotification(ctx, buildNotification(
				parent.UserID,
				&userID,
				NotificationTypeCommentReply,
				"收到新的回复",
				fmt.Sprintf("%s 回复了你的评论", created.UserDisplayName),
				fileID,
				created.ID,
				created.Content,
			))
		}
	} else if file.CreatedBy != nil && *file.CreatedBy != userID {
		_ = s.interactions.CreateNotification(ctx, buildNotification(
			*file.CreatedBy,
			&userID,
			NotificationTypeFileComment,
			"文件收到新评论",
			fmt.Sprintf("%s 评论了你的文件《%s》", created.UserDisplayName, file.Name),
			fileID,
			created.ID,
			created.Content,
		))
	}

	return &item, nil
}

func (s *InteractionService) DeleteComment(ctx context.Context, userID, commentID uint) error {
	comment, err := s.interactions.GetCommentByID(ctx, commentID, &userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNotFound
		}
		return ErrDependencyUnavailable
	}
	if comment.UserID != userID {
		return ErrForbidden
	}
	if err := s.interactions.DeleteCommentTree(ctx, commentID); err != nil {
		return ErrDependencyUnavailable
	}
	return nil
}

func (s *InteractionService) VoteComment(ctx context.Context, userID, commentID uint, value int) (int, error) {
	if value != -1 && value != 1 {
		return 0, ErrValidation
	}

	actor, err := s.users.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, ErrNotFound
		}
		return 0, ErrDependencyUnavailable
	}

	comment, err := s.interactions.GetCommentByID(ctx, commentID, &userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, ErrNotFound
		}
		return 0, ErrDependencyUnavailable
	}
	if comment.UserID == userID {
		return 0, ErrForbidden
	}

	finalVote, err := s.interactions.SetCommentVote(ctx, commentID, userID, value)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, ErrNotFound
		}
		return 0, ErrDependencyUnavailable
	}

	if finalVote != 0 {
		actorName := strings.TrimSpace(actor.DisplayName)
		if actorName == "" {
			actorName = actor.Username
		}
		notificationType := NotificationTypeCommentLike
		title := "收到评论点赞"
		content := fmt.Sprintf("%s 赞了你的评论", actorName)
		if finalVote < 0 {
			notificationType = NotificationTypeCommentDislike
			title = "收到评论点踩"
			content = fmt.Sprintf("%s 点踩了你的评论", actorName)
		}
		_ = s.interactions.CreateNotification(ctx, buildNotification(
			comment.UserID,
			&userID,
			notificationType,
			title,
			content,
			comment.FileID,
			comment.ID,
			comment.Content,
		))
	}
	return finalVote, nil
}

func (s *InteractionService) ListNotifications(ctx context.Context, userID uint, page, pageSize int, types []string) (*NotificationListResult, error) {
	items, total, err := s.interactions.ListNotifications(ctx, userID, repository.NotificationListQuery{
		Page:     page,
		PageSize: pageSize,
		Types:    types,
	})
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	unread, err := s.interactions.CountUnreadNotifications(ctx, userID)
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	applyResolvedNotificationAvatars(items)
	page, pageSize = normalizePagination(page, pageSize, 20, 100)
	return &NotificationListResult{
		Items:      items,
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: int((total + int64(pageSize) - 1) / int64(pageSize)),
		Unread:     unread,
	}, nil
}

func (s *InteractionService) MarkNotificationRead(ctx context.Context, userID, notificationID uint) error {
	if err := s.interactions.MarkNotificationRead(ctx, userID, notificationID); err != nil {
		return ErrDependencyUnavailable
	}
	return nil
}

func (s *InteractionService) MarkAllNotificationsRead(ctx context.Context, userID uint, types []string) error {
	if err := s.interactions.MarkNotificationsReadByType(ctx, userID, types); err != nil {
		return ErrDependencyUnavailable
	}
	return nil
}

func (s *InteractionService) ListMyComments(ctx context.Context, userID uint, page, pageSize int) (*CommentListResult, int64, error) {
	items, total, err := s.interactions.ListUserComments(ctx, userID, &userID, repository.CommentListQuery{
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		return nil, 0, ErrDependencyUnavailable
	}
	applyResolvedCommentAvatars(items)
	out := make([]CommentItem, 0, len(items))
	for index := range items {
		out = append(out, toCommentItem(&items[index], &userID))
	}
	return &CommentListResult{Items: out, Total: int64(len(out)), Page: page, PageSize: pageSize}, total, nil
}

func toCommentItem(comment *model.FileComment, currentUserID *uint) CommentItem {
	replyTo := (*CommentAuthor)(nil)
	if strings.TrimSpace(comment.ParentUsername) != "" {
		replyTo = &CommentAuthor{
			Username:    comment.ParentUsername,
			DisplayName: comment.ParentDisplayName,
		}
	}
	canDelete := currentUserID != nil && *currentUserID == comment.UserID
	return CommentItem{
		ID:              comment.ID,
		FileID:          comment.FileID,
		ParentID:        comment.ParentID,
		RootID:          comment.RootID,
		Content:         comment.Content,
		LikeCount:       comment.LikeCount,
		DislikeCount:    comment.DislikeCount,
		CurrentUserVote: comment.CurrentUserVote,
		CreatedAt:       comment.CreatedAt.Format(timeLayout),
		UpdatedAt:       comment.UpdatedAt.Format(timeLayout),
		CanDelete:       canDelete,
		ReplyCount:      comment.ReplyCount,
		Author: CommentAuthor{
			ID:          comment.UserID,
			Username:    comment.UserUsername,
			DisplayName: comment.UserDisplayName,
			AvatarURL:   comment.UserAvatarURL,
		},
		ReplyTo: replyTo,
	}
}

func buildNotification(userID uint, actorUserID *uint, kind, title, content string, fileID, commentID uint, commentContent string) *model.UserNotification {
	return buildNotificationWithData(userID, actorUserID, kind, title, content, fileID, commentID, commentContent, nil)
}

func buildNotificationWithData(userID uint, actorUserID *uint, kind, title, content string, fileID, commentID uint, commentContent string, extra map[string]any) *model.UserNotification {
	data := map[string]any{}
	if fileID > 0 {
		data["fileId"] = fileID
	}
	if commentID > 0 {
		data["commentId"] = commentID
	}
	if commentContent != "" {
		data["commentContent"] = commentContent
	}
	for key, value := range extra {
		data[key] = value
	}
	return &model.UserNotification{
		UserID:      userID,
		ActorUserID: actorUserID,
		Type:        kind,
		Title:       title,
		Content:     content,
		Data:        data,
	}
}

func normalizePagination(page, pageSize, defaultPageSize, maxPageSize int) (int, int) {
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

const timeLayout = "2006-01-02T15:04:05Z07:00"
