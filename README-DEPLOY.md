# FluxFiles 部署指南

本文面向实际生产部署，覆盖服务器准备、环境变量配置、阿里云 OSS、Docker Compose 启动、HTTPS、升级、备份与排障。

适用项目目录：

- [docker-compose.yml](D:/workspace/React/WebSite/FluxFiles/docker-compose.yml)
- [.env](D:/workspace/React/WebSite/FluxFiles/.env)
- [.env.example](D:/workspace/React/WebSite/FluxFiles/.env.example)
- [deploy/nginx/default.conf](D:/workspace/React/WebSite/FluxFiles/deploy/nginx/default.conf)

## 1. 部署目标

部署完成后，你将得到：

- 公开文件分发站点
- 管理员后台
- PostgreSQL 元数据数据库
- Redis 限流与安全组件
- 阿里云 OSS 文件存储

默认访问路径：

- 前台：`https://your-domain.com/`
- 后台：`https://your-domain.com/admin/login`
- API：`https://your-domain.com/api/...`

## 2. 当前部署架构

FluxFiles 的运行方式如下：

1. `web` 容器中的 Nginx 提供前端页面
2. `/api` 请求由 Nginx 反向代理到 `api` 容器
3. 管理员上传文件时，先向后端申请 OSS 临时上传 URL
4. 浏览器拿到临时 URL 后直接 PUT 文件到 OSS
5. 前端通知后端完成入库，后端校验 OSS 对象元数据后写入 PostgreSQL
6. 用户下载文件时，后端生成临时签名下载链接

这意味着：

- 文件内容不经过本地磁盘落地
- 上传带宽主要由浏览器和 OSS 承担，不压后端机器
- OSS Bucket 必须正确配置 CORS

## 3. 服务器要求

建议最小配置：

- CPU：2 核
- 内存：4 GB
- 磁盘：40 GB SSD
- 系统：Ubuntu 22.04 LTS 或 Debian 12

建议开放端口：

- `22`：SSH
- `80`：HTTP
- `443`：HTTPS

不建议对公网开放：

- `5432`：PostgreSQL
- `6379`：Redis
- `8080`：API 调试端口

## 4. 前置准备

### 4.1 域名

准备一个域名，例如：

- `files.example.com`

将该域名 A 记录解析到服务器公网 IP。

### 4.2 阿里云 OSS

在阿里云控制台完成以下操作：

1. 创建 OSS Bucket
2. 记录 Bucket 所在地域
3. 创建 RAM 用户
4. 为该 RAM 用户授予当前 Bucket 的最小必要权限
5. 获取：
   - `OSS_REGION`
   - `OSS_ENDPOINT`
   - `OSS_BUCKET`
   - `OSS_ACCESS_KEY_ID`
   - `OSS_ACCESS_KEY_SECRET`

建议不要直接使用主账号 AccessKey。

### 4.3 OSS CORS 配置

由于后台上传采用“前端直传 OSS”，Bucket 必须允许浏览器跨域上传。

至少配置一条 CORS 规则，建议如下：

- Allowed Origins：
  - `https://your-domain.com`
  - 本地联调时可额外加 `http://localhost:5173`
- Allowed Methods：
  - `PUT`
  - `GET`
  - `HEAD`
  - `OPTIONS`
- Allowed Headers：
  - `*`
- Expose Headers：
  - `ETag`
  - `x-oss-request-id`
- Max Age：
  - `3600`

如果 CORS 没配好，后台上传时浏览器会直接报跨域错误。

### 4.4 管理员初始账号

准备好首个管理员账号密码：

- `ADMIN_BOOTSTRAP_USERNAME`
- `ADMIN_BOOTSTRAP_PASSWORD`

当数据库中还没有管理员账号时，系统会在首次启动时自动创建。

## 5. 安装 Docker 与 Compose

以下以 Ubuntu 为例。

### 5.1 更新系统

```bash
sudo apt update
sudo apt upgrade -y
```

