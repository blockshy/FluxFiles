package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"fluxfiles/api/internal/model"
	"fluxfiles/api/internal/repository"

	"gorm.io/gorm"
)

type TaxonomyListResult struct {
	Items      []model.Category `json:"items"`
	Page       int              `json:"page"`
	PageSize   int              `json:"pageSize"`
	Total      int64            `json:"total"`
	TotalPages int              `json:"totalPages"`
}

type TaxonomyLogListResult struct {
	Items      []model.TaxonomyChangeLog `json:"items"`
	Page       int                       `json:"page"`
	PageSize   int                       `json:"pageSize"`
	Total      int64                     `json:"total"`
	TotalPages int                       `json:"totalPages"`
}

type ListTaxonomiesInput struct {
	Page     int
	PageSize int
	Search   string
}

type SaveTaxonomyInput struct {
	Name string
}

type TaxonomyService struct {
	db    *gorm.DB
	repo  *repository.TaxonomyRepository
	logs  *repository.TaxonomyLogRepository
	files *repository.FileRepository
	audit *OperationLogService
}

func NewTaxonomyService(
	db *gorm.DB,
	repo *repository.TaxonomyRepository,
	logs *repository.TaxonomyLogRepository,
	files *repository.FileRepository,
	audit *OperationLogService,
) *TaxonomyService {
	return &TaxonomyService{
		db:    db,
		repo:  repo,
		logs:  logs,
		files: files,
		audit: audit,
	}
}

func (s *TaxonomyService) List(ctx context.Context, kind repository.TaxonomyKind, input ListTaxonomiesInput) (*TaxonomyListResult, error) {
	items, total, err := s.repo.List(ctx, kind, repository.TaxonomyListQuery{
		Page:     input.Page,
		PageSize: input.PageSize,
		Search:   input.Search,
	})
	if err != nil {
		return nil, ErrDependencyUnavailable
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
	return &TaxonomyListResult{
		Items:      items,
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: totalPages,
	}, nil
}

func (s *TaxonomyService) ListOptions(ctx context.Context, kind repository.TaxonomyKind) ([]model.Category, error) {
	items, err := s.repo.ListOptions(ctx, kind)
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	return items, nil
}

func (s *TaxonomyService) Create(ctx context.Context, kind repository.TaxonomyKind, adminID uint, ip string, input SaveTaxonomyInput) (*model.Category, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, ErrValidation
	}
	if _, err := s.repo.GetByName(ctx, kind, name); err == nil {
		return nil, fmt.Errorf("%w: name already exists", ErrValidation)
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrDependencyUnavailable
	}

	item := &model.Category{
		Name:      name,
		CreatedBy: adminID,
		UpdatedBy: adminID,
	}
	if err := s.repo.Create(ctx, kind, item); err != nil {
		return nil, ErrDependencyUnavailable
	}
	created, err := s.repo.GetByID(ctx, kind, item.ID)
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	s.recordChange(ctx, kind, created.ID, "create", nil, created, adminID)
	s.audit.Record(ctx, adminID, string(kind)+".create", string(kind), fmt.Sprintf("%d", created.ID), created.Name, ip)
	return created, nil
}

func (s *TaxonomyService) Update(ctx context.Context, kind repository.TaxonomyKind, id, adminID uint, ip string, input SaveTaxonomyInput) (*model.Category, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, ErrValidation
	}
	item, err := s.repo.GetByID(ctx, kind, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, ErrDependencyUnavailable
	}
	if existing, err := s.repo.GetByName(ctx, kind, name); err == nil && existing.ID != id {
		return nil, fmt.Errorf("%w: name already exists", ErrValidation)
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrDependencyUnavailable
	}

	before := *item
	if err := s.repo.Update(ctx, kind, item, map[string]any{
		"name":       name,
		"updated_by": adminID,
		"updated_at": gorm.Expr("NOW()"),
	}); err != nil {
		return nil, ErrDependencyUnavailable
	}
	if before.Name != name {
		if err := s.syncFileReferences(ctx, kind, before.Name, name); err != nil {
			return nil, err
		}
	}
	updated, err := s.repo.GetByID(ctx, kind, id)
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	s.recordChange(ctx, kind, updated.ID, "update", &before, updated, adminID)
	s.audit.Record(ctx, adminID, string(kind)+".update", string(kind), fmt.Sprintf("%d", updated.ID), updated.Name, ip)
	return updated, nil
}

