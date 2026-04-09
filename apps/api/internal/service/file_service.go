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
	"fluxfiles/api/pkg/validator"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var safeFileName = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

type FileService struct {
	cfg       *config.Config
	files     *repository.FileRepository
	storage   *ossclient.Client
	breakers  *resilience.Breakers
	logs      *OperationLogService
	validator *validator.UploadPolicy
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
	uploadPolicy *validator.UploadPolicy,
) *FileService {
	return &FileService{
		cfg:       cfg,
		files:     files,
		storage:   storage,
		breakers:  breakers,
		logs:      logs,
		validator: uploadPolicy,
	}
}

func (s *FileService) ListPublic(ctx context.Context, params repository.FileListParams) ([]model.File, int64, error) {
	params.PublicOnly = true
	return s.list(ctx, params)
}

func (s *FileService) ListAdmin(ctx context.Context, params repository.FileListParams) ([]model.File, int64, error) {
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
	return result.(*model.File), nil
}

func (s *FileService) GetAdmin(ctx context.Context, id uint) (*model.File, error) {
	result, err := s.breakers.DB.Execute(func() (any, error) {
		return s.files.GetByID(ctx, id, false)
	})
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, ErrNotFound
		}
		return nil, ErrDependencyUnavailable
	}
	return result.(*model.File), nil
}

func (s *FileService) DashboardStats(ctx context.Context) (*repository.DashboardStats, error) {
	result, err := s.breakers.DB.Execute(func() (any, error) {
		return s.files.DashboardStats(ctx)
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

	if err := s.validator.Validate(input.OriginalName, input.Size, input.MimeType); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrValidation, err.Error())
	}

	resolvedMimeType := s.validator.ResolveMimeType(input.OriginalName, input.MimeType)
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

	result, err := s.breakers.OSS.Execute(func() (any, error) {
		return s.storage.HeadObject(ctx, input.ObjectKey)
	})
	if err != nil {
		return nil, ErrDependencyUnavailable
	}

	objectMeta := result.(*ossclient.HeadObjectResult)
	if err := s.validator.Validate(input.OriginalName, objectMeta.ContentLength, derefString(objectMeta.ContentType)); err != nil {
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

func (s *FileService) Update(ctx context.Context, id uint, adminID uint, ip string, values map[string]any) (*model.File, error) {
	file, err := s.GetAdmin(ctx, id)
	if err != nil {
		return nil, err
	}

	values["tags"] = normalizeTags(toStringSlice(values["tags"]))
	if _, err := s.breakers.DB.Execute(func() (any, error) {
		return nil, s.files.Update(ctx, file, values)
	}); err != nil {
		return nil, ErrDependencyUnavailable
	}

	updated, err := s.GetAdmin(ctx, id)
	if err == nil {
		s.logs.Record(ctx, adminID, "file.update", "file", strconv.FormatUint(uint64(id), 10), updated.Name, ip)
	}
	return updated, err
}

func (s *FileService) Delete(ctx context.Context, id uint, adminID uint, ip string) error {
	file, err := s.GetAdmin(ctx, id)
	if err != nil {
		return err
	}

	if s.cfg.Storage.DeleteMode == "sync" {
		if _, err := s.breakers.OSS.Execute(func() (any, error) {
			return nil, s.storage.Delete(ctx, file.ObjectKey)
		}); err != nil {
			return ErrDependencyUnavailable
		}
	}

	if _, err := s.breakers.DB.Execute(func() (any, error) {
		return nil, s.files.SoftDelete(ctx, file)
	}); err != nil {
		return ErrDependencyUnavailable
	}

	s.logs.Record(ctx, adminID, "file.delete", "file", strconv.FormatUint(uint64(id), 10), file.Name, ip)
	return nil
}

func (s *FileService) GenerateDownload(ctx context.Context, id uint) (*DownloadResult, error) {
	file, err := s.GetPublic(ctx, id)
	if err != nil {
		return nil, err
	}

	result, err := s.breakers.OSS.Execute(func() (any, error) {
		url, expiresAt, innerErr := s.storage.PresignDownload(ctx, file.ObjectKey)
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
