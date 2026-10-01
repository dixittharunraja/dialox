# Build context: repository root. Builds the SPA, then serves it from nginx, which also
# reverse-proxies /api (REST + WebSocket) to the api service.
FROM node:22-alpine AS build
ENV HUSKY=0 COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/client/package.json apps/client/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @dialox/client...
COPY packages/shared packages/shared
COPY apps/client apps/client
RUN pnpm --filter @dialox/client build

FROM nginx:1.27-alpine
COPY infra/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/client/dist /usr/share/nginx/html
EXPOSE 80
