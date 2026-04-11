package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"fluxfiles/api/internal/model"
	"fluxfiles/api/internal/repository"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type ManagedUserListResult struct {
	Items      []model.User `json:"items"`
	Page       int          `json:"page"`
	PageSize   int          `json:"pageSize"`
	Total      int64        `json:"total"`
	TotalPages int          `json:"totalPages"`
}

type ListManagedUsersInput struct {
	Page     int
	PageSize int
	Search   string
}

type CreateManagedUserInput struct {
	Username    string
	Email       string
	DisplayName string
	Password    string
	Role        string
	Permissions []string
	IsEnabled   bool
}

type UpdateManagedUserInput struct {
	Email       string
	DisplayName string
	Role        string
	Permissions []string
	IsEnabled   bool
}

type AdminService struct {
	users    *repository.UserRepository
	settings *SettingsService
	logs     *OperationLogService
}

func NewAdminService(
	users *repository.UserRepository,
	settings *SettingsService,
	logs *OperationLogService,
) *AdminService {
	return &AdminService{
		users:    users,
		settings: settings,
		logs:     logs,
	}
}

func (s *AdminService) ListUsers(ctx context.Context, input ListManagedUsersInput) (*ManagedUserListResult, error) {
	items, total, err := s.users.List(ctx, repository.UserListQuery{
		Page:     input.Page,
		PageSize: input.PageSize,
		Search:   input.Search,
	})
	if err != nil {
		return nil, ErrDependencyUnavailable
	}
	applyResolvedAvatars(items)

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

	return &ManagedUserListResult{
		Items:      items,
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: totalPages,
	}, nil
}

func (s *AdminService) CreateUser(ctx context.Context, adminID uint, ip string, input CreateManagedUserInput) (*model.User, error) {
	username := strings.TrimSpace(input.Username)
	email := strings.ToLower(strings.TrimSpace(input.Email))
	displayName := strings.TrimSpace(input.DisplayName)
	password := strings.TrimSpace(input.Password)
	role, err := normalizeRole(input.Role)
	if err != nil {
		return nil, err
	}
	permissions, err := NormalizePermissions(role, input.Permissions)
	if err != nil {
		return nil, err
	}

	if username == "" || email == "" || displayName == "" || password == "" {
		return nil, ErrValidation
	}
	if !emailPattern.MatchString(email) {
		return nil, fmt.Errorf("%w: invalid email format", ErrValidation)
	}

	if _, err := s.users.GetByUsername(ctx, username); err == nil {
		return nil, fmt.Errorf("%w: username already exists", ErrValidation)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrDependencyUnavailable
	}

	if _, err := s.users.GetByEmail(ctx, email); err == nil {
		return nil, fmt.Errorf("%w: email already exists", ErrValidation)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrDependencyUnavailable
	}

	hash, hashErr := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if hashErr != nil {
		return nil, ErrDependencyUnavailable
	}

	user := &model.User{
		Username:     username,
		Email:        email,
		DisplayName:  displayName,
		AvatarURL:    buildDefaultAvatarDataURL(username, displayName),
		PasswordHash: string(hash),
		Role:         role,
		Permissions:  permissions,
		IsEnabled:    input.IsEnabled,
	}
	if err := s.users.Create(ctx, user); err != nil {
		return nil, ErrDependencyUnavailable
	}

	s.logs.Record(ctx, adminID, "user.create", "user", fmt.Sprintf("%d", user.ID), MarshalAuditDetail(AuditDetail{
		Summary: "Created user",
		Changes: []AuditFieldChange{
			{Field: "username", Label: "Username", After: user.Username},
			{Field: "displayName", Label: "Nickname", After: user.DisplayName},
			{Field: "email", Label: "Email", After: user.Email},
			{Field: "role", Label: "Role", After: user.Role},
			{Field: "permissions", Label: "Permissions", After: user.Permissions},
			{Field: "isEnabled", Label: "Enabled", After: user.IsEnabled},
		},
	}), ip)
	return user, nil
}

