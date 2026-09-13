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

## Requirements

- Node.js 22 or newer
- pnpm 11.24.0
- `TodeX_app` checked out next to this directory because the build reuses its `src/lib` protocol implementation
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

## Website downloads

The version and platform selectors use `src/renderer/site/releases.json`, a
snapshot of published stable releases and their actual GitHub asset URLs. Refresh
it before preparing a website release:

```bash
pnpm releases:refresh
```

The refresh needs public GitHub API access, but no token. Website visitors do not
call the GitHub API. Desktop and Backend versions are selected independently;
unpublished architectures are not offered. Download links point to official
release assets, with release notes and SHA256 checksum files alongside them.
Product copy is based on the ecosystem, Desktop, Backend, and Web READMEs.
The original generated sky asset and its prompt are documented in
[website assets](docs/website-assets.md).

## Production

```bash
TODEX_BUILD_VERSION=1.2.3 pnpm build
HOST=0.0.0.0 PORT=4173 pnpm start
```

CI should set `TODEX_BUILD_VERSION` to the release version while building. Local
development builds display `DEV0.0.0`; `package.json` keeps the valid placeholder
version `0.0.0`.

### Docker image

The `docker` GitHub Actions workflow is triggered manually (**Actions → docker →
Run workflow**) with a release version such as `1.2.3`. It builds
`ghcr.io/<owner>/todex_web:<version>` (plus `:latest` by default) and requires a
`HEROUI_KEY` repository secret (the `hp_…` key) so `hpsetup` can fetch the
licensed `@heroui-pro/react` contents. The `protocol_ref` input pins which
`youtonghy/TodeX` branch or tag the protocol sources are compiled from.

To build the image locally, point the `todexapp` build context at a sibling
`TodeX_app` checkout:

```bash
docker buildx build \
  --build-context todexapp=/path/to/TodeX_app \
  --secret id=HEROUI_KEY,env=HEROUI_KEY \
  -t todex-web .
```

Run it with `docker run -p 4173:4173 todex-web`; `HOST` and `PORT` are supported.

The Node server exposes the site and `GET /healthz`. It has no Backend proxy, user database, session store, or secret configuration.

Terminate TLS at a trusted reverse proxy. An HTTPS page must use HTTPS/WSS for non-loopback Backends. Each Backend must allow the deployed site origin through CORS and, when relevant, browser Private Network Access.

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
