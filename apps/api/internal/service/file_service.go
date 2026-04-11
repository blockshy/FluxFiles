package service

import (
	"context"
	"fmt"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"fluxfiles/api/internal/config"
	"fluxfiles/api/internal/model"
	"fluxfiles/api/internal/repository"
	ossclient "fluxfiles/api/pkg/oss"
	"fluxfiles/api/pkg/resilience"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var safeFileName = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

type FileService struct {
	cfg      *config.Config
	files    *repository.FileRepository
	storage  *ossclient.Client
	breakers *resilience.Breakers
	logs     *OperationLogService
	settings *SettingsService
	taxonomy *TaxonomyService
}

type PrepareUploadInput struct {
	OriginalName string
	Size         int64
	MimeType     string
}

type CompleteUploadInput struct {
	ObjectKey    string
	OriginalName string
	Name         string
	Description  string
	Category     string
	Tags         []string
	IsPublic     bool
	AdminID      uint
	IP           string
}

type DownloadResult struct {
	URL       string    `json:"url"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type UploadPreparationResult struct {
	ObjectKey string            `json:"objectKey"`
	UploadURL string            `json:"uploadUrl"`
	Method    string            `json:"method"`
	Headers   map[string]string `json:"headers"`
	ExpiresAt time.Time         `json:"expiresAt"`
}

func NewFileService(
	cfg *config.Config,
	files *repository.FileRepository,
	storage *ossclient.Client,
	breakers *resilience.Breakers,
	logs *OperationLogService,
	settings *SettingsService,
	taxonomy *TaxonomyService,
) *FileService {
	return &FileService{
		cfg:      cfg,
		files:    files,
		storage:  storage,
		breakers: breakers,
		logs:     logs,
		settings: settings,
		taxonomy: taxonomy,
	}
}

func (s *FileService) ListPublic(ctx context.Context, params repository.FileListParams) ([]model.File, int64, error) {
	params.PublicOnly = true
	return s.list(ctx, params)
}

func (s *FileService) ListAdmin(ctx context.Context, actorID uint, permissions []string, params repository.FileListParams) ([]model.File, int64, error) {
	if !canManageAnyFiles(permissions) {
		return nil, 0, ErrForbidden
	}
	if !canManageAllFiles(permissions) {
		params.OwnerID = &actorID
	}
	return s.list(ctx, params)
}

func (s *FileService) list(ctx context.Context, params repository.FileListParams) ([]model.File, int64, error) {
	result, err := s.breakers.DB.Execute(func() (any, error) {
		items, total, innerErr := s.files.List(ctx, params)
		if innerErr != nil {
			return nil, innerErr
		}
		return struct {
			Items []model.File
			Total int64
		}{
			Items: items,
			Total: total,
		}, nil
	})
	if err != nil {
		return nil, 0, ErrDependencyUnavailable
	}

	payload := result.(struct {
		Items []model.File
		Total int64
	})
	applyResolvedFileUploaderAvatars(payload.Items)
	if s.taxonomy != nil {
		if err := s.taxonomy.EnrichFiles(ctx, payload.Items); err != nil {
			return nil, 0, err
		}
	}
	return payload.Items, payload.Total, nil
}

func (s *FileService) GetPublic(ctx context.Context, id uint) (*model.File, error) {
	result, err := s.breakers.DB.Execute(func() (any, error) {
		return s.files.GetPublicByID(ctx, id)
	})
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, ErrDependencyUnavailable
	}
	file := result.(*model.File)
	applyResolvedFileUploaderAvatar(file)
	if s.taxonomy != nil {
		items := []model.File{*file}
		if err := s.taxonomy.EnrichFiles(ctx, items); err != nil {
			return nil, err
		}
		*file = items[0]
	}
	return file, nil
}

func (s *FileService) GetAdmin(ctx context.Context, id uint, actorID uint, permissions []string) (*model.File, error) {
	result, err := s.breakers.DB.Execute(func() (any, error) {
		return s.files.GetByID(ctx, id, false)
	})
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, ErrDependencyUnavailable
	}
	file := result.(*model.File)
	applyResolvedFileUploaderAvatar(file)
	if s.taxonomy != nil {
		items := []model.File{*file}
		if err := s.taxonomy.EnrichFiles(ctx, items); err != nil {
			return nil, err
		}
		*file = items[0]
	}
	if err := ensureFileAccess(file, actorID, permissions); err != nil {
		return nil, err
	}
	return file, nil
}

func (s *FileService) DashboardStats(ctx context.Context, actorID uint, permissions []string) (*repository.DashboardStats, error) {
	if !canManageAnyFiles(permissions) {
		return nil, ErrForbidden
	}
	var ownerID *uint
	if !canManageAllFiles(permissions) {
		ownerID = &actorID
	}
	result, err := s.breakers.DB.Execute(func() (any, error) {
		return s.files.DashboardStats(ctx, ownerID)
	})
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	return result.(*repository.DashboardStats), nil
}

func (s *FileService) PrepareUpload(ctx context.Context, input PrepareUploadInput) (*UploadPreparationResult, error) {
	if strings.TrimSpace(input.OriginalName) == "" || input.Size <= 0 {
		return nil, ErrValidation
	}

	uploadPolicy, err := s.settings.BuildUploadPolicy(ctx)
	if err != nil {
		return nil, err
	}

	if err := uploadPolicy.Validate(input.OriginalName, input.Size, input.MimeType); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrValidation, err.Error())
	}

	resolvedMimeType := uploadPolicy.ResolveMimeType(input.OriginalName, input.MimeType)
	objectKey := s.objectKey(input.OriginalName)
	result, err := s.breakers.OSS.Execute(func() (any, error) {
		return s.storage.PresignUpload(ctx, objectKey, resolvedMimeType)
	})
	if err != nil {
		return nil, ErrDependencyUnavailable
	}

	prepared := result.(*ossclient.PresignedUpload)
	return &UploadPreparationResult{
		ObjectKey: objectKey,
		UploadURL: prepared.URL,
		Method:    prepared.Method,
		Headers:   prepared.SignedHeaders,
		ExpiresAt: prepared.Expiration,
	}, nil
}

func (s *FileService) Create(ctx context.Context, input CompleteUploadInput) (*model.File, error) {
	if strings.TrimSpace(input.ObjectKey) == "" || strings.TrimSpace(input.OriginalName) == "" {
		return nil, ErrValidation
	}
	if s.taxonomy != nil {
		if err := s.taxonomy.ValidateSelections(ctx, input.Category, input.Tags); err != nil {
			return nil, err
		}
	}

	result, err := s.breakers.OSS.Execute(func() (any, error) {
		return s.storage.HeadObject(ctx, input.ObjectKey)
	})
	if err != nil {
		return nil, ErrDependencyUnavailable
	}

	objectMeta := result.(*ossclient.HeadObjectResult)
	uploadPolicy, err := s.settings.BuildUploadPolicy(ctx)
	if err != nil {
		return nil, err
	}
	if err := uploadPolicy.Validate(input.OriginalName, objectMeta.ContentLength, derefString(objectMeta.ContentType)); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrValidation, err.Error())
	}

	fileName := strings.TrimSpace(input.Name)
	if fileName == "" {
		fileName = strings.TrimSuffix(input.OriginalName, filepath.Ext(input.OriginalName))
	}

	file := &model.File{
		Name:          fileName,
		OriginalName:  input.OriginalName,
		ObjectKey:     input.ObjectKey,
		Size:          objectMeta.ContentLength,
		MimeType:      derefString(objectMeta.ContentType),
		Description:   strings.TrimSpace(input.Description),
		Category:      strings.TrimSpace(input.Category),
		Tags:          normalizeTags(input.Tags),
		IsPublic:      input.IsPublic,
		DownloadCount: 0,
		CreatedBy:     &input.AdminID,
	}

	if _, err := s.breakers.DB.Execute(func() (any, error) {
		return nil, s.files.Create(ctx, file)
	}); err != nil {
		return nil, ErrDependencyUnavailable
	}

	s.logs.Record(ctx, input.AdminID, "file.create", "file", strconv.FormatUint(uint64(file.ID), 10), file.Name, input.IP)
	return file, nil
}

func (s *FileService) CanPrepareUpload(permissions []string) bool {
	return HasPermission(permissions, PermissionAdminFilesUpload)
}

func (s *FileService) GetUploadSettings(ctx context.Context) (UploadSettings, error) {
	return s.settings.GetUploadSettings(ctx)
}

func (s *FileService) Update(ctx context.Context, id uint, adminID uint, permissions []string, ip string, values map[string]any) (*model.File, error) {
	file, err := s.GetAdmin(ctx, id, adminID, permissions)
	if err != nil {
		return nil, err
	}

	values["tags"] = normalizeTags(toStringSlice(values["tags"]))
	if s.taxonomy != nil {
		category := file.Category
		if rawCategory, ok := values["category"].(string); ok {
			category = strings.TrimSpace(rawCategory)
		}
		if err := s.taxonomy.ValidateSelections(ctx, category, values["tags"].([]string)); err != nil {
			return nil, err
		}
	}
	if _, err := s.breakers.DB.Execute(func() (any, error) {
		return nil, s.files.Update(ctx, file, values)
	}); err != nil {
		return nil, ErrDependencyUnavailable
	}

	updated, err := s.GetAdmin(ctx, id, adminID, permissions)
	if err == nil {
		s.logs.Record(ctx, adminID, "file.update", "file", strconv.FormatUint(uint64(id), 10), updated.Name, ip)
	}
	return updated, err
}

func (s *FileService) Delete(ctx context.Context, id uint, adminID uint, permissions []string, ip string) error {
	file, err := s.GetAdmin(ctx, id, adminID, permissions)
	if err != nil {
		return err
	}

	if _, err := s.breakers.OSS.Execute(func() (any, error) {
		deleteErr := s.storage.Delete(ctx, file.ObjectKey)
		if deleteErr != nil && !isObjectMissingError(deleteErr) {
			return nil, deleteErr
		}
		return nil, nil
	}); err != nil {
		return ErrDependencyUnavailable
	}

	if _, err := s.breakers.DB.Execute(func() (any, error) {
		return nil, s.files.HardDelete(ctx, id)
	}); err != nil {
		return ErrDependencyUnavailable
	}

	s.logs.Record(ctx, adminID, "file.delete", "file", strconv.FormatUint(uint64(id), 10), file.Name, ip)
	return nil
}

func isObjectMissingError(err error) bool {
	if err == nil {
		return false
	}
	text := strings.ToLower(err.Error())
	return strings.Contains(text, "nosuchkey") || strings.Contains(text, "not found")
}

func (s *FileService) GenerateDownload(ctx context.Context, id uint, authenticated bool) (*DownloadResult, error) {
	downloadSettings, err := s.settings.GetDownloadSettings(ctx)
	if err != nil {
		return nil, err
	}
	if !authenticated && !downloadSettings.GuestDownloadAllowed {
		return nil, ErrForbidden
	}

	file, err := s.GetPublic(ctx, id)
	if err != nil {
		return nil, err
	}

	result, err := s.breakers.OSS.Execute(func() (any, error) {
		url, expiresAt, innerErr := s.storage.PresignDownload(ctx, file.ObjectKey, file.OriginalName, time.Duration(downloadSettings.URLExpiresSeconds)*time.Second)
		if innerErr != nil {
			return nil, innerErr
		}
		return &DownloadResult{URL: url, ExpiresAt: expiresAt}, nil
	})
	if err != nil {
		return nil, ErrDependencyUnavailable
	}

	if _, err := s.breakers.DB.Execute(func() (any, error) {
		return nil, s.files.IncrementDownload(ctx, id)
	}); err != nil {
		return nil, ErrDependencyUnavailable
	}

	return result.(*DownloadResult), nil
}

func canManageAllFiles(permissions []string) bool {
	return HasPermission(permissions, PermissionAdminFilesAll)
}

func canManageAnyFiles(permissions []string) bool {
	return canManageAllFiles(permissions) ||
		HasPermission(permissions, PermissionAdminFilesOwn) ||
		HasPermission(permissions, PermissionAdminFilesUpload) ||
		HasPermission(permissions, PermissionAdminFilesEdit) ||
		HasPermission(permissions, PermissionAdminFilesDelete)
}

func ensureFileAccess(file *model.File, actorID uint, permissions []string) error {
	if canManageAllFiles(permissions) {
		return nil
	}
	if !HasPermission(permissions, PermissionAdminFilesOwn) {
		if !(HasPermission(permissions, PermissionAdminFilesUpload) || HasPermission(permissions, PermissionAdminFilesEdit) || HasPermission(permissions, PermissionAdminFilesDelete)) {
			return ErrForbidden
		}
	}
	if file.CreatedBy == nil || *file.CreatedBy != actorID {
		return ErrForbidden
	}
	return nil
}

func (s *FileService) objectKey(originalName string) string {
	ext := strings.ToLower(filepath.Ext(originalName))
	base := safeFileName.ReplaceAllString(strings.TrimSuffix(originalName, ext), "-")
	base = strings.Trim(base, "-")
	if base == "" {
		base = "file"
	}

	datePath := time.Now().UTC().Format("2006/01/02")
	if s.cfg.Storage.BasePath == "" {
		return fmt.Sprintf("%s/%s-%s%s", datePath, base, uuid.NewString(), ext)
	}
	return fmt.Sprintf("%s/%s/%s-%s%s", s.cfg.Storage.BasePath, datePath, base, uuid.NewString(), ext)
}

func normalizeTags(tags []string) []string {
	if len(tags) == 0 {
		return []string{}
	}

	unique := make(map[string]struct{}, len(tags))
	result := make([]string, 0, len(tags))
	for _, tag := range tags {
		normalized := strings.TrimSpace(tag)
		if normalized == "" {
			continue
		}
		if _, ok := unique[normalized]; ok {
			continue
		}
		unique[normalized] = struct{}{}
		result = append(result, normalized)
	}
	return result
}

func toStringSlice(value any) []string {
	switch typed := value.(type) {
	case []string:
		return typed
	case []any:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			if str, ok := item.(string); ok {
				out = append(out, str)
			}
		}
		return out
	default:
		return []string{}
	}
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
