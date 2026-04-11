# FluxFiles

FluxFiles 是一个基于阿里云 OSS、PostgreSQL、Redis 和 React 的文件分发与后台管理系统，包含公开首页、文件详情互动区、用户中心和细粒度权限后台。

线上地址：

- 生产环境：`https://rsec.top/fluxfiles/`
- 测试环境：`https://test.rsec.top/fluxfiles/`

## 当前能力

- 公开文件列表、关键词搜索、分类筛选、标签筛选、多条件排序
- 文件详情页展示分类、标签、上传者、上传时间、大小、类型、原文件名、描述
- 文件详情页支持下载、收藏、评论、楼中楼回复、点赞、点踩
- 下载支持游客/登录用户分流控制、下载验证码、OSS 临时下载链接过期时间配置
- 用户注册、登录、个人中心、头像上传、密码修改、下载记录、消息通知
- 后台文件管理、下载记录管理、用户管理、系统设置、操作日志
- 后台分类管理与标签管理均为树形层级管理
- 后台和前台功能都进入权限模板与细粒度权限控制

## 技术栈

- 后端：Go、Gin、GORM
- 前端：React、TypeScript、Vite、Ant Design、TanStack Query
- 数据库：PostgreSQL
- 缓存/限流：Redis
- 对象存储：Alibaba Cloud OSS
- 部署：Docker、Docker Compose、Nginx

## 目录结构

- `apps/api`：Go API 服务
- `apps/web`：React 前端
- `deploy/pgsql/public.sql`：PostgreSQL 结构基线
- `docker-compose.yml`：生产环境编排
- `docker-compose.dev.yml`：测试环境编排
- `.env`：生产环境变量
- `.env.dev`：测试环境变量

## 环境与部署

FluxFiles 生产和测试环境都连接宿主机上的 PostgreSQL 与 Redis，不自带数据库容器。

常用脚本：

```bash
./run-dev.sh
./stop-dev.sh
./run-prod.sh
./stop-prod.sh
```

注意：

- `run-dev.sh` / `run-prod.sh` 只负责构建和重启容器，不会自动执行数据库结构同步
- 如果 `deploy/pgsql/public.sql` 发生变化，需要手动执行数据库结构同步
- 生产环境部署时只同步代码和必要的数据库结构变更，不要把测试环境数据、调试数据或临时配置同步到生产环境

生产环境结构同步示例：

```bash
docker exec -i postgresql psql -U postgres -d flux_files -f - < deploy/pgsql/public.sql
```

测试环境结构同步示例：

```bash
docker exec -i postgresql psql -U postgres -d fluxfiles_dev -f - < deploy/pgsql/public.sql
```

## 数据库概览

结构基线文件：

- [`deploy/pgsql/public.sql`](./deploy/pgsql/public.sql)

当前核心表包括：

- `users`
- `files`
- `operation_logs`
- `categories`
- `tags`
- `taxonomy_change_logs`
- `user_favorites`
- `user_download_records`
- `file_comments`
- `comment_votes`
- `user_notifications`
- `system_settings`

## 权限模型

角色：

- `user`
- `admin`

当前管理员权限：

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
- `admin.community.view`
- `admin.community.moderate`
- `admin.settings`
- `admin.audit`

当前前台权限：

- `public.files.view`
- `public.files.detail`
- `public.files.download`
- `public.files.favorite`
- `public.comments.create`
- `public.comments.reply`
- `public.comments.vote`
- `public.comments.delete_own`
- `public.community.view`
- `public.community.post.create`
- `public.community.post.edit_own`
- `public.community.post.delete_own`
- `public.community.reply.create`
- `public.community.reply.delete_own`
- `public.profile.view_own`
- `public.profile.edit_own`
- `public.profile.view_public`
- `public.notifications.view`

约束说明：

- 管理员除了 `role=admin`，还必须具备对应权限才能访问后台能力
- 普通用户也可以分配权限；新建普通用户和新注册用户默认使用 `default_user` 普通用户基础权限模板
- 超级管理员模板和新初始化的 bootstrap 管理员默认包含后台权限和前台权限
- 文件编辑/删除/下载记录查看依赖文件范围权限
- 分类和标签的创建/编辑/删除/日志权限都依赖对应的 `view` 权限
- 前台评论、社区、个人中心、通知等登录用户功能同样需要前后端同时校验对应权限

## 分类与标签模型

文件分类树：

- 数据表：`categories`
- 路径形式：`顶级分类.子分类.子分类`

标签：

- 数据表：`tags`
- 当前使用 `tags.parent_id` 表示层级关系
- 路径形式：`顶级标签.子标签.子标签`

## 下载与互动规则

- 游客是否允许下载由后台系统设置控制
- 下载验证码由后台系统设置控制
- OSS 临时下载链接过期时间由后台系统设置控制，默认 `60` 秒
- 前端关键操作前会重新获取相关设置，避免页面未刷新时出现旧配置绕过或错误提示不匹配
- 评论支持主楼、楼中楼回复、点赞、点踩、删除级联
- 下载记录同时记录游客和登录用户

## 用户与删除规则

- 用户支持自定义头像，未设置时使用默认头像
- 游客不能访问公开用户主页
- 后台用户删除为物理删除
- 仅允许删除“没有上传文件且没有关键后台引用数据”的用户
- 后台文件删除为物理删除，会删除 OSS 对象、数据库文件记录和关联的文件通知数据

## 开发验证

后端测试：

```bash
cd apps/api
env GOCACHE=/tmp/fluxfiles-go-build /huyu/environment/go/current/bin/go test ./...
```

前端构建：

```bash
cd apps/web
npm run build
```

本地健康检查：

```bash
curl -sS http://127.0.0.1:28080/healthz
curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:28081/fluxfiles/
curl -sS http://127.0.0.1:18080/healthz
curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:8081/fluxfiles/
```

## 相关文档

- API 文档：[`API.md`](./API.md)
- 部署说明：[`README-DEPLOY.md`](./README-DEPLOY.md)
- 部署记录：[`README-DEPLOY-LOG.md`](./README-DEPLOY-LOG.md)
