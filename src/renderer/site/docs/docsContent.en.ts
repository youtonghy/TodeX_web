// English docs content pack — the reference translation. Other locales mirror
// this structure (same slugs, same sections) and translate title/description/
// body while keeping code, commands, and API paths verbatim.
import type { DocsLocalePack } from './docsContent';

const body = (markdown: string) => `${markdown.trim()}\n`;

export const enDocs: DocsLocalePack = {
  sections: {
    'section-introduction': 'Introduction',
    'section-backend': 'Backend',
    'section-desktop': 'Desktop',
    'section-mobile': 'Mobile',
  },
  pages: {

    // ------------------------------------------------------------- Introduction

    'introduction': {
      slug: 'introduction',
      title: 'Overview',
      description: 'What TodeX is, how the pieces fit together, and where to start.',
      body: body(`
TodeX is a **self-hostable multi-agent coding workbench**. One Rust backend —
\`todex-agentd\` — orchestrates the coding agents you already use (Codex,
Claude Code, Pi, Devin, OpenCode, Grok Build, Antigravity, and any ACP-compatible agent)
behind a single authenticated API. Desktop, web, and mobile clients connect
to it over an encrypted channel.

Nothing is proxied through TodeX infrastructure: the backend runs on your
machine or your server, agents run under your own accounts and credentials,
and your code never leaves the workspace roots you authorize.

## The moving parts

\`\`\`text
TodeX Desktop (Electron)          Todex Mobile (Swift)
TodeX Web client ──────┐                 │
                       │  REST /v2/*  +  WebSocket /v2/ws
                       │  Ed25519 device auth + X25519 / ML-KEM-768
                       v
               todex-agentd  (Rust · Tokio · Axum)
                       │
        ┌──────────────┼───────────────┬──────────────┐
        v              v               v              v
   codex app-      claude stream-   pi rpc      acp profiles
   server (JSON)   json             (devin, opencode, …)
\`\`\`

| Component | What it is |
| --- | --- |
| **Backend** | \`todex-agentd\`, the daemon that owns conversations, workspaces, provider drivers, and security. |
| **Desktop** | Electron + React 19 client with a three-pane workbench. |
| **Web** | This site serves the same workbench over HTTP — nothing to install. |
| **Mobile** | Native Swift + UIKit client for iPhone and iPad (in development). |

## Highlights

- **Agent-agnostic.** Conversations are provider-agnostic; swap agents per
  thread or run several side by side on the same workspace.
- **Persistent conversations.** Every conversation is a folder on the backend
  host — manifest, append-only event journal, snapshots, and native provider
  state — so turns resume across client reconnects and daemon restarts.
- **Fail-closed security.** Devices enroll through a verification code, every
  request is Ed25519-signed, and transport can upgrade to post-quantum
  ML-KEM-768.
- **Full workbench.** Streaming chat with approvals, embedded terminal, Git
  status and diffs, skills/MCP catalogs, and task boards — identical on
  desktop and web.

## Where to go next

| Goal | Doc |
| --- | --- |
| Get running in ten minutes | [Quick start](/docs/introduction/quick-start) |
| Learn the vocabulary | [Concepts](/docs/introduction/concepts) |
| Run the backend | [Backend overview](/docs/backend) |
| Use the desktop app | [Desktop overview](/docs/desktop) |
`),
    },

    'introduction/quick-start': {
      slug: 'introduction/quick-start',
      title: 'Quick start',
      description: 'Install the backend, pair a client, and start your first agent conversation.',
      body: body(`
You need a machine that can run the backend and at least one authenticated
agent CLI (\`codex\`, \`claude\`, \`pi\`, \`devin\`, \`opencode\`, …).

## 1. Install the backend

On macOS, Linux, or WSL — no Rust toolchain required:

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/youtonghy/TodeX_backend/main/install.sh | bash
\`\`\`

The script installs \`todex-agentd\` into \`~/.local/bin\`, verifies the
release checksums, and restarts a running managed daemon. Pin a release with
\`install.sh install --version 2.0.2\`, or build from source with
\`cargo build --release\`.

## 2. Start it and approve your device

\`\`\`bash
todex-agentd tui
\`\`\`

The TUI shows daemon status, live logs, and pairing tools. When a client
requests access for the first time, press \`d\` to show the verification code,
compare it with the client, then press \`a\` to approve (or \`r\` to reject).
Quitting the TUI leaves the daemon running in the background.

## 3. Connect a client

- **Desktop** — install a package from the release page, open Settings, and
  enter only the backend URL (default \`http://127.0.0.1:7345\`). Complete
  device verification, which also pins the backend's encryption key.
- **Web** — open \`/app\` on a hosted TodeX site, or the page served by your
  own deployment, and point it at your backend the same way.

## 4. Create a workspace and a conversation

Add a project directory inside a configured workspace root, mark it trusted,
then start a conversation with any available provider. Prompts, approvals,
terminal, and Git state all stream over the same connection.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Client can't reach the backend | \`todex-agentd daemon status\`; the port is 7345 by default |
| \`401\` on every request | Device not approved — redo verification in the TUI |
| WebSocket fails while REST works | Encryption mismatch — re-pair the device in Settings |
| Agent shows unavailable | The provider CLI isn't installed or logged in on the host |
`),
    },

    'introduction/concepts': {
      slug: 'introduction/concepts',
      title: 'Concepts',
      description: 'The vocabulary behind every TodeX screen: providers, workspaces, conversations, devices.',
      body: body(`
## Providers and provider drivers

A *provider* is an agent engine the backend can drive — Codex, Claude Code,
Pi, Grok Build, Devin, OpenCode, Antigravity, or any ACP 2.0 profile declared in
\`config.toml\`. Each provider has a native driver (JSON-RPC app-server,
stream-json, RPC, or ACP stdio) so capabilities like skills, slash commands,
and model catalogs come straight from the installed CLI instead of being
approximated.

*Provider accounts* (the cc-switch model) let you keep several account
profiles per agent — TodeX activates one by rewriting the agent's own global
config, so sessions started outside TodeX behave identically.

## Workspaces and trust

A *workspace* is a project directory under a configured *workspace root*
(\`TODEX_AGENTD_WORKSPACE_ROOT\`, default \`~/projects\`). New workspaces are
untrusted by default: trusting one is an explicit, owner-scoped decision that
controls what agents may execute there. Untrusting a workspace cancels its
active turns.

## Conversations

A conversation is a folder under \`$DATA_DIR/conversations/<uuid>/\`:

| File | Contents |
| --- | --- |
| \`manifest.json\` | Metadata, active provider profile, workspace, timestamps |
| \`events.jsonl\` | Append-only event journal — the source of truth for history |
| \`snapshot.json\` | Compact state snapshot for fast reloads |
| \`provider-state.json\` | Native engine state for turn resumption |

Turns are optimistic-concurrency protected: a second mutation while a turn
runs returns \`409 Conflict\` instead of silently queueing.

## Devices and pairing

Clients don't log in with passwords. Each client *device* generates an
Ed25519 key and requests enrollment; you approve it once by comparing a code
in the backend TUI. From then on every HTTP request carries a device
signature, and devices can be revoked individually.

## Transport encryption

| Mode | Meaning |
| --- | --- |
| \`none\` | Plaintext (loopback-only setups) |
| \`x25519\` | X25519 + ChaCha20-Poly1305 |
| \`ml-kem-768\` | NIST post-quantum ML-KEM-768 (default for pairing) |

The backend's encryption key is delivered and verified during device
pairing: the verification code covers the key, so comparing the code also
authenticates it.

## Tenants

All data is namespaced by \`tenant_id\`; queries, journals, and subscriptions
can never cross tenants.
`),
    },

    // ------------------------------------------------------------------ Backend

    'backend': {
      slug: 'backend',
      title: 'Backend overview',
      description: 'todex-agentd — the Rust daemon that orchestrates agents, conversations, and security.',
      body: body(`
\`todex-agentd\` is the core of TodeX: a single Rust binary built on Tokio and
Axum that exposes one REST surface (\`/v2/*\`) and one multiplexed WebSocket
(\`/v2/ws\`) for event streams, approvals, and terminal sessions.

## Provider drivers

| Provider | Transport | Notes |
| --- | --- | --- |
| **Codex** | JSON-RPC app-server | \`start\`, \`turn\`, \`status\`, \`stop\`, \`attach\`, \`replay\`, \`interrupt\` |
| **Claude Code** | stream-json | Drives the Claude CLI; built-in model aliases without a gateway |
| **Pi** | Native RPC | Command discovery, dynamic models, interactive tool approval |
| **Grok Build** | Managed CLI | Versioned, self-updatable like other managed CLIs |
| **Antigravity** | stream-json | Drives \`agy\` print mode; a TodeX PreToolUse hook in \`~/.gemini/config\` asks for approval per tool (ask / auto / full access) and carries TodeX's MCP tools |
| **ACP 2.0** | stdio profiles | Devin (\`devin acp\`), OpenCode (\`opencode acp\`), custom \`config.toml\` profiles |

The backend never mutates provider installations to serve a UI: capability
catalogs (skills, MCP servers, slash commands, models) are introspected live
with project-over-user precedence, and skills are injected into prompts by
\`resourceId\` rather than uploaded.

## Conversation engine

All turn state lives in conversation folders, journaled as append-only
events with snapshots and native provider state. Subscriptions replay from a
sequence number (\`afterSequence\`) so clients resynchronize after reconnects
without losing messages.

## One socket, many channels

\`/v2/ws\` multiplexes conversation subscriptions, prompt dispatch,
permission decisions, PTY terminal sessions, and engine controls over a
single connection — with heartbeat detection and UTF-8 frame enforcement.

## Managing the daemon

\`todex-agentd\` ships an interactive TUI (\`todex-agentd tui\`) for status,
logs, device approval, and pairing QR codes, plus a PID-file daemon mode
(\`daemon start|stop|restart|status\`) and login autostart
(\`daemon autostart enable\`). See [Install & run](/docs/backend/install).
`),
    },

    'backend/install': {
      slug: 'backend/install',
      title: 'Install & run',
      description: 'Install script, building from source, run modes, and updates.',
      body: body(`
## Install script (macOS / Linux / WSL)

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/youtonghy/TodeX_backend/main/install.sh | bash
\`\`\`

\`\`\`bash
install.sh install                 # install or update to the latest release
install.sh update                  # update an existing install
install.sh install --version 2.0.2 # pin a specific release
install.sh status                  # installed/latest versions and daemon state
install.sh uninstall               # stop the daemon and remove the binary
install.sh uninstall --purge       # also remove the ~/.todex-agent data dir
\`\`\`

The script installs to \`~/.local/bin\` (override with \`--prefix\` or
\`TODEX_INSTALL_DIR\`), verifies \`SHA256SUMS\`, keeps one rollback copy, and
restarts a running managed daemon. The prebuilt Linux binary needs glibc
2.28+; musl distributions such as Alpine must build from source. WSL is
detected automatically.

A pinned \`--version\` stays only with \`TODEX_AUTO_UPDATE=0\` — otherwise
\`serve\`, \`tui\`, and \`daemon start\` self-update on launch, and a running
daemon restarts into the new release once no agent has run for five minutes.

## Build from source

\`\`\`bash
cargo build --release
\`\`\`

Requires Rust 1.80+ (MSRV). The binary is \`todex-agentd\`.

## Run modes

\`\`\`bash
# Interactive TUI — status, logs, device approval, pairing QR codes
todex-agentd tui

# Foreground server
todex-agentd serve --host 127.0.0.1 --port 7345

# Background daemon (PID file under the data dir)
todex-agentd daemon start
todex-agentd daemon status
todex-agentd daemon restart
todex-agentd daemon stop

# Launch at login (launchd / systemd user service / registry Run key)
todex-agentd daemon autostart enable
\`\`\`

Quitting the TUI leaves the daemon running. The pairing QR code carries only
the server address and renders as solid terminal cells; press \`b\` in the QR
popup to open a square SVG version in the browser when the code doesn't fit
the terminal. The credentials popup shows the transport key fingerprint.
`),
    },

    'backend/configuration': {
      slug: 'backend/configuration',
      title: 'Configuration',
      description: 'config.toml, environment variables, and how they resolve.',
      body: body(`
## Precedence

1. Command-line arguments
2. Environment variables
3. \`$TODEX_AGENTD_DATA_DIR/config.toml\` (default \`~/.todex-agent/config.toml\`)
4. Built-in defaults

## Options

| Option | CLI flag | Environment | Default |
| --- | --- | --- | --- |
| Host | \`--host\` | \`TODEX_AGENTD_HOST\` | \`127.0.0.1\` |
| Port | \`--port\` | \`TODEX_AGENTD_PORT\` | \`7345\` |
| Data directory | \`--data-dir\` | \`TODEX_AGENTD_DATA_DIR\` | \`~/.todex-agent\` |
| Workspace roots | \`--workspace-root\` (repeatable) | \`TODEX_AGENTD_WORKSPACE_ROOT\` / \`TODEX_AGENTD_WORKSPACE_ROOTS\` | \`~/projects\` |
| Default agent | — | \`TODEX_AGENTD_DEFAULT_AGENT\` | \`codex\` |
| Codex binary | — | \`TODEX_AGENTD_CODEX_BIN\` | \`codex\` |
| Claude binary | — | \`TODEX_AGENTD_CLAUDE_BIN\` | \`claude\` |
| Pi binary | — | \`TODEX_AGENTD_PI_BIN\` | \`pi\` |
| Device auth | — | \`TODEX_AGENTD_ENABLE_AUTH\` | \`true\` |
| Pairing encryption | — | \`TODEX_AGENTD_PAIRING_ENCRYPTION\` | \`ml-kem-768\` |

## Example \`config.toml\`

\`\`\`toml
host = "127.0.0.1"
port = 7345
pairing_encryption = "ml-kem-768"
data_dir = "~/.todex-agent"
workspace_root = "~/projects"
# workspace_roots = ["~/projects", "/srv/repos"]

[agent]
default_agent = "codex"
codex_bin = "codex"
claude_bin = "claude"
pi_bin = "pi"
# Stop a turn whose provider produces no output for this many minutes (0 disables).
provider_idle_timeout_minutes = 60

[agent.acp_profiles.default]
command = "mcp-server"
args = ["--stdio"]

[security]
enable_auth = true
enable_tls = false
\`\`\`

> **Note:** \`enable_tls = true\` is intentionally blocked on the native
> listener to prevent false security assumptions. For remote access,
> terminate TLS at a trusted reverse proxy such as Nginx, Caddy, or
> Cloudflare Tunnel.
`),
    },

    'backend/security': {
      slug: 'backend/security',
      title: 'Security & pairing',
      description: 'Device verification, request signing, workspace boundaries, and transport encryption.',
      body: body(`
TodeX is fail-closed: nothing talks to the backend until a device is
explicitly approved, and every request is cryptographically signed.

## Device verification

Each client device generates an Ed25519 key pair and requests enrollment. The
flow is human-verified:

1. Enter only the backend URL. The client shows a random verification code
   and the transport key fingerprint (\`XXXX-XXXX-XXXX-XXXX\`), then waits.
2. In the backend TUI, press \`d\` to open the device panel and compare the
   full code; the fingerprint is shown next to it.
3. Press \`a\` to approve or \`r\` to reject. Approved devices appear in the
   same panel; \`x\` revokes the selected device.

After approval, every HTTP request carries the device signature —
unauthorized requests are rejected with \`401 Unauthorized\`. The code is
computed over a transcript that includes the transport protocol and public
key, so approval also authenticates the backend's encryption key: the client
pins the device key, protocol, and public key in one step and connects.

## Transport encryption

| Mode | Suite | When |
| --- | --- | --- |
| \`none\` | Plaintext | Loopback-only setups |
| \`x25519\` | X25519 + ChaCha20-Poly1305 | General remote access |
| \`ml-kem-768\` | NIST post-quantum ML-KEM | Default for pairing |

Keys are delivered only through device pairing — there is no manual key
import. Settings shows the pinned protocol, key fingerprint, and verified
state. Profiles holding a key that was saved without pairing verification
are refused on every host, loopback included, until they are re-paired.
Plaintext \`none\` is allowed only on loopback.

## Workspace boundaries

\`workspace_roots\` restricts every file and directory API to authorized
scopes — clients cannot read outside them. Per-workspace trust is
owner-scoped, new workspaces start untrusted, and revoking trust cancels
active turns and detaches the workspace without deleting its conversations.

## Isolation

- **Tenants** — every query, journal, and subscription is scoped by
  \`tenant_id\`.
- **Subprocesses** — agent CLIs run with sanitized environments so
  administrative variables don't leak into provider sessions.
- **TLS** — the native listener refuses \`enable_tls\`; terminate TLS at a
  reverse proxy instead of trusting a bypass.
`),
    },

    'backend/api': {
      slug: 'backend/api',
      title: 'API reference',
      description: 'The /v2 REST surface and the multiplexed /v2/ws WebSocket.',
      body: body(`
All endpoints live under \`/v2\`. Every request must carry a registered
device signature; bodies and responses are JSON.

## System

| Endpoint | Purpose |
| --- | --- |
| \`GET /health\` | Liveness probe |
| \`GET /v2/version\` | Daemon version, workspace root, capabilities |

## Workspaces

| Endpoint | Purpose |
| --- | --- |
| \`GET /v2/workspaces\` | Cached workspaces for the current tenant |
| \`PUT /v2/workspaces\` | Merge workspace caches; returns canonical IDs and auto-trusts undecided directories inside the workspace boundary |
| \`GET \\| PUT /v2/workspaces/{id}/trust\` | Read or change owner-scoped execution trust (new workspaces are untrusted) |
| \`DELETE /v2/workspaces/{id}\` | Revoke trust, cancel active turns, remove the workspace (conversations are kept) |
| \`GET /v2/workspace/entries?workspace=&query=\` | File/folder suggestions for the \`@\` picker |
| \`GET /v2/workspace/directories?path=\` | Directory tree explorer |
| \`GET /v2/workspace/file?path=\` | Read a file inside the sandbox root |
| \`GET /v2/browser/fetch?url=\` | Proxy a web resource fetch |

## Providers

| Endpoint | Purpose |
| --- | --- |
| \`GET /v2/providers\` | Providers and their active states |
| \`GET /v2/providers/versions\` | Installed vs latest CLI versions for each agent |
| \`POST /v2/providers/{provider}/install\` | Install a missing managed CLI (vendor's official script) |
| \`POST /v2/providers/{provider}/upgrade\` | Start a single-flight CLI upgrade; active agent work blocks it |
| \`GET /v2/providers/upgrades/{operationId}\` | Async install/upgrade progress and verified version |
| \`GET /v2/providers/models?provider=&workspace=\` | Provider's model catalog |
| \`GET /v2/providers/commands?provider=&workspace=\` | Slash commands and extensions |

Provider accounts live under \`/v2/agent-providers/{agent}\`, with
\`GET .../export\` and \`POST .../import\` moving profiles between hosts as a
signed JSON file.

## Conversations

| Endpoint | Purpose |
| --- | --- |
| \`GET /v2/conversations\` | Persisted conversations for the tenant |
| \`POST /v2/conversations\` | Create a conversation folder with a provider |
| \`GET /v2/conversations/{id}\` | Manifest and details |
| \`GET /v2/conversations/{id}/events?afterSequence=&limit=\` | Paginated event journal; \`beforeSequence=N\` pages backwards for lazy history |
| \`POST /v2/conversations/{id}/prompt\` | Dispatch a turn — text, typed content, model, reasoning effort, skill resource IDs |
| \`POST /v2/conversations/{id}/cancel\` | Cancel the running turn |
| \`POST /v2/conversations/{id}/permissions/{permissionId}\` | Resolve an interactive approval |

A second mutation while a turn is running returns \`409 Conflict\` — turns
are not silently queued.

## WebSocket — \`/v2/ws\`

One connection multiplexes:

- \`conversation.subscribe\` — live event journals with sequence-based resume
- Prompt dispatch and cancellation
- Permission decisions
- \`terminal.open\` / \`terminal.input\` / \`terminal.resize\` / \`terminal.close\` — PTY sessions
- Local Codex engine process control

Frames enforce UTF-8 length limits; heartbeats detect dead connections.

The authoritative contract is [docs/API.md](https://github.com/youtonghy/TodeX_backend/blob/main/docs/API.md)
in the backend repository.
`),
    },

    // ------------------------------------------------------------------ Desktop

    'desktop': {
      slug: 'desktop',
      title: 'Desktop overview',
      description: 'The Electron client — a three-pane workbench for macOS, Windows, and Linux.',
      body: body(`
TodeX Desktop is a native client for \`todex-agentd\` built with Electron 44,
React 19, Vite 7, Tailwind CSS v4, and HeroUI Pro. It shares the
\`@todex/protocol\` transport library with the web client, so the workbench
is identical — the desktop app adds native integrations on top.

## Three panes

- **Left sidebar** — workspace explorer, conversation history with agent
  badges, thread lifecycle (New, Rename, Fork, Delete), and quick settings.
- **Center chat** — streaming Markdown timeline with Shiki highlighting and
  KaTeX math, interactive approval cards (commands, diffs, tool calls), and
  a prompt box with model + reasoning-effort pickers, \`@\` reference menu (files, folders, chats, skills, MCP),
  \`/\` slash commands, \`#\` skill/MCP suggestions, and Codex Fast mode.
- **Right workbench** — tabbed drawer with Slash Commands reference, live
  Git Diff, an embedded xterm.js PTY terminal, the Skills/MCP Capabilities
  catalog, and Experiments.

## Desktop-only extras

- Native file and directory pickers for loopback workspaces.
- Electron \`userData\` persistence, secure IPC via \`contextBridge\`
  (\`nodeIntegration: false\`), and per-build diagnostics logs.
- Connection diagnostics that distinguish unreachable backends, bad URLs,
  auth failures, deprecated \`/v1\` endpoints, and WebSocket mismatches.

## Releases

Prebuilt packages ship from GitHub Releases: Windows NSIS (x64 + ARM64),
macOS Apple Silicon DMG, Linux x64 AppImage, with SHA-256 checksums. See
[Set up & build](/docs/desktop/setup) for development builds.
`),
    },

    'desktop/setup': {
      slug: 'desktop/setup',
      title: 'Set up & build',
      description: 'Prerequisites, development mode, and release packaging.',
      body: body(`
## Requirements

- Node.js 22+, pnpm 11+
- A running \`todex-agentd\` backend (default \`http://127.0.0.1:7345\`)
- A HeroUI Pro license token for package installation

## Install

\`@heroui-pro/react\` authenticates during install, so export the token first:

\`\`\`bash
export HEROUI_AUTH_TOKEN="your_heroui_key"   # or: export HEROUI_AUTH_TOKEN="$HEROUI_KEY"
pnpm install
pnpm run dev
\`\`\`

> **Warning:** never commit the token to the repository.

If the Electron binary download breaks midway, repair it with
\`rm -rf node_modules/electron/dist && node node_modules/electron/install.js\`.

## Scripts

| Command | What it does |
| --- | --- |
| \`pnpm run dev\` | Predev checks, then the app in Vite dev mode (1280×800 window) |
| \`pnpm run build\` | Build main, preload, and renderer |
| \`pnpm run package\` | Package with electron-builder |
| \`pnpm run preview\` | Preview the production build |
| \`pnpm run typecheck\` | Typecheck main + renderer targets |
| \`pnpm run check:electron\` | Verify the native Electron binary |

## Releases

Packages are produced by the **Release desktop packages** GitHub workflow:
enter a semver like \`1.2.3\` and it publishes Windows NSIS (x64 + ARM64), a
macOS Apple Silicon DMG, a Linux x64 AppImage, and SHA-256 sums to the
release tag. Development builds report \`DEV0.0.0\`; the workflow needs
\`HEROUI_AUTH_TOKEN\` and — while the protocol repo is private —
\`PROTOCOL_REPO_TOKEN\` Actions secrets. macOS releases require signing; see
\`docs/automatic-updates.md\` in the desktop repo.

## Development logs

Builds stamped \`DEV0.0.0\` write diagnostics to
\`userData/logs/todex-desktop-debug.log\` (override with
\`TODEX_DESKTOP_LOG_PATH\`). Logs cover window, IPC, HTTP, WebSocket, and
uncaught errors with tokens, cookies, keys, and attachments redacted.
`),
    },

    'desktop/connect': {
      slug: 'desktop/connect',
      title: 'Connect a backend',
      description: 'Pairing flows, device verification, and connection diagnostics.',
      body: body(`
The desktop app talks to one backend at a time over REST + WebSocket; every
request is signed with the device's enrolled key.

## Ways to pair

| Method | How |
| --- | --- |
| **Device verification** | Enter the backend URL; the app shows a code and the transport key fingerprint — approve it in the backend TUI (\`d\`, then \`a\`); the encryption key is pinned and the app connects. |

Settings shows the pinned protocol, key fingerprint, and verified state.
Use **Re-pair** to run verification again; changing the backend address
clears the pinned key.

## Managing providers from the client

The pairing panel lists the backend's Codex, Pi, Claude Code, Grok Build, and
ACP CLI inventory with installed vs latest versions, installs missing CLIs
in one click, and starts managed upgrades. Provider accounts can be exported
and imported as a JSON file to sync agent credentials between hosts — the
file contains keys in plain text, so handle it like a secret.

## Diagnostics

| State | Cause | Fix |
| --- | --- | --- |
| Backend unreachable | \`/v2/version\` or \`/health\` fails | Start \`todex-agentd\`; check the port |
| Invalid backend URL | URL can't be parsed | Use \`http://127.0.0.1:7345\` form |
| Authentication failed | HTTP 401/403 | Re-run device verification |
| Deprecated protocol | URL path contains \`/v1\` | Switch to \`/v2\` |
| WebSocket failure | REST works, \`/v2/ws\` fails | Firewall, token, or crypto mismatch — re-pair the device |
| Agent unavailable | Provider shows \`available = false\` | Install/authenticate the agent CLI on the backend host |
`),
    },

    'desktop/workbench': {
      slug: 'desktop/workbench',
      title: 'The workbench',
      description: 'Sidebar, chat panel, workbench tabs, and keyboard shortcuts.',
      body: body(`
The workbench is the same on desktop and web. This page uses desktop terms;
where the web differs it's noted.

## Left sidebar

Workspaces on top, conversations below. Conversation rows show the active
agent badge and run state; right-click actions cover New, Rename, Fork, and
Delete. Workspaces can be added from any directory under a configured
workspace root and are trusted explicitly.

## Center — chat

- Streaming Markdown with Shiki code highlighting and KaTeX math.
- Approval cards for commands, file diffs, and tool calls — resolve them
  inline while the turn runs.
- Prompt box: \`@\` opens a reference menu — pick a type, then search it:
  \`@file:\`, \`@folder:\`, \`@chat:\` (attaches another conversation of the
  workspace as a Markdown file), \`@skill:\` and \`@mcp:\`; \`/\` runs a provider slash
  command, \`#\` references a skill or MCP capability. The model picker
  matches names case-insensitively and carries a draggable reasoning-effort
  control plus Codex Fast mode where the provider supports it.
- Reasoning and tool details mount lazily on expansion; final answers stay
  isolated from context and execution noise.

## Right — workbench tabs

| Tab | Contents |
| --- | --- |
| Slash Commands | Reference of the provider's commands |
| Git Diff | Live working-directory changes |
| Terminal | Embedded xterm.js PTY with direct keyboard input and auto resize |
| Capabilities | Read-only catalog of active Skills and MCP servers |
| Experiments | Feature toggles and developer diagnostics |

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| ⌘B / Ctrl B | Toggle the left sidebar |
| ⌘⌥B / Ctrl Alt B | Toggle the workbench aside |
| ⇧⌘G / Ctrl Shift G | Git actions |
| ⌘N (⌥N on web) | New conversation |
| ⇧⌘N (⌥⇧N on web) | Add a workspace |
| ⇧⌘K / Ctrl Shift K | Kanban task board |
| ⇧⌘T (⌥⇧T on web) | Terminal view (SSH hosts, keys, remote files) |

> Browsers reserve ⌘N / ⇧⌘N / ⇧⌘T, so the web client uses the Option modifier
> for the two "new" actions and the Terminal view. Everything else is identical.

Holding the modifier briefly reveals shortcut hint badges in the UI.
`),
    },

    // ------------------------------------------------------------------- Mobile

    'mobile': {
      slug: 'mobile',
      title: 'Mobile',
      description: 'The native iPhone & iPad client — coming soon.',
      body: body(`
> **Coming soon.** The mobile client is in active development; this page
> tracks what's planned and will be replaced by full documentation when the
> first beta ships.

Todex Mobile is a native Swift + UIKit app for iPhone and iPad that pairs
with the same \`todex-agentd\` backend — the same workspaces, conversations,
approvals, and terminal sessions in your pocket.

## Planned

- **Camera pairing** — scan the backend's QR code to fill in its address,
  then complete device verification exactly as on desktop.
- **Chat + console** — a two-pane layout on wide screens: conversation
  timeline on one side, a workbench with terminal, files, browser preview,
  and Git on the other.
- **Full turn control** — approvals, plan-mode feedback, model and
  reasoning pickers, message queueing, and local notifications when a
  conversation finishes while you're away.
- **Same security model** — Ed25519 device signatures and X25519 /
  ML-KEM-768 transport encryption, with tokens stored in the iOS Keychain.

## In the meantime

The [web client](/docs/introduction/quick-start) already works in mobile
browsers against a reachable backend — it's the same workbench UI, just not
a native shell. For backend pairing details see
[Security & pairing](/docs/backend/security).
`),
    },
  },
};
