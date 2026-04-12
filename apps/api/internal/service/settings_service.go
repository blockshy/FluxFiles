package service

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"fluxfiles/api/internal/config"
	"fluxfiles/api/internal/repository"
	"fluxfiles/api/pkg/resilience"
	"fluxfiles/api/pkg/validator"

	"gorm.io/gorm"
)

const registrationOpenSettingKey = "registration.open"
const permissionTemplatesSettingKey = "admin.permission_templates"
const rateLimitSettingsKey = "security.rate_limits"
const captchaSettingsKey = "security.captcha"
const uploadSettingsKey = "storage.upload_policy"
const guestDownloadAllowedSettingKey = "security.guest_download_allowed"
const downloadSettingsKey = "security.download_settings"
const fileListDisplaySettingsKey = "ui.file_list_display"
const siteContentSettingsKey = "ui.site_content"

type RateLimitRuleSettings struct {
	Limit         int `json:"limit"`
	WindowSeconds int `json:"windowSeconds"`
}

type SplitRateLimitRuleSettings struct {
	Guest         RateLimitRuleSettings `json:"guest"`
	Authenticated RateLimitRuleSettings `json:"authenticated"`
}

type RateLimitSettings struct {
	Login    SplitRateLimitRuleSettings `json:"login"`
	Download RateLimitRuleSettings      `json:"download"`
	Upload   RateLimitRuleSettings      `json:"upload"`
	List     SplitRateLimitRuleSettings `json:"list"`
}

type CaptchaSettings struct {
	LoginEnabled        bool `json:"loginEnabled"`
	RegistrationEnabled bool `json:"registrationEnabled"`
}

type UploadSettings struct {
	RestrictFileSize  bool     `json:"restrictFileSize"`
	MaxSizeBytes      int64    `json:"maxSizeBytes"`
	RestrictFileTypes bool     `json:"restrictFileTypes"`
	AllowedExtensions []string `json:"allowedExtensions"`
	AllowedMimeTypes  []string `json:"allowedMimeTypes"`
}

type DownloadSettings struct {
	GuestDownloadAllowed bool `json:"guestDownloadAllowed"`
	CaptchaEnabled       bool `json:"captchaEnabled"`
	URLExpiresSeconds    int  `json:"urlExpiresSeconds"`
}

type FileListDisplaySettings struct {
	CategoryMode string `json:"categoryMode"`
	TagMode      string `json:"tagMode"`
}

type SiteContentSettings struct {
	AboutHTML string `json:"aboutHtml"`
}

type SettingsService struct {
	settings      *repository.SystemSettingRepository
	defaultRates  config.RateLimitConfig
	defaultUpload UploadSettings
}

func NewSettingsService(settings *repository.SystemSettingRepository, defaults config.RateLimitConfig, security config.SecurityConfig) *SettingsService {
	return &SettingsService{
		settings:     settings,
		defaultRates: defaults,
		defaultUpload: UploadSettings{
			RestrictFileSize:  security.MaxUploadSizeBytes > 0,
			MaxSizeBytes:      security.MaxUploadSizeBytes,
			RestrictFileTypes: len(security.AllowedFileExtensions) > 0 || len(security.AllowedMimeTypes) > 0,
			AllowedExtensions: normalizeExtensionList(security.AllowedFileExtensions),
			AllowedMimeTypes:  normalizeMimeTypeList(security.AllowedMimeTypes),
		},
	}
}

func (s *SettingsService) IsRegistrationOpen(ctx context.Context) (bool, error) {
	item, err := s.settings.GetByKey(ctx, registrationOpenSettingKey)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return true, nil
		}
		return false, ErrDependencyUnavailable
	}

	value, parseErr := strconv.ParseBool(item.Value)
	if parseErr != nil {
		return false, ErrDependencyUnavailable
	}
	return value, nil
}

func (s *SettingsService) SetRegistrationOpen(ctx context.Context, enabled bool) error {
	if err := s.settings.Upsert(ctx, registrationOpenSettingKey, strconv.FormatBool(enabled)); err != nil {
		return ErrDependencyUnavailable
	}
	return nil
}