func (s *AdminService) UpdateUser(ctx context.Context, adminID, userID uint, ip string, input UpdateManagedUserInput) (*model.User, error) {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, ErrDependencyUnavailable
	}

	role, err := normalizeRole(input.Role)
	if err != nil {
		return nil, err
	}
	permissions, err := NormalizePermissions(role, input.Permissions)
	if err != nil {
		return nil, err
	}

	values := map[string]any{}

	if displayName := strings.TrimSpace(input.DisplayName); displayName == "" {
		return nil, ErrValidation
	} else if displayName != user.DisplayName {
		values["display_name"] = displayName
	}

	if email := strings.ToLower(strings.TrimSpace(input.Email)); email == "" {
		return nil, ErrValidation
	} else {
		if !emailPattern.MatchString(email) {
			return nil, fmt.Errorf("%w: invalid email format", ErrValidation)
		}
		if existing, err := s.users.GetByEmail(ctx, email); err == nil && existing.ID != user.ID {
			return nil, fmt.Errorf("%w: email already exists", ErrValidation)
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrDependencyUnavailable
		}
		if email != user.Email {
			values["email"] = email
		}
	}

	if user.Role == "admin" && HasPermission(user.Permissions, PermissionAdminUsersEdit) &&
		(role != "admin" || !input.IsEnabled || !HasPermission(permissions, PermissionAdminUsersEdit)) {
		remaining, countErr := s.users.CountEnabledAdminsWithPermissionExcluding(ctx, user.ID, PermissionAdminUsersEdit)
		if countErr != nil {
			return nil, ErrDependencyUnavailable
		}
		if remaining == 0 {
			return nil, fmt.Errorf("%w: at least one enabled admin with user edit permission must remain", ErrValidation)
		}
	}

	if role != user.Role {
		values["role"] = role
	}
	if !slicesEqualStrings(permissions, user.Permissions) {
		values["permissions"] = permissions
	}
	if input.IsEnabled != user.IsEnabled {
		values["is_enabled"] = input.IsEnabled
	}

	if len(values) == 0 {
		return user, nil
	}
	changes := make([]AuditFieldChange, 0, 4)
	if value, ok := values["display_name"]; ok {
		changes = append(changes, AuditFieldChange{Field: "displayName", Label: "Nickname", Before: user.DisplayName, After: value})
	}
	if value, ok := values["email"]; ok {
		changes = append(changes, AuditFieldChange{Field: "email", Label: "Email", Before: user.Email, After: value})
	}
	if value, ok := values["role"]; ok {
		changes = append(changes, AuditFieldChange{Field: "role", Label: "Role", Before: user.Role, After: value})
	}
	if value, ok := values["permissions"]; ok {
		changes = append(changes, AuditFieldChange{Field: "permissions", Label: "Permissions", Before: user.Permissions, After: value})
	}
	if value, ok := values["is_enabled"]; ok {
		changes = append(changes, AuditFieldChange{Field: "isEnabled", Label: "Enabled", Before: user.IsEnabled, After: value})
	}

	if err := s.users.Update(ctx, user, values); err != nil {
		return nil, ErrDependencyUnavailable
	}

	s.logs.Record(ctx, adminID, "user.update", "user", fmt.Sprintf("%d", user.ID), MarshalAuditDetail(AuditDetail{
		Summary: "Updated user",
		Changes: changes,
	}), ip)
	updated, getErr := s.users.GetByID(ctx, user.ID)
	if getErr != nil {
		return nil, getErr
	}
	applyResolvedAvatar(updated)
	return updated, nil
}

