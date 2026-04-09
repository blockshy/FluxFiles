# FluxFiles Deployment Guide

This guide is for production deployment. Use it together with:

- [`docker-compose.yml`](D:/workspace/React/WebSite/FluxFiles/docker-compose.yml)
- [`.env`](D:/workspace/React/WebSite/FluxFiles/.env)
- [`deploy/pgsql/public.sql`](D:/workspace/React/WebSite/FluxFiles/deploy/pgsql/public.sql)
- [`README-DEPLOY-LOG.md`](D:/workspace/React/WebSite/FluxFiles/README-DEPLOY-LOG.md)

## 1. Deployment Topology

- External Nginx handles public traffic and HTTPS
- `/fluxfiles/` is proxied to the frontend service
- `/api/` is proxied to the backend service
- PostgreSQL stores metadata
- Redis stores rate-limit and login protection data
- Alibaba Cloud OSS stores file binaries

## 2. Server Requirements

Recommended minimum:

- 2 vCPU
- 4 GB RAM
- 40 GB SSD
- Ubuntu 22.04 or Debian 12

Open only:

- `22`
- `80`
- `443`

Do not expose publicly:

- `5432`
- `6379`
- `8080`

## 3. Prepare Alibaba Cloud OSS

1. Create an OSS bucket
2. Record `OSS_REGION`, `OSS_ENDPOINT`, and `OSS_BUCKET`
3. Create a RAM user with minimum required permissions
4. Record `OSS_ACCESS_KEY_ID` and `OSS_ACCESS_KEY_SECRET`
5. Configure bucket CORS for your frontend domain

Recommended OSS CORS:

- Allowed Origins:
  - `https://your-domain.com`
- Allowed Methods:
  - `PUT`
  - `GET`
  - `HEAD`
  - `OPTIONS`
- Allowed Headers:
  - `*`
- Expose Headers:
  - `ETag`
  - `x-oss-request-id`
- Max Age:
  - `3600`

## 4. Prepare the Database

The API does not auto-migrate tables on startup.

You must create the schema manually from [`deploy/pgsql/public.sql`](D:/workspace/React/WebSite/FluxFiles/deploy/pgsql/public.sql):

```bash
psql -U fluxfiles -d fluxfiles -f deploy/pgsql/public.sql
```

Schema source of truth:

- `users`
- `files`
- `operation_logs`
- `user_favorites`
- `user_download_records`

Version-specific schema changes are tracked in [`README-DEPLOY-LOG.md`](D:/workspace/React/WebSite/FluxFiles/README-DEPLOY-LOG.md).

## 5. Prepare Project Files

Suggested target directory:

```text
/opt/FluxFiles
```

Example:

```bash
git clone <your-repository-url> /opt/FluxFiles
cd /opt/FluxFiles
```

## 6. Configure Environment Variables

Copy and edit the production environment file:

```bash
cp .env.example .env
```

Required values to replace:

- `APP_EXTERNAL_URL`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `ADMIN_BOOTSTRAP_PASSWORD`
- `OSS_BUCKET`
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`

Important notes:

- Production uses [`.env`](D:/workspace/React/WebSite/FluxFiles/.env)
- Local testing should use [`.env.dev`](D:/workspace/React/WebSite/FluxFiles/.env.dev)
- Do not reuse development secrets in production

## 7. Start Services

Build and start:

```bash
docker compose up -d --build
```

Check status:

```bash
docker compose ps
```

Check logs:

```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs -f postgres
docker compose logs -f redis
```

## 8. Bootstrap Admin Account

At first startup, the API creates the bootstrap admin only if there is no existing admin user.

Variables:

- `ADMIN_BOOTSTRAP_USERNAME`
- `ADMIN_BOOTSTRAP_PASSWORD`

Change the bootstrap password before going live.

## 9. External Nginx Example

FluxFiles frontend is built under `/fluxfiles/`. Your external Nginx only needs to proxy `/fluxfiles/` and `/api/`.

Example:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /fluxfiles/ {
        proxy_pass http://127.0.0.1:80/fluxfiles/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Adjust upstream addresses to your actual deployment.

## 10. Verify the Deployment

Health check:

```bash
curl http://127.0.0.1/healthz
```

Public list:

```bash
curl http://127.0.0.1/api/files
```

Admin login:

```bash
curl -X POST http://127.0.0.1/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-admin-password"}'
```

Browser checks:

- `https://your-domain.com/fluxfiles/`
- `https://your-domain.com/fluxfiles/admin/login`

## 11. First Upload Verification

1. Log in as admin
2. Call `POST /api/admin/files/upload-prepare`
3. Browser uploads directly to OSS
4. Frontend calls `POST /api/admin/files`
5. Confirm the file appears in the admin list
6. Confirm the public page can search and download it

If step 2 fails:

- check backend validation response
- check upload limits
- check JWT and rate limits

If step 3 fails:

- check OSS CORS
- check signed URL expiry
- check bucket permissions

If step 4 fails:

- check OSS object existence
- check backend `HeadObject` validation
- check database connectivity

## 12. Upgrade Procedure

1. Review [`README-DEPLOY-LOG.md`](D:/workspace/React/WebSite/FluxFiles/README-DEPLOY-LOG.md)
2. Back up PostgreSQL
3. Pull the new code
4. Compare `.env.example` with your current `.env`
5. Apply any required SQL changes from the deploy log
6. Rebuild and restart
7. Verify login, upload, download, public listing, and user center

Example:

```bash
cd /opt/FluxFiles
git pull
docker compose up -d --build
docker compose ps
```

## 13. Backup and Restore

Backup:

```bash
docker exec -t fluxfiles-postgres pg_dump -U fluxfiles -d fluxfiles > fluxfiles-backup.sql
```

Restore:

```bash
cat fluxfiles-backup.sql | docker exec -i fluxfiles-postgres psql -U fluxfiles -d fluxfiles
```

Also enable OSS bucket versioning or lifecycle policies where appropriate.

## 14. Troubleshooting

Upload fails:

- verify OSS region and endpoint
- verify RAM permissions
- verify bucket CORS
- verify backend upload validation settings

Download fails:

- verify object exists in OSS
- verify signed URL TTL
- verify file is public

Database errors:

- verify `POSTGRES_*`
- verify the schema from `deploy/pgsql/public.sql` has been applied

Redis errors:

- verify `REDIS_*`
- verify Redis service health

Admin login fails:

- verify bootstrap admin exists
- verify password
- verify login failure lock settings

## 15. Development vs Production

Use the development files only for local testing:

- [`.env.dev`](D:/workspace/React/WebSite/FluxFiles/.env.dev)
- [`docker-compose.dev.yml`](D:/workspace/React/WebSite/FluxFiles/docker-compose.dev.yml)

Start dev:

```bash
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d --build
```

Keep production files unchanged:

- [`.env`](D:/workspace/React/WebSite/FluxFiles/.env)
- [`docker-compose.yml`](D:/workspace/React/WebSite/FluxFiles/docker-compose.yml)