func (s *SettingsService) IsGuestDownloadAllowed(ctx context.Context) (bool, error) {
	settings, err := s.GetDownloadSettings(ctx)
	if err != nil {
		return false, err
	}
	return settings.GuestDownloadAllowed, nil
}

func (s *SettingsService) SetGuestDownloadAllowed(ctx context.Context, allowed bool) error {
	settings, err := s.GetDownloadSettings(ctx)
	if err != nil {
		return err
	}
	settings.GuestDownloadAllowed = allowed
	_, err = s.SetDownloadSettings(ctx, settings)
	return err
}

func (s *SettingsService) DefaultDownloadSettings() DownloadSettings {
	return DownloadSettings{
		GuestDownloadAllowed: true,
		CaptchaEnabled:       false,
		URLExpiresSeconds:    60,
	}
}

func (s *SettingsService) DefaultFileListDisplaySettings() FileListDisplaySettings {
	return FileListDisplaySettings{
		CategoryMode: "fullPath",
		TagMode:      "fullPath",
	}
}

func (s *SettingsService) DefaultSiteContentSettings() SiteContentSettings {
	return SiteContentSettings{
		AboutHTML: "",
	}
}

func (s *SettingsService) GetDownloadSettings(ctx context.Context) (DownloadSettings, error) {
	item, err := s.settings.GetByKey(ctx, downloadSettingsKey)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			guestAllowed, guestErr := s.legacyGuestDownloadAllowed(ctx)
			if guestErr != nil {
				return DownloadSettings{}, guestErr
			}
			settings := s.DefaultDownloadSettings()
			settings.GuestDownloadAllowed = guestAllowed
			return settings, nil
		}
		return DownloadSettings{}, ErrDependencyUnavailable
	}

	var settings DownloadSettings
	if err := json.Unmarshal([]byte(item.Value), &settings); err != nil {
		return DownloadSettings{}, ErrDependencyUnavailable
	}
	return normalizeDownloadSettings(settings, s.DefaultDownloadSettings())
}

func (s *SettingsService) legacyGuestDownloadAllowed(ctx context.Context) (bool, error) {
	item, err := s.settings.GetByKey(ctx, guestDownloadAllowedSettingKey)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return true, nil
		}
		return false, ErrDependencyUnavailable
	}

	value, parseErr := strconv.ParseBool(item.Value)
	if parseErr != nil {
		return false, ErrDependencyUnavailable
	}
	return value, nil
}

func (s *SettingsService) SetDownloadSettings(ctx context.Context, settings DownloadSettings) (DownloadSettings, error) {
	normalized, err := normalizeDownloadSettings(settings, s.DefaultDownloadSettings())
	if err != nil {
		return DownloadSettings{}, err
	}
	payload, err := json.Marshal(normalized)
	if err != nil {
		return DownloadSettings{}, ErrDependencyUnavailable
	}
	if err := s.settings.Upsert(ctx, downloadSettingsKey, string(payload)); err != nil {
		return DownloadSettings{}, ErrDependencyUnavailable
	}
	if err := s.settings.Upsert(ctx, guestDownloadAllowedSettingKey, strconv.FormatBool(normalized.GuestDownloadAllowed)); err != nil {
		return DownloadSettings{}, ErrDependencyUnavailable
	}
	return normalized, nil
}

func (s *SettingsService) GetFileListDisplaySettings(ctx context.Context) (FileListDisplaySettings, error) {
	item, err := s.settings.GetByKey(ctx, fileListDisplaySettingsKey)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return s.DefaultFileListDisplaySettings(), nil
		}
		return FileListDisplaySettings{}, ErrDependencyUnavailable
	}

	var settings FileListDisplaySettings
	if err := json.Unmarshal([]byte(item.Value), &settings); err != nil {
		return FileListDisplaySettings{}, ErrDependencyUnavailable
	}
	return normalizeFileListDisplaySettings(settings, s.DefaultFileListDisplaySettings())
}

