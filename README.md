# Snapshare

Self-hosted photo gallery sharing for photographers — like Scrappbook/Pixieset, but on your own VPS.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- Postgres 16 + Drizzle ORM
- MinIO (S3-compatible object storage)
- Cloudflare CDN in front of MinIO for free, cached photo delivery
- External Traefik reverse proxy (network `traefik_proxy-net`) handles TLS
- Auth.js (Credentials) for the photographer admin
- Signed JWT cookies for client gallery access (optional password)
- `sharp` for thumb (400px) + web (1600px) variants
- `archiver` for streamed ZIP downloads

## Local development

1. Start Postgres + MinIO:

   ```bash
   npm run docker:dev
   ```

   MinIO console: http://localhost:9001 (snapshare / snapshare_dev_secret).
   Buckets `originals` and `photos` are created automatically; `photos` is set to anonymous download.

2. Copy env (defaults already match the dev compose):

   ```bash
   cp .env.example .env.local
   # generate AUTH_SECRET:
   openssl rand -base64 32
   ```

3. Apply DB schema:

   ```bash
   npm run db:push
   ```

4. Create your admin user:

   ```bash
   npm run create-user
   ```

5. Start the dev server:

   ```bash
   npm run dev
   ```

   Visit http://localhost:3000 → sign in → create a gallery → upload photos.

## Production deploy (VPS via Docker)

1. Set `.env` on the VPS:

   ```env
   APP_URL=https://app.example.com
   APP_DOMAIN=app.example.com
   CDN_DOMAIN=cdn.example.com
   PHOTOS_PUBLIC_BASE_URL=https://cdn.example.com/photos
   AUTH_SECRET=...        # openssl rand -base64 32
   POSTGRES_PASSWORD=...
   MINIO_ROOT_USER=snapshare
   MINIO_ROOT_PASSWORD=...
   ```

2. DNS: point `app.example.com` and `cdn.example.com` at the VPS IP.
   For `cdn.example.com`, enable Cloudflare proxy (orange cloud) and add a
   cache rule: `URI Path matches /photos/*` → Cache Everything, Edge TTL 1y.

   Traefik (running externally on `traefik_proxy-net`) handles TLS for both
   hostnames via the labels in `docker-compose.prod.yml`.

3. Build and start:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

4. Apply migrations and create the admin user:

   ```bash
   docker compose -f docker-compose.prod.yml exec app npx drizzle-kit migrate
   # create-user requires tsx, easier from your laptop with DATABASE_URL pointing at the VPS:
   DATABASE_URL=postgresql://... npm run create-user
   ```

5. Create the MinIO buckets via the MinIO console (port-forward `minio:9000`
   or expose temporarily). Set `photos` to anonymous download so Cloudflare
   can serve images.

## Backups (do this before your first real client!)

Plan: nightly `restic` cron → Backblaze B2 for both the Postgres dump and
the MinIO data volume. See plan in `~/.claude/plans/` for details.

## Project structure

```
src/
  app/
    api/
      auth/[...nextauth]/             NextAuth handlers
      uploads/{presign,complete}/     Direct-to-S3 upload pipeline
      g/[slug]/{download,favorite}/   Public gallery API
    dashboard/                        Photographer admin
    g/[slug]/                         Public gallery (with /password gate)
    login/                            Sign in
  lib/
    auth.ts            NextAuth (credentials) config
    db/                Drizzle schema + client
    s3.ts              MinIO/S3 client + presign helpers
    images.ts          sharp processing
    gallery-auth.ts    JWT cookie + password helpers
  proxy.ts             Reserved for custom-domain routing (Phase 8 — TODO)
```

## Status / what's done

- [x] Phases 1–7 of the plan: infra, auth, dashboard, upload, public gallery, download, favorites, branding
- [ ] Phase 8: custom domains (schema is in place; resolver route + Caddy `on_demand_tls` still to wire)
- [ ] Phase 9: backups
