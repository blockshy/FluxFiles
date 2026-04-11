-- FluxFiles latest PostgreSQL schema
-- Apply this file to create the current target database structure.

BEGIN;

CREATE SCHEMA IF NOT EXISTS public;

CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    email VARCHAR(128) NOT NULL,
    display_name VARCHAR(128) NOT NULL,
    avatar_url TEXT NOT NULL DEFAULT '',
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

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';

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

CREATE TABLE IF NOT EXISTS public.categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    parent_id BIGINT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT categories_name_key UNIQUE (name),
    CONSTRAINT categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id),
    CONSTRAINT categories_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id)
);

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS parent_id BIGINT NULL;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'categories_parent_id_fkey'
    ) THEN
        ALTER TABLE public.categories
            ADD CONSTRAINT categories_parent_id_fkey
            FOREIGN KEY (parent_id) REFERENCES public.categories(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_categories_deleted_at ON public.categories(deleted_at);
CREATE INDEX IF NOT EXISTS idx_categories_created_by ON public.categories(created_by);
CREATE INDEX IF NOT EXISTS idx_categories_updated_by ON public.categories(updated_by);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON public.categories(parent_id, sort_order);

CREATE TABLE IF NOT EXISTS public.tags (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    parent_id BIGINT NULL,
    category_id BIGINT NULL,
    tag_category_id BIGINT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT tags_name_key UNIQUE (name),
    CONSTRAINT tags_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id),
    CONSTRAINT tags_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id)
);

ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS parent_id BIGINT NULL;
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS category_id BIGINT NULL;
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS tag_category_id BIGINT NULL;
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tags_parent_id_fkey'
    ) THEN
        ALTER TABLE public.tags
            ADD CONSTRAINT tags_parent_id_fkey
            FOREIGN KEY (parent_id) REFERENCES public.tags(id)
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tags_category_id_fkey'
    ) THEN
        ALTER TABLE public.tags
            ADD CONSTRAINT tags_category_id_fkey
            FOREIGN KEY (category_id) REFERENCES public.categories(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tags_deleted_at ON public.tags(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tags_created_by ON public.tags(created_by);
CREATE INDEX IF NOT EXISTS idx_tags_updated_by ON public.tags(updated_by);
CREATE INDEX IF NOT EXISTS idx_tags_parent_id ON public.tags(parent_id);
CREATE INDEX IF NOT EXISTS idx_tags_parent_sort_order ON public.tags(parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_tags_category_id ON public.tags(category_id);
CREATE INDEX IF NOT EXISTS idx_tags_tag_category_id ON public.tags(tag_category_id);
CREATE INDEX IF NOT EXISTS idx_tags_sort_order ON public.tags(category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_tags_tag_category_sort_order ON public.tags(tag_category_id, sort_order);

DO $$
DECLARE
    fallback_user_id BIGINT;
    default_category_id BIGINT;
    tag_category_row RECORD;
    mapped_parent_tag_id BIGINT;
BEGIN
    SELECT id
    INTO fallback_user_id
    FROM public.users
    WHERE deleted_at IS NULL
    ORDER BY id
    LIMIT 1;

    IF fallback_user_id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.categories (name, parent_id, created_by, updated_by, created_at, updated_at)
    VALUES ('默认分类', NULL, fallback_user_id, fallback_user_id, NOW(), NOW())
    ON CONFLICT (name) DO NOTHING;

    SELECT id
    INTO default_category_id
    FROM public.categories
    WHERE name = '默认分类' AND deleted_at IS NULL
    ORDER BY id
    LIMIT 1;

    IF default_category_id IS NOT NULL THEN
        UPDATE public.tags
        SET category_id = default_category_id,
            updated_by = COALESCE(updated_by, fallback_user_id),
            updated_at = NOW()
        WHERE category_id IS NULL;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'tag_categories'
    ) THEN
        FOR tag_category_row IN
            WITH RECURSIVE tag_category_tree AS (
                SELECT tc.id, tc.name, tc.parent_id, tc.sort_order, tc.created_by, tc.updated_by, tc.created_at, tc.updated_at, 0 AS depth
                FROM public.tag_categories tc
                WHERE tc.parent_id IS NULL AND tc.deleted_at IS NULL
                UNION ALL
                SELECT tc.id, tc.name, tc.parent_id, tc.sort_order, tc.created_by, tc.updated_by, tc.created_at, tc.updated_at, tag_category_tree.depth + 1
                FROM public.tag_categories tc
                INNER JOIN tag_category_tree ON tag_category_tree.id = tc.parent_id
                WHERE tc.deleted_at IS NULL
            )
            SELECT tag_category_tree.*, parent.name AS parent_name
            FROM tag_category_tree
            LEFT JOIN public.tag_categories parent ON parent.id = tag_category_tree.parent_id
            ORDER BY tag_category_tree.depth, tag_category_tree.sort_order, tag_category_tree.created_at, tag_category_tree.id
        LOOP
            mapped_parent_tag_id := NULL;
            IF tag_category_row.parent_name IS NOT NULL THEN
                SELECT id
                INTO mapped_parent_tag_id
                FROM public.tags
                WHERE name = tag_category_row.parent_name AND deleted_at IS NULL
                ORDER BY id
                LIMIT 1;
            END IF;

            INSERT INTO public.tags (name, parent_id, sort_order, created_by, updated_by, created_at, updated_at)
            VALUES (
                tag_category_row.name,
                mapped_parent_tag_id,
                COALESCE(tag_category_row.sort_order, 0),
                COALESCE(tag_category_row.created_by, fallback_user_id),
                COALESCE(tag_category_row.updated_by, fallback_user_id),
                COALESCE(tag_category_row.created_at, NOW()),
                COALESCE(tag_category_row.updated_at, NOW())
            )
            ON CONFLICT (name) DO NOTHING;
        END LOOP;

        UPDATE public.tags AS tags
        SET parent_id = parent_tags.id,
            updated_by = COALESCE(tags.updated_by, fallback_user_id),
            updated_at = NOW()
        FROM public.tag_categories legacy_categories
        INNER JOIN public.tags parent_tags ON parent_tags.name = legacy_categories.name AND parent_tags.deleted_at IS NULL
        WHERE tags.tag_category_id = legacy_categories.id
          AND tags.deleted_at IS NULL
          AND tags.parent_id IS NULL;
    END IF;
END $$;

WITH ordered_categories AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY parent_id ORDER BY created_at, id) AS seq
    FROM public.categories
    WHERE deleted_at IS NULL
)
UPDATE public.categories AS categories
SET sort_order = ordered_categories.seq
FROM ordered_categories
WHERE categories.id = ordered_categories.id
  AND (categories.sort_order IS NULL OR categories.sort_order = 0);

WITH ordered_tags AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY parent_id ORDER BY sort_order, created_at, id) AS seq
    FROM public.tags
    WHERE deleted_at IS NULL
)
UPDATE public.tags AS tags
SET sort_order = ordered_tags.seq
FROM ordered_tags
WHERE tags.id = ordered_tags.id
  AND (tags.sort_order IS NULL OR tags.sort_order = 0);

