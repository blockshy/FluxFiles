package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"fluxfiles/api/internal/model"
	"fluxfiles/api/internal/repository"

	"gorm.io/gorm"
)

const (
	NotificationTypeCommunityPostReply  = "community.post.reply"
	NotificationTypeCommunityReplyReply = "community.reply.reply"
)

var htmlTagPattern = regexp.MustCompile(`(?s)<[^>]*>`)
var scriptPattern = regexp.MustCompile(`(?is)<(script|style|iframe|object|embed)[^>]*>.*?</(script|style|iframe|object|embed)>`)
var eventAttrPattern = regexp.MustCompile(`(?i)\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)`)
var jsHrefPattern = regexp.MustCompile(`(?i)(href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')`)

type CommunityPostItem struct {
	ID            uint          `json:"id"`
	Title         string        `json:"title"`
	ContentHTML   string        `json:"contentHtml"`
	ContentText   string        `json:"contentText"`
	IsPinned      bool          `json:"isPinned"`
	IsLocked      bool          `json:"isLocked"`
	ViewCount     int64         `json:"viewCount"`
	ReplyCount    int64         `json:"replyCount"`
	LastRepliedAt string        `json:"lastRepliedAt,omitempty"`
	CreatedAt     string        `json:"createdAt"`
	UpdatedAt     string        `json:"updatedAt"`
	CanEdit       bool          `json:"canEdit"`
	CanDelete     bool          `json:"canDelete"`
	Author        CommentAuthor `json:"author"`
}

type CommunityReplyItem struct {
	ID        uint           `json:"id"`
	PostID    uint           `json:"postId"`
	ParentID  *uint          `json:"parentId,omitempty"`
	Content   string         `json:"content"`
	CreatedAt string         `json:"createdAt"`
	UpdatedAt string         `json:"updatedAt"`
	CanDelete bool           `json:"canDelete"`
	Author    CommentAuthor  `json:"author"`
	ReplyTo   *CommentAuthor `json:"replyTo,omitempty"`
}

type CommunityListResult struct {
	Items      []CommunityPostItem `json:"items"`
	Page       int                 `json:"page"`
	PageSize   int                 `json:"pageSize"`
	Total      int64               `json:"total"`
	TotalPages int                 `json:"totalPages"`
}

type CommunityReplyListResult struct {
	Items      []CommunityReplyItem `json:"items"`
	Page       int                  `json:"page"`
	PageSize   int                  `json:"pageSize"`
	Total      int64                `json:"total"`
	TotalPages int                  `json:"totalPages"`
}

type CommunityService struct {
	repo         *repository.CommunityRepository
	interactions *repository.InteractionRepository
	logs         *OperationLogService
}

func NewCommunityService(repo *repository.CommunityRepository, interactions *repository.InteractionRepository, logs *OperationLogService) *CommunityService {
	return &CommunityService{repo: repo, interactions: interactions, logs: logs}
}

func (s *CommunityService) ListPosts(ctx context.Context, currentUserID *uint, page, pageSize int, search string) (*CommunityListResult, error) {
	items, total, err := s.repo.ListPosts(ctx, repository.CommunityListQuery{Page: page, PageSize: pageSize, Search: search})
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	out := make([]CommunityPostItem, 0, len(items))
	for index := range items {
		out = append(out, toCommunityPostItem(&items[index], currentUserID))
	}
	page, pageSize = normalizePagination(page, pageSize, 20, 100)
	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))
	return &CommunityListResult{Items: out, Page: page, PageSize: pageSize, Total: total, TotalPages: totalPages}, nil
}

func (s *CommunityService) GetPost(ctx context.Context, id uint, currentUserID *uint, incrementView bool) (*CommunityPostItem, error) {
	post, err := s.repo.GetPostByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, ErrDependencyUnavailable
	}
	if incrementView {
		_ = s.repo.IncrementPostView(ctx, id)
		post.ViewCount++
	}
	item := toCommunityPostItem(post, currentUserID)
	return &item, nil
}

func (s *CommunityService) CreatePost(ctx context.Context, userID uint, title, contentHTML string) (*CommunityPostItem, error) {
	cleanTitle := strings.TrimSpace(title)
	cleanHTML, cleanText, err := normalizeCommunityHTML(contentHTML)
	if err != nil {
		return nil, err
	}
	if cleanTitle == "" || len([]rune(cleanTitle)) > 255 {
		return nil, ErrValidation
	}
	post := &model.CommunityPost{
		Title:       cleanTitle,
		ContentHTML: cleanHTML,
		ContentText: cleanText,
		AuthorID:    userID,
	}
	if err := s.repo.CreatePost(ctx, post); err != nil {
		return nil, ErrDependencyUnavailable
	}
	return s.GetPost(ctx, post.ID, &userID, false)
}

