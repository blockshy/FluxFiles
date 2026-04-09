# FluxFiles API 文档

本文档基于当前项目实现整理，覆盖请求方式、路径、鉴权、参数、返回结构和常见状态码。

## 基础信息

- Base URL：`/api`
- 鉴权方式：管理员接口使用 `Authorization: Bearer <JWT>`
- 数据格式：
  - 普通请求：`application/json`
  - 上传流程：
    - `upload-prepare`：JSON
    - 浏览器直传 OSS：`PUT` 到 OSS 临时 URL
    - 完成入库：JSON

## 统一响应结构

```json
{
  "success": true,
  "message": "ok",
  "requestId": "uuid",
  "data": {}
}
```

分页接口的 `data` 结构：

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 0
  }
}
```

## 鉴权说明

无需登录：

- `GET /api/files`
- `GET /api/files/:id`
- `GET /api/files/:id/download`

需要管理员 JWT：

- `POST /api/admin/login`
- `GET /api/admin/me`
- `GET /api/admin/stats`
- `GET /api/admin/files`
- `GET /api/admin/files/:id`
- `POST /api/admin/files/upload-prepare`
- `POST /api/admin/files`
- `PUT /api/admin/files/:id`
- `DELETE /api/admin/files/:id`

---

## 1. 管理员登录

`POST /api/admin/login`

请求头：

```http
Content-Type: application/json
```

请求体：

```json
{
  "username": "admin",
  "password": "your-password"
}
```

字段说明：

- `username`：必填，3-64 字符
- `password`：必填，8-128 字符

成功响应：

```json
{
  "success": true,
  "message": "login successful",
  "requestId": "xxx",
  "data": {
    "token": "jwt-token",
    "expiresAt": "2026-04-10T12:00:00Z",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin",
      "createdAt": "2026-04-09T12:00:00Z",
      "updatedAt": "2026-04-09T12:00:00Z"
    }
  }
}
```

常见状态码：

- `200`：登录成功
- `400`：请求体格式错误
- `401`：账号或密码错误
- `429`：登录失败过多或触发限流
- `503`：认证依赖异常

---

## 2. 获取当前管理员信息

`GET /api/admin/me`

请求头：

```http
Authorization: Bearer <JWT>
```

成功响应：

```json
{
  "success": true,
  "message": "ok",
  "requestId": "xxx",
  "data": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

常见状态码：

- `200`
- `401`：Token 缺失、无效或过期
- `403`：非管理员

---

## 3. 管理后台统计

`GET /api/admin/stats`

请求头：

```http
Authorization: Bearer <JWT>
```

成功响应：

```json
{
  "success": true,
  "message": "ok",
  "requestId": "xxx",
  "data": {
    "totalFiles": 12,
    "publicFiles": 10,
    "totalDownloads": 208,
    "totalStorage": 104857600
  }
}
```

字段说明：

- `totalFiles`：文件总数
- `publicFiles`：公开文件数
- `totalDownloads`：累计下载次数
- `totalStorage`：总存储字节数

常见状态码：

- `200`
- `401`
- `403`
- `503`

---

## 4. 管理员文件列表

`GET /api/admin/files`

请求头：

```http
Authorization: Bearer <JWT>
```

查询参数：

- `page`：页码，默认 `1`
- `pageSize`：每页数量，默认 `10`，最大 `100`
- `search`：搜索关键词，匹配 `name/original_name/description/category`
- `sortBy`：排序字段，可选：
  - `createdAt`
  - `name`
  - `downloadCount`
  - `size`
- `sortOrder`：排序方向，可选：
  - `asc`
  - `desc`

示例：

```http
GET /api/admin/files?page=1&pageSize=10&search=manual&sortBy=createdAt&sortOrder=desc
```

成功响应：

```json
{
  "success": true,
  "message": "ok",
  "requestId": "xxx",
  "data": {
    "items": [
      {
        "id": 1,
        "name": "产品手册",
        "originalName": "manual.pdf",
        "objectKey": "fluxfiles/2026/04/09/manual-uuid.pdf",
        "size": 102400,
        "mimeType": "application/pdf",
        "description": "2026 版本",
        "category": "文档",
        "tags": ["手册", "产品"],
        "isPublic": true,
        "downloadCount": 12,
        "createdBy": 1,
        "createdAt": "2026-04-09T12:00:00Z",
        "updatedAt": "2026-04-09T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 1
    }
  }
}
```

常见状态码：

- `200`
- `401`
- `403`
- `429`
- `503`

---

## 5. 获取管理员可见的单个文件详情

`GET /api/admin/files/:id`

请求头：

```http
Authorization: Bearer <JWT>
```

路径参数：

- `id`：文件 ID

成功响应：

- `data` 为单个文件对象，结构同列表项

常见状态码：

- `200`
- `401`
- `403`
- `404`
- `503`

---

## 6. 申请 OSS 直传签名

`POST /api/admin/files/upload-prepare`

请求头：

```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

请求体：

```json
{
  "originalName": "manual.pdf",
  "size": 102400,
  "mimeType": "application/pdf"
}
```

字段说明：

- `originalName`：原始文件名，必填
- `size`：文件大小，单位字节，必填，必须大于 0
- `mimeType`：文件 MIME，前端建议传浏览器识别值；后端会结合扩展名做兼容推断

成功响应：

```json
{
  "success": true,
  "message": "upload prepared",
  "requestId": "xxx",
  "data": {
    "objectKey": "fluxfiles/2026/04/09/manual-uuid.pdf",
    "uploadUrl": "https://your-bucket.oss-cn-hangzhou.aliyuncs.com/...",
    "method": "PUT",
    "headers": {
      "Content-Type": "application/pdf"
    },
    "expiresAt": "2026-04-09T12:10:00Z"
  }
}
```

字段说明：

- `objectKey`：OSS 对象 Key，后续完成入库时需要回传
- `uploadUrl`：直传 OSS 的临时 URL
- `method`：通常为 `PUT`
- `headers`：上传时必须附带的签名头
- `expiresAt`：签名过期时间

常见状态码：

- `200`
- `400`：文件扩展名、MIME、大小不合法
- `401`
- `403`
- `429`
- `503`

说明：

- 该接口只负责生成上传会话，不会写数据库
- 前端拿到结果后应直接向 `uploadUrl` 发 `PUT`

---

## 7. 浏览器直传 OSS

这一步不是站内 API，而是前端直接请求阿里云 OSS。

请求方式：

- `PUT <uploadUrl>`

请求头：

- 使用 `upload-prepare` 返回的 `headers`
- 一般至少包含 `Content-Type`

请求体：

- 文件二进制内容

成功条件：

- OSS 返回 `200` 或 `204`

注意：

- Bucket 必须配置 CORS
- 如果这里失败但 `upload-prepare` 成功，优先排查 OSS CORS 和签名过期

---

## 8. 完成上传并写入数据库

`POST /api/admin/files`

请求头：

```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

请求体：

```json
{
  "objectKey": "fluxfiles/2026/04/09/manual-uuid.pdf",
  "originalName": "manual.pdf",
  "name": "产品手册",
  "description": "2026 版本",
  "category": "文档",
  "tags": ["手册", "产品"],
  "isPublic": true
}
```

字段说明：

- `objectKey`：必填，来自 `upload-prepare`
- `originalName`：必填，原始文件名
- `name`：必填，展示名
- `description`：选填
- `category`：选填
- `tags`：选填，字符串数组
- `isPublic`：必填，是否公开

后端行为：

- 调 OSS `HeadObject`
- 校验对象存在
- 校验大小、扩展名、MIME
- 写入数据库
- 记录操作日志

成功响应：

```json
{
  "success": true,
  "message": "file uploaded",
  "requestId": "xxx",
  "data": {
    "id": 1,
    "name": "产品手册",
    "originalName": "manual.pdf",
    "objectKey": "fluxfiles/2026/04/09/manual-uuid.pdf",
    "size": 102400,
    "mimeType": "application/pdf",
    "description": "2026 版本",
    "category": "文档",
    "tags": ["手册", "产品"],
    "isPublic": true,
    "downloadCount": 0,
    "createdBy": 1,
    "createdAt": "2026-04-09T12:00:00Z",
    "updatedAt": "2026-04-09T12:00:00Z"
  }
}
```

常见状态码：

- `201`
- `400`：参数错误或 OSS 对象校验失败
- `401`
- `403`
- `429`
- `503`

---

## 9. 更新文件信息

`PUT /api/admin/files/:id`

请求头：

```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

路径参数：

- `id`：文件 ID

请求体：

```json
{
  "name": "新版产品手册",
  "description": "2026 Q2 更新版",
  "category": "文档",
  "tags": ["手册", "更新"],
  "isPublic": true
}
```

字段说明：

- `name`：必填
- `description`：选填
- `category`：选填
- `tags`：选填
- `isPublic`：必填

成功响应：

- `data` 为更新后的文件对象

常见状态码：

- `200`
- `400`
- `401`
- `403`
- `404`
- `503`

---

## 10. 删除文件

`DELETE /api/admin/files/:id`

请求头：

```http
Authorization: Bearer <JWT>
```

路径参数：

- `id`：文件 ID

成功响应：

```json
{
  "success": true,
  "message": "file deleted",
  "requestId": "xxx"
}
```

说明：

- 如果 `OSS_DELETE_MODE=sync`，会同步删除 OSS 对象
- 数据库侧为软删除

常见状态码：

- `200`
- `401`
- `403`
- `404`
- `503`

---

## 11. 公共文件列表

`GET /api/files`

无需鉴权。

查询参数：

- `page`：默认 `1`
- `pageSize`：默认 `10`
- `search`：按名称、原始名、描述、分类模糊搜索
- `sortBy`：
  - `createdAt`
  - `name`
  - `downloadCount`
  - `size`
- `sortOrder`：
  - `asc`
  - `desc`

示例：

```http
GET /api/files?page=1&pageSize=10&search=manual&sortBy=createdAt&sortOrder=desc
```

返回：

- 仅公开文件
- 分页结构同管理员列表

常见状态码：

- `200`
- `429`
- `503`

---

## 12. 公共文件详情

`GET /api/files/:id`

无需鉴权。

路径参数：

- `id`：文件 ID

成功响应：

- `data` 为公开文件对象

常见状态码：

- `200`
- `404`
- `503`

---

## 13. 获取公共下载链接

`GET /api/files/:id/download`

无需鉴权。

路径参数：

- `id`：文件 ID

成功响应：

```json
{
  "success": true,
  "message": "download url generated",
  "requestId": "xxx",
  "data": {
    "url": "https://your-bucket.oss-cn-hangzhou.aliyuncs.com/...",
    "expiresAt": "2026-04-09T12:10:00Z"
  }
}
```

后端行为：

- 检查文件是否公开
- 生成 OSS 临时签名下载 URL
- 下载次数自增

常见状态码：

- `200`
- `404`
- `429`
- `503`

---

## 14. 健康检查

`GET /healthz`

无需鉴权。

成功响应：

```json
{
  "status": "ok"
}
```

状态码：

- `200`

---

## 15. 常见错误码汇总

- `200`：成功
- `201`：创建成功
- `400`：参数不合法、上传类型不允许、大小超限、对象校验失败
- `401`：未登录、Token 无效或过期
- `403`：无管理员权限
- `404`：文件不存在
- `429`：触发限流
- `503`：数据库、Redis、OSS 等依赖异常

---

## 16. 上传流程时序建议

管理员上传文件的正确前端流程：

1. 调 `POST /api/admin/files/upload-prepare`
2. 拿到 `uploadUrl`、`objectKey`、`headers`
3. 直接 `PUT` 文件到 OSS
4. 成功后调 `POST /api/admin/files`
5. 刷新后台列表

如果第 1 步失败：

- 查看返回 `message`
- 大概率是扩展名、MIME、大小问题

如果第 3 步失败：

- 大概率是 OSS CORS、签名过期、Bucket 权限问题

如果第 4 步失败：

- 大概率是 OSS 对象未成功上传，或后端 `HeadObject` 校验失败
