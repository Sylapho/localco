# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable \
  && corepack prepare pnpm@10.33.0 --activate

WORKDIR /workspace

FROM base AS manifests

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/shop/package.json apps/shop/package.json

FROM manifests AS deps

RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY . .
RUN pnpm db:generate
RUN pnpm build:api

FROM manifests AS prod-deps

RUN pnpm install --frozen-lockfile --prod --filter @localco/api

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=prod-deps --chown=node:node /workspace/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /workspace/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /workspace/apps/api/prisma/schema.prisma ./apps/api/prisma/schema.prisma
COPY --from=build --chown=node:node /workspace/apps/api/prisma/migrations ./apps/api/prisma/migrations

WORKDIR /app/apps/api

USER node

EXPOSE 4000

CMD ["node", "dist/src/main.js"]
