# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

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

ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ARG API_INTERNAL_URL=http://localhost:4000/api

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV API_INTERNAL_URL=$API_INTERNAL_URL

COPY . .
RUN pnpm build:shop

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

WORKDIR /app

COPY --from=build --chown=node:node /workspace/apps/shop/.next/standalone ./
COPY --from=build --chown=node:node /workspace/apps/shop/.next/static ./apps/shop/.next/static
COPY --from=build --chown=node:node /workspace/apps/shop/public ./apps/shop/public

WORKDIR /app/apps/shop

USER node

EXPOSE 3001

CMD ["node", "server.js"]
