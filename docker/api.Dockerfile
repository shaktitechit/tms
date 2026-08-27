# Deprecated: use `docker/Dockerfile` target `api`.
# Kept so existing `docker build -f docker/api.Dockerfile` commands still work.
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
ENV NODE_ENV=production
COPY --from=api-build /app/package.json /app/package.json
COPY --from=api-build /app/package-lock.json /app/package-lock.json
COPY --from=api-build /app/node_modules /app/node_modules
COPY --from=api-build /app/packages /app/packages
COPY --from=api-build /app/apps/api /app/apps/api
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/index.js"]
