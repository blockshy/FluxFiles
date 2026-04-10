package dto

type LoginRequest struct {
	Username      string `json:"username" binding:"required,min=3,max=64"`
	Password      string `json:"password" binding:"required,min=8,max=128"`
	CaptchaID     string `json:"captchaId"`
	CaptchaAnswer string `json:"captchaAnswer"`
}

type RegisterRequest struct {
	Username      string `json:"username" binding:"required,min=3,max=64"`
	Email         string `json:"email" binding:"required,email,max=128"`
	DisplayName   string `json:"displayName" binding:"required,min=1,max=128"`
	Password      string `json:"password" binding:"required,min=8,max=128"`
	CaptchaID     string `json:"captchaId"`
	CaptchaAnswer string `json:"captchaAnswer"`
}

type UpdateProfileRequest struct {
	Email             string `json:"email" binding:"required,email,max=128"`
	DisplayName       string `json:"displayName" binding:"required,min=1,max=128"`
	AvatarURL         string `json:"avatarUrl" binding:"max=3000000"`
	Bio               string `json:"bio" binding:"max=5000"`
	ProfileVisibility struct {
		ShowBio            bool `json:"showBio"`
		ShowStats          bool `json:"showStats"`
		ShowPublishedFiles bool `json:"showPublishedFiles"`
		ShowFavorites      bool `json:"showFavorites"`
	} `json:"profileVisibility"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword" binding:"required,min=8,max=128"`
	NewPassword     string `json:"newPassword" binding:"required,min=8,max=128"`
}

type CreateManagedUserRequest struct {
	Username    string   `json:"username" binding:"required,min=3,max=64"`
	Email       string   `json:"email" binding:"required,email,max=128"`
	DisplayName string   `json:"displayName" binding:"required,min=1,max=128"`
	Password    string   `json:"password" binding:"required,min=8,max=128"`
	Role        string   `json:"role" binding:"required,oneof=user admin"`
	Permissions []string `json:"permissions"`
	IsEnabled   bool     `json:"isEnabled"`
}

type UpdateManagedUserRequest struct {
	Email       string   `json:"email" binding:"required,email,max=128"`
	DisplayName string   `json:"displayName" binding:"required,min=1,max=128"`
	Role        string   `json:"role" binding:"required,oneof=user admin"`
	Permissions []string `json:"permissions"`
	IsEnabled   bool     `json:"isEnabled"`
}

type UpdateRegistrationSettingRequest struct {
	RegistrationEnabled bool `json:"registrationEnabled"`
}

type UpdateCaptchaSettingsRequest struct {
	LoginEnabled        bool `json:"loginEnabled"`
	RegistrationEnabled bool `json:"registrationEnabled"`
}

type RateLimitRuleRequest struct {
	Limit         int `json:"limit" binding:"min=0"`
	WindowSeconds int `json:"windowSeconds" binding:"min=0"`
}

type UpdateRateLimitSettingsRequest struct {
	Login    RateLimitRuleRequest `json:"login"`
	Download RateLimitRuleRequest `json:"download"`
	Upload   RateLimitRuleRequest `json:"upload"`
	List     RateLimitRuleRequest `json:"list"`
}

type UpdateUploadSettingsRequest struct {
	RestrictFileSize  bool     `json:"restrictFileSize"`
	MaxSizeBytes      int64    `json:"maxSizeBytes" binding:"min=0"`
	RestrictFileTypes bool     `json:"restrictFileTypes"`
	AllowedExtensions []string `json:"allowedExtensions"`
	AllowedMimeTypes  []string `json:"allowedMimeTypes"`
}

type PermissionTemplateRequest struct {
	Key         string   `json:"key" binding:"required"`
	Name        string   `json:"name" binding:"required"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions" binding:"required,min=1"`
}

type UpdatePermissionTemplatesRequest struct {
	Templates []PermissionTemplateRequest `json:"templates" binding:"required,min=1"`
}

type UpdateFileRequest struct {
	Name        string   `json:"name" binding:"required,min=1,max=255"`
	Description string   `json:"description" binding:"max=5000"`
	Category    string   `json:"category" binding:"max=128"`
	Tags        []string `json:"tags"`
	IsPublic    bool     `json:"isPublic"`
}

type PrepareUploadRequest struct {
	OriginalName string `json:"originalName" binding:"required,min=1,max=255"`
	Size         int64  `json:"size" binding:"required,gt=0"`
	MimeType     string `json:"mimeType" binding:"max=128"`
}

type CompleteUploadRequest struct {
	ObjectKey    string   `json:"objectKey" binding:"required,min=1,max=512"`
	OriginalName string   `json:"originalName" binding:"required,min=1,max=255"`
	Name         string   `json:"name" binding:"required,min=1,max=255"`
	Description  string   `json:"description" binding:"max=5000"`
	Category     string   `json:"category" binding:"max=128"`
	Tags         []string `json:"tags"`
	IsPublic     bool     `json:"isPublic"`
}
