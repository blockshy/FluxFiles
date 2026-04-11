# FluxFiles API

Base URL: `/api`

## 通用规则

- 公开接口默认不需要登录
- 用户中心接口需要 `Authorization: Bearer <user-jwt>`
- 后台接口需要 `Authorization: Bearer <admin-jwt>`
- 后台接口除了登录态，还会继续校验管理员权限
- 所有受系统设置影响的关键操作都必须以后端校验为准，前端只做体验补充

标准响应：

```json
{
  "success": true,
  "message": "ok",
  "requestId": "uuid",
  "data": {}
}
```

分页响应：

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

## 权限

当前管理员权限值：

- `admin.files.own`
- `admin.files.all`
- `admin.files.upload`
- `admin.files.edit`
- `admin.files.delete`
- `admin.downloads.view`
- `admin.users.create`
- `admin.users.edit`
- `admin.categories.view`
- `admin.categories.create`
- `admin.categories.edit`
- `admin.categories.delete`
- `admin.categories.logs`
- `admin.tags.view`
- `admin.tags.create`
- `admin.tags.edit`
- `admin.tags.delete`
- `admin.tags.logs`
- `admin.settings`
- `admin.audit`

## 公开接口

### `GET /api/files`

公开文件列表。

查询参数：

- `page`
- `pageSize`
- `search`
- `categories`，逗号分隔
- `tags`，逗号分隔
- `sortBy`: `createdAt` | `name` | `size`
- `sortOrder`: `asc` | `desc`

### `GET /api/files/categories/options`

公开文件分类树选项。

### `GET /api/files/tags/options`

公开标签树选项。

### `GET /api/files/download-config`

公开下载配置。

返回示例：

```json
{
  "captchaEnabled": true,
  "guestDownloadAllowed": false
}
```

### `GET /api/files/:id`

公开文件详情。

### `GET /api/files/:id/comments`

获取评论列表或某个主楼下的回复。

查询参数：

- `page`
- `pageSize`
- `rootId`，可选

### `GET /api/files/:id/download`

生成文件临时下载链接。

查询参数：

- `captchaId`，可选
- `captchaAnswer`，可选

说明：

- 若后台开启下载验证码，必须带验证码参数
- 若游客下载被关闭，未登录用户会被拒绝
- 返回的 URL 为阿里云 OSS 临时签名地址

### `GET /api/users/:username/profile`

公开用户主页详情。

说明：

- 当前要求登录后才能访问
- 游客不能直接查看公开用户主页

## 认证接口

### `GET /api/auth/register-config`

获取注册与验证码配置。

返回示例：

```json
{
  "registrationEnabled": true,
  "captcha": {
    "loginEnabled": false,
    "registrationEnabled": true
  }
}
```

### `GET /api/auth/captcha`

获取验证码题目。

### `POST /api/auth/register`

注册普通用户。

请求体：

```json
{
  "username": "demo_user",
  "email": "demo@example.com",
  "displayName": "Demo User",
  "password": "StrongPassword123!",
  "captchaId": "optional",
  "captchaAnswer": "optional"
}
```

### `POST /api/auth/login`

普通用户登录。

请求体：

```json
{
  "username": "demo_user",
  "password": "StrongPassword123!",
  "captchaId": "optional",
  "captchaAnswer": "optional"
}
```

## 用户中心接口

### `GET /api/user/me`

获取当前用户资料。

### `PUT /api/user/me`

更新当前用户资料。

### `PUT /api/user/password`

修改当前用户密码。

### `GET /api/user/favorites`

获取当前用户收藏列表。

### `POST /api/user/favorites/:id`

收藏文件。

### `DELETE /api/user/favorites/:id`

取消收藏文件。

### `GET /api/user/downloads`

获取当前用户下载历史。

查询参数：

- `limit`

### `POST /api/user/files/:id/comments`

发表评论或回复评论。

请求体：

```json
{
  "content": "评论内容",
  "parentId": 123
}
```

### `DELETE /api/user/comments/:id`

删除自己的评论，级联删除其子回复。

### `POST /api/user/comments/:id/vote`

点赞或点踩评论。

请求体：

```json
{
  "value": 1
}
```

`value` 只允许：

- `1`
- `-1`

### `GET /api/user/comments/mine`

获取我的评论记录。

### `GET /api/user/notifications`

获取消息通知列表。

查询参数：

- `page`
- `pageSize`
- `type`

### `POST /api/user/notifications/read-all`

按类型或全部标记已读。

### `POST /api/user/notifications/:id/read`

标记单条通知已读。