func (s *SettingsService) SetFileListDisplaySettings(ctx context.Context, settings FileListDisplaySettings) (FileListDisplaySettings, error) {
	normalized, err := normalizeFileListDisplaySettings(settings, s.DefaultFileListDisplaySettings())
	if err != nil {
		return FileListDisplaySettings{}, err
	}
	payload, err := json.Marshal(normalized)
	if err != nil {
		return FileListDisplaySettings{}, ErrDependencyUnavailable
	}
	if err := s.settings.Upsert(ctx, fileListDisplaySettingsKey, string(payload)); err != nil {
		return FileListDisplaySettings{}, ErrDependencyUnavailable
	}
	return normalized, nil
}

func (s *SettingsService) GetSiteContentSettings(ctx context.Context) (SiteContentSettings, error) {
	item, err := s.settings.GetByKey(ctx, siteContentSettingsKey)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return s.DefaultSiteContentSettings(), nil
		}
		return SiteContentSettings{}, ErrDependencyUnavailable
	}

	var settings SiteContentSettings
	if err := json.Unmarshal([]byte(item.Value), &settings); err != nil {
		return SiteContentSettings{}, ErrDependencyUnavailable
	}
	return SiteContentSettings{
		AboutHTML: strings.TrimSpace(settings.AboutHTML),
	}, nil
}

func (s *SettingsService) SetSiteContentSettings(ctx context.Context, settings SiteContentSettings) (SiteContentSettings, error) {
	normalized := SiteContentSettings{
		AboutHTML: strings.TrimSpace(settings.AboutHTML),
	}
	payload, err := json.Marshal(normalized)
	if err != nil {
		return SiteContentSettings{}, ErrDependencyUnavailable
	}
	if err := s.settings.Upsert(ctx, siteContentSettingsKey, string(payload)); err != nil {
		return SiteContentSettings{}, ErrDependencyUnavailable
	}
	return normalized, nil
}

func (s *SettingsService) GetCaptchaSettings(ctx context.Context) (CaptchaSettings, error) {
	item, err := s.settings.GetByKey(ctx, captchaSettingsKey)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return CaptchaSettings{}, nil
		}
		return CaptchaSettings{}, ErrDependencyUnavailable
	}

	var settings CaptchaSettings
	if err := json.Unmarshal([]byte(item.Value), &settings); err != nil {
		return CaptchaSettings{}, ErrDependencyUnavailable
	}
	return settings, nil
}

func (s *SettingsService) SetCaptchaSettings(ctx context.Context, settings CaptchaSettings) (CaptchaSettings, error) {
	payload, err := json.Marshal(settings)
	if err != nil {
		return CaptchaSettings{}, ErrDependencyUnavailable
	}
	if err := s.settings.Upsert(ctx, captchaSettingsKey, string(payload)); err != nil {
		return CaptchaSettings{}, ErrDependencyUnavailable
	}
	return settings, nil
}

func (s *SettingsService) GetPermissionTemplates(ctx context.Context) ([]PermissionTemplate, error) {
	item, err := s.settings.GetByKey(ctx, permissionTemplatesSettingKey)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return append([]PermissionTemplate(nil), DefaultPermissionTemplates...), nil
		}
		return nil, ErrDependencyUnavailable
	}

	var templates []PermissionTemplate
	if err := json.Unmarshal([]byte(item.Value), &templates); err != nil {
		return nil, ErrDependencyUnavailable
	}
	normalized, err := NormalizePermissionTemplates(templates)
	if err != nil {
		return nil, err
	}
	return normalized, nil
}

func (s *SettingsService) SetPermissionTemplates(ctx context.Context, templates []PermissionTemplate) error {
	normalized, err := NormalizePermissionTemplates(templates)
	if err != nil {
		return err
	}
	payload, err := json.Marshal(normalized)
	if err != nil {
		return ErrDependencyUnavailable
	}
	if err := s.settings.Upsert(ctx, permissionTemplatesSettingKey, string(payload)); err != nil {
		return ErrDependencyUnavailable
	}
	return nil
}