func (s *CommunityService) UpdatePost(ctx context.Context, userID, postID uint, title, contentHTML string) (*CommunityPostItem, error) {
	post, err := s.repo.GetPostByID(ctx, postID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, ErrDependencyUnavailable
	}
	if post.AuthorID != userID {
		return nil, ErrForbidden
	}
	cleanTitle := strings.TrimSpace(title)
	cleanHTML, cleanText, normalizeErr := normalizeCommunityHTML(contentHTML)
	if normalizeErr != nil {
		return nil, normalizeErr
	}
	if cleanTitle == "" || len([]rune(cleanTitle)) > 255 {
		return nil, ErrValidation
	}
	if err := s.repo.UpdatePost(ctx, post, map[string]any{
		"title":        cleanTitle,
		"content_html": cleanHTML,
		"content_text": cleanText,
		"updated_at":   gorm.Expr("NOW()"),
	}); err != nil {
		return nil, ErrDependencyUnavailable
	}
	return s.GetPost(ctx, postID, &userID, false)
}

func (s *CommunityService) DeletePost(ctx context.Context, userID, postID uint) error {
	post, err := s.repo.GetPostByID(ctx, postID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNotFound
		}
		return ErrDependencyUnavailable
	}
	if post.AuthorID != userID {
		return ErrForbidden
	}
	if err := s.repo.DeletePost(ctx, postID); err != nil {
		return ErrDependencyUnavailable
	}
	return nil
}

func (s *CommunityService) ListReplies(ctx context.Context, postID uint, currentUserID *uint, page, pageSize int) (*CommunityReplyListResult, error) {
	if _, err := s.repo.GetPostByID(ctx, postID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, ErrDependencyUnavailable
	}
	items, total, err := s.repo.ListReplies(ctx, postID, page, pageSize)
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	out := make([]CommunityReplyItem, 0, len(items))
	for index := range items {
		out = append(out, toCommunityReplyItem(&items[index], currentUserID))
	}
	page, pageSize = normalizePagination(page, pageSize, 20, 100)
	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))
	return &CommunityReplyListResult{Items: out, Page: page, PageSize: pageSize, Total: total, TotalPages: totalPages}, nil
}

func (s *CommunityService) CreateReply(ctx context.Context, userID, postID uint, parentID *uint, content string) (*CommunityReplyItem, error) {
	post, err := s.repo.GetPostByID(ctx, postID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, ErrDependencyUnavailable
	}
	if post.IsLocked {
		return nil, fmt.Errorf("%w: post is locked", ErrValidation)
	}

	body := strings.TrimSpace(content)
	if body == "" || len([]rune(body)) > 2000 {
		return nil, ErrValidation
	}

	var parent *model.CommunityReply
	if parentID != nil && *parentID > 0 {
		parent, err = s.repo.GetReplyByID(ctx, *parentID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, ErrNotFound
			}
			return nil, ErrDependencyUnavailable
		}
		if parent.PostID != postID {
			return nil, ErrValidation
		}
	}

	reply := &model.CommunityReply{PostID: postID, UserID: userID, ParentID: parentID, Content: body}
	if err := s.repo.CreateReply(ctx, reply); err != nil {
		return nil, ErrDependencyUnavailable
	}
	_ = s.repo.TouchPostReplyTime(ctx, postID, time.Now().UTC())

	created, err := s.repo.GetReplyByID(ctx, reply.ID)
	if err != nil {
		return nil, ErrDependencyUnavailable
	}

	if parent != nil && parent.UserID != userID {
		_ = s.interactions.CreateNotification(ctx, buildNotificationWithData(
			parent.UserID,
			&userID,
			NotificationTypeCommunityReplyReply,
			"收到社区回复",
			fmt.Sprintf("有人回复了你在帖子《%s》中的回帖", post.Title),
			0,
			0,
			body,
			map[string]any{"postId": postID, "postTitle": post.Title, "replyId": created.ID},
		))
	} else if post.AuthorID != userID {
		_ = s.interactions.CreateNotification(ctx, buildNotificationWithData(
			post.AuthorID,
			&userID,
			NotificationTypeCommunityPostReply,
			"帖子收到新回复",
			fmt.Sprintf("有人回复了你的帖子《%s》", post.Title),
			0,
			0,
			body,
			map[string]any{"postId": postID, "postTitle": post.Title, "replyId": created.ID},
		))
	}

	item := toCommunityReplyItem(created, &userID)
	return &item, nil
}