## 后台认证接口

### `POST /api/admin/login`

管理员登录。

### `GET /api/admin/me`

获取当前管理员资料和权限。

## 后台文件接口

相关权限：

- 文件范围：`admin.files.own` 或 `admin.files.all`
- 上传：`admin.files.upload`
- 编辑：`admin.files.edit`
- 删除：`admin.files.delete`
- 下载记录：`admin.downloads.view`

### `GET /api/admin/stats`

获取后台文件统计面板数据。

### `GET /api/admin/files`

获取后台文件列表。

### `GET /api/admin/files/upload-settings`

获取上传限制配置。

### `GET /api/admin/files/:id`

获取后台文件详情。

### `POST /api/admin/files/upload-prepare`

准备直传 OSS。

### `POST /api/admin/files`

完成文件元数据创建。

### `PUT /api/admin/files/:id`

更新文件元数据。

### `DELETE /api/admin/files/:id`

物理删除文件。

说明：

- 删除 OSS 对象
- 硬删数据库文件记录
- 清理关联文件通知记录

### `GET /api/admin/files/:id/downloads`

查看某个文件的下载记录。

## 后台下载记录接口

权限：

- `admin.downloads.view`

### `GET /api/admin/downloads`

查看全部文件下载记录。

查询参数：

- `page`
- `pageSize`
- `search`
- `userSearch`
- `ip`
- `authStatus`: `all` | `guest` | `user`
- `startAt`
- `endAt`

## 后台用户接口

权限：

- 创建：`admin.users.create`
- 编辑/启停/删除：`admin.users.edit`

### `GET /api/admin/users`

获取用户列表。

### `POST /api/admin/users`

创建用户。

### `PUT /api/admin/users/:id`

更新用户资料、角色、权限、启用状态。

### `PUT /api/admin/users/:id/enabled`

快捷启用或停用用户。

### `DELETE /api/admin/users/:id`

物理删除用户。

限制：

- 不能删除当前登录管理员
- 不能删除仍有上传文件的用户
- 不能删除仍有关联关键后台记录的用户

## 后台分类接口

权限：

- `admin.categories.view`
- `admin.categories.create`
- `admin.categories.edit`
- `admin.categories.delete`
- `admin.categories.logs`

### `GET /api/admin/categories`

获取分类列表。

### `GET /api/admin/categories/options`

获取分类树选项。

### `POST /api/admin/categories`

创建分类。

### `PUT /api/admin/categories/:id`

更新分类。

### `POST /api/admin/categories/:id/move`

调整分类顺序。

### `DELETE /api/admin/categories/:id`

物理删除分类。

### `GET /api/admin/categories/:id/logs`

获取分类变更记录。

## 后台标签接口

标签接口：

- `GET /api/admin/tags`
- `GET /api/admin/tags/options`
- `POST /api/admin/tags`
- `PUT /api/admin/tags/:id`
- `POST /api/admin/tags/:id/move`
- `DELETE /api/admin/tags/:id`
- `GET /api/admin/tags/:id/logs`

权限：

- `admin.tags.view`
- `admin.tags.create`
- `admin.tags.edit`
- `admin.tags.delete`
- `admin.tags.logs`

## 后台系统设置接口

权限：

- `admin.settings`

### `GET /api/admin/settings`

获取系统设置总览。

当前返回包含：

- `registrationEnabled`
- `guestDownloadAllowed`
- `downloadSettings`
- `captcha`
- `rateLimits`
- `uploadSettings`

### `PUT /api/admin/settings/registration`

更新注册开关。

### `PUT /api/admin/settings/guest-download`

更新游客下载开关。

### `PUT /api/admin/settings/download`

更新下载设置。

字段：

- `guestDownloadAllowed`
- `captchaEnabled`
- `urlExpiresSeconds`

### `PUT /api/admin/settings/captcha`

更新登录/注册验证码设置。

### `PUT /api/admin/settings/rate-limits`

更新限流设置。

说明：

- `login` 和 `list` 已拆分为 `guest` / `authenticated`
- `download` 和 `upload` 为统一规则

### `PUT /api/admin/settings/upload`

更新上传限制。

字段：

- `restrictFileSize`
- `maxSizeBytes`
- `restrictFileTypes`
- `allowedExtensions`
- `allowedMimeTypes`

### `GET /api/admin/settings/permission-templates`

获取权限模板列表。

### `PUT /api/admin/settings/permission-templates`

更新权限模板列表。

## 后台审计接口

权限：

- `admin.audit`

### `GET /api/admin/logs`

获取后台操作日志。