ALTER TABLE public.tags DROP CONSTRAINT IF EXISTS tags_tag_category_id_fkey;
ALTER TABLE public.tags DROP CONSTRAINT IF EXISTS tags_category_id_fkey;
DROP INDEX IF EXISTS idx_tags_category_id;
DROP INDEX IF EXISTS idx_tags_tag_category_id;
DROP INDEX IF EXISTS idx_tags_sort_order;
DROP INDEX IF EXISTS idx_tags_tag_category_sort_order;
ALTER TABLE public.tags DROP COLUMN IF EXISTS category_id;
ALTER TABLE public.tags DROP COLUMN IF EXISTS tag_category_id;

DROP TABLE IF EXISTS public.tag_categories;

CREATE TABLE IF NOT EXISTS public.taxonomy_change_logs (
    id BIGSERIAL PRIMARY KEY,
    taxonomy_type VARCHAR(32) NOT NULL,
    taxonomy_id BIGINT NOT NULL,
    action VARCHAR(32) NOT NULL,
    before_data TEXT NOT NULL DEFAULT '',
    after_data TEXT NOT NULL DEFAULT '',
    admin_user_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT taxonomy_change_logs_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_change_logs_type_id ON public.taxonomy_change_logs(taxonomy_type, taxonomy_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_change_logs_admin_user_id ON public.taxonomy_change_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_change_logs_created_at ON public.taxonomy_change_logs(created_at);

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
    user_id BIGINT NULL,
    file_id BIGINT NOT NULL,
    ip VARCHAR(64) NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_download_records_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id)
        ON DELETE CASCADE,
    CONSTRAINT user_download_records_file_id_fkey
        FOREIGN KEY (file_id) REFERENCES public.files(id)
        ON DELETE CASCADE
);

ALTER TABLE public.user_download_records ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.user_download_records ADD COLUMN IF NOT EXISTS ip VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE public.user_download_records ADD COLUMN IF NOT EXISTS user_agent TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_user_download_records_user_id ON public.user_download_records(user_id);
CREATE INDEX IF NOT EXISTS idx_user_download_records_file_id ON public.user_download_records(file_id);
CREATE INDEX IF NOT EXISTS idx_user_download_records_ip ON public.user_download_records(ip);
CREATE INDEX IF NOT EXISTS idx_user_download_records_downloaded_at ON public.user_download_records(downloaded_at);