func (s *SettingsService) DefaultRateLimitSettings() RateLimitSettings {
	defaultRule := RateLimitRuleSettings{
		Limit:         s.defaultRates.LoginLimit,
		WindowSeconds: s.defaultRates.LoginWindowSeconds,
	}
	defaultListRule := RateLimitRuleSettings{
		Limit:         s.defaultRates.ListLimit,
		WindowSeconds: s.defaultRates.ListWindowSeconds,
	}
	return RateLimitSettings{
		Login: SplitRateLimitRuleSettings{
			Guest:         defaultRule,
			Authenticated: defaultRule,
		},
		Download: RateLimitRuleSettings{
			Limit:         s.defaultRates.DownloadLimit,
			WindowSeconds: s.defaultRates.DownloadWindowSeconds,
		},
		Upload: RateLimitRuleSettings{
			Limit:         s.defaultRates.UploadLimit,
			WindowSeconds: s.defaultRates.UploadWindowSeconds,
		},
		List: SplitRateLimitRuleSettings{
			Guest:         defaultListRule,
			Authenticated: defaultListRule,
		},
	}
}

func (s *SettingsService) GetRateLimitSettings(ctx context.Context) (RateLimitSettings, error) {
	item, err := s.settings.GetByKey(ctx, rateLimitSettingsKey)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return s.DefaultRateLimitSettings(), nil
		}
		return RateLimitSettings{}, ErrDependencyUnavailable
	}

	var settings RateLimitSettings
	if err := json.Unmarshal([]byte(item.Value), &settings); err != nil {
		var legacy struct {
			Login    RateLimitRuleSettings `json:"login"`
			Download RateLimitRuleSettings `json:"download"`
			Upload   RateLimitRuleSettings `json:"upload"`
			List     RateLimitRuleSettings `json:"list"`
		}
		if legacyErr := json.Unmarshal([]byte(item.Value), &legacy); legacyErr != nil {
			return RateLimitSettings{}, ErrDependencyUnavailable
		}
		settings = RateLimitSettings{
			Login: SplitRateLimitRuleSettings{
				Guest:         legacy.Login,
				Authenticated: legacy.Login,
			},
			Download: legacy.Download,
			Upload:   legacy.Upload,
			List: SplitRateLimitRuleSettings{
				Guest:         legacy.List,
				Authenticated: legacy.List,
			},
		}
	}

	return normalizeRateLimitSettings(settings, s.DefaultRateLimitSettings())
}

func (s *SettingsService) SetRateLimitSettings(ctx context.Context, settings RateLimitSettings) (RateLimitSettings, error) {
	normalized, err := normalizeRateLimitSettings(settings, s.DefaultRateLimitSettings())
	if err != nil {
		return RateLimitSettings{}, err
	}

	payload, err := json.Marshal(normalized)
	if err != nil {
		return RateLimitSettings{}, ErrDependencyUnavailable
	}
	if err := s.settings.Upsert(ctx, rateLimitSettingsKey, string(payload)); err != nil {
		return RateLimitSettings{}, ErrDependencyUnavailable
	}
	return normalized, nil
}

func (s *SettingsService) DefaultUploadSettings() UploadSettings {
	return UploadSettings{
		RestrictFileSize:  s.defaultUpload.RestrictFileSize,
		MaxSizeBytes:      s.defaultUpload.MaxSizeBytes,
		RestrictFileTypes: s.defaultUpload.RestrictFileTypes,
		AllowedExtensions: append([]string(nil), s.defaultUpload.AllowedExtensions...),
		AllowedMimeTypes:  append([]string(nil), s.defaultUpload.AllowedMimeTypes...),
	}
}

