# =========================================================
# FluxFiles Web Dockerfile
# 作用：
# 1. 先在 Node 环境中构建前端静态资源
# 2. 再用 Nginx 提供静态文件服务
# 3. 最终得到适合生产部署的前端站点镜像
# =========================================================

# ---------------------------------------------------------
# 第一阶段：builder
# 使用 Node 镜像安装依赖并执行前端打包
# ---------------------------------------------------------
FROM node:22-alpine AS builder

# 设置构建工作目录
WORKDIR /app

# 构建参数：
# VITE_API_BASE_URL 会在前端打包时注入到 Vite 环境变量中
# 这里默认使用 /api，表示前端通过同域反向代理访问后端 API
# 如果将来前后端分域部署，也可以在构建时改成完整地址
ARG VITE_API_BASE_URL=/api

# 把构建参数写入环境变量，供 `npm run build` 使用
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# 先复制 package.json，利用 Docker 缓存加速依赖安装
COPY apps/web/package.json ./

# 安装前端依赖
# 这里使用 npm install，适合当前项目结构
RUN npm install

# 再复制完整前端源码
COPY apps/web ./

# 执行前端生产构建
# 产物默认输出到 /app/dist
RUN npm run build

# ---------------------------------------------------------
# 第二阶段：runtime
# 使用 Nginx 托管静态文件
# ---------------------------------------------------------
FROM nginx:1.27-alpine

# 拷贝自定义 Nginx 配置
# 该配置负责：
# 1. 提供 /fluxfiles/ 下的前端静态资源
# 2. 支持前端路由回退到 index.html
# 3. 反向代理 /api/ 到后端服务
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf

# 把构建好的静态资源复制到 Nginx 目录中
# 这里放到 /usr/share/nginx/html/fluxfiles
# 是为了配合项目当前以 /fluxfiles/ 作为前端基路径部署
COPY --from=builder /app/dist /usr/share/nginx/html/fluxfiles

# 声明 Nginx 在容器内监听的端口
EXPOSE 80