### 5.2 安装 Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker
sudo systemctl start docker
```

### 5.3 验证

```bash
docker version
docker compose version
```

如需免 `sudo`：

```bash
sudo usermod -aG docker $USER
newgrp docker
```

## 6. 上传项目代码

推荐部署目录：

```text
/opt/FluxFiles
```

方式一，Git：

```bash
git clone <your-repository-url> /opt/FluxFiles
cd /opt/FluxFiles
```

方式二，本地上传：

```bash
scp -r FluxFiles user@your-server:/opt/
ssh user@your-server
cd /opt/FluxFiles
```

## 7. 配置环境变量

项目根目录已提供：

- [`.env.example`](D:/workspace/React/WebSite/FluxFiles/.env.example)
- [`.env`](D:/workspace/React/WebSite/FluxFiles/.env)

如果你要重新生成正式配置：

```bash
cp .env.example .env
```

### 7.1 必改项

以下值必须替换：

```dotenv
APP_EXTERNAL_URL=
POSTGRES_PASSWORD=
JWT_SECRET=
ADMIN_BOOTSTRAP_PASSWORD=
OSS_BUCKET=
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
```

### 7.2 生产配置示例

```dotenv
APP_NAME=FluxFiles
APP_ENV=production
APP_HOST=0.0.0.0
APP_PORT=8080
APP_EXTERNAL_URL=https://files.example.com

POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=fluxfiles
POSTGRES_USER=fluxfiles
POSTGRES_PASSWORD=PleaseChangeStrongPassword
POSTGRES_SSLMODE=disable

REDIS_ADDR=redis:6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_PREFIX=fluxfiles

JWT_SECRET=ReplaceWithLongRandomSecret
JWT_EXPIRE_HOURS=12
ADMIN_BOOTSTRAP_USERNAME=admin
ADMIN_BOOTSTRAP_PASSWORD=ReplaceWithStrongAdminPassword

OSS_REGION=cn-hangzhou
OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
OSS_BUCKET=your-production-bucket
OSS_ACCESS_KEY_ID=your-ram-access-key-id
OSS_ACCESS_KEY_SECRET=your-ram-access-key-secret
OSS_BASE_PATH=fluxfiles/prod
OSS_SIGNED_URL_TTL_MINUTES=10
OSS_DELETE_MODE=sync

WEB_PORT=80
API_PORT=8080
VITE_API_BASE_URL=/api
```

## 8. 首次启动

在项目根目录执行：

```bash
docker compose up -d --build
```

首次启动会：

1. 构建前后端镜像
2. 启动 PostgreSQL 和 Redis
3. 启动 API 与 Web
4. 自动迁移数据库表
5. 自动初始化管理员账号

## 9. 检查运行状态

```bash
docker compose ps
```

期望状态：

- `postgres` 为 `healthy`
- `redis` 为 `healthy`
- `api` 为 `Up`
- `web` 为 `Up`

查看日志：

```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs -f postgres
docker compose logs -f redis
```

## 10. 验证服务

### 10.1 健康检查

```bash
curl http://127.0.0.1/healthz
```

预期：

```text
ok
```

### 10.2 公共接口

```bash
curl http://127.0.0.1/api/files
```

### 10.3 管理员登录

```bash
curl -X POST http://127.0.0.1/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-admin-password"}'
```

登录成功会返回 JWT。

### 10.4 浏览器访问

访问：

- `http://your-domain.com/`
- `http://your-domain.com/admin/login`

如已配置 HTTPS，则使用 `https://`。

## 11. 首次上传验证

管理员登录后，进入后台文件管理页，测试上传一个白名单内文件。

期望流程：

1. 前端调用 `/api/admin/files/upload-prepare`
2. 后端返回 OSS 临时上传 URL
3. 浏览器直接 PUT 文件到 OSS
4. 前端调用 `/api/admin/files` 完成入库
5. 后台列表出现该文件
6. OSS 控制台可看到该对象
7. 前台页面可检索并下载该文件

