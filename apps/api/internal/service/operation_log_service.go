package service

import (
	"context"

	"fluxfiles/api/internal/model"
	"fluxfiles/api/internal/repository"
)

type OperationLogService struct {
	repo *repository.OperationLogRepository
}

func NewOperationLogService(repo *repository.OperationLogRepository) *OperationLogService {
	return &OperationLogService{repo: repo}
}

func (s *OperationLogService) Record(ctx context.Context, adminUserID uint, action, targetType, targetID, detail, ip string) {
	_ = s.repo.Create(ctx, &model.OperationLog{
		AdminUserID: adminUserID,
		Action:      action,
		TargetType:  targetType,
		TargetID:    targetID,
		Detail:      detail,
		IP:          ip,
	})
}

type OperationLogListResult struct {
	Items      []repository.OperationLogItem `json:"items"`
	Page       int                           `json:"page"`
	PageSize   int                           `json:"pageSize"`
	Total      int64                         `json:"total"`
	TotalPages int                           `json:"totalPages"`
}

type ListOperationLogsInput struct {
	Page       int
	PageSize   int
	Search     string
	Action     string
	TargetType string
}

func (s *OperationLogService) List(ctx context.Context, input ListOperationLogsInput) (*OperationLogListResult, error) {
	items, total, err := s.repo.List(ctx, repository.OperationLogListQuery{
		Page:       input.Page,
		PageSize:   input.PageSize,
		Search:     input.Search,
		Action:     input.Action,
		TargetType: input.TargetType,
	})
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	for index := range items {
		items[index].AdminAvatarURL = resolveAvatarURL(items[index].AdminUsername, items[index].AdminDisplayName, items[index].AdminAvatarURL)
		if items[index].TargetUserID > 0 {
			items[index].TargetAvatarURL = resolveAvatarURL(items[index].TargetUsername, items[index].TargetDisplayName, items[index].TargetAvatarURL)
		}
	}

	page := input.Page
	if page < 1 {
		page = 1
	}
	pageSize := input.PageSize
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))

	return &OperationLogListResult{
		Items:      items,
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: totalPages,
	}, nil
}
