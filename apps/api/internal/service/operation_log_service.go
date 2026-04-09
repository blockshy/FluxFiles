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
