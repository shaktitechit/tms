# Deprecated: use `docker/Dockerfile` target `worker`.
# syntax=docker/dockerfile:1
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