func (s *CommunityService) DeleteReply(ctx context.Context, userID, replyID uint, canModerate bool) error {
	reply, err := s.repo.GetReplyByID(ctx, replyID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNotFound
		}
		return ErrDependencyUnavailable
	}
	if reply.UserID != userID && !canModerate {
		return ErrForbidden
	}
	if err := s.repo.DeleteReply(ctx, replyID); err != nil {
		return ErrDependencyUnavailable
	}
	return nil
}

func (s *CommunityService) ModeratePost(ctx context.Context, adminID, postID uint, pin, lock *bool, remove bool, ip string) error {
	post, err := s.repo.GetPostByID(ctx, postID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNotFound
		}
		return ErrDependencyUnavailable
	}
	if remove {
		if err := s.repo.DeletePost(ctx, postID); err != nil {
			return ErrDependencyUnavailable
		}
		s.logs.Record(ctx, adminID, "community.post.delete", "community_post", strconv.FormatUint(uint64(postID), 10), post.Title, ip)
		return nil
	}
	values := map[string]any{"updated_at": gorm.Expr("NOW()")}
	if pin != nil {
		values["is_pinned"] = *pin
	}
	if lock != nil {
		values["is_locked"] = *lock
	}
	if len(values) == 1 {
		return nil
	}
	if err := s.repo.UpdatePost(ctx, post, values); err != nil {
		return ErrDependencyUnavailable
	}
	s.logs.Record(ctx, adminID, "community.post.moderate", "community_post", strconv.FormatUint(uint64(postID), 10), post.Title, ip)
	return nil
}

func toCommunityPostItem(item *model.CommunityPost, currentUserID *uint) CommunityPostItem {
	name := strings.TrimSpace(item.AuthorDisplayName)
	if name == "" {
		name = item.AuthorUsername
	}
	out := CommunityPostItem{
		ID:          item.ID,
		Title:       item.Title,
		ContentHTML: item.ContentHTML,
		ContentText: item.ContentText,
		IsPinned:    item.IsPinned,
		IsLocked:    item.IsLocked,
		ViewCount:   item.ViewCount,
		ReplyCount:  item.ReplyCount,
		CreatedAt:   item.CreatedAt.Format(timeLayout),
		UpdatedAt:   item.UpdatedAt.Format(timeLayout),
		Author: CommentAuthor{
			ID:          item.AuthorID,
			Username:    item.AuthorUsername,
			DisplayName: name,
			AvatarURL:   resolveAvatarURL(item.AuthorUsername, name, item.AuthorAvatarURL),
		},
	}
	if item.LastRepliedAt != nil {
		out.LastRepliedAt = item.LastRepliedAt.Format(timeLayout)
	}
	if currentUserID != nil && *currentUserID == item.AuthorID {
		out.CanEdit = true
		out.CanDelete = true
	}
	return out
}

func toCommunityReplyItem(item *model.CommunityReply, currentUserID *uint) CommunityReplyItem {
	name := strings.TrimSpace(item.UserDisplayName)
	if name == "" {
		name = item.UserUsername
	}
	out := CommunityReplyItem{
		ID:        item.ID,
		PostID:    item.PostID,
		ParentID:  item.ParentID,
		Content:   item.Content,
		CreatedAt: item.CreatedAt.Format(timeLayout),
		UpdatedAt: item.UpdatedAt.Format(timeLayout),
		Author: CommentAuthor{
			ID:          item.UserID,
			Username:    item.UserUsername,
			DisplayName: name,
			AvatarURL:   resolveAvatarURL(item.UserUsername, name, item.UserAvatarURL),
		},
	}
	if currentUserID != nil && *currentUserID == item.UserID {
		out.CanDelete = true
	}
	if strings.TrimSpace(item.ParentUsername) != "" || strings.TrimSpace(item.ParentDisplayName) != "" {
		replyName := strings.TrimSpace(item.ParentDisplayName)
		if replyName == "" {
			replyName = item.ParentUsername
		}
		out.ReplyTo = &CommentAuthor{Username: item.ParentUsername, DisplayName: replyName}
	}
	return out
}

func normalizeCommunityHTML(raw string) (string, string, error) {
	value := strings.TrimSpace(raw)
	value = scriptPattern.ReplaceAllString(value, "")
	value = eventAttrPattern.ReplaceAllString(value, "")
	value = jsHrefPattern.ReplaceAllString(value, `$1="#"`)
	text := strings.TrimSpace(htmlTagPattern.ReplaceAllString(value, " "))
	text = strings.Join(strings.Fields(text), " ")
	if value == "" || text == "" || len([]rune(text)) > 20000 || len(value) > 100000 {
		return "", "", ErrValidation
	}
	return value, text, nil
}
