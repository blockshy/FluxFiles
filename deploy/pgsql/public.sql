-- FluxFiles latest PostgreSQL schema
-- Apply this file to create the current target database structure.

BEGIN;

CREATE SCHEMA IF NOT EXISTS public;

CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    email VARCHAR(128) NOT NULL,
    display_name VARCHAR(128) NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'user',
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    profile_visibility JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT users_username_key UNIQUE (username),
    CONSTRAINT users_email_key UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON public.users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_enabled ON public.users(is_enabled);

CREATE TABLE IF NOT EXISTS public.files (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    object_key VARCHAR(512) NOT NULL,
    size BIGINT NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category VARCHAR(128) NOT NULL DEFAULT '',
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    download_count BIGINT NOT NULL DEFAULT 0,
    created_by BIGINT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT files_object_key_key UNIQUE (object_key),
    CONSTRAINT files_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.users(id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_files_name ON public.files(name);
CREATE INDEX IF NOT EXISTS idx_files_category ON public.files(category);
CREATE INDEX IF NOT EXISTS idx_files_is_public ON public.files(is_public);
CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON public.files(deleted_at);
CREATE INDEX IF NOT EXISTS idx_files_created_by ON public.files(created_by);

CREATE TABLE IF NOT EXISTS public.operation_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(128) NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    ip VARCHAR(64) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT operation_logs_admin_user_id_fkey
        FOREIGN KEY (admin_user_id) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_operation_logs_admin_user_id ON public.operation_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_action ON public.operation_logs(action);
CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON public.operation_logs(created_at);

CREATE TABLE IF NOT EXISTS public.user_favorites (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    file_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_favorites_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id)
        ON DELETE CASCADE,
    CONSTRAINT user_favorites_file_id_fkey
        FOREIGN KEY (file_id) REFERENCES public.files(id)
        ON DELETE CASCADE,
    CONSTRAINT uq_user_favorites_user_file UNIQUE (user_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON public.user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_file_id ON public.user_favorites(file_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_created_at ON public.user_favorites(created_at);

CREATE TABLE IF NOT EXISTS public.user_download_records (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    file_id BIGINT NOT NULL,
    downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_download_records_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id)
        ON DELETE CASCADE,
    CONSTRAINT user_download_records_file_id_fkey
        FOREIGN KEY (file_id) REFERENCES public.files(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_download_records_user_id ON public.user_download_records(user_id);
CREATE INDEX IF NOT EXISTS idx_user_download_records_file_id ON public.user_download_records(file_id);
CREATE INDEX IF NOT EXISTS idx_user_download_records_downloaded_at ON public.user_download_records(downloaded_at);

CREATE TABLE IF NOT EXISTS public.system_settings (
    key VARCHAR(128) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
