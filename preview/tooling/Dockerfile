# syntax=docker/dockerfile:1.7
# Godhuli Shop API — multi-stage build

ARG NODE_VERSION=22.11.0
ARG ALPINE_VERSION=3.20

# ---------- deps ----------
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++ \
    && corepack enable \
    && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- build ----------
FROM deps AS build
COPY . .
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build && pnpm prune --prod

# ---------- runtime ----------
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runtime
LABEL org.opencontainers.image.title="godhuli-shop-api" \
      org.opencontainers.image.source="https://github.com/godhuli/shop"

ARG APP_UID=10001
WORKDIR /srv/app
RUN addgroup -S godhuli && adduser -S -u ${APP_UID} -G godhuli godhuli

COPY --from=build --chown=godhuli:godhuli /app/dist ./dist
COPY --from=build --chown=godhuli:godhuli /app/node_modules ./node_modules
COPY --chown=godhuli:godhuli package.json ./

ENV NODE_ENV=production PORT=8080 TZ="Asia/Dhaka"
EXPOSE 8080/tcp

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1

USER godhuli
ENTRYPOINT ["node", "--enable-source-maps"]
CMD ["dist/server.js"]
