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
Claude Code, Pi, Devin, OpenCode, Grok Build, Antigravity, omp, and any ACP-compatible agent)
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
| See what changed in 2.4, with a live walkthrough | [What's new in 2.4](/docs/introduction/whats-new) |
| Get running in ten minutes | [Quick start](/docs/introduction/quick-start) |
| Learn the vocabulary | [Concepts](/docs/introduction/concepts) |
| Run the backend | [Backend overview](/docs/backend) |
| Use the desktop app | [Desktop overview](/docs/desktop) |
`),
    },

    'introduction/whats-new': {
      slug: 'introduction/whats-new',
      title: "What's new in 2.4",
      description: "Private conversations, forks from any reply, local and container backends, signed releases — with a live walkthrough.",
      body: body(`
TodeX 2.4.0 (November 2026) ships the desktop app, the backend and the web
workbench together. The walkthrough below is the real workbench running on
demo data: a script opens a conversation, sends a task and opens the work
process while the agent reads, edits and tests. Pause it at any step to look
around, or play it again from the start.

:::demo

## Conversations

- **Private conversations** — start one from the sidebar (⌘⇧P / Ctrl Shift P,
  ⌥⇧P on web). Its content lives only in the backend's memory: no journal,
  no history cache, nothing left after a daemon restart. Claude Code, Codex
  and Pi write no session files at all; omp, OpenCode and DeepSeek Harness
  keep theirs in a temporary folder deleted with the conversation (Linux and
  macOS).
- **Fork from an earlier reply** — every reply has a fork button. The new
  conversation keeps the history up to that reply; workspace files stay as
  they are. Codex and Pi fork from any reply, other agents from the latest.
- **Goals** — \`/goal <objective>\` hands Codex a native goal. A bar above the
  prompt box shows its status, tokens and time, with Pause, Resume and Clear.
- **Compaction instructions** — Pi takes \`/todex compact <instructions>\`.
- **Accept edits** — a permission mode for Claude Code that approves file
  edits and still asks for commands.
- **Background work** — while an agent waits on background tasks, the prompt
  box and the sidebar row keep showing it as working.

## Sidebar and profile

- **Unified layout** (Settings → Appearance → Sidebar layout) nests each
  workspace's conversations under it.
- **Tags** for workspaces and groups, and **Group by tags** to split the list
  into one section per tag.
- "None" is now **No workspace**.
- The **Profile** page replaces the usage and quota dialogs — press the
  identity card at the bottom of the sidebar.

## Settings

- **CLI management** moved into Settings, one page per agent CLI, with
  **Update all**.
- **Config sync** copies CLI accounts, settings, MCPs, skills and SSH
  connections from one backend to another, side by side.
- **History cache** (desktop) opens recently viewed conversations from this
  device first; it stores only the encrypted content.
- **Computer Use engine** — built-in, or the experimental agent-desktop.

See [Settings](/docs/desktop/settings).

## Backends and containers

- **Local backend** — the desktop app deploys and runs this machine's
  \`todex-agentd\` and talks to it over local IPC, with no network port. See
  [Local backend](/docs/desktop/local-backend).
- **TodeX containers** — run a backend inside Docker and create container
  workspaces, with auto-freeze and setup commands. See
  [Containers](/docs/desktop/containers).
- **omp (oh-my-pi)** joins the supported agents.

## Security

- The install script, the backend updater and desktop updates install only
  releases whose \`SHA256SUMS.sig\` verifies with the release key.
- The backend answers cross-origin requests only from the desktop app,
  loopback pages and the origins you list, and treats proxied requests as
  remote. See [Security & pairing](/docs/backend/security).
- The privacy filter recognizes ID and phone numbers of many countries and
  has aggressive options; SSH output shown to you hides filtered values under
  a scratch-off cover.
- The terminal hosts list has a **Local** host that opens \`ssh localhost\`.
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

Add a project directory inside a configured workspace root, then start a conversation with any available provider. Prompts, approvals,
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

## Workspaces

A *workspace* is a project directory under a configured *workspace root*
(\`TODEX_AGENTD_WORKSPACE_ROOT\`, default \`~/projects\`). Agents, terminals,
and Git can run in any workspace inside the configured roots.

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

With \`[api] enabled = true\` it also serves a key-authenticated REST + SSE
API for scripts and services; see [External API & keys](/docs/backend/external-api).

## Provider drivers

| Provider | Transport | Notes |
| --- | --- | --- |
| **Codex** | JSON-RPC app-server | \`start\`, \`turn\`, \`status\`, \`stop\`, \`attach\`, \`replay\`, \`interrupt\` |
| **Claude Code** | stream-json | Drives the Claude CLI; built-in model aliases without a gateway |
| **Pi** | Native RPC | Command discovery, dynamic models, interactive tool approval |
| **Grok Build** | Managed CLI | Versioned, self-updatable like other managed CLIs |
| **Antigravity** | stream-json | Drives \`agy\` print mode; a TodeX PreToolUse hook in \`~/.gemini/config\` asks for approval per tool (ask / full access); auto uses agy's own Auto review where the account offers it (otherwise it asks); also carries TodeX's MCP tools |
| **ACP 2.0** | stdio profiles | Devin (\`devin acp\`), OpenCode (\`opencode acp\`), omp (\`omp acp\`), custom \`config.toml\` profiles |

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
\`TODEX_INSTALL_DIR\`), verifies \`SHA256SUMS\` and its signature
\`SHA256SUMS.sig\` (with an installed \`todex-agentd\` or OpenSSL 3), keeps
one rollback copy, and restarts a running managed daemon. When the signature
cannot be checked it refuses to install unless you pass
\`--allow-unverified\`; releases up to 2.3.6 were unsigned and get a warning
and a checksum-only check. The backend's own updater likewise installs only
releases signed by the release key. The prebuilt Linux binary needs glibc
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

## Headless administration

Without a TUI — in a container or over SSH — the same tasks have commands:

\`\`\`bash
todex-agentd pair list                    # pending pairing requests
todex-agentd pair approve <code> [--yes]
todex-agentd pair reject <code>
todex-agentd devices list
todex-agentd devices revoke <device>
todex-agentd providers install codex claude --if-missing
\`\`\`

Exit code 2 means nothing matched; 3 means the command ran as a different
user than the daemon. The desktop app can also deploy and manage a backend
on its own machine — see [Local backend](/docs/desktop/local-backend).
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
| External API | \`--enable-api\` / \`--api-port\` | \`TODEX_AGENTD_API_ENABLED\` / \`TODEX_AGENTD_API_PORT\` | off / \`7346\` |
| Network listener | — | \`TODEX_AGENTD_NETWORK_ENABLED\` | \`true\` |
| Local IPC | — | \`TODEX_AGENTD_IPC_ENABLED\` / \`TODEX_AGENTD_IPC_PATH\` | on / \`<data_dir>/agentd.sock\` |
| Allowed browser origins | — | \`TODEX_AGENTD_CORS_ORIGINS\` | none |
| Trusted proxies | — | \`TODEX_AGENTD_TRUSTED_PROXIES\` | none |
| Pairing origins | — | \`TODEX_AGENTD_PAIRING_ORIGINS\` | none |
| omp binary | — | \`omp_bin\` in \`[agent]\` | \`omp\` |

\`network_enabled = false\` needs IPC on: the backend then serves clients
only through the IPC socket (named pipe on Windows) and keeps a random
loopback port for agent tools and \`/v2/version\`. Container deployments add
their own variables — see [Containers](/docs/desktop/containers).

## Example \`config.toml\`

\`\`\`toml
host = "127.0.0.1"
port = 7345
pairing_encryption = "ml-kem-768"
data_dir = "~/.todex-agent"
workspace_root = "~/projects"
# workspace_roots = ["~/projects", "/srv/repos"]
# Serve clients over local IPC only (needs [ipc] enabled).
# network_enabled = false

[ipc]
enabled = true
# path = "~/.todex-agent/agentd.sock"

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
# Browser origins allowed besides the desktop app and loopback pages.
# cors_origins = ["https://todex.example.com"]
# Proxies whose forwarded client address is trusted.
# trusted_proxies = ["10.0.0.2"]

[api]
enabled = false
host = "127.0.0.1"
port = 7346
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

## Browser origins and proxies

The backend answers cross-origin requests only from the desktop app
(\`todex-desktop://app\`), loopback pages and the exact origins listed in
\`security.cors_origins\`. A request carrying \`Forwarded\`,
\`X-Forwarded-For\` or \`X-Real-IP\` counts as remote even when it arrives on
loopback, so a reverse proxy on the same host cannot reach loopback-only
paths; list the proxy in \`security.trusted_proxies\` to use the client
address it forwards. Pairing requests show the origin they came from.

## Local IPC

The IPC socket (named pipe on Windows) accepts only the user who runs the
daemon. Over it, clients need no device signature and can use the local
admin API. With \`network_enabled = false\` IPC is the only way in. See
[Local backend](/docs/desktop/local-backend).

## Signed releases

Every release publishes \`SHA256SUMS.sig\`, an Ed25519 signature over the
checksums. \`install.sh\`, the backend updater, the desktop app's backend
deployment and desktop updates all refuse releases whose signature does not
verify.

## Private conversations

A private conversation is kept only in the daemon's memory: no journal, no
keyring entry, nothing counted in history storage, and gone after a restart.
Claude Code, Codex and Pi write no session files; omp, OpenCode and DeepSeek
Harness write theirs to a temporary folder (\`$XDG_RUNTIME_DIR/todex-private\`,
then \`/dev/shm\`, then the system temp folder) that is deleted with the
conversation, on Linux and macOS only. Grok Build, Devin, Antigravity and ACP
profiles refuse them. Private conversations cannot be forked, scheduled,
compacted or referenced from another conversation. Memory can still reach
swap or a core dump, the agent's provider handles requests under its own
policy, and edits to workspace files are kept as usual.

## Privacy filter

The output filter hides secrets from what the agent sees. It recognizes ID
numbers (by check digit or shape for China, Hong Kong, Taiwan, US SSN, UK,
Singapore, Korea, Spain and Brazil; next to a naming word for others such as
passports) and phone numbers (international and the national formats of
several countries). **Aggressive options**, off by default, also cover URL
tokens, high-entropy strings, UUIDs, email, phone numbers and public IPs,
and you can add up to 32 custom key names. In the Agent SSH output view,
filtered values sit under a scratch-off cover you can wipe away.

## Workspace boundaries

\`workspace_roots\` restricts every file and directory API to authorized
scopes — clients cannot read outside them. Removing a workspace cancels its
active turns and detaches it without deleting its conversations.

## Isolation

- **Tenants** — every query, journal, and subscription is scoped by
  \`tenant_id\`.
- **Subprocesses** — agent CLIs run with sanitized environments so
  administrative variables don't leak into provider sessions.
- **TLS** — the native listener refuses \`enable_tls\`; terminate TLS at a
  reverse proxy instead of trusting a bypass.
- **API keys** — keys of the [external API](/docs/backend/external-api)
  reach only their own conversations, scoped agents and workspaces.
`),
    },

    'backend/api': {
      slug: 'backend/api',
      title: 'API reference',
      description: 'The /v2 REST surface and the multiplexed /v2/ws WebSocket.',
      body: body(`
All endpoints live under \`/v2\`. Every request must carry a registered
device signature; bodies and responses are JSON.

API keys for scripts and services use a separate port and \`/api/v1\`; see
[External API & keys](/docs/backend/external-api).

## System

| Endpoint | Purpose |
| --- | --- |
| \`GET /health\` | Liveness probe |
| \`GET /v2/version\` | Daemon version, workspace root, capabilities |

## Workspaces

| Endpoint | Purpose |
| --- | --- |
| \`GET /v2/workspaces\` | Cached workspaces for the current tenant |
| \`PUT /v2/workspaces\` | Merge workspace caches; returns canonical IDs |
| \`DELETE /v2/workspaces/{id}\` | Cancel active turns and remove the workspace (conversations are kept) |
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
- \`terminal.start\` / \`terminal.input\` / \`terminal.resize\` / \`terminal.stop\` — PTY sessions; \`terminal.attach\` rejoins a running one and replays its recent output
- Local Codex engine process control

Frames enforce UTF-8 length limits; heartbeats detect dead connections.

The authoritative contract is [docs/API.md](https://github.com/youtonghy/TodeX_backend/blob/main/docs/API.md)
in the backend repository.
`),
    },

    'backend/external-api': {
      slug: 'backend/external-api',
      title: 'External API & keys',
      description: 'Call your agents from scripts and services over REST + SSE with backend-managed API keys.',
      body: body(`
Besides the device port (7345), \`todex-agentd\` can serve a separate
REST + SSE API on its own port for scripts, CI jobs, and other services. It
is authenticated with **API keys issued by the backend** — no device pairing,
no transport v2 — and runs any agent TodeX already drives. It shares the
daemon's conversation engine, but every key only sees its own conversations.

## Turn it on

The listener is **off by default**. Enable it with \`[api] enabled = true\`
in \`config.toml\`, \`--enable-api\`, or \`TODEX_AGENTD_API_ENABLED=true\`; the
TUI settings can toggle it and edit the port (applied on the next start).

\`\`\`toml
[api]
enabled = true
host = "127.0.0.1"
port = 7346
# allow_plaintext_remote = true   # only behind a TLS-terminating proxy
\`\`\`

The API port must differ from the main port. Keys are bearer credentials, so
a non-loopback \`api.host\` is refused unless \`allow_plaintext_remote = true\`
is set — put a TLS reverse proxy in front for remote use. There is no CORS:
browsers cannot call it cross-origin.

## Issue and manage keys

A key looks like \`tdx_<id>_<secret>\` and is shown **once**, when it is
created. The backend keeps only a hash of the secret in
\`<data_dir>/api-keys.json\` (0600), so the file alone neither authenticates
nor decrypts anything.

\`\`\`bash
todex-agentd api-key create --name ci --agent codex --workspace ~/projects/app
todex-agentd api-key list
todex-agentd api-key update <id> --approval auto-approve
todex-agentd api-key revoke <id>
\`\`\`

The TUI has an **API Keys** panel (\`i\`: \`n\` new, \`a\` cycle approval,
\`x\` twice to revoke), and paired devices can use \`GET/POST /v2/api-keys\`,
\`PATCH/DELETE /v2/api-keys/{id}\`. Changes apply to a running daemon
without a restart; a revoked or expired key gets \`401\` at once and its
running turns are cancelled.

Each key carries:

- **Agents** — the agents it may use (all by default).
- **Workspaces** — absolute paths it may use, subdirectories included (all
  workspace roots by default).
- **Approval** — how permission requests are answered: \`ask\` (default,
  the caller answers), \`auto-approve\`, or \`reject\`. Requests bound to a
  specific device are never approved on a key's behalf.
- **Expiry** — optional.

API conversations get the agent's own tools only — TodeX's SSH, desktop and
browser tools are not injected — and turns cannot override permission or
sandbox modes; the key's approval policy governs them.

## Endpoints

Send \`Authorization: Bearer <key>\` (or \`X-API-Key\`) to
\`http://127.0.0.1:7346\`.

| Endpoint | Purpose |
| --- | --- |
| \`GET /api/v1/health\` | Liveness probe (no key) |
| \`GET /api/v1/me\` | The calling key, its scopes and approval policy |
| \`GET /api/v1/agents\` | Agents the key may use |
| \`GET /api/v1/agents/{agent}/models?workspace=\` | Live model catalog |
| \`GET /api/v1/workspaces\` | Workspaces the key may use |
| \`POST /api/v1/conversations\` | Create a conversation: \`{agent, workspace, title?}\` |
| \`GET /api/v1/conversations\` | The key's conversations |
| \`GET / DELETE /api/v1/conversations/{id}\` | Read or delete one |
| \`POST /api/v1/conversations/{id}/turns\` | Start a turn: \`{text, model?, reasoningEffort?}\`; with \`Accept: text/event-stream\` it streams the turn |
| \`GET /api/v1/conversations/{id}/events?after=&limit=\` | Event page (plaintext) |
| \`GET /api/v1/conversations/{id}/events/stream\` | SSE: history, then live events; resumes with \`Last-Event-ID\` |
| \`POST /api/v1/conversations/{id}/cancel\` | Cancel the running turn |
| \`POST /api/v1/conversations/{id}/permissions/{permissionId}\` | Answer a permission request |
| \`POST /api/v1/runs\` | One call: new conversation + one turn, streamed or awaited |

SSE events carry \`id: <sequence>\`, \`event: <type>\` and the event JSON as
\`data\`; a \`: \` keepalive is sent every 15 seconds. Errors use the same
\`{"code", "message"}\` shape as \`/v2\`.

## One-shot runs

\`\`\`bash
KEY=$(todex-agentd api-key create --name demo --workspace ~/projects/app | tail -1)

curl -s -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \\
  -d '{"agent":"codex","workspace":"'"$HOME"'/projects/app","text":"Summarize the README"}' \\
  http://127.0.0.1:7346/api/v1/runs
# {"conversationId":"…","turnId":"…","status":"completed","output":"…","error":null}

curl -N -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \\
  -d '{"agent":"claude-code","workspace":"'"$HOME"'/projects/app","text":"List the TODOs","stream":true}' \\
  http://127.0.0.1:7346/api/v1/runs
\`\`\`

Without \`stream\`, the call waits for the turn (\`timeoutSecs\`, default 600,
at most 3600; on timeout the turn is cancelled and \`504\` is returned).

## History stays encrypted

Conversation history is always end-to-end encrypted on disk. Each key
derives its own history recipient from its secret, and only that key's
conversations are wrapped for it. While serving a request made with the key,
the backend decrypts those events in memory and returns plaintext; nothing
derived from the key is stored. A stolen data directory still cannot be
read, and a leaked key exposes only its own conversations.

The authoritative contract is the "外部 API（API Key）" chapter of
[docs/API.md](https://github.com/youtonghy/TodeX_backend/blob/main/docs/API.md).
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

- [Local backend](/docs/desktop/local-backend): deploy and run this
  machine's backend and connect over IPC.
- [Containers](/docs/desktop/containers): run backends in Docker and create
  container workspaces.
- An on-device history cache for recently viewed conversations.
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

For a backend on the same machine, the desktop app can skip all of this and
connect over local IPC — see [Local backend](/docs/desktop/local-backend).
Container backends show the \`todexc\` / \`docker exec\` command that
approves the device — see [Containers](/docs/desktop/containers).

## Managing providers from the client

**Settings → CLI management** lists the backend's agent CLIs with installed
vs latest versions, installs missing CLIs, and runs several upgrades at once
(see [Settings](/docs/desktop/settings)). **Config sync** copies accounts,
settings, MCPs, skills and SSH connections between two backends. Provider accounts can be exported
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
where the web differs it's noted. Watch it at work first — the walkthrough
is the real UI on demo data, driven by a script:

:::demo

## Left sidebar

Workspaces on top, conversations below — or, with **Sidebar layout →
Unified** (Settings → Appearance), each workspace with its conversations
nested under it, five per page. Conversation rows show the active agent badge
and run state, and stay marked as working while the agent waits on
background tasks; right-click actions cover New, Rename, Fork, and Delete.
Workspaces can be added from any directory under a configured workspace
root, or inside a [container](/docs/desktop/containers).

- **Tags** — **Edit tags** on a workspace or **Edit group tags** on a group.
  The tag button on the Workspaces header turns on **Group by tags**: one
  section per tag, **Untagged** last.
- **No workspace** (formerly "None") holds conversations without a
  workspace; with several backends they form one built-in group.
- **Private conversations** — **New private conversation** (⌘⇧P / Ctrl Shift
  P) picks an agent and starts a conversation that lives only in the
  backend's memory; it carries a badge and a notice. See
  [Security & pairing](/docs/backend/security).
- **Profile** — press the identity card at the bottom for the Profile page:
  usage, plan quotas and activity.

## Scheduled conversations and optional features

- **Scheduled conversations** — create one from the sidebar (or from a Kanban
  task) and pick a time. The conversation is created right away; everything
  you send there is held in the backend queue and sent in order at that time.
  Sidebar rows show a countdown icon, and a bar above the prompt box offers
  Send now, Change time, and Cancel.
- **Features** (Settings → Features) — Scheduled conversations, Terminal, and
  the Kanban task board can each be shown in the sidebar, folded under a
  "More" row, or turned off (which also removes their shortcuts and menu
  entries). Saved per device.
- **Connection** — while the backend is still loading, the sidebar shows
  "waiting for the backend to finish loading" and the client keeps trying for
  up to 2 minutes instead of failing. The active conversation's agent is
  pre-warmed so the first message starts faster.

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
- **Fork from this reply** under a reply starts a new conversation with the
  history up to there (workspace files are not rolled back). Codex and Pi
  fork from any reply; other agents only from the latest.
- **\`/goal <objective>\`** (Codex) sets a native goal; the goal bar above
  the prompt box shows its status and usage, with Pause, Resume and Clear.
  Pi accepts \`/todex compact <instructions>\`.
- The permission picker offers **Accept edits** for Claude Code: file edits
  are approved, commands still ask.

## Right — workbench tabs

| Tab | Contents |
| --- | --- |
| Slash Commands | Reference of the provider's commands |
| Git Diff | Live working-directory changes |
| Terminal | Embedded xterm.js PTY (WebGL) that survives reconnects and reloads, with find, links, shell integration and command-finished notices |
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
| ⇧⌘P (⌥⇧P on web) | New private conversation |
| ⌘L / Ctrl L | Quick search (conversations and their content) |
| ⌘1…⌘9 / Ctrl 1…9 | Select a workbench tab |
| ⇧⌘K / Ctrl Shift K | Kanban task board |
| ⇧⌘T (⌥⇧T on web) | Terminal view (SSH hosts, keys, remote files) |

> Browsers reserve ⌘N / ⇧⌘N / ⇧⌘T, so the web client uses the Option modifier
> for the two "new" actions and the Terminal view. Everything else is identical.

## Terminal

Inside a terminal (macOS uses ⌘, Linux and Windows use Ctrl Shift):

| Keys | Action |
| --- | --- |
| ⌘C / Ctrl Shift C | Copy (Ctrl C also copies while text is selected) |
| ⌘V / Ctrl Shift V | Paste |
| ⌘F / Ctrl Shift F | Find |
| ⌘K / Ctrl Shift K | Clear |
| ⌘↑ ⌘↓ / Ctrl Shift ↑ ↓ | Previous / next prompt |

Right-click opens the same actions. Ctrl/⌘-click opens links and
\`path:line\` references to workspace files. Pasting several lines into a
program that does not use bracketed paste asks first.

**Shell integration** (Settings → Appearance → Terminal, on by default)
loads a small script into new bash, zsh and fish terminals. It marks each
prompt (red for a failed command), keeps the path field on the shell's
directory, asks before closing a tab whose command is still running, and
posts a notice when a command of 10 seconds or more finishes out of sight.
Programs can post notices too (OSC 9 / OSC 777).

**Images.** Paste an image (when the clipboard holds no text) or drop image
files onto a terminal: TodeX stores them where the terminal runs — on the
backend machine, or under \`~/.cache/todex/paste\` on the SSH host — and
pastes their paths, which Claude Code and Codex attach as images. Pasted
images are removed after 7 days. Ctrl V still goes to the program.

**Reconnecting.** A terminal keeps running while you are away. When the app
reconnects or reloads, it picks up where it left off, or, when that output
is no longer kept, the backend sends the current screen — full-screen
programs such as vim or Claude Code come back as they were.

Holding the modifier briefly reveals shortcut hint badges in the UI.
`),
    },

    // ------------------------------------------------------------------- Mobile

    'desktop/settings': {
      slug: 'desktop/settings',
      title: "Settings",
      description: "CLI management, config sync between backends, the history cache, and the Computer Use engine.",
      body: body(`
Settings are grouped in a rail on the left. This page covers the parts that
changed in 2.4; the backend pages ([Local backend](/docs/desktop/local-backend),
[Containers](/docs/desktop/containers)) have their own docs.

## CLI management

**Settings → CLI management** lists the backend's agent CLIs (Codex, Claude
Code, Pi, Grok Build, omp and the ACP profiles) with installed and latest
versions. Several CLIs can install or upgrade at once; **Update all** runs
every pending upgrade. CLIs that ship inside a container image show
"Updated with the image" instead.

Each CLI opens its own page with tabs:

| Tab | Contents |
| --- | --- |
| Settings | The CLI's own settings and provider profiles |
| MCP / Skill | The MCP servers and skills of the picked backend |
| Accounts | Provider accounts and API keys |
| Cleanup | The CLI's native sessions on the backend |
| Plugins | omp plugins: install, upgrade, remove, turn on or off |

**Shared MCPs / Skills** at the top of the list manages the ones every agent
sees. Activating or deleting a provider profile asks first and says what
changes in the CLI's global config; Claude Code's config is backed up before
the first activation. The Codex account form can fetch the model list from
the base URL, and sets reasoning effort and context-window presets — clear a
field to remove its key from \`config.toml\`.

## Config sync

**Settings → Backend connections → Config sync** puts two backends side by
side: a **Source backend** to read from and a **Target backend** to write to,
both shown live. Pick what to copy:

- CLI accounts
- Settings
- MCP servers
- Skills
- SSH connections

Only new and changed items are written; nothing on the target is deleted.
Secrets are redacted on screen. SSH hosts that log in with a password, and
private keys, are never synced — put the key on the target first.

## Storage and the history cache

**Settings → General → Storage** holds **Cache recent conversations on this
device** (desktop, on by default). Recently viewed conversations open from
this device first, catch up from the backend, and stay readable while
disconnected.

- Only the encrypted content the backend sent is stored, never plaintext.
- The newest 300 events of up to 100 conversations, 200 MB at most; the
  least recently used go first.
- The cache of a conversation is dropped when it is deleted, and the whole
  cache when the device is revoked or the backend removed.
- **Clear cache** removes only this device's copy.

Private conversations are never cached. The web client keeps no history
cache.

## Computer Use engine

The Computer Use page has an **Engine** choice: **Built-in**, or
**agent-desktop (experimental)**, which the backend downloads on first use
and shows as Ready, Downloading, Install failed or Not installed.

## Appearance

**Sidebar layout** switches between **Split** (workspaces and conversations
in separate lists, the default) and **Unified** (conversations nested under
their workspace). The terminal's shell integration lives here too.
`),
    },

    'desktop/local-backend': {
      slug: 'desktop/local-backend',
      title: "Local backend",
      description: "Deploy this machine's backend from the desktop app and connect over local IPC.",
      body: body(`
The desktop app can run \`todex-agentd\` on the machine it is installed on and
talk to it over **local IPC** — a Unix socket, or a named pipe on Windows,
that only your user account can open. No network port and no device
verification are needed for that connection.

## Deploy and connect

Open **Settings → Local backend**. The **This machine** card runs
\`todex-agentd\` at the same version as TodeX Desktop:

1. **Deploy and connect** downloads the backend, verifies its signature,
   starts it, pairs this app and connects over IPC.
2. Afterwards the card offers **Start and connect**, **Restart**, **Stop**,
   **Pair again** and **Show log**.

The desktop app installs only backend releases whose \`SHA256SUMS.sig\`
verifies with the release key. Older, unsigned releases (up to 2.3.6) are
accepted only when they are exactly the version this app pairs with.

Startup options are **Start at login** and **Stop when TodeX quits** (off by
default, so the backend keeps serving other devices). The listener section
sets the listen address (default \`127.0.0.1\`), the port and the pairing
encryption.

The same page edits workspace roots, shows the pairing QR code and transport
key fingerprint for remote access, approves or rejects pairing requests,
revokes devices and resets the backend.

## Switching existing connections to IPC

When a loopback connection (\`http://127.0.0.1:7345\`) points at a backend
that also serves IPC, the app suggests **Switch to IPC**. Once IPC serves
that daemon, the matching TCP profile is turned off and its data moves to the
IPC profile. Turn the hint off with **Suggest switching to IPC**.

## Turning off the network listener

If only this app uses the backend, switch **Network listener** off. It can
only be turned off while the app is connected over IPC, asks for
confirmation and takes effect after a restart. The backend then keeps just a
random loopback port for agent tools and \`/v2/version\`. In the backend TUI
the same switch is \`b\`; in \`config.toml\` it is \`network_enabled = false\`
(see [Configuration](/docs/backend/configuration)).

## Local admin API

Over IPC only, the backend serves \`/v2/local-admin/*\` — status, config,
pairing requests, devices and reset — without device signatures, because
the socket already proves the caller is the same user. Over TCP these routes
return 404.
`),
    },

    'desktop/containers': {
      slug: 'desktop/containers',
      title: "Containers",
      description: "Run backends in Docker, create container workspaces, and keep containers tidy.",
      body: body(`
A TodeX container is a Docker image with \`todex-agentd\` and the agent CLIs
preinstalled. Each container is its own backend: agents run inside it, and
your project folder is mounted in.

## Requirements

Docker with Compose v2 on the machine running TodeX Desktop. **Settings →
TodeX Container** checks both, lists the image tags and every TodeX
container, and offers start, stop, restart, upgrade, mounts, logs and delete.
Deleting keeps the container's home volume unless you tick it. The page
shares the \`~/.config/todex-container/<name>/\` layout with the \`todexc\`
command-line tool.

## Container workspaces

**New workspace** offers **Local workspace** or **Container workspace**. For a
container workspace, TodeX mounts the folder — at the same path on Linux and
macOS, at \`/workspace/<folder>\` on Windows — pairs with the container's
backend, installs the agent CLIs and offers to sync your agent config into it
(see [Config sync](/docs/desktop/settings)).

Container backends report \`deployment: container\`:

- Pairing shows the \`todexc\` / \`docker exec\` command that approves this
  device.
- CLIs baked into the image show "Updated with the image"; upgrade the image
  instead.
- Path mappings translate between host and container paths, so **Choose
  locally** and **Open** work on container files.

## Setup commands

A container workspace can run setup commands once, as the \`todex\` user, at
the workspace path, through \`bash -c\`, stopping at the first failure.
Templates are suggested for pnpm, npm, yarn, uv, \`requirements.txt\` and
git submodules. A long setup can continue in the background.

## Freezing idle containers

**Freeze when idle** (off by default) pauses a container (\`docker pause\`)
after an idle time between 15 minutes and 4 hours. Sending a message, opening
a terminal or opening one of its workspaces resumes it; container cards also
show **Freeze** and **Resume**.

## Automatic cleanup

Cleanup runs a minute after start and then every 6 hours:

- remove old images;
- remove containers stopped for 1, 7 or 30 days (or never);
- unmount folders no workspace uses;
- stop containers when TodeX quits.

Home volumes are never deleted automatically.

## Backend settings for containers

| Setting | Effect |
| --- | --- |
| \`TODEX_AGENTD_DEPLOYMENT=container\` | Self-update is off; \`update\` exits 0 without changes |
| \`TODEX_AGENTD_ADVERTISE_URL\` | Address the backend advertises to clients |
| \`TODEX_AGENTD_IMAGE_CLI_DIR\` | CLIs managed by the image; installing them returns 409 |
| \`TODEX_AGENTD_PATH_MAPPINGS\` | Host ↔ container path mappings (\`[[workspace.path_mappings]]\`) |

Headless containers are administered with
\`todex-agentd pair list|approve|reject\`, \`devices list|revoke\` and
\`providers install <id>…\` (see [Install & run](/docs/backend/install)).
`),
    },

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