func (s *TaxonomyService) Delete(ctx context.Context, kind repository.TaxonomyKind, id, adminID uint, ip string) error {
	item, err := s.repo.GetByID(ctx, kind, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNotFound
		}
		return ErrDependencyUnavailable
	}
	usageCount, err := s.countUsage(ctx, kind, item.Name)
	if err != nil {
		return ErrDependencyUnavailable
	}
	if usageCount > 0 {
		return fmt.Errorf("%w: taxonomy is still used by files", ErrValidation)
	}
	before := *item
	if err := s.repo.Delete(ctx, kind, id); err != nil {
		return ErrDependencyUnavailable
	}
	s.recordChange(ctx, kind, id, "delete", &before, nil, adminID)
	s.audit.Record(ctx, adminID, string(kind)+".delete", string(kind), fmt.Sprintf("%d", id), before.Name, ip)
	return nil
}

func (s *TaxonomyService) ListLogs(ctx context.Context, kind repository.TaxonomyKind, id uint, page, pageSize int) (*TaxonomyLogListResult, error) {
	items, total, err := s.logs.List(ctx, string(kind), id, page, pageSize)
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))
	return &TaxonomyLogListResult{
		Items:      items,
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: totalPages,
	}, nil
}

func (s *TaxonomyService) ValidateSelections(ctx context.Context, category string, tags []string) error {
	if category = strings.TrimSpace(category); category != "" {
		if _, err := s.repo.GetByName(ctx, repository.TaxonomyKindCategory, category); err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("%w: category does not exist", ErrValidation)
			}
			return ErrDependencyUnavailable
		}
	}

	seen := map[string]struct{}{}
	for _, tag := range tags {
		value := strings.TrimSpace(tag)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		if _, err := s.repo.GetByName(ctx, repository.TaxonomyKindTag, value); err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("%w: tag does not exist", ErrValidation)
			}
			return ErrDependencyUnavailable
		}
	}
	return nil
}

func (s *TaxonomyService) countUsage(ctx context.Context, kind repository.TaxonomyKind, name string) (int64, error) {
	switch kind {
	case repository.TaxonomyKindCategory:
		return s.files.CountByCategory(ctx, name)
	case repository.TaxonomyKindTag:
		return s.files.CountByTag(ctx, name)
	default:
		return 0, ErrValidation
	}
}

func (s *TaxonomyService) syncFileReferences(ctx context.Context, kind repository.TaxonomyKind, oldName, newName string) error {
	switch kind {
	case repository.TaxonomyKindCategory:
		if err := s.files.RenameCategoryReferences(ctx, oldName, newName); err != nil {
			return ErrDependencyUnavailable
		}
	case repository.TaxonomyKindTag:
		if err := s.files.RenameTagReferences(ctx, oldName, newName); err != nil {
			return ErrDependencyUnavailable
		}
	}
	return nil
}

func (s *TaxonomyService) recordChange(ctx context.Context, kind repository.TaxonomyKind, id uint, action string, before *model.Category, after *model.Category, adminID uint) {
	var beforeData string
	var afterData string
	if before != nil {
		if payload, err := json.Marshal(before); err == nil {
			beforeData = string(payload)
		}
	}
	if after != nil {
		if payload, err := json.Marshal(after); err == nil {
			afterData = string(payload)
		}
	}
	_ = s.logs.Create(ctx, &model.TaxonomyChangeLog{
		TaxonomyType: string(kind),
		TaxonomyID:   id,
		Action:       action,
		BeforeData:   beforeData,
		AfterData:    afterData,
		AdminUserID:  adminID,
	})
}
