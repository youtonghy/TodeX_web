# TodeX Web

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/renderer/assets/brand/t-icon-dark-beige.png" />
    <source media="(prefers-color-scheme: light)" srcset="src/renderer/assets/brand/t-icon-light.png" />
    <img src="src/renderer/assets/brand/t-icon-dark-beige.png" alt="TodeX" width="160" height="160" />
  </picture>
</p>

The TodeX public website lives at `/`, with the stateless web workbench at `/app`.
The website introduces the product and offers official Desktop and Backend downloads;
the mobile app is not available for download yet. Each workbench browser connects
directly to its own user-managed `todex-agentd` over REST and WebSocket.

The title menu includes CLI management for the active Backend, including installed/latest version status and managed one-click upgrades.
The chat model picker includes a search field above the list, with case-insensitive model name matching, a clear button, and keyboard navigation.

## Requirements

- Node.js 22 or newer
- pnpm 11.24.0
- `TodeX_protocol` checked out next to this directory because the build reuses its `src` protocol implementation
- A reachable `todex-agentd` with browser access enabled

## Development

```bash
export HEROUI_AUTH_TOKEN="<your licensed HeroUI Pro token>"
pnpm install
pnpm dev
```

The renderer reuses the licensed HeroUI Pro layout used by TodeX Desktop, so a valid HeroUI Pro token is required when installing dependencies in a clean checkout.

Open `http://127.0.0.1:5173` for the website, or `http://127.0.0.1:5173/app` for the workbench.

The two entries load independently. Visiting the website does not initialize the
workbench bridge or connect to a Backend. Existing `todex.web.*` browser data stays
available at `/app` on the same origin; no data migration is required. `/app/` and
nested `/app/*` URLs also load the workbench, including on direct visits and refresh.

The website's workbench preview embeds `/demo`: the real sidebar, chat and workbench
panels replaying a scripted walkthrough (new workspace → new conversation → send a
message → receive the answer) from in-memory sample data. It never connects to a
Backend or writes `todex.web.*` storage, pauses while scrolled out of view, and shows
the finished state without animation under `prefers-reduced-motion`. The script and
sample data live in `src/renderer/demo/`. The CSP allows same-origin framing
(`frame-ancestors 'self'`) for this embed only.

## Website downloads

The version and platform selectors are served by `GET /api/releases`, which the
Node server answers with live GitHub Releases data (10-minute in-memory cache;
the last good catalog is served flagged `stale` if a refresh fails). The server
needs public GitHub API access; set `GITHUB_TOKEN` to raise the rate limit.
Website visitors never contact GitHub directly. Desktop and Backend versions
are selected independently; unpublished architectures are not offered.
Download links point to official release assets, with release notes and SHA256
checksum files alongside them. Product copy is based on the ecosystem, Desktop,
Backend, and Web READMEs. The original generated sky asset and its prompt are
documented in [website assets](docs/website-assets.md).

## Production

```bash
TODEX_BUILD_VERSION=1.2.3 pnpm build
HOST=0.0.0.0 PORT=4173 pnpm start
```

CI should set `TODEX_BUILD_VERSION` to the release version while building. Local
development builds display `DEV0.0.0`; `package.json` keeps the valid placeholder
version `0.0.0`.

### Docker

Published images live at `ghcr.io/youtonghy/todex_web`, tagged with each release
version plus `latest`. The container listens on `4173`, runs as the unprivileged
`node` user, and ships a health check against `GET /healthz`. `HOST` and `PORT`
are the only required runtime settings; `GITHUB_TOKEN` is optional and only
raises the GitHub API rate limit used by `GET /api/releases`. There is no
Backend proxy, user database, or session store.

Run it directly:

```bash
docker run -d --name todex-web --restart unless-stopped \
  -p 4173:4173 \
  ghcr.io/youtonghy/todex_web:latest
```

Or use the bundled [`compose.yaml`](compose.yaml):

```bash
cp .env.example .env   # optional: change PORT to pick the host port
docker compose pull
docker compose up -d
docker compose logs -f web
```

Pin a version with `TODEX_WEB_TAG=1.2.3 docker compose up -d`. Upgrade with
`docker compose pull && docker compose up -d`.

```yaml
services:
  web:
    image: ghcr.io/youtonghy/todex_web:${TODEX_WEB_TAG:-latest}
    restart: unless-stopped
    ports:
      - "${PORT:-4173}:4173"
    environment:
      HOST: 0.0.0.0
      PORT: "4173"
```

Put a trusted reverse proxy (Caddy, nginx, Traefik) in front of the container to
terminate TLS. An HTTPS page must use HTTPS/WSS for non-loopback Backends, and
each Backend must allow the deployed site origin through CORS and, when
relevant, browser Private Network Access.

#### Building the image

The `docker` GitHub Actions workflow is triggered manually (**Actions → docker →
Run workflow**) with a release version such as `1.2.3`. It pushes
`ghcr.io/youtonghy/todex_web:<version>` (plus `:latest` by default) and requires
a `HEROUI_KEY` repository secret (the `hp_…` key) so `hpsetup` can fetch the
licensed `@heroui-pro/react` contents. The `protocol_ref` input pins which
`youtonghy/TodeX_protocol` branch or tag the protocol sources are compiled from.

To build locally, the image needs a sibling `TodeX_protocol` checkout as the
`todexprotocol` build context and `HEROUI_KEY` exported in the shell. The key is
passed as a BuildKit secret and never stored in a layer.
[`compose.build.yaml`](compose.build.yaml) layers a `build` section onto the
service:

```bash
export HEROUI_KEY="hp_..."
docker compose -f compose.yaml -f compose.build.yaml up -d --build
# TODEX_PROTOCOL_DIR=/path/to/TodeX_protocol and TODEX_BUILD_VERSION=1.2.3 override the defaults
```

The equivalent plain `docker buildx` invocation:

```bash
docker buildx build \
  --build-context todexprotocol=/path/to/TodeX_protocol \
  --secret id=HEROUI_KEY,env=HEROUI_KEY \
  --build-arg TODEX_BUILD_VERSION=1.2.3 \
  -t todex-web .
```

## Device verification

Enter your Backend address, request device verification, then compare the full code in the Backend TUI (`d`) and approve with `a` or reject with `r`. Approval saves the token for that Backend. Encryption public keys still require QR or manual import. See [device verification](docs/device-verification.md) for expiry, compatibility, and credential handling.

## Browser data and credentials

Connection profiles, Backend tokens, selected workspaces, layout preferences, event cursors, and bounded local caches are stored under `todex.web.*` in the browser's `localStorage`. They are isolated by browser origin and browser profile, not by a TodeX account.

Any script executing on the site origin or a privileged browser extension can read these credentials. Deploy immutable reviewed assets, use the included Content Security Policy, avoid third-party scripts, and use the in-app **Clear data** action on shared devices.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## App icons

Desktop and Web share the same T artwork, with light and dark variants for the interface and documentation. See [app icon assets](docs/app-icons.md) for previews, file roles, and update instructions.
