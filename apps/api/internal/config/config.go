package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	App       AppConfig
	Database  DatabaseConfig
	Redis     RedisConfig
	Security  SecurityConfig
	Storage   StorageConfig
	RateLimit RateLimitConfig
}

type AppConfig struct {
	Name           string
	Env            string
	Host           string
	Port           string
	ExternalURL    string
	TrustedProxies []string
}

type DatabaseConfig struct {
	Host     string
	Port     string
	Name     string
	User     string
	Password string
	SSLMode  string
}

type RedisConfig struct {
	Addr     string
	Password string
	DB       int
	Prefix   string
}

type SecurityConfig struct {
	JWTSecret             string
	JWTExpireHours        int
	AdminBootstrapUser    string
	AdminBootstrapPass    string
	LoginFailureLimit     int
	LoginBlockMinutes     int
	BlacklistIPs          []string
	MaxUploadSizeBytes    int64
	AllowedFileExtensions []string
	AllowedMimeTypes      []string
}

type StorageConfig struct {
	Region              string
	Endpoint            string
	Bucket              string
	AccessKeyID         string
	AccessKeySecret     string
	BasePath            string
	SignedURLTTLMinutes int
	DeleteMode          string
}

type RateLimitConfig struct {
	LoginLimit            int
	LoginWindowSeconds    int
	DownloadLimit         int
	DownloadWindowSeconds int
	UploadLimit           int
	UploadWindowSeconds   int
	ListLimit             int
	ListWindowSeconds     int
}

func Load() (*Config, error) {
	cfg := &Config{
		App: AppConfig{
			Name:           getEnv("APP_NAME", "FluxFiles"),
			Env:            getEnv("APP_ENV", "development"),
			Host:           getEnv("APP_HOST", "0.0.0.0"),
			Port:           getEnv("APP_PORT", "8080"),
			ExternalURL:    strings.TrimRight(getEnv("APP_EXTERNAL_URL", "http://localhost"), "/"),
			TrustedProxies: splitAndTrim(getEnv("TRUSTED_PROXIES", "127.0.0.1,::1,172.16.0.0/12,10.0.0.0/8")),
		},
		Database: DatabaseConfig{
			Host:     getEnv("POSTGRES_HOST", "localhost"),
			Port:     getEnv("POSTGRES_PORT", "5432"),
			Name:     getEnv("POSTGRES_DB", "fluxfiles"),
			User:     getEnv("POSTGRES_USER", "fluxfiles"),
			Password: getEnv("POSTGRES_PASSWORD", ""),
			SSLMode:  getEnv("POSTGRES_SSLMODE", "disable"),
		},
		Redis: RedisConfig{
			Addr:     getEnv("REDIS_ADDR", "localhost:6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getEnvAsInt("REDIS_DB", 0),
			Prefix:   getEnv("REDIS_PREFIX", "fluxfiles"),
		},
		Security: SecurityConfig{
			JWTSecret:             getEnv("JWT_SECRET", ""),
			JWTExpireHours:        getEnvAsInt("JWT_EXPIRE_HOURS", 24),
			AdminBootstrapUser:    getEnv("ADMIN_BOOTSTRAP_USERNAME", ""),
			AdminBootstrapPass:    getEnv("ADMIN_BOOTSTRAP_PASSWORD", ""),
			LoginFailureLimit:     getEnvAsInt("LOGIN_FAILURE_LIMIT", 5),
			LoginBlockMinutes:     getEnvAsInt("LOGIN_BLOCK_MINUTES", 15),
			BlacklistIPs:          splitAndTrim(getEnv("BLACKLIST_IPS", "")),
			MaxUploadSizeBytes:    int64(getEnvAsInt("MAX_UPLOAD_SIZE_MB", 200)) * 1024 * 1024,
			AllowedFileExtensions: splitAndTrim(getEnv("ALLOWED_FILE_EXTENSIONS", "")),
			AllowedMimeTypes:      splitAndTrim(getEnv("ALLOWED_MIME_TYPES", "")),
		},
		Storage: StorageConfig{
			Region:              getEnv("OSS_REGION", ""),
			Endpoint:            getEnv("OSS_ENDPOINT", ""),
			Bucket:              getEnv("OSS_BUCKET", ""),
			AccessKeyID:         getEnv("OSS_ACCESS_KEY_ID", ""),
			AccessKeySecret:     getEnv("OSS_ACCESS_KEY_SECRET", ""),
			BasePath:            strings.Trim(getEnv("OSS_BASE_PATH", "fluxfiles"), "/"),
			SignedURLTTLMinutes: getEnvAsInt("OSS_SIGNED_URL_TTL_MINUTES", 10),
			DeleteMode:          strings.ToLower(getEnv("OSS_DELETE_MODE", "sync")),
		},
		RateLimit: RateLimitConfig{
			LoginLimit:            getEnvAsInt("RATE_LIMIT_LOGIN", 10),
			LoginWindowSeconds:    getEnvAsInt("RATE_LIMIT_LOGIN_WINDOW_SECONDS", 60),
			DownloadLimit:         getEnvAsInt("RATE_LIMIT_DOWNLOAD", 60),
			DownloadWindowSeconds: getEnvAsInt("RATE_LIMIT_DOWNLOAD_WINDOW_SECONDS", 60),
			UploadLimit:           getEnvAsInt("RATE_LIMIT_UPLOAD", 20),
			UploadWindowSeconds:   getEnvAsInt("RATE_LIMIT_UPLOAD_WINDOW_SECONDS", 300),
			ListLimit:             getEnvAsInt("RATE_LIMIT_LIST", 120),
			ListWindowSeconds:     getEnvAsInt("RATE_LIMIT_LIST_WINDOW_SECONDS", 60),
		},
	}

	if cfg.Security.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	if cfg.Storage.Region == "" || cfg.Storage.Endpoint == "" || cfg.Storage.Bucket == "" {
		return nil, fmt.Errorf("OSS_REGION, OSS_ENDPOINT and OSS_BUCKET are required")
	}

	if cfg.Storage.AccessKeyID == "" || cfg.Storage.AccessKeySecret == "" {
		return nil, fmt.Errorf("OSS access key credentials are required")
	}

	return cfg, nil
}

func (c Config) Address() string {
	return fmt.Sprintf("%s:%s", c.App.Host, c.App.Port)
}

func (c Config) DatabaseDSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s TimeZone=%s",
		c.Database.Host,
		c.Database.Port,
		c.Database.User,
		c.Database.Password,
		c.Database.Name,
		c.Database.SSLMode,
		time.Local.String(),
	)
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func getEnvAsInt(key string, fallback int) int {
	value := getEnv(key, "")
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func splitAndTrim(value string) []string {
	if strings.TrimSpace(value) == "" {
		return []string{}
	}

	raw := strings.Split(value, ",")
	items := make([]string, 0, len(raw))
	for _, item := range raw {
		trimmed := strings.TrimSpace(item)
		if trimmed != "" {
			items = append(items, trimmed)
		}
	}
	return items
}
