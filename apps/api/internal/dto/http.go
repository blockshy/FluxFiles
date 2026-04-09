package dto

type LoginRequest struct {
	Username string `json:"username" binding:"required,min=3,max=64"`
	Password string `json:"password" binding:"required,min=8,max=128"`
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
