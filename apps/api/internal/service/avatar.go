package service

import (
	"encoding/base64"
	"fmt"
	"hash/fnv"
	"strings"

	"fluxfiles/api/internal/model"
)

const maxAvatarBytes = 2 * 1024 * 1024

var allowedAvatarPrefixes = []string{
	"data:image/png;base64,",
	"data:image/jpeg;base64,",
	"data:image/jpg;base64,",
	"data:image/webp;base64,",
	"data:image/gif;base64,",
}

func resolveAvatarURL(username, displayName, avatarURL string) string {
	if normalized, ok := normalizeAvatarDataURL(avatarURL); ok {
		return normalized
	}
	return buildDefaultAvatarDataURL(username, displayName)
}

func normalizeAvatarDataURL(raw string) (string, bool) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "", false
	}

	prefix := ""
	for _, item := range allowedAvatarPrefixes {
		if strings.HasPrefix(strings.ToLower(value), item) {
			prefix = value[:len(item)]
			break
		}
	}
	if prefix == "" {
		return "", false
	}

	payload := value[len(prefix):]
	decoded, err := base64.StdEncoding.DecodeString(payload)
	if err != nil || len(decoded) == 0 || len(decoded) > maxAvatarBytes {
		return "", false
	}
	return prefix + payload, true
}

func buildDefaultAvatarDataURL(username, displayName string) string {
	seed := strings.TrimSpace(displayName)
	if seed == "" {
		seed = strings.TrimSpace(username)
	}
	if seed == "" {
		seed = "FluxFiles"
	}

	initial := []rune(strings.ToUpper(seed))[0]
	palette := []struct {
		bg   string
		text string
	}{
		{bg: "#1d4ed8", text: "#eff6ff"},
		{bg: "#047857", text: "#ecfdf5"},
		{bg: "#7c3aed", text: "#f5f3ff"},
		{bg: "#c2410c", text: "#fff7ed"},
		{bg: "#be123c", text: "#fff1f2"},
		{bg: "#0f766e", text: "#f0fdfa"},
	}

	hasher := fnv.New32a()
	_, _ = hasher.Write([]byte(strings.ToLower(seed)))
	choice := palette[hasher.Sum32()%uint32(len(palette))]

	svg := fmt.Sprintf(
		`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="40" fill="%s"/><text x="50%%" y="53%%" dominant-baseline="middle" text-anchor="middle" fill="%s" font-family="Arial, sans-serif" font-size="72" font-weight="700">%s</text></svg>`,
		choice.bg,
		choice.text,
		string(initial),
	)

	return "data:image/svg+xml;base64," + base64.StdEncoding.EncodeToString([]byte(svg))
}

func applyResolvedAvatar(user *model.User) {
	if user == nil {
		return
	}
	user.AvatarURL = resolveAvatarURL(user.Username, user.DisplayName, user.AvatarURL)
}

func applyResolvedAvatars(users []model.User) {
	for index := range users {
		applyResolvedAvatar(&users[index])
	}
}

func applyResolvedFileUploaderAvatar(file *model.File) {
	if file == nil || strings.TrimSpace(file.CreatedByUsername) == "" {
		return
	}
	file.CreatedByAvatarURL = resolveAvatarURL(file.CreatedByUsername, file.CreatedByDisplayName, file.CreatedByAvatarURL)
}

func applyResolvedFileUploaderAvatars(files []model.File) {
	for index := range files {
		applyResolvedFileUploaderAvatar(&files[index])
	}
}

func resolveUserAvatarFields(username, displayName, avatarURL string) string {
	return resolveAvatarURL(username, displayName, avatarURL)
}

func applyResolvedCommentAvatar(comment *model.FileComment) {
	if comment == nil || strings.TrimSpace(comment.UserUsername) == "" {
		return
	}
	comment.UserAvatarURL = resolveAvatarURL(comment.UserUsername, comment.UserDisplayName, comment.UserAvatarURL)
}

func applyResolvedCommentAvatars(items []model.FileComment) {
	for index := range items {
		applyResolvedCommentAvatar(&items[index])
	}
}

func applyResolvedNotificationAvatar(notification *model.UserNotification) {
	if notification == nil || strings.TrimSpace(notification.ActorUsername) == "" {
		return
	}
	notification.ActorAvatarURL = resolveAvatarURL(notification.ActorUsername, notification.ActorDisplayName, notification.ActorAvatarURL)
}

func applyResolvedNotificationAvatars(items []model.UserNotification) {
	for index := range items {
		applyResolvedNotificationAvatar(&items[index])
	}
}
