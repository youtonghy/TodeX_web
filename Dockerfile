# syntax=docker/dockerfile:1

# This build expects the sibling TodeX_protocol checkout as a named build
# context, because the web bundle compiles protocol sources from
# ../TodeX_protocol/src:
#
#   docker buildx build --build-context todexprotocol=/path/to/TodeX_protocol -t todex-web .
#
# The licensed @heroui-pro/react contents are fetched by hpsetup with the hp_
# key; pass it as a build secret (never in a build-arg or copied file):
#
#   --secret id=HEROUI_KEY,env=HEROUI_KEY
#
# Self-hosting needs no build: run the published image with the backends it
# should serve (see docs/self-hosting.md):
#
#   docker run -p 4173:4173 -e TODEX_BACKENDS="Home=http://192.168.1.20:7345" ghcr.io/youtonghy/todex_web

# Everything up to the runtime stage produces platform-independent JavaScript
# (no native modules ship), so it runs on the build host; only the runtime
# stage, which has no RUN steps, is per target platform. Multi-arch images
# therefore build without emulation.
FROM --platform=$BUILDPLATFORM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate
WORKDIR /build/TodeX_web

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
# esbuild needs its install script; the @heroui-pro/react stub postinstall is
# skipped because hpsetup below supplies the licensed package contents, and
# the @zowe keyring helper it pulls in has no credential store here. pnpm 11
# errors on unlisted build scripts, so both must be denied explicitly.
RUN printf "allowBuilds:\n  esbuild: true\n  '@heroui-pro/react': false\n  '@zowe/secrets-for-zowe-sdk': false\n" > pnpm-workspace.yaml
RUN --mount=type=cache,id=todex-web-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store
ARG HPSETUP_VERSION=latest
RUN --mount=type=secret,id=HEROUI_KEY,env=HEROUI_KEY \
    pnpm dlx "hpsetup@$HPSETUP_VERSION" "$HEROUI_KEY"
# Protocol sources resolve their @noble/* imports through this node_modules.
RUN mkdir -p /build/TodeX_protocol \
    && ln -s /build/TodeX_web/node_modules /build/TodeX_protocol/node_modules
COPY --from=todexprotocol src /build/TodeX_protocol/src

FROM deps AS build
COPY . .
# hpsetup rewrites these manifests (it installs @heroui-pro/react@latest plus
# the peer deps the licensed bundle needs). Keep the deps-stage copies so they
# stay in sync with node_modules — with the repo copies restored, pnpm's
# verifyDepsBeforeRun (default: install) would reinstall the unlicensed npm
# stub over the licensed package contents before lint/typecheck.
COPY --from=deps /build/TodeX_web/package.json /build/TodeX_web/pnpm-lock.yaml /build/TodeX_web/pnpm-workspace.yaml ./
ARG TODEX_BUILD_VERSION=DEV0.0.0
ENV TODEX_BUILD_VERSION=$TODEX_BUILD_VERSION
RUN pnpm lint && pnpm typecheck && pnpm build

# The server needs only express, compression and helmet; client libraries are
# devDependencies bundled into dist-client.
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=todex-web-pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --ignore-scripts --store-dir /pnpm/store

FROM node:22-alpine AS runtime
ARG TODEX_BUILD_VERSION=DEV0.0.0
LABEL org.opencontainers.image.title="TodeX Web" \
      org.opencontainers.image.description="Browser client for user-managed TodeX backends" \
      org.opencontainers.image.licenses="See LICENSE" \
      org.opencontainers.image.version=$TODEX_BUILD_VERSION
# TODEX_BACKENDS: comma-separated `Name=URL` entries. When set, the workbench
# lists exactly these backends and reaches them through this server's
# /backend/<id>/ proxy; every browser still pairs with each backend.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4173 \
    TODEX_BACKENDS=""
WORKDIR /app
COPY --from=prod-deps --chown=root:root /build/TodeX_web/node_modules ./node_modules
COPY --from=build --chown=root:root /build/TodeX_web/dist-server ./dist-server
COPY --from=build --chown=root:root /build/TodeX_web/dist-client ./dist-client
COPY --chown=root:root package.json ./
# Nothing is written at runtime, so the container can run with --read-only.
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/healthz" || exit 1
STOPSIGNAL SIGTERM
CMD ["node", "dist-server/server/index.js"]
