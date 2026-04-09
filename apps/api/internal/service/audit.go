package service

import "encoding/json"

type AuditFieldChange struct {
	Field  string `json:"field"`
	Label  string `json:"label"`
	Before any    `json:"before,omitempty"`
	After  any    `json:"after,omitempty"`
}

type AuditDetail struct {
	Summary string             `json:"summary"`
	Changes []AuditFieldChange `json:"changes,omitempty"`
	Meta    map[string]any     `json:"meta,omitempty"`
}

func MarshalAuditDetail(detail AuditDetail) string {
	payload, err := json.Marshal(detail)
	if err != nil {
		return detail.Summary
	}
	return string(payload)
}
