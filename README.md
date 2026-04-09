# FluxFiles

FluxFiles 是一个面向公开用户的文件查询与分发网站，采用 `Go + Gin + GORM + PostgreSQL + Redis + React + Ant Design + Nginx + Docker Compose` 实现，文件实体存储在阿里云 OSS，数据库只保存元数据。

## 1. 技术选型说明

### 后端
- `Go 1.23 + Gin`：成熟、性能稳定、适合高并发 API 场景。
- `GORM + PostgreSQL`：兼顾开发效率与生产可维护性。
- `Redis`：用于分布式限流、登录失败计数和降级兜底。
- `Alibaba Cloud OSS Go SDK V2`：对接 OSS 上传、删除和签名下载。
- `gobreaker`：为 OSS/数据库访问提供熔断能力。

### 前端
- `React + TypeScript + Vite`：构建快、结构清晰，适合中小型生产后台。
- `Ant Design`：企业级组件成熟，表格、表单、后台布局能力完整。
- `TanStack Query + Axios`：请求封装与缓存清晰，便于扩展。

### 部署
- `Docker Compose`：一键启动 `web + api + postgres + redis`。
- `Nginx`：托管前端静态资源并反代 `/api` 到后端。

## 2. 项目整体架构

### 架构分层
- 前端：公共站点、管理员登录、管理员文件管理共用一套路由和请求层。
- 后端：`controller -> service -> repository -> model` 分层，配置、日志、中间件和基础组件独立。
- 存储：文件内容仅进入 OSS；数据库只保存元数据、统计信息和操作日志。
- 安全保护：JWT 鉴权、bcrypt 密码哈希、Redis 限流、登录失败封禁、OSS/DB 熔断、IP 黑名单、上传白名单控制。

### 核心流程
1. 管理员登录后获取 JWT。
2. 管理员上传时，后端先签发 OSS 临时上传 URL。
3. 前端拿到签名 URL 后直接将文件 PUT 到 OSS。
4. 上传完成后由后端校验对象并写入 PostgreSQL 文件元数据。
5. 公共用户查询文件列表时只访问数据库元数据。
6. 下载时后端按文件 ID 生成 OSS 临时签名 URL，再返回给前端跳转下载。

## 3. 项目目录结构

```text
FluxFiles/
├─ apps/
│  ├─ api/
│  │  ├─ cmd/server
│  │  ├─ internal/
│  │  │  ├─ app
│  │  │  ├─ config
│  │  │  ├─ controller
│  │  │  ├─ dto
│  │  │  ├─ middleware
│  │  │  ├─ model
│  │  │  ├─ repository
│  │  │  ├─ router
│  │  │  └─ service
│  │  ├─ migrations
│  │  └─ pkg/
│  │     ├─ auth
│  │     ├─ logger
│  │     ├─ oss
│  │     ├─ resilience
│  │     ├─ response
│  │     └─ validator
│  └─ web/
│     ├─ src/
│     │  ├─ api
│     │  ├─ components
│     │  ├─ features
│     │  ├─ layouts
│     │  ├─ lib
│     │  ├─ pages
│     │  ├─ router
│     │  └─ styles
├─ deploy/nginx
├─ docker-compose.yml
├─ .env.example
└─ README.md
```

## 4. 数据库设计

### users

```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
```

### files

```sql
CREATE TABLE files (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    object_key VARCHAR(512) NOT NULL UNIQUE,
    size BIGINT NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    description TEXT,
    category VARCHAR(128),
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    download_count BIGINT NOT NULL DEFAULT 0,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
```

### operation_logs