func (s *SettingsService) GetUploadSettings(ctx context.Context) (UploadSettings, error) {
	item, err := s.settings.GetByKey(ctx, uploadSettingsKey)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return s.DefaultUploadSettings(), nil
		}
		return UploadSettings{}, ErrDependencyUnavailable
	}

	var settings UploadSettings
	if err := json.Unmarshal([]byte(item.Value), &settings); err != nil {
		return UploadSettings{}, ErrDependencyUnavailable
	}
	return normalizeUploadSettings(settings, s.DefaultUploadSettings())
}

func (s *SettingsService) SetUploadSettings(ctx context.Context, settings UploadSettings) (UploadSettings, error) {
	normalized, err := normalizeUploadSettings(settings, s.DefaultUploadSettings())
	if err != nil {
		return UploadSettings{}, err
	}

	payload, err := json.Marshal(normalized)
	if err != nil {
		return UploadSettings{}, ErrDependencyUnavailable
	}
	if err := s.settings.Upsert(ctx, uploadSettingsKey, string(payload)); err != nil {
		return UploadSettings{}, ErrDependencyUnavailable
	}
	return normalized, nil
}

func (s *SettingsService) BuildUploadPolicy(ctx context.Context) (*validator.UploadPolicy, error) {
	settings, err := s.GetUploadSettings(ctx)
	if err != nil {
		return nil, err
	}

	maxSize := int64(0)
	if settings.RestrictFileSize {
		maxSize = settings.MaxSizeBytes
	}
	extensions := []string{}
	mimeTypes := []string{}
	if settings.RestrictFileTypes {
		extensions = append(extensions, settings.AllowedExtensions...)
		mimeTypes = append(mimeTypes, settings.AllowedMimeTypes...)
	}
	return validator.NewUploadPolicy(maxSize, extensions, mimeTypes), nil
}

func (s *SettingsService) DefaultRateLimitRule(name string, authenticated bool) resilience.RateRule {
	settings := s.DefaultRateLimitSettings()
	return buildRateRule(name, settings, authenticated)
}

func (s *SettingsService) GetRateLimitRule(ctx context.Context, name string, authenticated bool) (resilience.RateRule, error) {
	settings, err := s.GetRateLimitSettings(ctx)
	if err != nil {
		return s.DefaultRateLimitRule(name, authenticated), err
	}
	return buildRateRule(name, settings, authenticated), nil
}

func normalizeRateLimitSettings(value RateLimitSettings, defaults RateLimitSettings) (RateLimitSettings, error) {
	var err error
	value.Login, err = normalizeSplitRateLimitRule(value.Login, defaults.Login)
	if err != nil {
		return RateLimitSettings{}, err
	}
	value.Download, err = normalizeRateLimitRule(value.Download, defaults.Download)
	if err != nil {
		return RateLimitSettings{}, err
	}
	value.Upload, err = normalizeRateLimitRule(value.Upload, defaults.Upload)
	if err != nil {
		return RateLimitSettings{}, err
	}
	value.List, err = normalizeSplitRateLimitRule(value.List, defaults.List)
	if err != nil {
		return RateLimitSettings{}, err
	}
	return value, nil
}

func normalizeSplitRateLimitRule(value SplitRateLimitRuleSettings, defaults SplitRateLimitRuleSettings) (SplitRateLimitRuleSettings, error) {
	var err error
	value.Guest, err = normalizeRateLimitRule(value.Guest, defaults.Guest)
	if err != nil {
		return SplitRateLimitRuleSettings{}, err
	}
	value.Authenticated, err = normalizeRateLimitRule(value.Authenticated, defaults.Authenticated)
	if err != nil {
		return SplitRateLimitRuleSettings{}, err
	}
	return value, nil
}

func normalizeRateLimitRule(value RateLimitRuleSettings, defaults RateLimitRuleSettings) (RateLimitRuleSettings, error) {
	if value.Limit < 0 || value.WindowSeconds < 0 {
		return RateLimitRuleSettings{}, ErrValidation
	}
	if value.Limit == 0 && value.WindowSeconds == 0 {
		return defaults, nil
	}
	if value.Limit == 0 {
		return RateLimitRuleSettings{Limit: 0, WindowSeconds: value.WindowSeconds}, nil
	}
	if value.WindowSeconds == 0 {
		return RateLimitRuleSettings{}, ErrValidation
	}
	return value, nil
}

