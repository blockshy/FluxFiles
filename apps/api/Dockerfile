# =========================================================
# FluxFiles API Dockerfile
# 作用：
# 1. 使用多阶段构建，先在 Go 镜像中编译二进制
# 2. 再把编译结果复制到更小的运行时镜像中
# 3. 最终得到一个适合生产部署的精简 API 容器
# =========================================================

# ---------------------------------------------------------
# 第一阶段：builder
# 用官方 Go Alpine 镜像编译后端程序
# 这个阶段体积可以大一些，因为只负责构建，不直接上线运行
# ---------------------------------------------------------
FROM golang:1.23-alpine AS builder

# 设置构建阶段的工作目录
# 后续 COPY / RUN 都会以这个目录为基准
WORKDIR /src/apps/api

# 先只复制 go.mod，利用 Docker 层缓存加速依赖下载
# 如果业务代码变化但依赖没变，这一层可以复用
COPY apps/api/go.mod ./

# 下载 Go 模块依赖
# 这样后续真正构建时依赖已经准备好
RUN go mod download

# 再复制完整的后端源码
COPY apps/api ./

# 编译 Linux amd64 的静态二进制文件
# 参数说明：
# CGO_ENABLED=0：关闭 CGO，减少运行时依赖，便于放进极简镜像
# GOOS=linux：生成 Linux 可执行文件
# GOARCH=amd64：生成 amd64 架构程序
# -ldflags="-s -w"：去掉调试符号，减小二进制体积
# -o /out/fluxfiles：输出到独立目录，方便下一阶段复制
# ./cmd/server：项目入口
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o /out/fluxfiles ./cmd/server

# ---------------------------------------------------------
# 第二阶段：runtime
# 使用极简 Alpine 作为运行时镜像
# 只保留真正运行 API 所需要的最小环境
# ---------------------------------------------------------
FROM alpine:3.20

# 安装运行时依赖：
# ca-certificates：用于 HTTPS 请求，例如连接 OSS 等外部服务
# tzdata：提供时区数据，便于程序正确处理时间
RUN apk add --no-cache ca-certificates tzdata

# 设置运行时工作目录
WORKDIR /app

# 从 builder 阶段复制编译好的二进制程序
# 不复制源码，从而减小镜像体积并降低暴露面
COPY --from=builder /out/fluxfiles /app/fluxfiles

# 声明容器对外监听的端口
# 这里只是元数据说明，真正端口映射由 docker-compose 或 docker run 决定
EXPOSE 8080

# 容器启动后默认执行的主进程
# 这里直接启动 FluxFiles 的 API 服务
ENTRYPOINT ["/app/fluxfiles"]