UPDATE public.users
SET permissions = permissions || '["admin.downloads.view"]'::jsonb
WHERE role = 'admin'
  AND permissions ? 'admin.files.all'
  AND NOT permissions ? 'admin.downloads.view';

CREATE TABLE IF NOT EXISTS public.file_comments (
    id BIGSERIAL PRIMARY KEY,
    file_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    parent_id BIGINT NULL,
    root_id BIGINT NULL,
    content TEXT NOT NULL,
    like_count BIGINT NOT NULL DEFAULT 0,
    dislike_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT file_comments_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE,
    CONSTRAINT file_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT file_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.file_comments(id) ON DELETE CASCADE,
    CONSTRAINT file_comments_root_id_fkey FOREIGN KEY (root_id) REFERENCES public.file_comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_file_comments_file_id ON public.file_comments(file_id);
CREATE INDEX IF NOT EXISTS idx_file_comments_user_id ON public.file_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_file_comments_parent_id ON public.file_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_file_comments_root_id ON public.file_comments(root_id);
CREATE INDEX IF NOT EXISTS idx_file_comments_deleted_at ON public.file_comments(deleted_at);
CREATE INDEX IF NOT EXISTS idx_file_comments_created_at ON public.file_comments(created_at);

CREATE TABLE IF NOT EXISTS public.comment_votes (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT comment_votes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.file_comments(id) ON DELETE CASCADE,
    CONSTRAINT comment_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT uq_comment_votes_comment_user UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_votes_comment_id ON public.comment_votes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_votes_user_id ON public.comment_votes(user_id);

CREATE TABLE IF NOT EXISTS public.user_notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    actor_user_id BIGINT NULL,
    type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT user_notifications_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON public.user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_actor_user_id ON public.user_notifications(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON public.user_notifications(type);
CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON public.user_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON public.user_notifications(created_at);

CREATE TABLE IF NOT EXISTS public.community_posts (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content_html TEXT NOT NULL,
    content_text TEXT NOT NULL DEFAULT '',
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    view_count BIGINT NOT NULL DEFAULT 0,
    last_replied_at TIMESTAMPTZ NULL,
    author_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT community_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_community_posts_author_id ON public.community_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_is_pinned ON public.community_posts(is_pinned);
CREATE INDEX IF NOT EXISTS idx_community_posts_is_locked ON public.community_posts(is_locked);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON public.community_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_community_posts_last_replied_at ON public.community_posts(last_replied_at);
CREATE INDEX IF NOT EXISTS idx_community_posts_deleted_at ON public.community_posts(deleted_at);

CREATE TABLE IF NOT EXISTS public.community_replies (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    parent_id BIGINT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT community_replies_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.community_posts(id) ON DELETE CASCADE,
    CONSTRAINT community_replies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT community_replies_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.community_replies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_community_replies_post_id ON public.community_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_community_replies_user_id ON public.community_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_community_replies_parent_id ON public.community_replies(parent_id);
CREATE INDEX IF NOT EXISTS idx_community_replies_created_at ON public.community_replies(created_at);
CREATE INDEX IF NOT EXISTS idx_community_replies_deleted_at ON public.community_replies(deleted_at);

UPDATE public.users
SET permissions = permissions || '["admin.community.view","admin.community.moderate"]'::jsonb
WHERE role = 'admin'
  AND permissions ? 'admin.files.all'
  AND NOT permissions ? 'admin.community.view';

UPDATE public.users
SET permissions = '[
  "public.files.view",
  "public.files.detail",
  "public.files.download",
  "public.files.favorite",
  "public.comments.create",
  "public.comments.reply",
  "public.comments.vote",
  "public.comments.delete_own",
  "public.community.view",
  "public.community.post.create",
  "public.community.post.edit_own",
  "public.community.post.delete_own",
  "public.community.reply.create",
  "public.community.reply.delete_own",
  "public.profile.view_own",
  "public.profile.edit_own",
  "public.profile.view_public",
  "public.notifications.view"
]'::jsonb
WHERE role = 'user'
  AND (permissions IS NULL OR permissions = '[]'::jsonb);

UPDATE public.users
SET permissions = permissions || '[
  "public.files.view",
  "public.files.detail",
  "public.files.download",
  "public.files.favorite",
  "public.comments.create",
  "public.comments.reply",
  "public.comments.vote",
  "public.comments.delete_own",
  "public.community.view",
  "public.community.post.create",
  "public.community.post.edit_own",
  "public.community.post.delete_own",
  "public.community.reply.create",
  "public.community.reply.delete_own",
  "public.profile.view_own",
  "public.profile.edit_own",
  "public.profile.view_public",
  "public.notifications.view"
]'::jsonb
WHERE role = 'admin'
  AND NOT permissions ? 'public.files.view';

CREATE TABLE IF NOT EXISTS public.system_settings (
    key VARCHAR(128) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
