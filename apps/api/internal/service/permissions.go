package service

import (
	"fmt"
	"slices"
	"strings"
)

const (
	PermissionAdminFilesOwn    = "admin.files.own"
	PermissionAdminFilesAll    = "admin.files.all"
	PermissionAdminFilesUpload = "admin.files.upload"
	PermissionAdminFilesEdit   = "admin.files.edit"
	PermissionAdminFilesDelete = "admin.files.delete"
	PermissionAdminUsersCreate = "admin.users.create"
	PermissionAdminUsersEdit   = "admin.users.edit"
	PermissionAdminSettings    = "admin.settings"
	PermissionAdminAudit       = "admin.audit"
)

var AllAdminPermissions = []string{
	PermissionAdminFilesOwn,
	PermissionAdminFilesAll,
	PermissionAdminFilesUpload,
	PermissionAdminFilesEdit,
	PermissionAdminFilesDelete,
	PermissionAdminUsersCreate,
	PermissionAdminUsersEdit,
	PermissionAdminSettings,
	PermissionAdminAudit,
}

type PermissionTemplate struct {
	Key         string   `json:"key"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

var DefaultPermissionTemplates = []PermissionTemplate{
	{
		Key:         "super_admin",
		Name:        "Super Admin",
		Description: "Full access to all admin features",
		Permissions: append([]string(nil), AllAdminPermissions...),
	},
	{
		Key:         "ops_admin",
		Name:        "Ops Admin",
		Description: "Manage files and view audit logs",
		Permissions: []string{PermissionAdminFilesAll, PermissionAdminFilesUpload, PermissionAdminFilesEdit, PermissionAdminFilesDelete, PermissionAdminAudit},
	},
	{
		Key:         "user_admin",
		Name:        "User Admin",
		Description: "Manage users and view audit logs",
		Permissions: []string{PermissionAdminUsersCreate, PermissionAdminUsersEdit, PermissionAdminAudit},
	},
	{
		Key:         "config_admin",
		Name:        "Config Admin",
		Description: "Manage system settings and view audit logs",
		Permissions: []string{PermissionAdminSettings, PermissionAdminAudit},
	},
}

func NormalizePermissions(role string, permissions []string) ([]string, error) {
	if role != "admin" {
		return []string{}, nil
	}

	if len(permissions) == 0 {
		return append([]string(nil), AllAdminPermissions...), nil
	}

	allowed := make(map[string]struct{}, len(AllAdminPermissions))
	for _, item := range AllAdminPermissions {
		allowed[item] = struct{}{}
	}

	normalized := make([]string, 0, len(permissions))
	seen := map[string]struct{}{}
	for _, permission := range permissions {
		value := strings.TrimSpace(strings.ToLower(permission))
		if value == "" {
			continue
		}
		if _, ok := allowed[value]; !ok {
			return nil, fmt.Errorf("%w: invalid permission", ErrValidation)
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}

	if len(normalized) == 0 {
		return nil, fmt.Errorf("%w: at least one admin permission is required", ErrValidation)
	}
	if err := ValidatePermissionCombination(normalized); err != nil {
		return nil, err
	}

	slices.Sort(normalized)
	return normalized, nil
}

func HasPermission(permissions []string, permission string) bool {
	for _, item := range permissions {
		if item == permission {
			return true
		}
	}
	return false
}

func HasAnyPermission(permissions []string, required ...string) bool {
	for _, permission := range required {
		if HasPermission(permissions, permission) {
			return true
		}
	}
	return false
}

func ValidatePermissionCombination(permissions []string) error {
	hasOwnScope := HasPermission(permissions, PermissionAdminFilesOwn)
	hasAllScope := HasPermission(permissions, PermissionAdminFilesAll)
	hasFileScope := hasOwnScope || hasAllScope

	if (HasPermission(permissions, PermissionAdminFilesEdit) || HasPermission(permissions, PermissionAdminFilesDelete)) && !hasFileScope {
		return fmt.Errorf("%w: file edit/delete permissions require own-file or all-file scope", ErrValidation)
	}

	return nil
}

func NormalizePermissionTemplates(templates []PermissionTemplate) ([]PermissionTemplate, error) {
	if len(templates) == 0 {
		return append([]PermissionTemplate(nil), DefaultPermissionTemplates...), nil
	}

	result := make([]PermissionTemplate, 0, len(templates))
	seen := map[string]struct{}{}
	for _, item := range templates {
		key := strings.TrimSpace(strings.ToLower(item.Key))
		name := strings.TrimSpace(item.Name)
		description := strings.TrimSpace(item.Description)
		if key == "" || name == "" {
			return nil, fmt.Errorf("%w: template key and name are required", ErrValidation)
		}
		if _, ok := seen[key]; ok {
			return nil, fmt.Errorf("%w: duplicate template key", ErrValidation)
		}
		seen[key] = struct{}{}

		permissions, err := NormalizePermissions("admin", item.Permissions)
		if err != nil {
			return nil, err
		}

		result = append(result, PermissionTemplate{
			Key:         key,
			Name:        name,
			Description: description,
			Permissions: permissions,
		})
	}

	slices.SortFunc(result, func(left, right PermissionTemplate) int {
		return strings.Compare(left.Key, right.Key)
	})
	return result, nil
}