```sql
CREATE TABLE operation_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id BIGINT NOT NULL REFERENCES users(id),
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(128) NOT NULL,
    detail TEXT,
    ip VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

完整 SQL 见 `apps/api/migrations/001_init.sql`。

## 5. 后端核心说明

### 主要 API

#### 公共接口
- `GET /api/files`
- `GET /api/files/:id`
- `GET /api/files/:id/download`

#### 管理员接口
- `POST /api/admin/login`
- `GET /api/admin/me`
- `GET /api/admin/stats`
- `GET /api/admin/files`
- `GET /api/admin/files/:id`
- `POST /api/admin/files/upload-prepare`
- `POST /api/admin/files`
- `PUT /api/admin/files/:id`
- `DELETE /api/admin/files/:id`

### 统一返回结构

```json
{
  "success": true,
  "message": "ok",
  "requestId": "uuid",
  "data": {}
}
```

### 核心实现点
- JWT 鉴权：`apps/api/pkg/auth/jwt.go`
- 限流：`apps/api/pkg/resilience/rate_limiter.go`
- 熔断：`apps/api/pkg/resilience/breaker.go`
- OSS 封装：`apps/api/pkg/oss/client.go`
- 上传验证：`apps/api/pkg/validator/file.go`
- 业务服务：`apps/api/internal/service/*.go`

## 6. 前端核心说明

### 页面
- `/`：公共文件列表页，支持搜索、排序、分页、下载。
- `/admin/login`：管理员登录页。
- `/admin/files`：管理员文件管理台，支持统计、上传、编辑、删除。

### 前端特性
- React Query 统一管理列表/统计请求和刷新。
- Axios 自动注入 JWT，后台 401 时自动清理会话。
- 上传弹窗支持 Drag & Drop，上传流程为“申请签名 URL -> 浏览器直传 OSS -> 回调后端入库”。
- 直传模式要求 OSS Bucket 正确配置 CORS，允许前端源发起 `PUT`、`GET`、`HEAD`、`OPTIONS` 请求。
- UI 采用低饱和企业风格，偏工业化控制台视觉。

## 7. Docker Compose 与部署

### 启动前准备
1. 修改根目录 `.env`，填入 PostgreSQL、Redis 和 OSS 配置。
2. 至少替换以下项：
   - `JWT_SECRET`
   - `ADMIN_BOOTSTRAP_PASSWORD`
   - `OSS_BUCKET`
   - `OSS_ACCESS_KEY_ID`
   - `OSS_ACCESS_KEY_SECRET`

### 一键启动

```bash
docker compose up -d --build
```

### 服务访问
- 前台站点：`http://localhost`
- 后端 API：`http://localhost:8080`
- 管理后台：`http://localhost/admin/login`

### 容器说明
- `web`：Nginx + 前端静态资源
- `api`：Gin API 服务
- `postgres`：业务数据库
- `redis`：限流与登录保护

## 8. 环境变量说明

根目录提供：
- `.env.example`：环境变量模板
- `.env`：可直接修改的本地示例配置

重点变量：
- `JWT_SECRET`：JWT 签名密钥
- `ADMIN_BOOTSTRAP_USERNAME / PASSWORD`：启动时初始化管理员账号
- `MAX_UPLOAD_SIZE_MB`：上传大小限制
- `ALLOWED_FILE_EXTENSIONS / ALLOWED_MIME_TYPES`：上传白名单
- `OSS_SIGNED_URL_TTL_MINUTES`：下载临时链接有效期
- `OSS_DELETE_MODE=sync|soft`：删除策略

## 9. 安全、限流、熔断设计

### 限流
- 登录接口：严格按 IP 限流。
- 下载接口：按 IP + 路由限流。
- 上传接口：按 IP 严格限流。
- 公共列表：宽松限流，避免恶意刷接口。
- Redis 不可用时，自动降级到进程内窗口计数器。

### 登录防暴力破解
- Redis 记录用户名 + IP 的失败计数。
- 达到 `LOGIN_FAILURE_LIMIT` 后在 `LOGIN_BLOCK_MINUTES` 内拒绝继续尝试。

### 熔断
- OSS 上传、删除、签名下载统一走熔断器。
- 数据库读写通过独立熔断器隔离失败。
- 连续失败后熔断，超时后半开探测恢复。

### 上传安全
- 文件大小限制。
- MIME 类型与扩展名双重白名单。
- 默认不允许脚本型危险文件上传。
- 上传改为前端直传 OSS，后端只签发短时上传 URL 并在完成入库前校验对象元数据。

### 审计
- 上传、编辑、删除写入 `operation_logs`。
- 日志中保留管理员 ID、动作、目标 ID、IP。

## 10. 本地开发

### 前端开发

```bash
cd apps/web
npm install
npm run dev
```

默认会把 `/api` 代理到 `http://localhost:8080`。

### 后端开发

建议直接使用 Docker：

```bash
docker compose up postgres redis -d
docker compose up api --build
```

如果本机安装了 Go，也可进入 `apps/api` 目录直接运行。

## 11. 初始化管理员账号

后端启动时会检查：
- `ADMIN_BOOTSTRAP_USERNAME`
- `ADMIN_BOOTSTRAP_PASSWORD`

如果数据库里还没有管理员账号，会自动创建首个管理员。

## 12. 已知说明

- 当前仓库已补齐工程骨架和关键实现，但本地环境未预装 Go，Go 编译需要通过 Docker 或额外安装 Go 完成。
- 如需生产部署，建议将 PostgreSQL、Redis、OSS 密钥替换为正式配置，并接入 HTTPS、监控和集中日志。