如果第 2 步成功、第 3 步失败，优先排查 OSS CORS。

## 12. HTTPS 配置

生产环境建议强制 HTTPS。

推荐方式：

1. 在宿主机或云负载均衡层终止 HTTPS
2. 反向代理到 FluxFiles 的 `web` 容器

如果使用宿主机 Nginx + Certbot：

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
sudo certbot --nginx -d files.example.com
```

## 13. 防火墙与安全组

建议仅开放：

- `22`
- `80`
- `443`

禁止公网访问：

- `5432`
- `6379`
- `8080`

## 14. 常用运维命令

启动：

```bash
docker compose up -d
```

重建并启动：

```bash
docker compose up -d --build
```

停止：

```bash
docker compose down
```

查看状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f
docker compose logs -f api
docker compose logs -f web
```

重启 API：

```bash
docker compose restart api
```

## 15. 升级流程

建议按以下流程升级：

1. 备份数据库
2. 拉取新代码
3. 对比 `.env.example` 是否新增配置
4. 更新 `.env`
5. 重新构建并启动
6. 验证上传、下载、登录与列表页

示例：

```bash
cd /opt/FluxFiles
git pull
docker compose up -d --build
docker compose ps
docker compose logs -f api
```

## 16. 数据备份

### 16.1 备份 PostgreSQL

```bash
docker exec -t fluxfiles-postgres pg_dump -U fluxfiles -d fluxfiles > fluxfiles-backup.sql
```

### 16.2 恢复 PostgreSQL

```bash
cat fluxfiles-backup.sql | docker exec -i fluxfiles-postgres psql -U fluxfiles -d fluxfiles
```

### 16.3 OSS 备份建议

建议同时启用：

- Bucket 版本控制
- 生命周期策略
- 关键目录异地备份

## 17. 常见问题排查

### 17.1 页面打不开

检查：

```bash
docker compose ps
docker compose logs -f web
```

### 17.2 后台登录失败

检查：

```bash
docker compose logs -f api
```

确认：

- `JWT_SECRET` 已配置
- 管理员是否初始化成功
- 是否因登录失败次数过多被临时封禁

### 17.3 上传失败

优先检查：

- OSS Key 是否正确
- Endpoint 与 Region 是否匹配
- Bucket CORS 是否允许当前站点
- 文件是否在扩展名和 MIME 白名单内
- 文件大小是否超出 `MAX_UPLOAD_SIZE_MB`
- RAM 用户是否有 PutObject 权限

### 17.4 下载失败

检查：

- OSS 对象是否真实存在
- API 是否成功签发临时下载链接
- `OSS_SIGNED_URL_TTL_MINUTES` 是否过短

### 17.5 数据库连接失败

确认：

- `POSTGRES_*` 配置正确
- `postgres` 容器为 `healthy`
- 数据库密码未写错

### 17.6 Redis 连接失败

系统会有一定降级能力，但不建议长期忽略。

```bash
docker compose logs -f redis
docker compose logs -f api
```

## 18. 生产加固建议

建议至少完成：

1. 替换所有默认密码
2. 使用高强度 `JWT_SECRET`
3. OSS 使用最小权限 RAM 子账号
4. 配置 HTTPS
5. 限制数据库和 Redis 只在内网访问
6. 定期备份 PostgreSQL
7. 配置日志、监控和告警

## 19. 上线检查清单

- 域名解析完成
- HTTPS 可用
- `.env` 中敏感信息已替换
- OSS 配置正确
- OSS CORS 已正确配置
- 管理员可以登录
- 文件可上传
- 文件可下载
- 公网未暴露 `5432/6379/8080`
- 备份方案已确定

## 20. 回滚建议

如升级失败：

1. 回退代码到上一个稳定版本
2. 执行 `docker compose up -d --build`
3. 如涉及数据库问题，按备份方案恢复

后续如果引入正式迁移工具，建议每个版本都提供可回滚迁移脚本。
