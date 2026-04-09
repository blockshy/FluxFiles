package validator

import (
	"fmt"
	"path/filepath"
	"strings"
)

type UploadPolicy struct {
	MaxSizeBytes int64
	Extensions   map[string]struct{}
	MimeTypes    map[string]struct{}
}

var genericMimeTypes = map[string]struct{}{
	"":                           {},
	"application/octet-stream":   {},
	"binary/octet-stream":        {},
	"application/x-download":     {},
	"application/force-download": {},
}

var mimeAliases = map[string]string{
	"application/x-zip-compressed": "application/zip",
	"application/vnd.rar":          "application/x-rar-compressed",
	"audio/mp3":                    "audio/mpeg",
	"audio/mpeg3":                  "audio/mpeg",
	"image/pjpeg":                  "image/jpeg",
}

var mimeTypeByExtension = map[string]string{
	".zip":  "application/zip",
	".rar":  "application/x-rar-compressed",
	".7z":   "application/x-7z-compressed",
	".pdf":  "application/pdf",
	".txt":  "text/plain",
	".csv":  "text/csv",
	".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	".xls":  "application/vnd.ms-excel",
	".doc":  "application/msword",
	".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".ppt":  "application/vnd.ms-powerpoint",
	".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
	".mp4":  "video/mp4",
	".mp3":  "audio/mpeg",
}

func NewUploadPolicy(maxSizeBytes int64, extensions, mimeTypes []string) *UploadPolicy {
	policy := &UploadPolicy{
		MaxSizeBytes: maxSizeBytes,
		Extensions:   make(map[string]struct{}, len(extensions)),
		MimeTypes:    make(map[string]struct{}, len(mimeTypes)),
	}

	for _, ext := range extensions {
		normalized := strings.ToLower(strings.TrimSpace(ext))
		if normalized == "" {
			continue
		}
		if normalized == "*" {
			policy.Extensions = map[string]struct{}{}
			break
		}
		policy.Extensions[normalized] = struct{}{}
	}

	for _, mimeType := range mimeTypes {
		normalized := strings.ToLower(strings.TrimSpace(mimeType))
		if normalized == "" {
			continue
		}
		if normalized == "*" {
			policy.MimeTypes = map[string]struct{}{}
			break
		}
		policy.MimeTypes[normalized] = struct{}{}
	}

	return policy
}

func (p *UploadPolicy) Validate(filename string, size int64, mimeType string) error {
	if size <= 0 {
		return fmt.Errorf("empty file is not allowed")
	}

	if size > p.MaxSizeBytes {
		return fmt.Errorf("file exceeds size limit of %d bytes", p.MaxSizeBytes)
	}

	ext := strings.ToLower(filepath.Ext(filename))
	if len(p.Extensions) > 0 {
		if _, ok := p.Extensions[ext]; !ok {
			return fmt.Errorf("file extension %s is not allowed", ext)
		}
	}

	normalizedMimeType := p.ResolveMimeType(filename, mimeType)
	if len(p.MimeTypes) > 0 {
		if _, ok := p.MimeTypes[normalizedMimeType]; !ok {
			return fmt.Errorf("mime type %s is not allowed", mimeType)
		}
	}

	return nil
}

func (p *UploadPolicy) ResolveMimeType(filename string, mimeType string) string {
	normalized := strings.ToLower(strings.TrimSpace(mimeType))
	if alias, ok := mimeAliases[normalized]; ok {
		normalized = alias
	}

	if _, ok := genericMimeTypes[normalized]; ok {
		ext := strings.ToLower(filepath.Ext(filename))
		if guessed, exists := mimeTypeByExtension[ext]; exists {
			return guessed
		}
	}

	return normalized
}
