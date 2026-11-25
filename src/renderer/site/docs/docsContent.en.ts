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
Claude Code, Pi, Devin, OpenCode, Grok Build, Antigravity, DeepSeek Harness, omp, and any ACP-compatible agent)
behind a single authenticated API. Desktop, web, and mobile clients connect
to it over an encrypted channel.

Nothing is proxied through TodeX infrastructure: the backend runs on your
machine or your server, agents run under your own accounts and credentials,
and your code never leaves the workspace roots you authorize.

## The moving parts

\`\`\`text
TodeX Desktop (Electron)          TodeX Mobile (Swift)
TodeX Web client ──────┐                 │
                       │  REST /v2/*  +  WebSocket /v2/ws
                       │  Ed25519 device auth + X25519 / ML-KEM-768
                       v
               todex-agentd  (Rust · Tokio · Axum)
                       │
        ┌──────────────┼───────────────┬──────────────┐
        v              v               v              v
   codex app-      claude stream-   pi rpc      acp profiles
   server (JSON)   json             (devin, opencode, dsh, agy, omp…)
\`\`\`

| Component | What it is |
| --- | --- |
| **Backend** | \`todex-agentd\`, the daemon that owns conversations, workspaces, provider drivers, backend groups, and security. |
| **Desktop** | Electron + React 19 client with a customizable Home board, three-pane workbench, local IPC, and containers. |
| **Web** | This site serves the same workbench over HTTP — nothing to install, direct or via self-hosted proxy. |
| **Mobile** | Native Swift + UIKit client for iPhone and iPad (in active development). |

## Highlights

- **Agent-agnostic.** Conversations are decoupled from providers; swap agents per thread, run several side by side on the same workspace, or let agents invoke each other through \`todex_agents\`.
- **Backend groups & end-to-end encrypted history.** Join a decentralized trust group once to reach every backend in it and receive history access automatically; conversation events are encrypted on disk with X-Wing so the backend holds no decryption keys.
- **Smart work mode & plan review.** Configure a two-stage Claude Code workflow: investigate and draft with a planning model, review the plan inline, then hand off mid-turn to an execution model with auto-approval — and automatically re-enter planning when needed.
- **Full workbench.** Customizable Home board, action-titled execution timelines with file chips, unified plan steps above the composer, Git diffs, embedded xterm.js terminal, Agent Browser (Chromium / Kitesurf), and Computer Use live views — identical on desktop and web.

## Where to go next

| Goal | Doc |
| --- | --- |
| See what changed in 2.5, with automated workbench demos | [What's new in 2.5](/docs/introduction/whats-new) |
| Get running in ten minutes | [Quick start](/docs/introduction/quick-start) |
| Learn the vocabulary and architecture | [Concepts](/docs/introduction/concepts) |
| Run the backend | [Backend overview](/docs/backend) |
| Use the desktop app | [Desktop overview](/docs/desktop) |
`),
    },

    'introduction/whats-new': {
      slug: 'introduction/whats-new',
      title: "What's new in 2.5",
      description: 'Backend groups, Smart work mode, plan review & live step checklists, customizable Home board, Kitesurf browser engine, and single-window Computer Use — each with a step-by-step automated workbench demo.',
      body: body(`
TodeX 2.5 (November 2026) brings decentralized multi-backend trust and tighter control over agent workflows: group your machines and devices without a central server, pair Claude Code with a two-stage Smart work mode, and work from a clearer timeline, Home board, and live desktop/browser panels.

Watch the full walkthrough first — a script creates a conversation, types a task, reveals the plan steps and execution progress, and streams the answer:

:::demo

## Backend groups

Previously each device had to pair point-to-point with every backend one by one. **Backend groups** (Mesh v1) place your backends ("nodes") and client devices in a shared decentralized trust group with no central server:

- **Join once, reach every node.** New devices scan the **Invite QR code** or paste an invite (which carries only backend addresses, no keys). **Any existing device** in the group checks the verification code and clicks **Approve** — never the backend — which grants access to every backend in the group and automatically fulfills encrypted history access.
- **Flexible backend onboarding.** Backends already paired point-to-point join in place, keeping their conversations and history (re-wrapped for the group); new backends join with an address and a 24-hour one-time **Join code** (\`todex-agentd mesh join-code\`, also printed in an ungrouped backend's startup log).
- **Local IPC stays fast; the group link stands by.** When this computer's backend is in the group and reached over local IPC, all workspaces, conversations, and requests continue over IPC (**This computer · data over IPC**), while the group connection stays open as a standby for presence, roster sync, and join approvals. Sibling profiles of the same daemon grant each other history automatically.
- **Presence, LAN beacons & end-to-end encrypted relays.** Device members show online or last-seen status. Nodes support **Pinned addresses**, automatic **UDP 21047 LAN beacons** on desktop, and **end-to-end encrypted relaying** (**Via** \`<node>\`) using device-signed tickets when direct addresses fail, switching back to direct automatically when reachable.
- **24-word recovery key & clean separation.** Creating a group issues a one-time 24-word recovery key to restore control and history if all devices are lost. Point-to-point backends stay under **Settings → Backend connections**, while group nodes live under **Settings → Backend groups**.

:::demo mesh

See [Connect a backend](/docs/desktop/connect) and [Security & pairing](/docs/backend/security).

## Smart work mode & plan review

**Smart work mode** turns multi-model planning and execution into a single seamless Claude Code workflow:

- **Two-stage configuration (Settings → Smart work mode).** Pick a **Plan stage** model, reasoning effort, and optional **Plan skill** (such as \`plan-gate\`, attached automatically to plan prompts), plus an **Execute stage** model and reasoning effort that always runs under **Auto-approve**.
- **Mid-turn plan handoff (\`plan_handoff\`).** Select **Smart** from the composer's work mode menu. While planning (**Smart · Planning**), Claude investigates read-only and submits a plan via \`ExitPlanMode\`. Approving the plan switches the running Claude process to the execute model and auto-approval mid-turn, records a quiet handoff notice, and continues coding (**Smart · Executing**).
- **Re-entering planning (\`plan_reentered\`).** If Claude calls \`EnterPlanMode\` during execution — or you attach the configured plan skill to a follow-up prompt — the conversation shifts back to the planning model and hands off again once the new plan is approved.
- **Dedicated Plan row & review card.** \`ExitPlanMode\` renders the full plan as its own Markdown **Plan** row in the timeline instead of hiding it inside tool arguments, and the composer shows a **Plan ready for approval** card (naming the execute model in Smart mode) with **Approve** or **Request changes** feedback.

:::demo smart

:::demo smart-settings

## Plan steps, action-titled runs & background tasks

- **Plan steps above the composer (\`Plan 1/3\`).** A collapsible checklist above the prompt box tracks normalized \`plan.updated\` steps and explanations across Codex (\`turn/plan/updated\`), Claude Code (\`TodoWrite\`), Pi (\`@tintinweb/pi-tasks\` \`TaskCreate\`/\`TaskUpdate\`/\`TaskList\`, persisting across turns), and ACP agents.
- **Codex warnings, auto-review notices & \`ultra\` effort.** Codex \`provider_warning\` (deduplicated per turn) and \`auto_review\` outcomes render as single quiet timeline lines with details and rationale in the tooltip; Codex effort pickers add \`ultra\`.

:::demo plan-steps

- **Thinking dots, action titles & file chips.** Running tool groups lead with the animated BoardUI thinking dots and name the active step (for example, "Reading \`page.tsx\`"); finished runs tally what they did ("Edited 2 files · Ran 1 command") and display touched files as chips.

:::demo execution-group

- **Stop background tasks & reliable unread dots.** When a Claude Code turn finishes while waiting on background commands or subagents, the composer shows a **Stop background tasks** button (\`conversation.backgroundTasks.stop\`); pending tasks stay tracked across follow-up turns, and background conversations keep their unread badge even after their in-memory timeline is released.
- **No timeout on approvals & richer alerts.** Interactive permission, question, and plan-review prompts wait with no 10-minute deadline until acted on or cancelled; system alerts display the question text or approval target and clear once answered.

:::demo background-tasks

## Home board, Plan calendar & sidebar

- **Customizable Home page.** TodeX starts on the **Home** board with live cards for **Running**, **Waiting for reply (Needs approval)**, **Conversations today**, **Tokens today**, **Usage by hour**, and **Plan limits** (5-hour and 7-day windows). Click **Customize layout** to drag-reorder, resize from the corner, remove, or restore cards.

:::demo home

- **Plan board & calendar.** The Kanban task board is now **Plan**, offering both **Board** and **Calendar** views.
- **Sidebar polish.** Workspaces on offline backends stay folded until paging reaches the end (**Show workspaces on offline backends (n)**); workspace group folders mirror the most urgent status ring of their workspaces (\`working > issue > unread\`); opening standalone pages (Home, Terminal, Plan, Profile) clears the workspace/conversation highlight behind them.

:::demo offline-sidebar

## Agent Browser & Computer Use

- **Live view placement.** Choose whether Agent Browser and Computer Use live views appear in the **Side panel** (default) or **Above the composer**.
- **Single-window Computer Use & AI cursor.** Observing an app or window captures and acts on that window alone via \`ScreenCaptureKit\` — even in another macOS Space or behind other windows — without moving your pointer. An animated orange **AI cursor** marks the last action landing point on both the host and the live view; macOS adds a drag-in permission guide, Screen Recording restart note, ad-hoc signature warning, and a red **Stop** button on the host pill.

:::demo computer-live

- **Experimental Kitesurf engine, headless Chromium & site approvals.** Choose between **Chromium** and Cloudflare's headless **Kitesurf** (\`workerd\`-based, per-tab isolated contexts, no display server needed); Chromium also falls back to \`--headless\` on Linux servers with no display. Visiting non-loopback sites prompts for **Site approval** (\`Allow once\` / \`Always allow\` / \`Deny\`), Settings lists always-allowed sites and lets you toggle **Ask for each site** vs **No approval** (with DNS resolution still blocking link-local, cloud metadata, and the daemon's port), and crashed or blank loads report \`PAGE_FAILED\` with console diagnostics.

:::demo agent-browser

## Linked skills & provider updates

- **Symlinked skills (\`Linked\`).** Top-level symlinks inside skill roots (such as \`~/.claude/skills/plan-gate -> ~/.codex/skills/plan-gate\`) appear in the Skills catalog with a read-only **Linked** badge and work seamlessly with Smart work mode and \`@skill:\`.

:::demo linked-skills

- **Antigravity over ACP.** Each conversation now runs a resident \`agy acp\` process with native ACP permissions, TodeX MCP servers with tool timeouts, and automatic cleanup of legacy \`~/.gemini/config\` hooks.
- **Live Claude Code models & 512K preset.** Claude Code discovers models and efforts (including \`ultracode\`) straight from its CLI \`initialize\` probe; custom provider model configs add an exact **512K (\`524,288\` tokens)** context-window preset.

## 2.4 foundations

2.5 builds on everything introduced in 2.4: **Private conversations** (RAM-only, \`⌘⇧P\` / \`⌥⇧P\`), **Fork from any reply**, Codex **\`/goal\`**, **Local IPC backend**, **TodeX Docker containers**, **Config sync**, **On-device history cache**, and \`SHA256SUMS.sig\` **signed releases**.
`),
    },

    'introduction/quick-start': {
      slug: 'introduction/quick-start',
      title: 'Quick start',
      description: 'Install the backend, pair a client or join a backend group, and start your first conversation.',
      body: body(`
You need a machine that can run the backend and at least one authenticated
agent CLI (\`codex\`, \`claude\`, \`pi\`, \`devin\`, \`opencode\`, \`dsh\`, \`omp\`, …). If you only want to run agents on your own computer, the desktop app can deploy and connect to a [Local backend](/docs/desktop/local-backend) over IPC in one click.

## 1. Install the backend

On macOS, Linux, or WSL — no Rust toolchain required:

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/youtonghy/TodeX_backend/main/install.sh | bash
\`\`\`

The script verifies \`SHA256SUMS.sig\`, installs \`todex-agentd\` into \`~/.local/bin\`,
and restarts a running managed daemon. Pin a release with
\`install.sh install --version 2.5.0\`, or build from source with
\`cargo build --release\`.

## 2. Start it and approve your device

\`\`\`bash
todex-agentd tui
\`\`\`

The TUI shows daemon status, live logs, devices, and pairing QR codes. When a client
requests access for the first time, press \`d\` to show the verification code and
transport key fingerprint, compare them with the client, then press \`a\` to approve (or \`r\` to reject).
Quitting the TUI leaves the daemon running in the background.

## 3. Connect a client

- **Desktop** — install a package from GitHub Releases. Use **Settings → Local backend** for one-click local IPC, or **Settings → Backend connections** with only the backend URL (default \`http://127.0.0.1:7345\`) to complete device verification.
- **Web** — open \`/app\` on a hosted TodeX site, or the page served by your own deployment, and pair it the same way.
- **Multiple devices or backends** — open **Settings → Backend groups** to create a group and scan the **Invite QR code** on additional devices so existing devices approve them without touching the terminal. See [Connect a backend](/docs/desktop/connect).

## 4. Create a workspace and a conversation

Add a project directory inside a configured workspace root (default \`~/projects\`), then start a conversation with any available provider. Prompts, approvals, plan reviews, live plan steps, terminal, and Git diffs all stream over the same encrypted connection.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Client can't reach the backend | \`todex-agentd daemon status\`; the default port is \`7345\` |
| \`401\` on every request | Device not approved or removed from the group — redo verification in the TUI or check the group roster |
| WebSocket fails while REST works | Encryption mismatch or proxy header mismatch — click **Re-pair** in Settings |
| Agent shows unavailable | The provider CLI isn't installed or logged in on the host (check **Settings → CLI management**) |
`),
    },

    'introduction/concepts': {
      slug: 'introduction/concepts',
      title: 'Concepts',
      description: 'The vocabulary behind every TodeX screen: providers, workspaces, conversations, groups, and encryption.',
      body: body(`
## Providers and provider drivers

A *provider* is an agent engine the backend drives — **Codex**, **Claude Code**,
**Pi**, **Grok Build**, **Devin**, **OpenCode**, **Antigravity**, **DeepSeek Harness (dsh)**, **omp (oh-my-pi)**, or any ACP 2.0 profile declared in \`config.toml\`. Each provider uses a native driver (JSON-RPC app-server, stream-json, RPC, or ACP stdio) so models, reasoning efforts, slash commands, skills, and MCP servers come straight from the installed CLI instead of being approximated.

*Provider accounts* let you keep multiple account and gateway configurations per agent — TodeX activates one by backing up and updating the agent's own global configuration (or patch layer), so sessions started outside TodeX behave identically.

## Workspaces

A *workspace* is a project directory under a configured *workspace root*
(\`TODEX_AGENTD_WORKSPACE_ROOT\`, default \`~/projects\`), or a Docker [Container workspace](/docs/desktop/containers). Agents, PTY terminals, and Git actions operate inside authorized workspace boundaries.

## Conversations

Every persisted conversation is a folder under \`$DATA_DIR/conversations/<uuid>/\` (except [private conversations](/docs/backend/security#private-conversations), which stay in daemon memory only):

| File | Contents |
| --- | --- |
| \`manifest.json\` | Metadata, active provider profile, workspace, timestamps, encrypted title |
| \`events.jsonl\` | Append-only event journal (with \`$enc\` ciphertext payloads) — source of truth for history |
| \`snapshot.json\` | Compact state snapshot for fast reloads |
| \`provider-state.json\` | Native engine state for turn resumption |

Turns are optimistic-concurrency protected: a conflicting mutation while a turn runs returns \`409 Conflict\`, while follow-ups typed in the composer queue safely on the backend until the active turn finishes.

## Devices, pairing, and backend groups

Clients never log in with passwords:

- **Point-to-point pairing (Pairing v3)**: each client device generates an Ed25519 key pair and requests enrollment; you compare a verification code in the backend TUI, pinning the device key, transport protocol, and backend public key together.
- **Backend groups (Mesh v1)**: a decentralized group of client devices and backend nodes linked by a signed roster chain (\`todex.mesh.roster\`). Once any group device approves a new device, it can reach every backend in the group and automatically read their encrypted history.

## Transport and history encryption

TodeX separates wire encryption from at-rest history confidentiality:

| Layer | Suite | Notes |
| --- | --- | --- |
| **Transport** | \`ml-kem-768\` (default) / \`x25519\` / \`none\` | REST travels inside \`POST /v2/sealed\` and WebSockets use \`tv=2\` encrypted binary frames; plaintext \`none\` is permitted only on loopback. |
| **History** | X-Wing end-to-end encryption (history v3) | Events and titles are encrypted before hitting disk for authorized device history keys and the 24-word recovery key; the backend holds no decryption keys. |

## Tenants

All workspaces, conversations, subscriptions, and caches are namespaced by \`tenant_id\` and never cross tenants.
`),
    },

    // ------------------------------------------------------------------ Backend

    'backend': {
      slug: 'backend',
      title: 'Backend overview',
      description: 'todex-agentd — the Rust daemon that orchestrates agents, conversations, backend groups, and security.',
      body: body(`
\`todex-agentd\` is the core of TodeX: a single Rust binary built on Tokio and Axum that serves an authenticated REST surface (\`/v2/*\`) and a multiplexed WebSocket (\`/v2/ws\`) for live events, approvals, PTY terminals, and backend groups.

With \`[api] enabled = true\` it also serves a key-authenticated REST + SSE API for scripts and services; see [External API & keys](/docs/backend/external-api).

## Provider drivers

| Provider | Transport | Notes |
| --- | --- | --- |
| **Codex** | JSON-RPC app-server | \`start\`, \`turn\`, \`status\`, \`stop\`, \`attach\`, \`replay\`, \`interrupt\`, fork at any reply, \`/goal\`, \`provider_warning\` & \`auto_review\` |
| **Claude Code** | stream-json | Live model catalog via \`initialize\`; Smart work mode (\`afterPlan\` / \`replan\`), plan review cards, background task stop, and built-in aliases |
| **Pi** | Native RPC | Command & dynamic model discovery, interactive tool approval, \`/todex compact\`, and cross-turn \`@tintinweb/pi-tasks\` plan tracking |
| **Grok Build** | Resident ACP / managed CLI | Self-updatable CLI, tool approvals, and user questions |
| **Antigravity** | Resident ACP (\`agy acp\`) | One resident process per conversation; native ACP approvals (using agy's Auto review when offered), TodeX MCP tools, and automatic cleanup of legacy hooks |
| **DeepSeek Harness** | Resident ACP (\`dsh\`) | Patch-layer configuration, built-in and npm plugin bundles, and custom routing |
| **ACP 2.0** | Resident / per-turn stdio profiles | Devin, OpenCode, omp (\`omp acp\`), and custom \`config.toml\` profiles |

The backend never alters provider installations to build UI: capability catalogs (skills, MCP servers, slash commands, models) are introspected live with project-over-user precedence, and top-level symlinked skills (\`linked: true\`) are recognized read-only and referenced by \`resourceId\`.

## Conversation engine & unified plan steps

- All turn state is journaled in append-only \`events.jsonl\` logs with snapshots; subscriptions resume from \`afterSequence\` without dropping messages across reconnects or daemon restarts.
- **Cross-provider \`plan.updated\` normalization**: Codex (\`turn/plan/updated\`), Claude Code (\`TodoWrite\`), Pi (\`@tintinweb/pi-tasks\`), and ACP plan updates all emit a uniform \`{ provider, explanation?, steps: [{ text, status }], plan }\` snapshot.
- **No deadline on pending approvals**: Interactive permission, question, and plan-review prompts wait indefinitely until answered, cancelled, or the daemon stops.

## One socket, many channels

\`/v2/ws\` multiplexes conversation subscriptions, prompt dispatch, permission decisions, background task stop (\`conversation.backgroundTasks.stop\`), PTY terminal sessions (with reconnect screen snapshots), history grants, and \`mesh.*\` group commands over a single connection with heartbeats and UTF-8 framing checks.

## Managing the daemon

\`todex-agentd\` ships an interactive TUI (\`todex-agentd tui\`) for status, logs, device approval, API keys, and pairing QR codes, plus PID-file daemon commands (\`daemon start|stop|restart|status\`), login autostart (\`daemon autostart enable\`), and headless CLI subcommands. See [Install & run](/docs/backend/install).
`),
    },

    'backend/install': {
      slug: 'backend/install',
      title: 'Install & run',
      description: 'Install script, building from source, run modes, and headless/mesh commands.',
      body: body(`
## Install script (macOS / Linux / WSL)

\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/youtonghy/TodeX_backend/main/install.sh | bash
\`\`\`

\`\`\`bash
install.sh install                 # install or update to the latest release
install.sh update                  # update an existing install
install.sh install --version 2.5.0 # pin a specific release
install.sh status                  # installed/latest versions and daemon state
install.sh uninstall               # stop the daemon and remove the binary
install.sh uninstall --purge       # also remove the ~/.todex-agent data dir
\`\`\`

The script installs to \`~/.local/bin\` (override with \`--prefix\` or \`TODEX_INSTALL_DIR\`), verifies \`SHA256SUMS\` and its Ed25519 signature \`SHA256SUMS.sig\` (with an installed \`todex-agentd\` or OpenSSL 3), keeps one rollback copy, and restarts a running managed daemon. Unverified releases are refused unless \`--allow-unverified\` is passed; releases up to 2.3.6 were unsigned and get a warning and checksum-only check. The backend's self-updater likewise installs only signed releases. Prebuilt Linux binaries require glibc 2.28+; musl distributions such as Alpine build from source. WSL is detected automatically.

A pinned \`--version\` stays pinned only with \`TODEX_AUTO_UPDATE=0\` — otherwise \`serve\`, \`tui\`, and \`daemon start\` self-update on launch, and a running daemon restarts into a new release once no agent has run for five minutes.

## Build from source

\`\`\`bash
cargo build --release
\`\`\`

Requires Rust 1.80+ (MSRV). Produces \`todex-agentd\`.

## Run modes

\`\`\`bash
# Interactive TUI — status, logs, device approval, API keys, pairing QR codes
todex-agentd tui

# Foreground server
todex-agentd serve --host 127.0.0.1 --port 7345

# Background daemon (PID file under the data dir)
todex-agentd daemon start
todex-agentd daemon status
todex-agentd daemon restart
todex-agentd daemon stop

# Launch at login (launchd / systemd user service / Windows Run key)
todex-agentd daemon autostart enable
\`\`\`

Quitting the TUI leaves the daemon running. The pairing QR code holds only the server address; press \`b\` in the QR popup to open a square SVG version in your browser if the terminal is too narrow.

## Headless administration & mesh commands

Without a TUI — inside a container or over SSH — use the CLI subcommands:

\`\`\`bash
# Point-to-point pairing and devices
todex-agentd pair list
todex-agentd pair approve <code> [--yes]
todex-agentd pair reject <code>
todex-agentd devices list
todex-agentd devices revoke <device>

# Backend groups (Mesh v1)
todex-agentd mesh status                  # node ID and joined groups
todex-agentd mesh join-code [--new]       # show or rotate the 24h one-time join code

# Provider CLIs and Agent Browser
todex-agentd providers install codex claude --if-missing
todex-agentd browser install
\`\`\`

Exit code \`2\` means nothing matched; \`3\` means the command ran as a different user than the daemon. Desktop users can also deploy and manage a backend on the same machine — see [Local backend](/docs/desktop/local-backend).
`),
    },

    'backend/configuration': {
      slug: 'backend/configuration',
      title: 'Configuration',
      description: 'config.toml, environment variables, and resolution precedence.',
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
| omp binary | — | \`omp_bin\` in \`[agent]\` | \`omp\` |
| Resident keepalive (s) | — | \`TODEX_AGENTD_PROVIDER_KEEPALIVE_SECONDS\` | \`300\` (\`30..=604800\`) |
| Device auth | — | \`TODEX_AGENTD_ENABLE_AUTH\` | \`true\` |
| Pairing encryption | — | \`TODEX_AGENTD_PAIRING_ENCRYPTION\` | \`ml-kem-768\` |
| External API | \`--enable-api\` / \`--api-port\` | \`TODEX_AGENTD_API_ENABLED\` / \`TODEX_AGENTD_API_PORT\` | off / \`7346\` |
| Network listener | — | \`TODEX_AGENTD_NETWORK_ENABLED\` | \`true\` |
| Local IPC | — | \`TODEX_AGENTD_IPC_ENABLED\` / \`TODEX_AGENTD_IPC_PATH\` | on / \`<data_dir>/agentd.sock\` |
| Allowed browser origins | — | \`TODEX_AGENTD_CORS_ORIGINS\` | none |
| Trusted proxies | — | \`TODEX_AGENTD_TRUSTED_PROXIES\` | none |
| Pairing origins | — | \`TODEX_AGENTD_PAIRING_ORIGINS\` | none |
| Mesh LAN beacon | — | \`TODEX_AGENTD_MESH_BEACON\` | \`true\` (UDP 21047) |
| Headless browser | — | \`TODEX_AGENT_BROWSER_HEADLESS\` | auto (headless if no display) |
| Kitesurf / workerd paths | — | \`TODEX_AGENT_BROWSER_KITESURF_DIR\` / \`TODEX_WORKERD_PATH\` | auto-downloaded |

\`network_enabled = false\` requires IPC to be enabled: the backend then serves clients only through the IPC socket (named pipe on Windows) while keeping a random loopback port for agent tools and \`/v2/version\`. Note that Backend group commands require network access and device authentication (\`enable_auth = true\`). Container deployments add their own variables — see [Containers](/docs/desktop/containers).

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

> **Note:** \`enable_tls = true\` is intentionally blocked on the native listener to prevent false security assumptions. For remote access, terminate TLS at a trusted reverse proxy such as Nginx, Caddy, or Cloudflare Tunnel.
`),
    },

    'backend/security': {
      slug: 'backend/security',
      title: 'Security & pairing',
      description: 'Device verification, backend group trust, history encryption, browser site guards, and privacy.',
      body: body(`
TodeX is fail-closed: unapproved devices cannot talk to the backend, every request is cryptographically signed, and conversation history stays end-to-end encrypted on disk.

## Point-to-point device verification (Pairing v3)

Each client device generates an Ed25519 key pair and requests enrollment:

1. Enter only the backend URL. The client shows a random verification code and the transport key fingerprint (\`XXXX-XXXX-XXXX-XXXX\`), then waits.
2. In the backend TUI, press \`d\` to open the device panel and compare the full code and fingerprint.
3. Press \`a\` to approve or \`r\` to reject; \`x\` revokes an approved device.

The code transcript binds the transport protocol and backend public key, so approval pins the device key, protocol, and encryption key in one step. Every subsequent request carries the device signature; revoked devices receive \`401 Unauthorized\` and open WebSockets close within 5 seconds (\`4401\`).

## Backend groups & encrypted relays (Mesh v1)

In a **Backend group**, trust is backed by signed documents instead of per-host manual approvals:

- **Signed roster chain (\`todex.mesh.roster\`)**: only a member device of the previous roster version (or the group's 24-word recovery signer) can sign the next roster. Removed devices lose backend and history access immediately on online nodes and can never sign a future roster.
- **Device-approved joins**: a new device scans the **Invite QR code** (carrying node addresses only, zero keys) and connects to any reachable node; **any existing device** of the group verifies the code and approves it. Nodes never expose mesh joins in the local TUI or \`devices.json\`.
- **Mutual-HMAC join codes**: adding a backend by join code proves an 80-bit RFC 4648 base32 secret both ways (\`joinCodeProof\` / \`joinProof\`) and invalidates after 5 failed guesses.
- **End-to-end encrypted relays**: relaying through \`/v2/mesh/relay/{node}/{ticket}/{path}\` requires a device-signed relay ticket (up to 64 concurrent relays per node). The relay forwards \`health\`, \`version\`, \`transport-policy\`, \`sealed\`, and \`tv=2\` socket frames byte for byte — it sees node IDs, timing, and sizes, never plaintext content.

## Transport encryption

| Mode | Suite | When |
| --- | --- | --- |
| \`none\` | Plaintext | Loopback-only setups |
| \`x25519\` | X25519 + ChaCha20-Poly1305 | General remote access |
| \`ml-kem-768\` | NIST post-quantum ML-KEM | Default for pairing |

Keys are delivered only through device pairing or signed \`node-info\` documents — there is no manual key import. Profiles holding an unverified key are refused on every host, loopback included, until re-paired.

## History encryption & sibling profiles

- Events and titles are encrypted before reaching disk for authorized X-Wing device recipients and the 24-word recovery key; the backend holds no private decryption key. Desktop and mobile clients cache only raw ciphertext on device.
- Approving a device into a **Backend group** automatically fulfills its history grant from online group devices with no extra prompt.
- When one daemon is reached through multiple profiles on the same client (for example IPC, TCP, and a group node sharing the same pinned transport key), those sibling profiles grant each other history access automatically so switching to local IPC keeps earlier history readable.

## Browser origins and proxies

The backend answers cross-origin requests only from the desktop app (\`todex-desktop://app\`), loopback pages, and the exact origins listed in \`security.cors_origins\`. Requests carrying \`Forwarded\`, \`X-Forwarded-For\`, or \`X-Real-IP\` always count as remote unless forwarded by a proxy listed in \`security.trusted_proxies\`.

## Agent Browser site approvals & network guard

- **Per-request Fetch guard**: both Chromium and Kitesurf pause and evaluate every tab request. \`localhost\`, \`127.0.0.1\`, and \`[::1]\` open directly; public and local-network hosts ask first (\`desktop_browser_host\`: Allow once / Always allow / Deny).
- **DNS resolution checks**: even when **Site approval** is set to **No approval**, the guard resolves hostnames and continuously blocks link-local ranges (\`169.254.0.0/16\`, \`fe80::/10\`), cloud metadata endpoints (\`fd00:ec2::254\`), credentials in URLs, and the daemon's own port. Password-field typing always requires a single-use confirmation (\`SENSITIVE_ACTION\`).

## Local IPC & signed releases

- **Local IPC**: the Unix socket (or Windows named pipe) accepts only the OS user running the daemon, serving \`/v2/local-admin/*\` without device signatures. With \`network_enabled = false\`, IPC is the only entry point.
- **Signed releases**: every release publishes \`SHA256SUMS.sig\`. \`install.sh\`, the backend updater, desktop local-backend deployment, and desktop updates refuse unverified releases.

## Private conversations

A private conversation lives only in the daemon's memory: no journal, no keyring entry, no history cache, and gone on daemon restart. Claude Code, Codex, and Pi write no session files; omp, OpenCode, and DeepSeek Harness place theirs in a temporary folder (\`$XDG_RUNTIME_DIR/todex-private\`, \`/dev/shm\`, or system temp, Linux/macOS only) deleted with the conversation. Grok Build, Devin, Antigravity, and generic ACP refuse them. Private conversations cannot be forked, scheduled, compacted, or referenced via \`@chat:\`.

## Privacy filter

The output filter masks secrets in \`todex_ssh\` output returned to agents (private keys, credentials, bank cards, national IDs, proxy credentials), with optional **Aggressive** rules (URL tokens, high-entropy strings, UUIDs, emails, phone numbers, public IPs) and up to 32 custom key names. In the user's SSH output pane, filtered values sit beneath a scratch-off cover.

## Workspace boundaries & isolation

- \`workspace_roots\` restricts every file and directory API to authorized directories; removing a workspace cancels active turns while preserving conversations.
- Every query and journal is scoped by \`tenant_id\`; agent subprocesses run with sanitized environments; native TLS is refused (terminate TLS at a reverse proxy); [External API](/docs/backend/external-api) keys reach only their own conversations, scoped agents, and workspaces.
`),
    },

    'backend/api': {
      slug: 'backend/api',
      title: 'API reference',
      description: 'The /v2 REST surface, multiplexed /v2/ws WebSocket, and 2.5 protocol additions.',
      body: body(`
All device endpoints live under \`/v2\` and carry Ed25519 device signatures over JSON (wrapped through \`POST /v2/sealed\` when transport encryption is active). API keys for scripts and CI use a separate port and \`/api/v1\`; see [External API & keys](/docs/backend/external-api).

## System & backend groups

| Endpoint | Purpose |
| --- | --- |
| \`GET /health\` | Liveness probe |
| \`GET /v2/version\` | Daemon version, workspace root, capabilities, and \`mesh: 1\` support flag |
| \`ALL /v2/mesh/relay/{node}/{ticket}/{path}\` | End-to-end encrypted byte-for-byte relay for public routes and \`tv=2\` WebSockets |

## Workspaces

| Endpoint | Purpose |
| --- | --- |
| \`GET /v2/workspaces\` | Cached workspaces for the current tenant |
| \`PUT /v2/workspaces\` | Merge workspace caches; returns canonical IDs |
| \`DELETE /v2/workspaces/{id}\` | Cancel active turns and remove the workspace (conversations kept) |
| \`GET /v2/workspace/entries?workspace=&query=\` | File/folder suggestions for the \`@\` picker |
| \`GET /v2/workspace/directories?path=\` | Directory tree explorer |
| \`GET /v2/workspace/file?path=\` | Read a file inside the sandbox root |

## Providers & CLI management

| Endpoint | Purpose |
| --- | --- |
| \`GET /v2/providers\` | Providers and capabilities (including \`supportsReplan\`, \`backgroundTaskStop\`) |
| \`GET /v2/providers/versions\` | Installed vs latest CLI versions for each agent |
| \`POST /v2/providers/{provider}/install\` | Install a missing managed CLI |
| \`POST /v2/providers/{provider}/upgrade\` | Start a single-flight CLI upgrade (active agent work blocks it) |
| \`GET /v2/providers/upgrades/{operationId}\` | Async install/upgrade progress |
| \`GET /v2/providers/models?provider=&workspace=\` | Live model catalog (including Claude Code \`initialize\` discovery) |
| \`GET /v2/providers/commands?provider=&workspace=\` | Slash commands, skills (including \`linked: true\` symlinks), and extensions |

Provider accounts live under \`/v2/agent-providers/{agent}\` with \`GET .../export\` and \`POST .../import\`.

## Conversations & Smart work mode

| Endpoint | Purpose |
| --- | --- |
| \`GET /v2/conversations\` | Persisted conversations for the tenant |
| \`POST /v2/conversations\` | Create a conversation (or private conversation) |
| \`GET /v2/conversations/{id}\` | Manifest and details |
| \`GET /v2/conversations/{id}/events?afterSequence=&limit=\` | Paginated event journal; \`beforeSequence=N\` pages backwards |
| \`POST /v2/conversations/{id}/prompt\` | Dispatch a turn — supports \`afterPlan\` and \`replan\` for Claude Smart work mode |
| \`POST /v2/conversations/{id}/cancel\` | Cancel the running turn |
| \`POST /v2/conversations/{id}/background-tasks/stop\` | Stop background tasks a session still waits on between turns |
| \`POST /v2/conversations/{id}/permissions/{permissionId}\` | Resolve tool, \`user_input\`, \`plan\`, or host approvals |

Conflicting mutations while a turn runs return \`409 Conflict\`; follow-ups use the queue endpoints.

## Agent desktop tools

| Endpoint | Purpose |
| --- | --- |
| \`GET / PUT /v2/agent-desktop\` | Enable/disable tools, pick \`browserEngine\` (\`chromium\` / \`kitesurf\`), set \`browserHostApproval\` (\`ask\` / \`auto\`), read permissions |
| \`POST /v2/agent-browser/install\` | Download the chosen browser engine |
| \`GET /v2/agent-browser/hosts\`, \`DELETE .../hosts/{host}\` | List or remove always-allowed external browser sites |
| \`GET /v2/agent-desktop/computer/apps\` | Running and installed apps for \`@app:\` |
| \`POST /v2/agent-desktop/computer/permissions\` | Open System Settings & drag-in permission guide on macOS |

## WebSocket — \`/v2/ws\`

One connection multiplexes:

- \`conversation.subscribe\` — sequence-resumable journals; normalized \`plan.updated\` snapshots across Codex, Claude, Pi, and ACP; \`provider.event\` (\`plan_handoff\`, \`plan_reentered\`, \`provider_warning\`, \`auto_review\`, \`background_tasks_pending\`, \`background_tasks_ended\`)
- Prompt dispatch, cancellation, permissions, and \`conversation.backgroundTasks.stop\`
- \`terminal.start\` / \`terminal.input\` / \`terminal.resize\` / \`terminal.stop\` / \`terminal.attach\` — PTY sessions with screen-snapshot reconnect
- \`agentBrowser.watch\` / \`agentBrowser.frame\` and \`desktop.computer.action\` (with AI cursor landing fractions)
- \`mesh.node.get\`, \`mesh.presence.get\`, \`mesh.state.get\`, \`mesh.state.push\`, \`mesh.join.list\`, \`mesh.join.approve\`, \`mesh.join.reject\`, and \`mesh.updated\` broadcasts

The authoritative contracts are [docs/API.md](https://github.com/youtonghy/TodeX_backend/blob/main/docs/API.md) and [docs/mesh-v1.md](https://github.com/youtonghy/TodeX_backend/blob/main/docs/mesh-v1.md) in the backend repository.
`),
    },

    'backend/external-api': {
      slug: 'backend/external-api',
      title: 'External API & keys',
      description: 'Call your agents from scripts, CI jobs, and services over REST + SSE with backend-managed API keys.',
      body: body(`
Besides the device port (\`7345\`), \`todex-agentd\` can serve a separate REST + SSE API on its own port for scripts, CI jobs, and automation services. It authenticates with **API keys issued by the backend** — no device pairing, no transport v2 — and can also be enabled and managed visually under **Settings → Agent Calling**.

## Turn it on

The listener is **off by default**. Enable it with \`[api] enabled = true\` in \`config.toml\`, \`--enable-api\`, \`TODEX_AGENTD_API_ENABLED=true\`, or through **Settings → Agent Calling** / the backend TUI (applied on the next backend start).

\`\`\`toml
[api]
enabled = true
host = "127.0.0.1"
port = 7346
# allow_plaintext_remote = true   # only behind a TLS-terminating proxy
\`\`\`

The API port must differ from the main port. Because keys are bearer credentials, non-loopback \`api.host\` values are refused unless \`allow_plaintext_remote = true\` is set behind a TLS reverse proxy. There is no CORS: browsers cannot call it cross-origin.

## Issue and manage keys

Keys follow \`tdx_<id>_<secret>\` and are displayed **once** at creation. The backend stores only a hash of the secret in \`<data_dir>/api-keys.json\` (\`0600\`).

\`\`\`bash
todex-agentd api-key create --name ci --agent codex --workspace ~/projects/app
todex-agentd api-key list
todex-agentd api-key update <id> --approval auto-approve
todex-agentd api-key revoke <id>
\`\`\`

The TUI **API Keys** panel (\`i\`) and **Settings → Agent Calling** manage keys live without a daemon restart; revoked or expired keys receive \`401\` immediately and any running turns are cancelled.

Each key scopes:

- **Agents & models** — bounded by both the global **Agent Calling** allowlist and the key's own agent selection (all by default).
- **Workspaces** — absolute paths including subdirectories (all workspace roots by default).
- **Approval** — \`ask\` (default), \`auto-approve\`, or \`reject\`; device-bound prompts are never auto-approved on a key's behalf.
- **Expiry** — optional.

API conversations use only the agent's native tools (no SSH, desktop, or browser MCP servers) and cannot override permission or sandbox modes.

## Endpoints

Send \`Authorization: Bearer <key>\` (or \`X-API-Key\`) to \`http://127.0.0.1:7346\`:

| Endpoint | Purpose |
| --- | --- |
| \`GET /api/v1/health\` | Liveness probe (no key) |
| \`GET /api/v1/me\` | Calling key, scopes, and approval policy |
| \`GET /api/v1/agents\` | Agents the key may use |
| \`GET /api/v1/agents/{agent}/models?workspace=\` | Live model catalog |
| \`GET /api/v1/workspaces\` | Workspaces the key may access |
| \`POST /api/v1/conversations\` | Create a conversation: \`{agent, workspace, title?}\` |
| \`GET /api/v1/conversations\` | List the key's conversations |
| \`GET / DELETE /api/v1/conversations/{id}\` | Inspect or delete a conversation |
| \`POST /api/v1/conversations/{id}/turns\` | Start a turn (\`Accept: text/event-stream\` streams SSE) |
| \`GET /api/v1/conversations/{id}/events?after=&limit=\` | Plaintext event page |
| \`GET /api/v1/conversations/{id}/events/stream\` | SSE stream (history then live, resumable via \`Last-Event-ID\`) |
| \`POST /api/v1/conversations/{id}/cancel\` | Cancel the running turn |
| \`POST /api/v1/conversations/{id}/permissions/{permissionId}\` | Answer a permission request |
| \`POST /api/v1/runs\` | One-shot: create conversation + run one turn, streamed or awaited |

## One-shot runs

\`\`\`bash
KEY=$(todex-agentd api-key create --name demo --workspace ~/projects/app | tail -1)

curl -s -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \\
  -d '{"agent":"codex","workspace":"'"$HOME"'/projects/app","text":"Summarize the README"}' \\
  http://127.0.0.1:7346/api/v1/runs

curl -N -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \\
  -d '{"agent":"claude-code","workspace":"'"$HOME"'/projects/app","text":"List the TODOs","stream":true}' \\
  http://127.0.0.1:7346/api/v1/runs
\`\`\`

Without \`stream\`, the call waits for the turn (\`timeoutSecs\` defaults to 600, max 3600; on timeout the turn is cancelled and \`504\` is returned).

## History stays encrypted

External API history is still end-to-end encrypted on disk. Each key derives its own history recipient from its secret, decrypted in memory only while serving requests authenticated with that key. Nothing derived from the secret is persisted on disk.
`),
    },

    // ------------------------------------------------------------------ Desktop

    'desktop': {
      slug: 'desktop',
      title: 'Desktop overview',
      description: 'The Electron client — customizable Home board, three-pane workbench, local IPC, and containers.',
      body: body(`
TodeX Desktop is a native client for \`todex-agentd\` built with Electron 44, React 19, Vite 7, Tailwind CSS v4, and the BoardUI design system. It shares \`@todex/protocol\` and the entire session layer with the web client, so the workbench is identical while adding native host integrations.

## Home board & three panes

- **Home page**: opens by default on launch with live cards for running runs, waiting approvals, daily conversation/token counts, hourly usage, and Codex / Claude Code plan limits — fully reorderable and resizable.
- **Left sidebar**: split or unified workspace/conversation layout, workspace tags, group folder status rings, offline-backend workspace folding, and standalone views for **Plan** (board & calendar), **Terminal** (SSH/FTP/Local), **Profile**, and **Private conversations**.
- **Center chat**: streaming Markdown timeline, action-titled execution groups with thinking dots and file chips, dedicated Plan rows & approval cards, live **Plan steps** above the composer, **Smart work mode** handoffs, \`@\` / \`/\` / \`#\` reference menus, and background task stop controls.
- **Right workbench**: resizable multi-tab aside with **Terminal** (embedded xterm.js WebGL PTY), **Files**, **Git Diff**, **Agent calls**, plus live views for **Agent browser** and **Computer Use** (or place live views above the composer).

## Desktop-only extras

- **[Local backend](/docs/desktop/local-backend)**: one-click download, signature check, launch, and local IPC connection for this machine's \`todex-agentd\` (keeping IPC for data and the group link as a standby).
- **[Containers](/docs/desktop/containers)**: run isolated backends in Docker with container workspaces, setup commands, idle auto-freeze, and scheduled cleanup.
- **LAN beacon discovery (UDP 21047)**: automatically finds Backend group nodes on the local network when IP addresses change.
- **On-device history cache**: opens recently viewed encrypted conversations instantaneously from local disk before catching up with the backend.
- **Native pickers & diagnostics**: OS file/directory dialogs, \`contextBridge\` IPC isolation (\`nodeIntegration: false\`), and redacted debug logs.

## Releases

Prebuilt packages ship from GitHub Releases: Windows NSIS (x64 + ARM64), macOS Apple Silicon DMG, and Linux x64 AppImage with SHA-256 checksums. See [Set up & build](/docs/desktop/setup) for development builds.
`),
    },

    'desktop/setup': {
      slug: 'desktop/setup',
      title: 'Set up & build',
      description: 'Prerequisites, development mode, release packaging, and redacted diagnostics.',
      body: body(`
## Requirements

- Node.js 22+, pnpm 11+
- Sibling checkout of \`TodeX_protocol\` next to the repository (compiled from \`src\`)
- A running \`todex-agentd\` backend (default \`http://127.0.0.1:7345\`), or use \`?demo\` mode in a browser

## Install & run

\`\`\`bash
pnpm install
pnpm run dev
\`\`\`

If the Electron binary download is interrupted, repair it with
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

Packages are built by the **Release desktop packages** GitHub workflow: enter a semver such as \`2.5.0\` to publish Windows NSIS (x64 + ARM64), macOS Apple Silicon DMG, Linux x64 AppImage, and \`SHA256SUMS\`. Development builds report \`DEV0.0.0\`. macOS signing and auto-update requirements are documented in \`docs/automatic-updates.md\` in the desktop repo.

## Development logs

Builds stamped \`DEV0.0.0\` write diagnostics to \`userData/logs/todex-desktop-debug.log\` (override with \`TODEX_DESKTOP_LOG_PATH\`). Logs cover window, IPC, HTTP, WebSocket, and uncaught errors with tokens, cookies, keys, and attachments redacted.
`),
    },

    'desktop/connect': {
      slug: 'desktop/connect',
      title: 'Connect a backend',
      description: 'Connect multiple point-to-point backends or join a Backend group, sync configs, and diagnose issues.',
      body: body(`
TodeX stays connected to **multiple backends at once**: each backend manages its own workspaces, conversations, and tools, distinguished by colored dots in the sidebar. When you use multiple devices and backends, **Backend groups** eliminate repetitive per-device pairing.

## Option 1: Backend groups (recommended for multiple devices & servers)

Under **Settings → Backend groups**, your devices and \`todex-agentd\` instances form a decentralized trust group that needs no central server (you can still pick a hub to speed up discovery and relaying):

1. **Create or join**: Click **Create group** on your first device and save the one-time 24-word **recovery key**. On new devices, open **Backend groups → Join group** and scan the **Invite QR code** (or paste the invite text — it carries node addresses only, never keys), then click **Approve** on **any existing device** after checking the verification code. Approval grants access to every backend in the group and their encrypted history at once.
2. **Add backends**: Already-paired backends join directly in place under **Add backend → Paired backend** (keeping existing conversations and history). Unpaired backends join via **Address and join code** (\`todex-agentd mesh join-code\`, valid 24 hours and printed in an ungrouped backend's startup log).
3. **Local IPC + group standby**: If this computer's backend is in the group and connected via [Local backend](/docs/desktop/local-backend), data and requests flow over IPC (**This computer · data over IPC**) while the group connection stays open as a standby for presence, roster sync, and join requests; sibling profiles of the same daemon share history grants automatically.
4. **Pinned addresses, LAN beacons & relays**: Pin public IPs, domains, or port-forwarded URLs in a node's group settings. Desktop clients listen for UDP 21047 LAN beacons, and when all direct addresses fail, traffic can route through another node of the group over an **end-to-end encrypted relay** (**Via** \`<node>\`), returning to direct as soon as a direct address answers.
5. **Hubs**: in the node settings of a backend with a public address that stays online, turn on **Hub** (the member list tags it **Hub**; a group may have several). The other backends keep a connection to it and swap their latest addresses through it, and the hub tells each one the public address it sees; devices first get through via the hub and move to a direct connection as soon as one works. A hub only passes on signed rosters and addresses and cannot read what it relays.

:::demo mesh

## Option 2: Point-to-point pairing

To connect an individual backend outside any group, open **Settings → Backend connections**, click **Add backend**, and enter only its URL:

1. The client displays a verification code and the backend's transport key fingerprint (\`XXXX-XXXX-XXXX-XXXX\`).
2. Approve the code in the backend TUI (\`d\`, then \`a\`).
3. The device key, transport protocol (default \`ml-kem-768\`), and backend public key are pinned together.

Open any point-to-point backend in Settings to check its fingerprint, **Re-pair**, or set its recovery key. Group nodes live exclusively under **Backend groups**. For same-machine backends use [Local backend](/docs/desktop/local-backend); containers display their \`todexc\` / \`docker exec\` approval command (see [Containers](/docs/desktop/containers)).

## Config sync & provider account export

- **Config sync (Settings → Backend connections → Config sync)**: place two paired backends side by side (**Source backend** and **Target backend**) and copy **CLI accounts**, **Settings**, **MCP servers**, **Skills**, and **SSH connections**. Only new and changed items are written; nothing on the target is deleted, and secrets stay masked on screen (password-based SSH hosts and private keys are never synced).
- **Account export/import**: export or import provider profiles as signed JSON files per agent under **Settings → CLI management → Accounts** (treat exported files as secrets).

:::demo config-sync

## Diagnostics

| State | Cause | Fix |
| --- | --- | --- |
| Backend unreachable | \`/v2/version\` or \`/health\` fails | Start \`todex-agentd\`; check ports/firewall, or pin an address / enable relays in the group |
| Invalid backend URL | URL can't be parsed | Use \`http(s)://host:port\` form (HTTPS pages require HTTPS/WSS for remote backends) |
| Authentication failed | HTTP 401/403 | Device not approved or removed from the group — re-pair or rejoin |
| Deprecated protocol | URL path contains \`/v1\` | Switch to the root \`/v2\` endpoint |
| WebSocket failure | REST works, \`/v2/ws\` fails | Check proxy WebSocket upgrades or crypto mismatch, then **Re-pair** |
| Agent unavailable | Provider shows \`available = false\` | Install or sign in to the CLI via **Settings → CLI management** |
`),
    },

    'desktop/workbench': {
      slug: 'desktop/workbench',
      title: 'The workbench',
      description: 'Home board, sidebar, Smart work mode & plan review, action-titled timelines, workbench tabs, and shortcuts.',
      body: body(`
The workbench is identical on desktop and web (web shortcut differences are noted). Watch the full scripted walkthrough first; each section below has its own automated demo you can pause or step through:

:::demo

## Home page

TodeX opens on **Home** by default, summarizing activity across every connected backend: **Running**, **Waiting for reply** (highlighting **Needs approval**), **Conversations today**, **Tokens today**, **Usage by hour**, and Codex / Claude Code **Plan limits** (5-hour and 7-day windows).

Click **Customize layout** to drag cards into a new order, resize them from the corner, remove cards, or add them back with **Add cards**; click **Reset** to restore the default board.

:::demo home

## Left sidebar

Workspaces sit above conversations — or switch **Settings → Appearance → Sidebar layout** to **Unified** to nest each workspace's conversations under it (5 per page). Rows show the active agent badge and status dot (staying lit while waiting on background tasks); right-click actions cover New, Rename, Fork, Pin, and Delete.

- **Offline-backend workspaces folded**: workspaces on disconnected backends stay hidden (except the currently open row) until paging reaches the bottom, where **Show workspaces on offline backends (n)** restores them in order. Search always queries everything.
- **Tags & folder status rings**: assign tags to workspaces or groups and toggle **Group by tags**; group folder icons carry the most urgent status ring among their workspaces (\`working > issue > unread\`).
- **Standalone views & No workspace**: **No workspace** collects unattached conversations across backends; opening Home, Plan, Terminal, or Profile clears the workspace/conversation highlight behind them.
- **Private conversations (\`⌘⇧P\` / \`⌥⇧P\` on web)**: pick a supported agent to run a RAM-only conversation with a private badge and notice.

:::demo offline-sidebar

## Scheduled conversations & optional features

- **Scheduled conversations**: create one from the sidebar or a **Plan** task and choose a send time. Messages sent there wait in the backend queue and fire in order at the scheduled time, with **Send now**, **Change time**, and **Cancel schedule** controls above the composer.
- **Features (Settings → Features)**: show, fold under **More**, or turn off **Scheduled conversations**, **Terminal**, and **Plan** per device (removing their shortcuts and menus when off).
- **Connection pre-warming**: while a backend is booting, the sidebar waits up to 2 minutes instead of failing immediately, and the active conversation's agent is pre-warmed for faster first replies.

## Smart work mode & plan review

Choose **Smart** in a Claude Code conversation's work mode menu to run the two-stage workflow configured in **Settings → Smart work mode**:

1. **Plan stage (\`Smart · Planning\`)**: Claude investigates using the planning model, reasoning effort, and automatically attached plan skill.
2. **Plan row & approval card**: \`ExitPlanMode\` renders the plan as its own Markdown **Plan** row in the timeline, paired with a **Plan ready for approval** composer card (showing the execute model in Smart mode) where you can **Approve** or send **Request changes** notes back to Claude.
3. **Mid-turn handoff & replanning**: approving switches the live process to the execute model and **Auto-approve** (**Smart · Executing**) with a handoff notice; if Claude re-enters Plan mode later or you attach the plan skill, it switches back to the planning model automatically.

:::demo smart

## Center — chat & plan steps

- **Plan steps above the composer (\`Plan 1/3\`)**: a collapsible checklist displays live step progress across Codex, Claude Code (\`TodoWrite\`), Pi (\`@tintinweb/pi-tasks\`, preserved across turns), and ACP agents.
- **Codex warnings & auto-review lines**: Codex \`provider_warning\` and \`auto_review\` outcomes appear as quiet single-line notices with tooltips; Codex efforts include \`ultra\`.

:::demo plan-steps

- **Thinking dots, action titles & file chips**: running tool groups animate with BoardUI thinking dots and describe the current call ("Reading \`page.tsx\`"); finished runs tally what they did ("Edited 2 files · Ran 1 command") and list touched files as chips.

:::demo execution-group

- **Stop background tasks**: when Claude Code waits only on background tasks after a turn finishes, click **Stop background tasks** above the composer to stop them cleanly.

:::demo background-tasks

- **Prompt box & forks**: \`@\` opens two-level references (\`@file:\`, \`@folder:\`, \`@chat:\`, \`@skill:\`, \`@mcp:\`, \`@app:\`, and SSH hosts); \`/\` runs slash commands; \`#\` references skills/MCPs; paste or drop images/files; click **Fork from this reply** under replies (any reply on Codex/Pi, latest reply on others). Codex supports \`/goal <objective>\`, and Pi accepts \`/todex compact <instructions>\`.

## Right — workbench tabs

| Tab | Contents |
| --- | --- |
| Terminal | Embedded xterm.js PTY (WebGL) with find, links, shell integration, image paste, and screen-snapshot reconnects |
| Files | Workspace directory tree and file preview |
| Git Diff | Live multi-repo working tree changes, branches, worktrees, and Git actions |
| Agent calls | Live view of child conversations spawned via \`todex_agents\` |
| Agent browser / Computer Use | Opens as a side-panel tab (or above the composer per **Live view placement**), displaying the orange **AI cursor** over Computer Use frames |

:::demo computer-live

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| \`⌘B\` / \`Ctrl B\` | Toggle left sidebar |
| \`⌘⌥B\` / \`Ctrl Alt B\` | Toggle right workbench aside |
| \`⇧⌘G\` / \`Ctrl Shift G\` | Git actions |
| \`⌘N\` (\`⌥N\` on web) | New conversation |
| \`⇧⌘N\` (\`⌥⇧N\` on web) | Add a workspace |
| \`⇧⌘P\` (\`⌥⇧P\` on web) | New private conversation |
| \`⌘L\` / \`Ctrl L\` | Quick search across conversations and content |
| \`⌘1…⌘9\` / \`Ctrl 1…9\` | Switch workbench tab |
| \`⇧⌘K\` / \`Ctrl Shift K\` | Plan panel (Board / Calendar) |
| \`⇧⌘T\` (\`⌥⇧T\` on web) | Terminal view (SSH hosts, keys, remote files, Local) |

> Browsers reserve \`⌘N\` / \`⇧⌘N\` / \`⇧⌘T\`, so the web client maps them to Option (\`⌥\`). Holding the modifier briefly reveals shortcut badges in the UI.

## Terminal & shell integration

Inside a terminal (macOS uses \`⌘\`; Linux and Windows use \`Ctrl Shift\`): \`⌘C\`/\`Ctrl Shift C\` copy, \`⌘V\`/\`Ctrl Shift V\` paste, \`⌘F\`/\`Ctrl Shift F\` find, \`⌘K\`/\`Ctrl Shift K\` clear, and \`⌘↑\`/\`⌘↓\` jump between prompts.

**Shell integration** (Settings → Appearance → Terminal) marks command exit status, syncs the path header, confirms before closing active commands, and notifies when a command running longer than 10 seconds finishes out of sight. Pasted or dropped images save to the terminal host (or \`~/.cache/todex/paste\` on SSH hosts) and paste their paths, cleaned up after 7 days.
`),
    },

    'desktop/settings': {
      slug: 'desktop/settings',
      title: 'Settings',
      description: 'Backend groups, connections & config sync, Smart work mode, Agent Desktop Tools, CLI management, and caches.',
      body: body(`
Settings use a grouped rail on the left. This page covers every major settings category; see [Local backend](/docs/desktop/local-backend) and [Containers](/docs/desktop/containers) for host-specific guides.

## Backend groups

**Settings → Backend groups** manages decentralized device and backend groups (Mesh v1):

- **Create & join**: create a group (backing up its one-time 24-word recovery key), scan an **Invite QR code** or paste an invite to join, and approve pending requests by verifying the code on any existing device.
- **Add backends & node settings**: add already-paired backends in place or pair new ones with a 24-hour **Join code**; configure **Pinned addresses**, **As a relay** role (\`Preferred\` / \`Allowed\` / \`Not allowed\`), and **Reachable through a relay** per node; monitor online/last-seen status or leave/remove members.

:::demo mesh

## Backend connections & Config sync

- **Backend connections**: manage point-to-point backends (label color, address, verified key fingerprint, re-pairing, and history encryption recovery). Group nodes stay under **Backend groups** rather than duplicating here.
- **Config sync (Settings → Backend connections → Config sync)**: view two paired backends side by side and copy **CLI accounts**, **Settings**, **MCP servers**, **Skills**, and **SSH hosts**. Only new or changed items are written; nothing on the target is deleted, secrets stay masked, and password-based SSH hosts or private keys are never synced.

:::demo config-sync

## Smart work mode

**Settings → Smart work mode** configures Claude Code's two-stage workflow per device:

- **Plan stage**: pick the planning **Model**, reasoning effort, and optional **Plan skill** (such as symlinked \`plan-gate\`) automatically attached to planning turns.
- **Execute stage**: pick the execution **Model** and reasoning effort; execution always runs under **Auto-approve** once you approve the plan.

:::demo smart-settings

## Agent Desktop Tools (Agent Browser & Computer Use)

Enable **Agent Desktop Tools** per backend (both run on the backend's computer and stream to every connected client):

- **Agent browser**:
  - **Engine**: choose between **Chromium** and experimental headless **Kitesurf** (Cloudflare \`workerd\`, per-tab isolated contexts with no desktop session required).
  - **Site approval & allowed sites**: choose **Ask for each site** (prompting on non-loopback public and LAN sites with \`Allow once\` / \`Always allow\` / \`Deny\`) or **No approval** (with DNS resolution still blocking link-local, cloud metadata, and the daemon's port), and manage saved **Always-allowed sites**.
  - **Workspace profiles**: isolate cookies, storage, and cache per workspace when using Chromium.
- **Computer Use**:
  - **Engine & live view placement**: choose **Built-in** or download experimental **agent-desktop**, and pin live views to the **Side panel** or **Above the composer**.
  - **macOS permission guide**: shows drag-in guidance beside System Settings, reminds when Screen Recording needs a backend restart, and detects ad-hoc signatures that cannot persist macOS grants.

:::demo agent-browser

## CLI management

**Settings → CLI management** tracks installed vs latest versions across Codex, Claude Code, Pi, Grok Build, DeepSeek Harness, omp, and ACP profiles, supporting parallel installs and **Update all** (container-baked CLIs show "Updated with the image"). **Shared MCPs / Skills** at the top configures entries shared across every agent.

| Tab | Contents |
| --- | --- |
| Settings | CLI config form, environment, and raw editor; Pi **Plugins** & native **MCP** tabs and **Subagent templates**; DeepSeek Harness (\`dsh\`) patch layers and plugins |
| MCP / Skill | Active MCP servers and skills; top-level symlinked skills carry a read-only **Linked** badge |
| Accounts | Provider accounts and API keys (with JSON export/import and an exact **512K / \`524,288\`** context preset) |
| Cleanup | Native CLI sessions stored on the backend |
| Plugins | omp plugin install, upgrade, remove, and toggle controls |

:::demo linked-skills

## Agent Calling, SSH, storage & appearance

- **Agent Calling**: set callable agents and models shared by \`todex_agents\` (MCP agent-to-agent sub-conversations) and the \`/api/v1\` external API, toggle the external API port, and manage scoped API keys.
- **SSH connections**: toggle Agent access per host and for the **Local** host terminal, configure privacy filter categories (including aggressive rules and custom keys), and choose **SSH approval** granularity (**Per host** vs **Per command**).
- **General → Storage**: run **TodeX history cleanup** and toggle **Cache recent conversations on this device** (desktop only; keeps up to 100 conversations / 300 newest events / 200 MB of raw ciphertext, never caching private conversations).
- **Appearance & notifications**: switch **Sidebar layout** (**Split** vs **Unified**) and terminal **Shell integration**; system alerts surface question text or approval targets and withdraw automatically once answered.
`),
    },

    'desktop/local-backend': {
      slug: 'desktop/local-backend',
      title: 'Local backend',
      description: "Deploy this machine's backend from the desktop app, connect over IPC, and keep the group link on standby.",
      body: body(`
The desktop app can deploy and run \`todex-agentd\` on the machine it is installed on and communicate over **local IPC** — a Unix socket, or a named pipe on Windows, accessible only to your OS user account without opening a network port or running device verification.

## Deploy and connect

Open **Settings → Local backend**. The **This machine** card runs \`todex-agentd\` matching the desktop version:

1. **Deploy and connect** downloads the release, verifies its \`SHA256SUMS.sig\` signature, starts the daemon, pairs this app, and connects over IPC.
2. Subsequent controls offer **Start and connect**, **Restart**, **Stop**, **Pair again**, and **Show log**.

Only releases verified by the release key are installed (older unsigned builds up to 2.3.6 are accepted only when matching the exact version). Configure **Start at login**, **Stop when TodeX quits** (off by default so remote/group devices stay served), workspace roots, listener port/encryption, and QR pairing from the same page.

## Switching loopback connections & participating in Backend groups

- **Switch to IPC**: when a loopback profile (\`http://127.0.0.1:7345\`) points at a daemon that also serves IPC, enabling Local backend reuses that profile in place (keeping its device key and history access) or offers **Switch to IPC**.
- **This computer in a Backend group (\`This computer · data over IPC\`)**: when the local backend also belongs to a **Backend group**, the desktop app keeps two links — all workspaces, conversations, and requests travel over the **IPC profile**, while the group network profile stays connected as a **standby** solely for presence, roster sync, and join requests. Because sibling profiles of the same daemon grant each other history automatically, history stays seamless across IPC and network links; if the IPC profile is removed, the group profile resumes carrying data.

## Turning off the network listener

If only this app uses the backend, turn **Network listener** off (requires an active IPC connection and a restart). The daemon keeps only a random loopback port for agent tools and \`/v2/version\` (also toggled with \`b\` in the TUI or \`network_enabled = false\` in \`config.toml\`). Leave the network listener on if remote devices reach this machine through a **Backend group**.

## Local admin API

Over IPC only, \`/v2/local-admin/*\` serves status, configuration, mesh join codes, pairing approvals, device revocation, and resets without device signatures. Over TCP these endpoints return \`404\`.
`),
    },

    'desktop/containers': {
      slug: 'desktop/containers',
      title: 'Containers',
      description: 'Run backends in Docker, create container workspaces, run setup scripts, and freeze or prune idle containers.',
      body: body(`
A TodeX container is a Docker image preloaded with \`todex-agentd\` and agent CLIs. Each container runs as its own isolated backend with your project directory mounted in.

## Requirements & container management

Docker with Compose v2 is required on the host running TodeX Desktop. **Settings → TodeX Container** checks prerequisites, lists image tags and TodeX containers, and provides start, stop, restart, upgrade, mounts, logs, and delete controls (preserving the container's home volume unless ticked). The screen shares the \`~/.config/todex-container/<name>/\` layout with the \`todexc\` CLI.

## Container workspaces

**New workspace** offers **Local workspace** or **Container workspace**. When creating a container workspace, TodeX:

1. Mounts the folder (at the same path on Linux/macOS, or \`/workspace/<folder>\` on Windows);
2. Pairs with the container backend (or displays the \`todexc\` / \`docker exec\` approval command);
3. Checks CLIs and offers to copy accounts, settings, MCPs, skills, and SSH hosts via [Config sync](/docs/desktop/settings#backend-connections-config-sync).

Container backends report \`deployment: container\`: baked-in CLIs show "Updated with the image", and host ↔ container path mappings make **Choose locally** and **Open** work seamlessly on container files.

## Setup commands

Container workspaces can run one-time setup commands as the \`todex\` user inside the workspace path via \`bash -c\`, stopping at the first failure, with suggested templates for \`pnpm\`, \`npm\`, \`yarn\`, \`uv\`, \`requirements.txt\`, and git submodules. Long setups continue in the background.

## Freezing idle containers & automatic cleanup

- **Freeze when idle** (off by default) pauses an idle container (\`docker pause\`) after 15 minutes to 4 hours; sending a message, opening a terminal, or focusing one of its workspaces resumes it automatically. Manual **Freeze** and **Resume** buttons appear on container cards.
- **Automatic cleanup** runs a minute after startup and every 6 hours thereafter to remove unused old images, prune stopped containers after 1/7/30 days, unmount unused folders, and optionally stop containers on quit. Home volumes are never deleted automatically.

## Container backend settings

| Setting | Effect |
| --- | --- |
| \`TODEX_AGENTD_DEPLOYMENT=container\` | Disables self-update; \`update\` exits 0 without changes |
| \`TODEX_AGENTD_ADVERTISE_URL\` | Address advertised to clients and Backend groups |
| \`TODEX_AGENTD_IMAGE_CLI_DIR\` | Image-managed CLIs; install requests return \`409\` |
| \`TODEX_AGENTD_PATH_MAPPINGS\` | Host ↔ container path mappings (\`[[workspace.path_mappings]]\`) |

Headless containers can be administered via \`todex-agentd pair list|approve|reject\`, \`todex-agentd mesh join-code\`, \`devices list|revoke\`, and \`providers install <id>…\`.
`),
    },

    'mobile': {
      slug: 'mobile',
      title: 'Mobile',
      description: 'The native iPhone & iPad client — coming soon.',
      body: body(`
> **Coming soon.** The native mobile client is in active development; this page tracks planned capabilities and will be replaced by full documentation when the first beta ships.

Todex Mobile (\`TodeX_native\`) is a native Swift + UIKit app for iPhone and iPad that connects to the same \`todex-agentd\` backend — bringing your workspaces, conversations, plan reviews, approvals, and terminal sessions into your pocket.

## Planned & aligning

- **Camera QR pairing & Backend groups** — scan a **Backend group** invite QR code or backend TUI QR code to fill addresses and complete verification exactly as on desktop.
- **Chat + console** — two-pane layout on iPad with conversation timeline and plan reviews on one side and terminal, files, live views, and Git on the other.
- **Full turn control** — approvals, question prompts, plan change requests, Smart work mode status, model/reasoning pickers, message queueing, and notifications when background work finishes.
- **Same security & ciphertext cache** — Ed25519 device signatures, X25519 / ML-KEM-768 transport encryption stored in iOS Keychain, and the same ciphertext-only on-device history cache (keeping offline conversation titles as \`titleEnc\` ciphertext and omitting private conversations).

## In the meantime

The [web client](/docs/introduction/quick-start) is responsive for mobile and tablet browsers — open \`/app\` directly or scan a Backend group invite QR code to get started. See [Security & pairing](/docs/backend/security) for pairing details.
`),
    },
  },
};
