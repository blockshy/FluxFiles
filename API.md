# FluxFiles API

Base URL: `/api`

## Common Rules

- Public file APIs do not require authentication
- User center APIs require `Authorization: Bearer <user-jwt>`
- Admin APIs require `Authorization: Bearer <admin-jwt>`
- Admin APIs may still return `403` if the user lacks the required permission

Standard response envelope:

```json
{
  "success": true,
  "message": "ok",
  "requestId": "uuid",
  "data": {}
}
```

Paginated response:

```json
{
  "success": true,
  "message": "ok",
  "requestId": "uuid",
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 0,
      "totalPages": 0
    }
  }
}
```

## Authentication and Roles

Roles:

- `user`
- `admin`

Admin permissions:

- `admin.files`
- `admin.users`
- `admin.settings`
- `admin.audit`

Login payload user object now includes `permissions`.

Example:

```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@local.fluxfiles",
  "displayName": "admin",
  "role": "admin",
  "permissions": ["admin.files", "admin.users", "admin.settings", "admin.audit"],
  "isEnabled": true,
  "createdAt": "2026-04-09T12:00:00Z",
  "updatedAt": "2026-04-09T12:00:00Z"
}
```

## Public APIs

### `GET /api/files`

Public file list.

Query params:

- `page`
- `pageSize`
- `search`
- `sortBy`: `createdAt` | `name` | `size`
- `sortOrder`: `asc` | `desc`

### `GET /api/files/:id`

Public file detail.

### `GET /api/files/:id/download`

Return signed temporary download URL.

### `GET /api/auth/register-config`

Get current registration switch.

Response:

```json
{
  "registrationEnabled": true
}
```

### `POST /api/auth/register`

Register a normal user.

### `POST /api/auth/login`

Unified login for normal users and admins.

## User Center APIs

### `GET /api/user/me`

Current user profile.

### `PUT /api/user/me`

Update current user profile.

### `PUT /api/user/password`

Change current user password.

### `GET /api/user/favorites`

Current user favorite files.

### `POST /api/user/favorites/:id`

Add favorite.

### `DELETE /api/user/favorites/:id`

Remove favorite.

### `GET /api/user/downloads`

Current user download history.

## Admin Auth APIs

### `POST /api/admin/login`

Admin-only login endpoint.

### `GET /api/admin/me`

Current admin identity and permissions.

## Admin File APIs

Required permission:

- `admin.files`

### `GET /api/admin/stats`

Dashboard stats.

### `GET /api/admin/files`

Admin file list.

### `GET /api/admin/files/:id`

Admin file detail.

### `POST /api/admin/files/upload-prepare`

Prepare direct-to-OSS upload.

### `POST /api/admin/files`

Finalize upload and create metadata.

### `PUT /api/admin/files/:id`

Update file metadata.

### `DELETE /api/admin/files/:id`

Soft-delete file metadata. OSS deletion depends on `OSS_DELETE_MODE`.

## Admin User APIs

Required permission:

- `admin.users`

### `GET /api/admin/users`

List users.

Query params:

- `page`
- `pageSize`
- `search`

### `POST /api/admin/users`

Create user.

Request body:

```json
{
  "username": "ops_admin",
  "email": "ops@example.com",
  "displayName": "Ops Admin",
  "password": "ChangeThisStrongPassword123!",
  "role": "admin",
  "permissions": ["admin.files", "admin.audit"],
  "isEnabled": true
}
```

### `PUT /api/admin/users/:id`

Update user role, permissions, profile fields, and enabled status.

Request body:

```json
{
  "email": "ops@example.com",
  "displayName": "Ops Admin",
  "role": "admin",
  "permissions": ["admin.files", "admin.audit"],
  "isEnabled": true
}
```

## Admin Settings APIs

Required permission:

- `admin.settings`

### `GET /api/admin/settings`

Get current registration setting.

### `PUT /api/admin/settings/registration`

Update registration switch.

Request body:

```json
{
  "registrationEnabled": false
}
```

### `GET /api/admin/settings/permission-templates`

Get configurable admin permission templates.

Response:

```json
{
  "templates": [
    {
      "key": "ops_admin",
      "name": "Ops Admin",
      "description": "Manage files and view audit logs",
      "permissions": ["admin.files", "admin.audit"]
    }
  ]
}
```

### `PUT /api/admin/settings/permission-templates`

Replace current permission templates.

Request body:

```json
{
  "templates": [
    {
      "key": "ops_admin",
      "name": "Ops Admin",
      "description": "Manage files and view audit logs",
      "permissions": ["admin.files", "admin.audit"]
    },
    {
      "key": "user_admin",
      "name": "User Admin",
      "description": "Manage users and view audit logs",
      "permissions": ["admin.users", "admin.audit"]
    }
  ]
}
```

## Admin Audit APIs

Required permission:

- `admin.audit`

### `GET /api/admin/logs`

List admin operation logs.

Query params:

- `page`
- `pageSize`
- `search`
- `action`
- `targetType`

Response item example:

```json
{
  "id": 12,
  "adminUserId": 1,
  "adminUsername": "admin",
  "action": "user.update",
  "targetType": "user",
  "targetId": "5",
  "detail": "{\"summary\":\"Updated user\",\"changes\":[{\"field\":\"permissions\",\"label\":\"Permissions\",\"before\":[\"admin.files\"],\"after\":[\"admin.files\",\"admin.audit\"]}]}",
  "ip": "127.0.0.1",
  "createdAt": "2026-04-09T12:34:56Z"
}
```

Structured `detail` format:

```json
{
  "summary": "Updated user",
  "changes": [
    {
      "field": "permissions",
      "label": "Permissions",
      "before": ["admin.files"],
      "after": ["admin.files", "admin.audit"]
    }
  ],
  "meta": {}
}
```

## Upload Flow

1. `POST /api/admin/files/upload-prepare`
2. Browser uploads file directly to returned OSS URL with `PUT`
3. `POST /api/admin/files`
4. Refresh list

## Rate-Limited Endpoints

- `POST /api/auth/login`
- `POST /api/admin/login`
- `POST /api/admin/files/upload-prepare`
- `POST /api/admin/files`
- `GET /api/files`
- `GET /api/files/:id/download`
