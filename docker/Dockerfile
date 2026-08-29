# syntax=docker/dockerfile:1
#
# Multi-target image: api | worker | web
# Compose Bake builds the shared `deps` stage once for all three.

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/config/package.json packages/config/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
RUN --mount=type=cache,target=/root/.npm \
  npm ci --no-audit --no-fund

# --- API ---
FROM deps AS api-build
WORKDIR /app
COPY tsconfig.base.json ./
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @video/shared && npm run build -w @video/api \
  && npm prune --omit=dev

FROM node:20-bookworm-slim AS api
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=api-build /app/package.json /app/package.json
COPY --from=api-build /app/package-lock.json /app/package-lock.json
COPY --from=api-build /app/node_modules /app/node_modules
COPY --from=api-build /app/packages /app/packages
COPY --from=api-build /app/apps/api /app/apps/api
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/index.js"]

# --- Worker ---
FROM deps AS worker-build
WORKDIR /app
COPY tsconfig.base.json ./
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY apps/worker apps/worker
RUN npm run build -w @video/shared && npm run build -w @video/worker \
  && npm prune --omit=dev

FROM node:20-bookworm-slim AS worker
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=worker-build /app/package.json /app/package.json
COPY --from=worker-build /app/package-lock.json /app/package-lock.json
COPY --from=worker-build /app/node_modules /app/node_modules
COPY --from=worker-build /app/packages /app/packages
COPY --from=worker-build /app/apps/worker /app/apps/worker
WORKDIR /app/apps/worker
CMD ["node", "dist/index.js"]

# --- Web ---
FROM deps AS web-build
WORKDIR /app
COPY tsconfig.base.json ./
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
ARG API_INTERNAL_URL=http://api:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
# Bump to invalidate stale BuildKit cache when auth/login changes.
ARG WEB_BUILD_ID=live-session-host-mic-v1
ENV WEB_BUILD_ID=$WEB_BUILD_ID
RUN mkdir -p apps/web/public \
  && npm run build -w @video/shared \
  && npm run build -w @video/web

FROM node:20-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=web-build /app/apps/web/.next/standalone ./
COPY --from=web-build /app/apps/web/.next/static ./apps/web/.next/static
RUN mkdir -p apps/web/public
COPY --from=web-build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
