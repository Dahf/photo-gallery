# Multi-stage build for Next.js standalone output.
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time placeholders. Real values come from `.env` / docker-compose at runtime.
# `next build` evaluates route modules (NextAuth, db client, S3) which otherwise
# throw on missing envs. None of these placeholders are baked into runtime code.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build \
    AUTH_SECRET=build-time-placeholder-not-used-at-runtime \
    S3_ENDPOINT=http://localhost:9000 \
    S3_ACCESS_KEY=build \
    S3_SECRET_KEY=build \
    PHOTOS_PUBLIC_BASE_URL=http://localhost:9000/photos
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# drizzle migrations (apply via `drizzle-kit migrate` from a one-off container)
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