func (s *AdminService) SetUserEnabled(ctx context.Context, adminID, userID uint, ip string, enabled bool) (*model.User, error) {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, ErrDependencyUnavailable
	}

	if user.IsEnabled == enabled {
		applyResolvedAvatar(user)
		return user, nil
	}
	beforeEnabled := user.IsEnabled

	if user.Role == "admin" && HasPermission(user.Permissions, PermissionAdminUsersEdit) && !enabled {
		remaining, countErr := s.users.CountEnabledAdminsWithPermissionExcluding(ctx, user.ID, PermissionAdminUsersEdit)
		if countErr != nil {
			return nil, ErrDependencyUnavailable
		}
		if remaining == 0 {
			return nil, fmt.Errorf("%w: at least one enabled admin with user edit permission must remain", ErrValidation)
		}
	}

	if err := s.users.Update(ctx, user, map[string]any{"is_enabled": enabled}); err != nil {
		return nil, ErrDependencyUnavailable
	}

	s.logs.Record(ctx, adminID, "user.enabled.update", "user", fmt.Sprintf("%d", user.ID), MarshalAuditDetail(AuditDetail{
		Summary: "Updated user enabled state",
		Changes: []AuditFieldChange{
			{Field: "isEnabled", Label: "Enabled", Before: beforeEnabled, After: enabled},
		},
	}), ip)

	updated, getErr := s.users.GetByID(ctx, user.ID)
	if getErr != nil {
		return nil, ErrDependencyUnavailable
	}
	applyResolvedAvatar(updated)
	return updated, nil
}

func (s *AdminService) GetRegistrationSettings(ctx context.Context) (bool, error) {
	return s.settings.IsRegistrationOpen(ctx)
}

func (s *AdminService) GetGuestDownloadAllowed(ctx context.Context) (bool, error) {
	return s.settings.IsGuestDownloadAllowed(ctx)
}

func (s *AdminService) GetDownloadSettings(ctx context.Context) (DownloadSettings, error) {
	return s.settings.GetDownloadSettings(ctx)
}

func (s *AdminService) UpdateGuestDownloadAllowed(ctx context.Context, adminID uint, ip string, allowed bool) error {
	before, err := s.settings.IsGuestDownloadAllowed(ctx)
	if err != nil {
		return err
	}
	if err := s.settings.SetGuestDownloadAllowed(ctx, allowed); err != nil {
		return err
	}
	s.logs.Record(ctx, adminID, "settings.guest_download.update", "system_setting", guestDownloadAllowedSettingKey, MarshalAuditDetail(AuditDetail{
		Summary: "Updated guest download setting",
		Changes: []AuditFieldChange{
			{Field: "guestDownloadAllowed", Label: "Guest Download Allowed", Before: before, After: allowed},
		},
	}), ip)
	return nil
}

func (s *AdminService) UpdateDownloadSettings(ctx context.Context, adminID uint, ip string, value DownloadSettings) (DownloadSettings, error) {
	before, err := s.settings.GetDownloadSettings(ctx)
	if err != nil {
		return DownloadSettings{}, err
	}
	after, err := s.settings.SetDownloadSettings(ctx, value)
	if err != nil {
		return DownloadSettings{}, err
	}
	s.logs.Record(ctx, adminID, "settings.download.update", "system_setting", downloadSettingsKey, MarshalAuditDetail(AuditDetail{
		Summary: "Updated download settings",
		Changes: []AuditFieldChange{
			{Field: "downloadSettings", Label: "Download Settings", Before: before, After: after},
		},
	}), ip)
	return after, nil
}

func (s *AdminService) GetRateLimitSettings(ctx context.Context) (RateLimitSettings, error) {
	return s.settings.GetRateLimitSettings(ctx)
}

func (s *AdminService) GetCaptchaSettings(ctx context.Context) (CaptchaSettings, error) {
	return s.settings.GetCaptchaSettings(ctx)
}

func (s *AdminService) GetUploadSettings(ctx context.Context) (UploadSettings, error) {
	return s.settings.GetUploadSettings(ctx)
}

