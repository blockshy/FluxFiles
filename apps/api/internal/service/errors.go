package service

import "errors"

var (
	ErrUnauthorized          = errors.New("unauthorized")
	ErrForbidden             = errors.New("forbidden")
	ErrTooManyAttempts       = errors.New("too many attempts")
	ErrNotFound              = errors.New("resource not found")
	ErrValidation            = errors.New("validation error")
	ErrDependencyUnavailable = errors.New("dependency unavailable")
)
