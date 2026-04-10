package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
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
	Name       string
	ParentID   *uint
	CategoryID *uint
}

type MoveTaxonomyInput struct {
	Direction string
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
	if err := s.enrichItems(ctx, kind, items); err != nil {
		return nil, err
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
	if err := s.enrichItems(ctx, kind, items); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *TaxonomyService) Create(ctx context.Context, kind repository.TaxonomyKind, adminID uint, ip string, input SaveTaxonomyInput) (*model.Category, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, ErrValidation
	}
	if err := s.validateSaveInput(ctx, kind, 0, input); err != nil {
		return nil, err
	}
	if _, err := s.repo.GetByName(ctx, kind, name); err == nil {
		return nil, fmt.Errorf("%w: name already exists", ErrValidation)
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrDependencyUnavailable
	}

	item := &model.Category{
		Name:       name,
		ParentID:   normalizeOptionalID(input.ParentID),
		CategoryID: normalizeOptionalID(input.CategoryID),
		SortOrder:  0,
		CreatedBy:  adminID,
		UpdatedBy:  adminID,
	}
	sortOrder, err := s.repo.NextSortOrder(ctx, kind, taxonomyParentID(kind, item))
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	item.SortOrder = sortOrder
	if err := s.repo.Create(ctx, kind, item); err != nil {
		return nil, ErrDependencyUnavailable
	}
	created, err := s.repo.GetByID(ctx, kind, item.ID)
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	if err := s.enrichSingle(ctx, kind, created); err != nil {
		return nil, err
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
	if err := s.enrichSingle(ctx, kind, item); err != nil {
		return nil, err
	}
	if existing, err := s.repo.GetByName(ctx, kind, name); err == nil && existing.ID != id {
		return nil, fmt.Errorf("%w: name already exists", ErrValidation)
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrDependencyUnavailable
	}
	if err := s.validateSaveInput(ctx, kind, id, input); err != nil {
		return nil, err
	}

	before := *item
	values := map[string]any{
		"name":       name,
		"updated_by": adminID,
		"updated_at": gorm.Expr("NOW()"),
	}
	parentChanged := false
	switch kind {
	case repository.TaxonomyKindCategory, repository.TaxonomyKindTagCategory:
		nextParentID := normalizeOptionalID(input.ParentID)
		values["parent_id"] = nextParentID
		parentChanged = !sameOptionalUint(item.ParentID, nextParentID)
	case repository.TaxonomyKindTag:
		nextCategoryID := normalizeOptionalID(input.CategoryID)
		values["tag_category_id"] = nextCategoryID
		parentChanged = !sameOptionalUint(item.CategoryID, nextCategoryID)
	}
	if parentChanged {
		sortOrder, sortErr := s.repo.NextSortOrder(ctx, kind, taxonomyParentID(kind, &model.Category{
			ParentID:   normalizeOptionalID(input.ParentID),
			CategoryID: normalizeOptionalID(input.CategoryID),
		}))
		if sortErr != nil {
			return nil, ErrDependencyUnavailable
		}
		values["sort_order"] = sortOrder
	}
	if err := s.repo.Update(ctx, kind, item, values); err != nil {
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
	if err := s.enrichSingle(ctx, kind, updated); err != nil {
		return nil, err
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
	if err := s.enrichSingle(ctx, kind, item); err != nil {
		return err
	}
	usageCount, err := s.countUsage(ctx, kind, item.Name)
	if err != nil {
		return ErrDependencyUnavailable
	}
	if usageCount > 0 {
		return fmt.Errorf("%w: taxonomy is still used by files", ErrValidation)
	}
	if kind == repository.TaxonomyKindCategory || kind == repository.TaxonomyKindTagCategory {
		childCategories, childTags, childErr := s.repo.CountCategoryChildren(ctx, kind, id)
		if childErr != nil {
			return ErrDependencyUnavailable
		}
		if childCategories > 0 || childTags > 0 {
			return fmt.Errorf("%w: category still contains subcategories or tags", ErrValidation)
		}
	}
	before := *item
	if err := s.repo.Delete(ctx, kind, id); err != nil {
		return ErrDependencyUnavailable
	}
	s.recordChange(ctx, kind, id, "delete", &before, nil, adminID)
	s.audit.Record(ctx, adminID, string(kind)+".delete", string(kind), fmt.Sprintf("%d", id), before.Name, ip)
	return nil
}

func (s *TaxonomyService) Move(ctx context.Context, kind repository.TaxonomyKind, id, adminID uint, ip string, input MoveTaxonomyInput) (*model.Category, error) {
	if !strings.EqualFold(input.Direction, "up") && !strings.EqualFold(input.Direction, "down") {
		return nil, ErrValidation
	}
	item, err := s.repo.GetByID(ctx, kind, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, ErrDependencyUnavailable
	}
	if err := s.enrichSingle(ctx, kind, item); err != nil {
		return nil, err
	}
	before := *item
	if err := s.repo.Move(ctx, kind, id, strings.ToLower(input.Direction)); err != nil {
		return nil, ErrDependencyUnavailable
	}
	updated, err := s.repo.GetByID(ctx, kind, id)
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	if err := s.enrichSingle(ctx, kind, updated); err != nil {
		return nil, err
	}
	s.recordChange(ctx, kind, updated.ID, "move_"+strings.ToLower(input.Direction), &before, updated, adminID)
	s.audit.Record(ctx, adminID, string(kind)+".move", string(kind), fmt.Sprintf("%d", updated.ID), updated.Name, ip)
	return updated, nil
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

func (s *TaxonomyService) EnrichFiles(ctx context.Context, files []model.File) error {
	if len(files) == 0 {
		return nil
	}

	categoryItems, err := s.repo.ListOptions(ctx, repository.TaxonomyKindCategory)
	if err != nil {
		return ErrDependencyUnavailable
	}
	tagCategoryItems, err := s.repo.ListOptions(ctx, repository.TaxonomyKindTagCategory)
	if err != nil {
		return ErrDependencyUnavailable
	}
	tagItems, err := s.repo.ListOptions(ctx, repository.TaxonomyKindTag)
	if err != nil {
		return ErrDependencyUnavailable
	}

	categoryPathMap := buildCategoryPathMap(categoryItems)
	tagCategoryPathMap := buildCategoryPathMap(tagCategoryItems)
	tagPathMap := buildTagPathMap(tagItems, tagCategoryPathMap)
	for index := range files {
		if files[index].Category != "" {
			files[index].CategoryPath = categoryPathMap[files[index].Category]
		}
		files[index].TagPaths = make([]string, 0, len(files[index].Tags))
		for _, tag := range files[index].Tags {
			if path, ok := tagPathMap[tag]; ok && path != "" {
				files[index].TagPaths = append(files[index].TagPaths, path)
				continue
			}
			files[index].TagPaths = append(files[index].TagPaths, tag)
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
	case repository.TaxonomyKindTagCategory:
		return 0, nil
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

func (s *TaxonomyService) enrichItems(ctx context.Context, kind repository.TaxonomyKind, items []model.Category) error {
	if len(items) == 0 {
		return nil
	}
	switch kind {
	case repository.TaxonomyKindCategory, repository.TaxonomyKindTagCategory:
		treeItems, err := s.repo.ListOptions(ctx, kind)
		if err != nil {
			return ErrDependencyUnavailable
		}
		pathMap, depthMap := buildCategoryPathMaps(treeItems)
		idMap := make(map[uint]model.Category, len(treeItems))
		for _, category := range treeItems {
			idMap[category.ID] = category
		}
		for index := range items {
			items[index].FullPath = pathMap[items[index].Name]
			items[index].Depth = depthMap[items[index].Name]
			childCategories, childTags, err := s.repo.CountCategoryChildren(ctx, kind, items[index].ID)
			if err != nil {
				return ErrDependencyUnavailable
			}
			items[index].ChildCount = childCategories
			items[index].TagCount = childTags
			if items[index].ParentID != nil {
				if parent, ok := idMap[*items[index].ParentID]; ok {
					items[index].ParentName = parent.Name
				}
			}
		}
	case repository.TaxonomyKindTag:
		tagCategoryItems, err := s.repo.ListOptions(ctx, repository.TaxonomyKindTagCategory)
		if err != nil {
			return ErrDependencyUnavailable
		}
		categoryPathMap := buildCategoryPathMap(tagCategoryItems)
		for index := range items {
			if items[index].CategoryName != "" {
				items[index].CategoryPath = categoryPathMap[items[index].CategoryName]
			}
			items[index].FullPath = joinPath(items[index].CategoryPath, items[index].Name)
		}
	}
	return nil
}

func (s *TaxonomyService) enrichSingle(ctx context.Context, kind repository.TaxonomyKind, item *model.Category) error {
	if item == nil {
		return nil
	}
	items := []model.Category{*item}
	if err := s.enrichItems(ctx, kind, items); err != nil {
		return err
	}
	*item = items[0]
	return nil
}

func (s *TaxonomyService) validateSaveInput(ctx context.Context, kind repository.TaxonomyKind, currentID uint, input SaveTaxonomyInput) error {
	switch kind {
	case repository.TaxonomyKindCategory, repository.TaxonomyKindTagCategory:
		if input.ParentID == nil || *input.ParentID == 0 {
			return nil
		}
		if currentID > 0 && *input.ParentID == currentID {
			return fmt.Errorf("%w: category cannot be its own parent", ErrValidation)
		}
		parent, err := s.repo.GetByID(ctx, kind, *input.ParentID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("%w: parent category does not exist", ErrValidation)
			}
			return ErrDependencyUnavailable
		}
		if currentID == 0 {
			return nil
		}
		allCategories, err := s.repo.ListOptions(ctx, kind)
		if err != nil {
			return ErrDependencyUnavailable
		}
		parentMap := make(map[uint]*uint, len(allCategories))
		for index := range allCategories {
			item := allCategories[index]
			parentMap[item.ID] = item.ParentID
		}
		cursor := parent.ID
		seen := map[uint]struct{}{}
		for cursor > 0 {
			if cursor == currentID {
				return fmt.Errorf("%w: category hierarchy cannot contain cycles", ErrValidation)
			}
			if _, ok := seen[cursor]; ok {
				break
			}
			seen[cursor] = struct{}{}
			next := parentMap[cursor]
			if next == nil {
				break
			}
			cursor = *next
		}
	case repository.TaxonomyKindTag:
		if input.CategoryID == nil || *input.CategoryID == 0 {
			return fmt.Errorf("%w: tag category is required", ErrValidation)
		}
		if _, err := s.repo.GetByID(ctx, repository.TaxonomyKindTagCategory, *input.CategoryID); err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("%w: tag category does not exist", ErrValidation)
			}
			return ErrDependencyUnavailable
		}
	}
	return nil
}

func normalizeOptionalID(value *uint) *uint {
	if value == nil || *value == 0 {
		return nil
	}
	return value
}

func taxonomyParentID(kind repository.TaxonomyKind, item *model.Category) *uint {
	if kind == repository.TaxonomyKindCategory || kind == repository.TaxonomyKindTagCategory {
		return item.ParentID
	}
	return item.CategoryID
}

func sameOptionalUint(left, right *uint) bool {
	switch {
	case left == nil && right == nil:
		return true
	case left == nil || right == nil:
		return false
	default:
		return *left == *right
	}
}

func buildCategoryPathMap(items []model.Category) map[string]string {
	pathMap, _ := buildCategoryPathMaps(items)
	return pathMap
}

func buildCategoryPathMaps(items []model.Category) (map[string]string, map[string]int) {
	itemByID := make(map[uint]model.Category, len(items))
	for _, item := range items {
		itemByID[item.ID] = item
	}

	pathByName := make(map[string]string, len(items))
	depthByName := make(map[string]int, len(items))
	var resolve func(item model.Category) (string, int)
	resolve = func(item model.Category) (string, int) {
		if cached, ok := pathByName[item.Name]; ok {
			return cached, depthByName[item.Name]
		}
		if item.ParentID == nil {
			pathByName[item.Name] = item.Name
			depthByName[item.Name] = 0
			return item.Name, 0
		}
		parent, ok := itemByID[*item.ParentID]
		if !ok {
			pathByName[item.Name] = item.Name
			depthByName[item.Name] = 0
			return item.Name, 0
		}
		parentPath, parentDepth := resolve(parent)
		path := joinPath(parentPath, item.Name)
		pathByName[item.Name] = path
		depthByName[item.Name] = parentDepth + 1
		return path, parentDepth + 1
	}

	names := make([]string, 0, len(items))
	for _, item := range items {
		names = append(names, item.Name)
	}
	slices.Sort(names)
	for _, name := range names {
		for _, item := range items {
			if item.Name == name {
				resolve(item)
				break
			}
		}
	}
	return pathByName, depthByName
}

func buildTagPathMap(items []model.Category, categoryPathMap map[string]string) map[string]string {
	result := make(map[string]string, len(items))
	for _, item := range items {
		categoryPath := categoryPathMap[item.CategoryName]
		result[item.Name] = joinPath(categoryPath, item.Name)
	}
	return result
}

func joinPath(parent, current string) string {
	parent = strings.TrimSpace(parent)
	current = strings.TrimSpace(current)
	switch {
	case parent == "":
		return current
	case current == "":
		return parent
	default:
		return parent + "." + current
	}
}
