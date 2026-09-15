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

FROM node:22-alpine AS base
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
RUN pnpm install --frozen-lockfile
ARG HPSETUP_VERSION=latest
RUN --mount=type=secret,id=HEROUI_KEY,env=HEROUI_KEY \
    pnpm dlx "hpsetup@$HPSETUP_VERSION" "$HEROUI_KEY"
# Protocol sources resolve their @noble/* imports through this node_modules.
RUN mkdir -p /build/TodeX_protocol \
    && ln -s /build/TodeX_web/node_modules /build/TodeX_protocol/node_modules
COPY --from=todexprotocol src /build/TodeX_protocol/src

FROM deps AS build
COPY . .
ARG TODEX_BUILD_VERSION=DEV0.0.0
ENV TODEX_BUILD_VERSION=$TODEX_BUILD_VERSION
RUN pnpm lint && pnpm typecheck && pnpm build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4173
WORKDIR /app
COPY --from=prod-deps /build/TodeX_web/node_modules ./node_modules
COPY --from=build /build/TodeX_web/dist-server ./dist-server
COPY --from=build /build/TodeX_web/dist-client ./dist-client
COPY package.json ./
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/healthz" || exit 1
CMD ["node", "dist-server/server/index.js"]
