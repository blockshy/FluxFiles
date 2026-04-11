package service

import (
	"fmt"
	"slices"
	"strings"
)

const (
	PermissionAdminFilesOwn          = "admin.files.own"
	PermissionAdminFilesAll          = "admin.files.all"
	PermissionAdminFilesUpload       = "admin.files.upload"
	PermissionAdminFilesEdit         = "admin.files.edit"
	PermissionAdminFilesDelete       = "admin.files.delete"
	PermissionAdminDownloadsView     = "admin.downloads.view"
	PermissionAdminUsersCreate       = "admin.users.create"
	PermissionAdminUsersEdit         = "admin.users.edit"
	PermissionAdminCategoriesView    = "admin.categories.view"
	PermissionAdminCategoriesCreate  = "admin.categories.create"
	PermissionAdminCategoriesEdit    = "admin.categories.edit"
	PermissionAdminCategoriesDelete  = "admin.categories.delete"
	PermissionAdminCategoriesLogs    = "admin.categories.logs"
	PermissionAdminTagsView          = "admin.tags.view"
	PermissionAdminTagsCreate        = "admin.tags.create"
	PermissionAdminTagsEdit          = "admin.tags.edit"
	PermissionAdminTagsDelete        = "admin.tags.delete"
	PermissionAdminTagsLogs          = "admin.tags.logs"
	PermissionAdminCommunityView     = "admin.community.view"
	PermissionAdminCommunityModerate = "admin.community.moderate"
	PermissionAdminSettings          = "admin.settings"
	PermissionAdminAudit             = "admin.audit"

	PermissionPublicFilesView               = "public.files.view"
	PermissionPublicFilesDetail             = "public.files.detail"
	PermissionPublicFilesDownload           = "public.files.download"
	PermissionPublicFilesFavorite           = "public.files.favorite"
	PermissionPublicCommentsCreate          = "public.comments.create"
	PermissionPublicCommentsReply           = "public.comments.reply"
	PermissionPublicCommentsVote            = "public.comments.vote"
	PermissionPublicCommentsDeleteOwn       = "public.comments.delete_own"
	PermissionPublicCommunityView           = "public.community.view"
	PermissionPublicCommunityPostCreate     = "public.community.post.create"
	PermissionPublicCommunityPostEditOwn    = "public.community.post.edit_own"
	PermissionPublicCommunityPostDeleteOwn  = "public.community.post.delete_own"
	PermissionPublicCommunityReplyCreate    = "public.community.reply.create"
	PermissionPublicCommunityReplyDeleteOwn = "public.community.reply.delete_own"
	PermissionPublicProfileViewOwn          = "public.profile.view_own"
	PermissionPublicProfileEditOwn          = "public.profile.edit_own"
	PermissionPublicProfileViewPublic       = "public.profile.view_public"
	PermissionPublicNotificationsView       = "public.notifications.view"
)

const DefaultUserPermissionTemplateKey = "default_user"

var AllAdminPermissions = []string{
	PermissionAdminFilesOwn,
	PermissionAdminFilesAll,
	PermissionAdminFilesUpload,
	PermissionAdminFilesEdit,
	PermissionAdminFilesDelete,
	PermissionAdminDownloadsView,
	PermissionAdminUsersCreate,
	PermissionAdminUsersEdit,
	PermissionAdminCategoriesView,
	PermissionAdminCategoriesCreate,
	PermissionAdminCategoriesEdit,
	PermissionAdminCategoriesDelete,
	PermissionAdminCategoriesLogs,
	PermissionAdminTagsView,
	PermissionAdminTagsCreate,
	PermissionAdminTagsEdit,
	PermissionAdminTagsDelete,
	PermissionAdminTagsLogs,
	PermissionAdminCommunityView,
	PermissionAdminCommunityModerate,
	PermissionAdminSettings,
	PermissionAdminAudit,
}

var AllPublicPermissions = []string{
	PermissionPublicFilesView,
	PermissionPublicFilesDetail,
	PermissionPublicFilesDownload,
	PermissionPublicFilesFavorite,
	PermissionPublicCommentsCreate,
	PermissionPublicCommentsReply,
	PermissionPublicCommentsVote,
	PermissionPublicCommentsDeleteOwn,
	PermissionPublicCommunityView,
	PermissionPublicCommunityPostCreate,
	PermissionPublicCommunityPostEditOwn,
	PermissionPublicCommunityPostDeleteOwn,
	PermissionPublicCommunityReplyCreate,
	PermissionPublicCommunityReplyDeleteOwn,
	PermissionPublicProfileViewOwn,
	PermissionPublicProfileEditOwn,
	PermissionPublicProfileViewPublic,
	PermissionPublicNotificationsView,
}

