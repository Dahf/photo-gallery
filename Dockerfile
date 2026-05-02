# Multi-stage build for Next.js standalone output.
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
# package-lock.json may have been generated on Windows (win32 prebuilds for
# sharp). Force-install the linuxmusl-x64 native binary so sharp loads in
# the Alpine runtime.
RUN npm install --no-save --include=optional --os=linux --libc=musl --cpu=x64 sharp

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
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# drizzle migrations + tooling, so `npx drizzle-kit migrate` works in this image.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/db ./src/lib/db
# Standalone admin scripts (create-user, etc.) run with plain `node`.
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
RUN npm install --omit=optional --no-save \
      drizzle-kit@0.31.10 \
      drizzle-orm@0.45.2 \
      postgres@3.4.9 \
      bcryptjs@3.0.3 \
      tsx@4.21.0 \
    # Replace whatever sharp variant the standalone trace shipped with the
    # linuxmusl-x64 native binary so it actually loads in this Alpine runtime.
    && npm install --no-save --include=optional --os=linux --libc=musl --cpu=x64 sharp@0.34.5 \
    && chown -R nextjs:nodejs /app/node_modules

# Migration entrypoint — runs drizzle-kit migrate before exec'ing the server.
COPY --chown=nextjs:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