func normalizeUploadSettings(value UploadSettings, defaults UploadSettings) (UploadSettings, error) {
	value.AllowedExtensions = normalizeExtensionList(value.AllowedExtensions)
	value.AllowedMimeTypes = normalizeMimeTypeList(value.AllowedMimeTypes)

	if value.MaxSizeBytes < 0 {
		return UploadSettings{}, ErrValidation
	}
	if !value.RestrictFileSize {
		value.MaxSizeBytes = 0
	} else if value.MaxSizeBytes == 0 {
		value.MaxSizeBytes = defaults.MaxSizeBytes
		if value.MaxSizeBytes <= 0 {
			return UploadSettings{}, ErrValidation
		}
	}

	if !value.RestrictFileTypes {
		value.AllowedExtensions = []string{}
		value.AllowedMimeTypes = []string{}
	}
	if value.AllowedExtensions == nil {
		value.AllowedExtensions = []string{}
	}
	if value.AllowedMimeTypes == nil {
		value.AllowedMimeTypes = []string{}
	}

	return value, nil
}

func normalizeDownloadSettings(value DownloadSettings, defaults DownloadSettings) (DownloadSettings, error) {
	if value.URLExpiresSeconds < 0 {
		return DownloadSettings{}, ErrValidation
	}
	if value.URLExpiresSeconds == 0 {
		value.URLExpiresSeconds = defaults.URLExpiresSeconds
	}
	if value.URLExpiresSeconds < 10 || value.URLExpiresSeconds > 86400 {
		return DownloadSettings{}, ErrValidation
	}
	return value, nil
}

func normalizeFileListDisplaySettings(value FileListDisplaySettings, defaults FileListDisplaySettings) (FileListDisplaySettings, error) {
	value.CategoryMode = strings.TrimSpace(value.CategoryMode)
	value.TagMode = strings.TrimSpace(value.TagMode)
	if value.CategoryMode == "" {
		value.CategoryMode = defaults.CategoryMode
	}
	if value.TagMode == "" {
		value.TagMode = defaults.TagMode
	}
	if value.CategoryMode != "fullPath" && value.CategoryMode != "leafName" {
		return FileListDisplaySettings{}, ErrValidation
	}
	if value.TagMode != "fullPath" && value.TagMode != "leafName" {
		return FileListDisplaySettings{}, ErrValidation
	}
	return value, nil
}

func normalizeExtensionList(values []string) []string {
	if values == nil {
		return []string{}
	}
	seen := map[string]struct{}{}
	items := make([]string, 0, len(values))
	for _, item := range values {
		value := strings.ToLower(strings.TrimSpace(item))
		if value == "" {
			continue
		}
		if !strings.HasPrefix(value, ".") {
			value = "." + value
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		items = append(items, value)
	}
	return items
}

func normalizeMimeTypeList(values []string) []string {
	if values == nil {
		return []string{}
	}
	seen := map[string]struct{}{}
	items := make([]string, 0, len(values))
	for _, item := range values {
		value := strings.ToLower(strings.TrimSpace(item))
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		items = append(items, value)
	}
	return items
}

func buildRateRule(name string, settings RateLimitSettings, authenticated bool) resilience.RateRule {
	target := settings.List.Guest
	if authenticated {
		target = settings.List.Authenticated
	}
	switch name {
	case "user-login", "admin-login":
		if authenticated {
			target = settings.Login.Authenticated
		} else {
			target = settings.Login.Guest
		}
	case "public-download":
		target = settings.Download
	case "admin-upload":
		target = settings.Upload
	case "public-list", "admin-list":
		if authenticated {
			target = settings.List.Authenticated
		} else {
			target = settings.List.Guest
		}
	}

	return resilience.RateRule{
		Name:   name,
		Limit:  target.Limit,
		Window: time.Duration(target.WindowSeconds) * time.Second,
	}
}
