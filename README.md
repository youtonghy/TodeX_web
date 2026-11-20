# TodeX Web

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="src/renderer/assets/brand/t-icon-dark-beige.png" />
    <source media="(prefers-color-scheme: light)" srcset="src/renderer/assets/brand/t-icon-light.png" />
    <img src="src/renderer/assets/brand/t-icon-dark-beige.png" alt="TodeX" width="120" height="120" />
  </picture>
</p>

<p align="center">
  <strong>The TodeX website and the full TodeX workbench in your browser: run and follow Codex, Claude Code, Pi and other coding agents on your own backends, from any computer.</strong>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a>
</p>

![TodeX Web workbench](docs/screenshots/home-en.png)

TodeX Web serves two things from one site:

- **The website** at `/`: what TodeX does, a live demo of the workbench, documentation, and downloads of the desktop app and the backend installer.
- **The workbench** at `/app`: the same workspace as [TodeX Desktop](https://github.com/youtonghy/TodeX_desktop), in a browser. It connects to your own TodeX backends (`todex-agentd`), which run the agent CLIs on their machines.

It works in light and dark themes, in English, 简体中文, 日本語 and 한국어, and you can self-host it with Docker.

## Contents

- [The website](#the-website)
- [Home at a glance](#home-at-a-glance)
- [Conversations](#conversations)
- [Models, reasoning and work modes](#models-reasoning-and-work-modes)
- [Plans and the task board](#plans-and-the-task-board)
- [Private conversations](#private-conversations)
- [Terminal and SSH](#terminal-and-ssh)
- [Agent desktop tools](#agent-desktop-tools)
- [Backends, groups and config sync](#backends-groups-and-config-sync)
- [Agent CLI management and Agent Calling](#agent-cli-management-and-agent-calling)
- [Usage profile](#usage-profile)
- [Security and browser data](#security-and-browser-data)
- [Deploy](#deploy)
- [Development](#development)

## The website

The landing page introduces TodeX and embeds a live demo: the real workbench replaying a short walkthrough with sample data, without connecting to any backend. **Downloads** lists the desktop packages for each version and platform, with release notes and checksums, plus the one-line backend installer. **Docs** has guides for workspaces, agents and plans, with live demo scenes for each feature.

![TodeX website](docs/screenshots/site-en.png)

## Home at a glance

The home page shows what needs you right now: running conversations, conversations waiting for your reply or approval, today's conversations and token usage, and each agent's plan limits with their reset times. **Customize layout** adds, removes and rearranges the cards.

| Light | Dark |
| :---: | :---: |
| ![Home, light](docs/screenshots/home-en.png) | ![Home, dark](docs/screenshots/home-dark-en.png) |

## Conversations

Workspaces are grouped into folders in the sidebar, each with its conversations and their live status. In a conversation you follow the agent's streamed answer, expand each run's commands, file diffs and tool calls, and answer approval requests once or for the whole conversation. The header shows the agent, Git branch, worktree and the size of the change.

The composer takes images and files, and has `@` (files, folders, other conversations, skills, MCP servers, SSH hosts, apps), `/` (the agent's slash commands) and `#` (skills and MCP servers) menus. Messages sent while the agent is busy wait in a queue, and conversations keep running after you close the tab, because the backend runs them.

| Light | Dark |
| :---: | :---: |
| ![Conversation, light](docs/screenshots/conversation-en.png) | ![Conversation, dark](docs/screenshots/conversation-dark-en.png) |

The running plan and the agent's goal stay above the composer:

| Plan steps | Agent goal |
| :---: | :---: |
| ![Plan steps](docs/screenshots/plan-steps-en.png) | ![Goal](docs/screenshots/goal-en.png) |

## Models, reasoning and work modes

Search for a model, drag the reasoning effort, and pick the work mode: **Implement**, **Plan**, or **Smart** for Claude Code (plan with one model, then run the approved plan with an execution model on auto-approval).

| Model and reasoning effort | Work modes |
| :---: | :---: |
| ![Model picker](docs/screenshots/model-card-en.png) | ![Work modes](docs/screenshots/work-mode-en.png) |

## Plans and the task board

A task board per workspace, with priorities, due dates and status, tasks pinned to the conversations that work on them, and a calendar view.

| Board | Calendar |
| :---: | :---: |
| ![Task board](docs/screenshots/task-board-en.png) | ![Plan calendar](docs/screenshots/plan-calendar-en.png) |

## Private conversations

A private conversation lives only in the backend's memory: nothing goes into history, and it is gone after a restart. Scheduled conversations send their prompt at the time you pick.

![Private conversation](docs/screenshots/private-conversation-en.png)

## Terminal and SSH

Open terminals on the backend machine, manage its SSH hosts, keys, FTP sites and port forwarding, browse remote files over SFTP/FTP, and give agents access to chosen hosts with per-conversation or per-command approval.

![Terminal hosts](docs/screenshots/terminal-hosts-en.png)

## Agent desktop tools

With agent desktop tools on, an agent can drive a browser and operate apps on the backend's computer. You watch it live and can stop it at any time; first use in each conversation needs approval.

| Computer Use live view | Settings |
| :---: | :---: |
| ![Computer Use live view](docs/screenshots/computer-live-en.png) | ![Agent desktop tools](docs/screenshots/settings-agent-desktop-en.png) |

## Backends, groups and config sync

Add as many backends as you like; each stays connected and serves its own workspaces. Pairing needs only the backend's address and a code you compare before approving. **Backend groups** join devices and backends into a group with QR invites and encrypted relays, and **config sync** copies agent accounts, settings, MCP servers and skills from one backend to another.

| Backend connections | Backend groups |
| :---: | :---: |
| ![Backend connections](docs/screenshots/settings-backends-en.png) | ![Backend groups](docs/screenshots/settings-mesh-en.png) |

![Config sync](docs/screenshots/config-sync-en.png)

## Agent CLI management and Agent Calling

See each agent CLI's installed and latest version, update or install it in one click, switch provider accounts, and export or import them as a file. **Agent Calling** lets agents hand tasks to other agents and models, and creates API keys for scripts that call agents through the backend's external API.

| CLI management | Agent Calling |
| :---: | :---: |
| ![CLI management](docs/screenshots/settings-cli-en.png) | ![Agent Calling](docs/screenshots/settings-agent-calling-en.png) |

## Usage profile

Token usage per agent and model, cache hit rate, an activity heatmap and active conversations by month.

![Profile](docs/screenshots/profile-en.png)

## Security and browser data

- **Device verification**: each browser pairs with a backend by comparing a code with the backend's console (or `todex-agentd pair approve`). Approval pins the backend's key and enrolls this browser's signing key; there are no keys to paste. See [device verification](docs/device-verification.md).
- **Encrypted transport**: once paired, every request and the live connection are encrypted, loopback included. Without pairing only a backend on this machine can be reached, and a changed backend key asks you to pair again.
- **End-to-end encrypted history**: history is always encrypted with keys your devices hold; the app reminds you until a recovery key is set.
- **Browser data**: connection settings and preferences live in this browser profile's local storage, and device keys are sealed in IndexedDB. Keys can only be saved on HTTPS or `localhost`. On a shared computer, use **Settings › Backend connections › Clear data**. Anything that runs script on the site's origin (including privileged extensions) can use these credentials, so serve reviewed assets and keep the included Content Security Policy.

## Deploy

The published image is `ghcr.io/youtonghy/todex_web` (`linux/amd64` and `linux/arm64`, tagged with each release and `latest`). It listens on port `4173`, runs as an unprivileged user with a read-only filesystem, and has a health check at `/healthz`. There is no user database.

```bash
docker run -d --name todex-web --restart unless-stopped --read-only \
  -p 4173:4173 ghcr.io/youtonghy/todex_web:latest
```

Or with the bundled [`compose.yaml`](compose.yaml):

```bash
cp .env.example .env   # set TODEX_BACKENDS and, optionally, PORT
docker compose pull
docker compose up -d
```

Pin a version with `TODEX_WEB_TAG=1.2.3`; upgrade with `docker compose pull && docker compose up -d`.

**Self-hosting with fixed backends.** Set `TODEX_BACKENDS` to comma-separated `Name=URL` entries, for example `Home=http://192.168.1.20:7345,Office=https://office.lan:7345`. The browser then talks only to this site, which forwards everything (pairing included) to the configured backends without ever revealing their addresses; the workbench shows exactly those backends, and `/` redirects to `/app`. Every browser still has to pass device verification on each backend, and the backends must have transport encryption on. See [self-hosting](docs/self-hosting.md).

Without `TODEX_BACKENDS`, each browser connects to its own backends directly. Put a reverse proxy (Caddy, nginx, Traefik) in front for TLS and WebSocket upgrades; an HTTPS page needs HTTPS/WSS backends, and each backend must allow the site's origin in `security.cors_origins` (or `TODEX_AGENTD_CORS_ORIGINS`).

`GITHUB_TOKEN` is optional and only raises the GitHub API rate limit for the downloads list, which the server fetches from GitHub Releases and caches for 10 minutes.

## Development

Requirements: Node.js 22+, pnpm 11, and a [TodeX_protocol](https://github.com/youtonghy/TodeX_protocol) checkout next to this directory. Installing dependencies in a clean checkout needs a licensed UI package token in `HEROUI_AUTH_TOKEN`.

```bash
pnpm install
pnpm dev     # website at http://127.0.0.1:5173, workbench at /app, demo at /demo
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
TODEX_BUILD_VERSION=1.2.3 pnpm build
HOST=0.0.0.0 PORT=4173 pnpm start
```

Building the Docker image yourself, and the release workflow: [docs/self-hosting.md](docs/self-hosting.md) and [`compose.build.yaml`](compose.build.yaml). Website assets: [docs/website-assets.md](docs/website-assets.md). App icons: [docs/app-icons.md](docs/app-icons.md).

## Related repositories

- [TodeX Desktop](https://github.com/youtonghy/TodeX_desktop): the desktop app
- [TodeX Backend](https://github.com/youtonghy/TodeX_backend): the `todex-agentd` backend that runs the agents
- [TodeX Native](https://github.com/youtonghy/TodeX_native): the mobile app
- [TodeX Container](https://github.com/youtonghy/TodeX_container): a Docker image with the backend and agent CLIs
- [TodeX Protocol](https://github.com/youtonghy/TodeX_protocol): the client library shared by the desktop and web clients

## License

MIT. See [LICENSE](LICENSE).