var AllPermissions = append(append([]string(nil), AllAdminPermissions...), AllPublicPermissions...)

var DefaultUserPermissions = []string{
	PermissionPublicFilesView,
	PermissionPublicFilesDetail,
	PermissionPublicFilesDownload,
	PermissionPublicFilesFavorite,
	PermissionPublicCommentsCreate,
	PermissionPublicCommentsReply,
	PermissionPublicCommentsVote,
	PermissionPublicCommentsDeleteOwn,
	PermissionPublicCommunityView,
	PermissionPublicCommunityPostCreate,
	PermissionPublicCommunityPostEditOwn,
	PermissionPublicCommunityPostDeleteOwn,
	PermissionPublicCommunityReplyCreate,
	PermissionPublicCommunityReplyDeleteOwn,
	PermissionPublicProfileViewOwn,
	PermissionPublicProfileEditOwn,
	PermissionPublicProfileViewPublic,
	PermissionPublicNotificationsView,
}

type PermissionTemplate struct {
	Key         string   `json:"key"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

var DefaultPermissionTemplates = []PermissionTemplate{
	{
		Key:         DefaultUserPermissionTemplateKey,
		Name:        "普通用户基础权限",
		Description: "新注册用户和普通新建用户默认使用的前台基础权限",
		Permissions: append([]string(nil), DefaultUserPermissions...),
	},
	{
		Key:         "super_admin",
		Name:        "Super Admin",
		Description: "Full access to all admin and public features",
		Permissions: append([]string(nil), AllPermissions...),
	},
	{
		Key:         "ops_admin",
		Name:        "Ops Admin",
		Description: "Manage files and view audit logs",
		Permissions: []string{PermissionAdminFilesAll, PermissionAdminFilesUpload, PermissionAdminFilesEdit, PermissionAdminFilesDelete, PermissionAdminDownloadsView, PermissionAdminCommunityView, PermissionAdminCommunityModerate, PermissionAdminAudit},
	},
	{
		Key:         "taxonomy_admin",
		Name:        "Taxonomy Admin",
		Description: "Manage hierarchical file categories, hierarchical tags, and their change logs",
		Permissions: []string{
			PermissionAdminCategoriesView,
			PermissionAdminCategoriesCreate,
			PermissionAdminCategoriesEdit,
			PermissionAdminCategoriesDelete,
			PermissionAdminCategoriesLogs,
			PermissionAdminTagsView,
			PermissionAdminTagsCreate,
			PermissionAdminTagsEdit,
			PermissionAdminTagsDelete,
			PermissionAdminTagsLogs,
		},
	},
	{
		Key:         "user_admin",
		Name:        "User Admin",
		Description: "Manage users and view audit logs",
		Permissions: []string{PermissionAdminUsersCreate, PermissionAdminUsersEdit, PermissionAdminAudit},
	},
	{
		Key:         "community_admin",
		Name:        "Community Admin",
		Description: "Review, pin, lock, and remove community posts",
		Permissions: []string{PermissionAdminCommunityView, PermissionAdminCommunityModerate, PermissionAdminAudit},
	},
	{
		Key:         "config_admin",
		Name:        "Config Admin",
		Description: "Manage system settings and view audit logs",
		Permissions: []string{PermissionAdminSettings, PermissionAdminAudit},
	},
}

func NormalizePermissions(role string, permissions []string) ([]string, error) {
	if len(permissions) == 0 {
		if role == "admin" {
			return append([]string(nil), AllPermissions...), nil
		}
		return append([]string(nil), DefaultUserPermissions...), nil
	}

	return normalizePermissionList(permissions, true)
}

func normalizePermissionList(permissions []string, requireNonEmpty bool) ([]string, error) {
	allowed := make(map[string]struct{}, len(AllPermissions))
	for _, item := range AllPermissions {
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

	if requireNonEmpty && len(normalized) == 0 {
		return nil, fmt.Errorf("%w: at least one permission is required", ErrValidation)
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
	if HasPermission(permissions, PermissionAdminDownloadsView) && !hasFileScope {
		return fmt.Errorf("%w: download record view permission requires own-file or all-file scope", ErrValidation)
	}
	if err := validateTaxonomyPermissionViewDependency(permissions, PermissionAdminCategoriesView, PermissionAdminCategoriesCreate, PermissionAdminCategoriesEdit, PermissionAdminCategoriesDelete, PermissionAdminCategoriesLogs); err != nil {
		return err
	}
	if err := validateTaxonomyPermissionViewDependency(permissions, PermissionAdminTagsView, PermissionAdminTagsCreate, PermissionAdminTagsEdit, PermissionAdminTagsDelete, PermissionAdminTagsLogs); err != nil {
		return err
	}
	if HasPermission(permissions, PermissionAdminCommunityModerate) && !HasPermission(permissions, PermissionAdminCommunityView) {
		return fmt.Errorf("%w: community moderation requires community view permission", ErrValidation)
	}
	if HasAnyPermission(permissions, PermissionPublicFilesDetail, PermissionPublicFilesDownload, PermissionPublicFilesFavorite, PermissionPublicCommentsCreate, PermissionPublicCommentsReply, PermissionPublicCommentsVote, PermissionPublicCommentsDeleteOwn) && !HasPermission(permissions, PermissionPublicFilesView) {
		return fmt.Errorf("%w: public file actions require public file list view permission", ErrValidation)
	}
	if HasAnyPermission(permissions, PermissionPublicFilesDownload, PermissionPublicFilesFavorite, PermissionPublicCommentsCreate, PermissionPublicCommentsReply, PermissionPublicCommentsVote, PermissionPublicCommentsDeleteOwn) && !HasPermission(permissions, PermissionPublicFilesDetail) {
		return fmt.Errorf("%w: public file interactions require public file detail permission", ErrValidation)
	}
	if HasPermission(permissions, PermissionPublicCommentsReply) && !HasPermission(permissions, PermissionPublicCommentsCreate) {
		return fmt.Errorf("%w: comment reply permission requires comment create permission", ErrValidation)
	}
	if HasAnyPermission(permissions, PermissionPublicCommunityPostCreate, PermissionPublicCommunityPostEditOwn, PermissionPublicCommunityPostDeleteOwn, PermissionPublicCommunityReplyCreate, PermissionPublicCommunityReplyDeleteOwn) && !HasPermission(permissions, PermissionPublicCommunityView) {
		return fmt.Errorf("%w: community actions require community view permission", ErrValidation)
	}
	if HasAnyPermission(permissions, PermissionPublicCommunityPostEditOwn, PermissionPublicCommunityPostDeleteOwn) && !HasPermission(permissions, PermissionPublicCommunityPostCreate) {
		return fmt.Errorf("%w: community post edit/delete permissions require post create permission", ErrValidation)
	}
	if HasPermission(permissions, PermissionPublicCommunityReplyDeleteOwn) && !HasPermission(permissions, PermissionPublicCommunityReplyCreate) {
		return fmt.Errorf("%w: community reply delete permission requires reply create permission", ErrValidation)
	}
	if HasPermission(permissions, PermissionPublicProfileEditOwn) && !HasPermission(permissions, PermissionPublicProfileViewOwn) {
		return fmt.Errorf("%w: profile edit permission requires own profile view permission", ErrValidation)
	}

	return nil
}

func validateTaxonomyPermissionViewDependency(permissions []string, viewPermission string, required ...string) error {
	if HasAnyPermission(permissions, required...) && !HasPermission(permissions, viewPermission) {
		return fmt.Errorf("%w: taxonomy management and log permissions require view permission", ErrValidation)
	}
	return nil
}

func NormalizePermissionTemplates(templates []PermissionTemplate) ([]PermissionTemplate, error) {
	if len(templates) == 0 {
		return append([]PermissionTemplate(nil), DefaultPermissionTemplates...), nil
	}

	result := make([]PermissionTemplate, 0, len(templates)+len(DefaultPermissionTemplates))
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

		permissions, err := normalizePermissionList(item.Permissions, true)
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
	for _, item := range DefaultPermissionTemplates {
		if _, ok := seen[item.Key]; ok {
			continue
		}
		result = append(result, PermissionTemplate{
			Key:         item.Key,
			Name:        item.Name,
			Description: item.Description,
			Permissions: append([]string(nil), item.Permissions...),
		})
	}

	slices.SortFunc(result, func(left, right PermissionTemplate) int {
		return strings.Compare(left.Key, right.Key)
	})
	return result, nil
}
