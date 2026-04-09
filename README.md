# FluxFiles

FluxFiles is a production-oriented file distribution system built around OSS object storage, PostgreSQL metadata, and a React admin/public frontend.

## Current Capabilities

- Public file browsing, searching, sorting, and signed downloads
- User registration, login, profile management, favorites, and download history
- Direct browser-to-OSS upload flow for admins
- Admin file management
- Admin user management
- Fine-grained admin permissions
- Configurable admin permission templates
- Registration open/close switch
- Structured audit logs for admin operations
- Frontend bilingual UI with manual Chinese/English switching
- Frontend deployment under `/fluxfiles/`

## Tech Stack

- Backend: Go, Gin, GORM, PostgreSQL, Redis
- Frontend: React, TypeScript, Vite, Ant Design, TanStack Query
- Storage: Alibaba Cloud OSS
- Deployment: Docker, Docker Compose, Nginx

## Database

Single source of truth:

- [`deploy/pgsql/public.sql`](D:/workspace/React/WebSite/FluxFiles/deploy/pgsql/public.sql)

Current tables:

- `users`
- `files`
- `operation_logs`
- `user_favorites`
- `user_download_records`
- `system_settings`

Apply schema manually before starting the API:

```bash
psql -U fluxfiles -d fluxfiles -f deploy/pgsql/public.sql
```

## Permission Model

User roles:

- `user`
- `admin`

Admin permissions:

- `admin.files`
- `admin.users`
- `admin.settings`
- `admin.audit`

Notes:

- Admin access is controlled by both `role=admin` and specific permissions
- Backend routes, frontend menus, and admin pages all enforce permission checks
- Permission templates are stored in `system_settings`, not hardcoded as runtime truth

## Core Admin Features

- File management
- User creation and editing
- Role and permission assignment
- Permission template management
- Registration switch management
- Audit log browsing

## Key API Groups

Detailed examples are in [`API.md`](D:/workspace/React/WebSite/FluxFiles/API.md).

- Public:
  - `GET /api/files`
  - `GET /api/files/:id`
  - `GET /api/files/:id/download`
  - `GET /api/auth/register-config`
  - `POST /api/auth/register`
  - `POST /api/auth/login`
- User center:
  - `GET /api/user/me`
  - `PUT /api/user/me`
  - `PUT /api/user/password`
  - `GET /api/user/favorites`
  - `POST /api/user/favorites/:id`
  - `DELETE /api/user/favorites/:id`
  - `GET /api/user/downloads`
- Admin:
  - `POST /api/admin/login`
  - `GET /api/admin/me`
  - `GET /api/admin/stats`
  - `GET /api/admin/files`
  - `POST /api/admin/files/upload-prepare`
  - `POST /api/admin/files`
  - `PUT /api/admin/files/:id`
  - `DELETE /api/admin/files/:id`
  - `GET /api/admin/users`
  - `POST /api/admin/users`
  - `PUT /api/admin/users/:id`
  - `GET /api/admin/settings`
  - `PUT /api/admin/settings/registration`
  - `GET /api/admin/settings/permission-templates`
  - `PUT /api/admin/settings/permission-templates`
  - `GET /api/admin/logs`

## Frontend Routes

Frontend base path:

- `/fluxfiles/`

Important routes:

- `/fluxfiles/`
- `/fluxfiles/login`
- `/fluxfiles/register`
- `/fluxfiles/me`
- `/fluxfiles/admin/`
- `/fluxfiles/admin/files`
- `/fluxfiles/admin/users`
- `/fluxfiles/admin/settings`
- `/fluxfiles/admin/logs`

Notes:

- There is no separate public admin login entry anymore
- Users log in from the normal login page
- Admin entry and admin menu items are shown according to current permissions

## Local Development

Use only dev config for local validation:

- [`.env.dev`](D:/workspace/React/WebSite/FluxFiles/.env.dev)
- [`docker-compose.dev.yml`](D:/workspace/React/WebSite/FluxFiles/docker-compose.dev.yml)

Start:

```bash
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d --build
```

Backend test:

```bash
cd apps/api
go test ./...
```

Frontend build:

```bash
cd apps/web
npm install
npm run build
```

## Deployment Notes

- Deployment guide: [`README-DEPLOY.md`](D:/workspace/React/WebSite/FluxFiles/README-DEPLOY.md)
- Version change log: [`README-DEPLOY-LOG.md`](D:/workspace/React/WebSite/FluxFiles/README-DEPLOY-LOG.md)

## Bootstrap Admin

The first admin account is created only when there is no existing admin user.

- Username source: `ADMIN_BOOTSTRAP_USERNAME`
- Password source: `ADMIN_BOOTSTRAP_PASSWORD`

Change the bootstrap password before production use.
