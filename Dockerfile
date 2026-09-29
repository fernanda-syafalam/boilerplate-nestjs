# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.33.4

FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app

ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# argon2 is the only native binding; bookworm-slim already has the build tooling.
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app

ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm run build

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm prune --prod

FROM gcr.io/distroless/nodejs${NODE_VERSION}-debian12 AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/package.json ./package.json

# distroless nonroot (UID 65532).
USER nonroot
EXPOSE 3000

# Runs the API; run the worker from the same image with a different command:
# `docker run <image> dist/worker.js`.
CMD ["dist/main.js"]