func (s *AdminService) UpdateRegistrationSettings(ctx context.Context, adminID uint, ip string, enabled bool) error {
	before, err := s.settings.IsRegistrationOpen(ctx)
	if err != nil {
		return err
	}
	if err := s.settings.SetRegistrationOpen(ctx, enabled); err != nil {
		return err
	}
	s.logs.Record(ctx, adminID, "settings.registration.update", "system_setting", registrationOpenSettingKey, MarshalAuditDetail(AuditDetail{
		Summary: "Updated registration setting",
		Changes: []AuditFieldChange{
			{Field: "registrationEnabled", Label: "Registration Enabled", Before: before, After: enabled},
		},
	}), ip)
	return nil
}

func (s *AdminService) UpdateRateLimitSettings(ctx context.Context, adminID uint, ip string, value RateLimitSettings) (RateLimitSettings, error) {
	before, err := s.settings.GetRateLimitSettings(ctx)
	if err != nil {
		return RateLimitSettings{}, err
	}
	after, err := s.settings.SetRateLimitSettings(ctx, value)
	if err != nil {
		return RateLimitSettings{}, err
	}
	s.logs.Record(ctx, adminID, "settings.rate_limits.update", "system_setting", rateLimitSettingsKey, MarshalAuditDetail(AuditDetail{
		Summary: "Updated rate limit settings",
		Changes: []AuditFieldChange{
			{Field: "rateLimits", Label: "Rate Limits", Before: before, After: after},
		},
	}), ip)
	return after, nil
}

func (s *AdminService) UpdateCaptchaSettings(ctx context.Context, adminID uint, ip string, value CaptchaSettings) (CaptchaSettings, error) {
	before, err := s.settings.GetCaptchaSettings(ctx)
	if err != nil {
		return CaptchaSettings{}, err
	}
	after, err := s.settings.SetCaptchaSettings(ctx, value)
	if err != nil {
		return CaptchaSettings{}, err
	}
	s.logs.Record(ctx, adminID, "settings.captcha.update", "system_setting", captchaSettingsKey, MarshalAuditDetail(AuditDetail{
		Summary: "Updated captcha settings",
		Changes: []AuditFieldChange{
			{Field: "captcha", Label: "Captcha Settings", Before: before, After: after},
		},
	}), ip)
	return after, nil
}

func (s *AdminService) UpdateUploadSettings(ctx context.Context, adminID uint, ip string, value UploadSettings) (UploadSettings, error) {
	before, err := s.settings.GetUploadSettings(ctx)
	if err != nil {
		return UploadSettings{}, err
	}
	after, err := s.settings.SetUploadSettings(ctx, value)
	if err != nil {
		return UploadSettings{}, err
	}
	s.logs.Record(ctx, adminID, "settings.upload_policy.update", "system_setting", uploadSettingsKey, MarshalAuditDetail(AuditDetail{
		Summary: "Updated upload policy",
		Changes: []AuditFieldChange{
			{Field: "uploadPolicy", Label: "Upload Policy", Before: before, After: after},
		},
	}), ip)
	return after, nil
}

func (s *AdminService) GetPermissionTemplates(ctx context.Context) ([]PermissionTemplate, error) {
	return s.settings.GetPermissionTemplates(ctx)
}

func (s *AdminService) UpdatePermissionTemplates(ctx context.Context, adminID uint, ip string, templates []PermissionTemplate) error {
	before, err := s.settings.GetPermissionTemplates(ctx)
	if err != nil {
		return err
	}
	if err := s.settings.SetPermissionTemplates(ctx, templates); err != nil {
		return err
	}
	after, err := s.settings.GetPermissionTemplates(ctx)
	if err != nil {
		return err
	}
	s.logs.Record(ctx, adminID, "settings.permission_templates.update", "system_setting", permissionTemplatesSettingKey, MarshalAuditDetail(AuditDetail{
		Summary: "Updated permission templates",
		Changes: []AuditFieldChange{
			{Field: "templates", Label: "Permission Templates", Before: before, After: after},
		},
	}), ip)
	return nil
}

func normalizeRole(role string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "admin":
		return "admin", nil
	case "", "user":
		return "user", nil
	default:
		return "", fmt.Errorf("%w: invalid role", ErrValidation)
	}
}

func slicesEqualStrings(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}
