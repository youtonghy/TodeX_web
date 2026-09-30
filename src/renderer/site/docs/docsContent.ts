// Docs preview content: a multi-level navigation tree plus one markdown body
// per leaf page. Real content loading (files, API, search index) plugs in
// behind `docPages` later without touching the layout.

export type DocNavNode = {
  /** Unique tree key. For nodes with a page this is also the URL slug. */
  id: string;
  title: string;
  /** Slug of the page rendered when this node is activated. */
  page?: string;
  children?: DocNavNode[];
};

export type DocPage = {
  slug: string;
  title: string;
  description: string;
  /** Markdown body; the page header renders `title`/`description` above it. */
  body: string;
};

export const docNav: DocNavNode[] = [
  {
    id: 'section-getting-started',
    title: 'Getting Started',
    children: [
      { id: 'introduction', title: 'Introduction', page: 'introduction' },
      {
        id: 'quick-start',
        title: 'Quick Start',
        page: 'quick-start',
        children: [
          { id: 'quick-start/backend', title: 'Run the backend', page: 'quick-start/backend' },
          { id: 'quick-start/connect-agent', title: 'Connect an agent', page: 'quick-start/connect-agent' },
          { id: 'quick-start/workbench', title: 'Open the workbench', page: 'quick-start/workbench' },
        ],
      },
      { id: 'concepts', title: 'Core concepts', page: 'concepts' },
    ],
  },
  {
    id: 'section-guides',
    title: 'Guides',
    children: [
      {
        id: 'guides/agents',
        title: 'Coding agents',
        page: 'guides/agents',
        children: [
          { id: 'guides/agents/codex', title: 'Codex', page: 'guides/agents/codex' },
          { id: 'guides/agents/claude', title: 'Claude Code', page: 'guides/agents/claude' },
          { id: 'guides/agents/acp', title: 'ACP-compatible agents', page: 'guides/agents/acp' },
        ],
      },
      { id: 'guides/git-workspaces', title: 'Git workspaces', page: 'guides/git-workspaces' },
      { id: 'guides/kanban', title: 'Kanban & tasks', page: 'guides/kanban' },
      { id: 'guides/mobile-pairing', title: 'Mobile pairing', page: 'guides/mobile-pairing' },
    ],
  },
  {
    id: 'section-self-hosting',
    title: 'Self-hosting',
    children: [
      { id: 'self-hosting/web-client', title: 'Web client', page: 'self-hosting/web-client' },
      { id: 'self-hosting/docker', title: 'Docker deployment', page: 'self-hosting/docker' },
      { id: 'self-hosting/https', title: 'HTTPS & remote access', page: 'self-hosting/https' },
    ],
  },
  {
    id: 'section-reference',
    title: 'Reference',
    children: [
      { id: 'reference/shortcuts', title: 'Keyboard shortcuts', page: 'reference/shortcuts' },
      { id: 'reference/faq', title: 'FAQ', page: 'reference/faq' },
    ],
  },
];

export const defaultDocSlug = 'introduction';

const body = (markdown: string) => `${markdown.trim()}\n`;

export const docPages: Record<string, DocPage> = {
  introduction: {
    slug: 'introduction',
    title: 'Introduction',
    description: 'What TodeX is, what it is not, and when it is the right tool for the job.',
    body: body(`
TodeX is a **self-hostable multi-agent coding workbench**. It connects the
coding agents you already use — Codex, Claude Code, Pi, and any
ACP-compatible agent — to one workspace that stays on *your* machine.

Instead of juggling terminal tabs, chat windows, and editor panes, TodeX
gives every agent a shared view of the same repository: conversations, Git
state, terminal output, and task boards live side by side.

## Why TodeX

- **Your machine, your rules.** The backend runs locally or on your own
  server. Code never leaves infrastructure you control.
- **Agent-agnostic.** Swap agents per conversation, or run several at once
  on the same workspace.
- **Everywhere.** The same backend serves the desktop app, this web client,
  and paired mobile devices.

## What it is not

TodeX is not an agent itself and does not ship its own model. It is the
workspace layer *around* your agents — you bring the subscriptions and API
keys, TodeX orchestrates everything else.

> **Tip:** If you just want to see it in action, the landing page embeds a
> [live scripted demo](/) of the real workbench — no install required.

## Where to go next

| Goal | Doc |
| --- | --- |
| Get running in minutes | [Quick start](/docs/quick-start) |
| Understand the moving parts | [Core concepts](/docs/concepts) |
| Run it on your own server | [Self-hosting](/docs/self-hosting/web-client) |
`),
  },

  'quick-start': {
    slug: 'quick-start',
    title: 'Quick Start',
    description: 'From zero to a working agent conversation in three steps.',
    body: body(`
This is the fastest path to a running TodeX setup. You will:

1. Run the **backend** daemon on a machine you control.
2. Connect a **coding agent** with your own credentials.
3. Open the **workbench** and send your first prompt.

## Before you start

- Node.js 22 or newer on the host machine.
- At least one supported agent installed — for example Codex or
  Claude Code — with an active subscription or API key.

## The three steps

### 1. Run the backend

\`\`\`bash
todex-agentd tui
\`\`\`

The daemon starts on your machine and prints the address your clients
should connect to. Keep it running.

### 2. Connect an agent

In the workbench, open **Settings → Agent providers** and pick the agent
you want. TodeX reuses the agent's own CLI login, so an agent that works in
your terminal works here too.

### 3. Open the workbench

Open \`http://localhost:4173/app\` (or the desktop app), create a workspace
pointed at a Git repository, and start a conversation.

> **Note:** Each step has its own page with screenshots and edge cases —
> use the menu on the left to jump straight to [Run the
> backend](/docs/quick-start/backend), [Connect an
> agent](/docs/quick-start/connect-agent), or [Open the
> workbench](/docs/quick-start/workbench).
`),
  },

  'quick-start/backend': {
    slug: 'quick-start/backend',
    title: 'Run the backend',
    description: 'Install and start the todex-agentd daemon.',
    body: body(`
The **backend** (\`todex-agentd\`) is the daemon that owns your workspaces
and talks to your agents. Every client — desktop, web, mobile — connects
to it.

## Install

\`\`\`bash
npm install -g todex-agentd
\`\`\`

## Start

\`\`\`bash
todex-agentd tui
\`\`\`

The TUI shows the listen address, connected agents, and live sessions. For
a headless server use \`todex-agentd serve\` instead.

## Verify

\`\`\`bash
curl http://localhost:4173/healthz
# {"status":"ok"}
\`\`\`

## Common options

| Flag | Default | Purpose |
| --- | --- | --- |
| \`--port\` | \`4173\` | HTTP/WebSocket listen port |
| \`--host\` | \`0.0.0.0\` | Bind address; use \`127.0.0.1\` for local-only |
| \`--data-dir\` | platform default | Where workspaces and session state live |

> **Security note:** The backend executes agent commands on the host. Bind
> it to \`127.0.0.1\` unless you have set up remote pairing — see
> [HTTPS & remote access](/docs/self-hosting/https).
`),
  },

  'quick-start/connect-agent': {
    slug: 'quick-start/connect-agent',
    title: 'Connect an agent',
    description: 'Register a coding agent provider with your own credentials.',
    body: body(`
TodeX talks to agents through **providers**. A provider wraps the agent's
CLI or protocol and describes which models and thinking levels it offers.

## Add a provider

1. Open **Settings → Agent providers**.
2. Click **Add provider** and pick the agent type.
3. Choose the auth mode — subscription (reuses the CLI login) or API key.

\`\`\`
Provider:  Claude Code
Auth:      Official subscription (claude login)
Models:    claude-sonnet-*, claude-opus-*
\`\`\`

## How auth works

- **Subscription** — TodeX points the agent at the session already on disk,
  the same credentials the CLI uses.
- **API key** — stored locally on the backend host; masked in the UI after
  saving.

## Pick a model

Each conversation can pin a model and a reasoning effort. Leave the model
list empty to accept the agent's defaults.

> **Tip:** Mix providers freely — a single workspace can hold a Codex
> conversation and a Claude Code conversation side by side.
`),
  },

  'quick-start/workbench': {
    slug: 'quick-start/workbench',
    title: 'Open the workbench',
    description: 'Create a workspace and send your first prompt.',
    body: body(`
The **workbench** is the three-pane app you saw on the landing page:
history and workspaces on the left, the conversation in the middle, and
tools — terminal, Git, files, browser — on the right.

## Create a workspace

1. Click **New workspace**.
2. Pick a local Git repository (or an empty folder).
3. Name it — the name shows up in history and on paired devices.

## Start a conversation

Press \`⌘ N\` or click **New conversation**, choose an agent, and type a
prompt. The agent sees the workspace root as its working directory.

## Try this first

\`\`\`
Look at the repo structure and tell me what this project does.
\`\`\`

While it runs, open the **Git changes** panel to watch the working tree,
or the **Terminal** panel (\`⌘ 3\`) for a real shell in the same directory.

## You are set up

From here, the [Guides](/docs/guides/agents) section walks through each
agent's specifics and the features that make the workspace feel like home.
`),
  },

  concepts: {
    slug: 'concepts',
    title: 'Core concepts',
    description: 'The four nouns TodeX is built around.',
    body: body(`
Four nouns cover most of TodeX. Once these click, every panel and setting
makes sense.

## Backend

The \`todex-agentd\` daemon. It owns state, runs agents, and serves every
client. One backend can serve many clients at once.

## Workspace

A directory (usually a Git repository) the backend watches. Workspaces hold
their own conversations, terminals, and task boards.

## Conversation

A session with one agent inside one workspace. Conversations are resumable —
close the client, reopen it on another device, and the same stream
continues.

## Agent provider

A configured coding agent: its auth, models, and capabilities. Providers
are backend-wide, so every client sees the same list.

## How they fit together

\`\`\`
todex-agentd (backend)
 └── Workspace ── Conversation ── Agent provider
        └── Terminal · Git · Files · Kanban
\`\`\`

Clients — desktop, web, mobile — are thin views onto this tree.
`),
  },

  'guides/agents': {
    slug: 'guides/agents',
    title: 'Coding agents',
    description: 'How providers, models, and thinking levels work across agents.',
    body: body(`
Every agent plugs into TodeX through the same provider contract, but each
one keeps its own personality: its model names, its thinking levels, its
tooling.

## What is shared

- **Auth** — subscription or API key, stored on the backend.
- **Models** — a picker with enable/disable per model.
- **Reasoning effort** — mapped to whatever the agent calls it
  (thinking, effort, reasoning level).

## What differs

| Agent | Auth | Notable extras |
| --- | --- | --- |
| Codex | Subscription or API key | Plan mode, code-review prompts |
| Claude Code | Subscription or API key | Skills, subagents |
| Pi | API key | Extension panels in the UI |
| ACP agents | Agent-specific | Anything ACP-capable |

## Picking the right one

Use the agent that already reads your codebase well — the workspace, Git
state, and history are identical either way, so switching agents mid-task
costs nothing.

> Pick a specific agent on the left for its setup quirks:
> [Codex](/docs/guides/agents/codex) · [Claude
> Code](/docs/guides/agents/claude) · [ACP-compatible
> agents](/docs/guides/agents/acp)
`),
  },

  'guides/agents/codex': {
    slug: 'guides/agents/codex',
    title: 'Codex',
    description: 'OpenAI Codex as a TodeX provider.',
    body: body(`
Codex connects through its CLI login or an API key, and exposes
OpenAI's \`gpt\` and \`codex\` model families.

## Setup

1. Run \`codex login\` on the backend host once (subscription path).
2. In TodeX: **Settings → Agent providers → Add → Codex**.
3. Pick the models you want available in the model picker.

## Highlights

- **Plan mode** — ask Codex to plan before it edits; the plan renders in
  the conversation before any code changes.
- **Reasoning effort** — low / medium / high / xhigh, mapped to Codex's
  own effort levels.

## Useful prompts

\`\`\`
/plan Refactor the session store to use transactions.
\`\`\`

Codex runs entirely under your account — TodeX never proxies the model
traffic.
`),
  },

  'guides/agents/claude': {
    slug: 'guides/agents/claude',
    title: 'Claude Code',
    description: 'Anthropic Claude Code as a TodeX provider.',
    body: body(`
Claude Code connects through \`claude login\` (subscription) or an
\`ANTHROPIC_API_KEY\`, and brings its skills and subagent ecosystem along.

## Setup

1. Run \`claude login\` on the backend host once.
2. **Settings → Agent providers → Add → Claude Code**.
3. Enable the models you want (Sonnet, Opus, Haiku).

## Highlights

- **Skills** — repo-level \`SKILL.md\` files are picked up automatically.
- **Subagents** — spawned subagent runs appear inline in the conversation
  timeline with their own status.

## Notes

Claude Code's permission prompts surface in TodeX as approval cards —
approve once per tool, per session, or always.
`),
  },

  'guides/agents/acp': {
    slug: 'guides/agents/acp',
    title: 'ACP-compatible agents',
    description: 'Any agent that speaks the Agent Client Protocol.',
    body: body(`
The **Agent Client Protocol (ACP)** is the open contract TodeX uses
internally. Any agent with an ACP driver works out of the box.

## Built-in drivers

- Pi
- Grok Build
- Devin
- OpenCode

## Bring your own

If an agent speaks ACP, point a custom provider at its command:

\`\`\`
Provider:  Custom (ACP)
Command:   my-agent --acp
\`\`\`

TodeX handles the session lifecycle, streaming, and permission bridge —
your agent just implements the protocol.

> **Deep dive:** the protocol itself lives in the
> [\`TodeX_protocol\`](https://github.com/youtonghy/TodeX_backend)
> repository next to the backend.
`),
  },

  'guides/git-workspaces': {
    slug: 'guides/git-workspaces',
    title: 'Git workspaces',
    description: 'Working tree visibility, diffs, and agent-safe Git actions.',
    body: body(`
Every workspace is a Git repository first. TodeX watches the working tree
and renders it live — no refresh, no polling.

## The Git panel

- **Changes** — staged, unstaged, and untracked files with inline diffs.
- **Branches** — current branch, upstream state, ahead/behind counts.
- **Actions** — commit, push, pull, and create PRs through the agent.

## Agent-aware Git

When an agent edits files, the changes stream into the same panel — you
watch the diff build in real time and can commit or revert hunks without
leaving the conversation.

## Safety

Destructive operations (discard changes, force push, reset hard) always
ask for confirmation — whether you click them or an agent requests them.

> **Tip:** The \`⌘ 2\` shortcut jumps straight to the Git panel.
`),
  },

  'guides/kanban': {
    slug: 'guides/kanban',
    title: 'Kanban & tasks',
    description: 'Track agent work on a shared board.',
    body: body(`
The **Kanban panel** turns agent work into cards you can see, reorder, and
hand back.

## How it works

1. Describe a task — or ask an agent to break a goal into cards.
2. Drag cards across **Backlog → In progress → Review → Done**.
3. Agents read the board: tell one to "pick up the top card" and it starts
   working.

## Why a board

Long-running agent work benefits from a shared source of truth that is
*not* the chat scroll. The board survives sessions, pairs across devices,
and gives you a place to park ideas mid-conversation.

## Tips

- Cards can carry file references — mention \`@path/to/file\` and the
  agent opens it.
- Combine with Git: review the diff when a card hits **Review**.
`),
  },

  'guides/mobile-pairing': {
    slug: 'guides/mobile-pairing',
    title: 'Mobile pairing',
    description: 'Carry the same workspace to your phone.',
    body: body(`
The TodeX mobile app pairs with your backend over an encrypted channel —
scan a QR code, approve the device, done.

## Pair a device

1. On the backend host: **Settings → Devices → Pair new device**.
2. Scan the QR code (or paste the pairing link) in the mobile app.
3. Approve the request on the host.

## What syncs

- Conversations — including streams still running.
- Workspaces and kanban boards.
- Approval requests — approve a tool call from your phone.

## Trust model

Pairing uses device verification: keys are generated on each side and the
host approves each device explicitly. Revoke any device from the same
settings page.

> **Remote access:** pairing works over LAN out of the box. For access
> away from home, see [HTTPS & remote
> access](/docs/self-hosting/https).
`),
  },

  'self-hosting/web-client': {
    slug: 'self-hosting/web-client',
    title: 'Web client',
    description: 'Serve the browser workbench from your own backend.',
    body: body(`
The web client is a static bundle served by the backend — there is no
separate server-side app to deploy.

## Build & run

\`\`\`bash
pnpm build
pnpm start
# → http://localhost:4173
\`\`\`

The Express server in \`server/\` serves the built client, the releases
API, and strict security headers. Point your reverse proxy at port
\`4173\`.

## Layout

| Route | Serves |
| --- | --- |
| \`/\` | Landing page + downloads |
| \`/app\` | The workbench (connects to your backend) |
| \`/demo\` | Scripted demo, no backend needed |
| \`/docs\` | This documentation |

## Configuration

- \`PORT\`, \`HOST\` — listen address.
- \`.env.example\` documents the rest.
`),
  },

  'self-hosting/docker': {
    slug: 'self-hosting/docker',
    title: 'Docker deployment',
    description: 'Run the full stack in containers.',
    body: body(`
The repo ships a multi-stage \`Dockerfile\` and \`compose.yaml\` that build
the client and run the backend together.

## Compose

\`\`\`bash
docker compose up -d --build
\`\`\`

## What the image does

1. **deps stage** — installs dependencies, including the licensed
   \`@heroui-pro/react\` package.
2. **build stage** — compiles the client bundle and the server.
3. **runtime** — a slim image exposing \`4173\`.

## Volumes

Mount a volume at the backend's data directory to persist workspaces and
sessions across rebuilds:

\`\`\`yaml
volumes:
  - todex-data:/data
\`\`\`

> **Heads up:** keep \`pnpm-lock.yaml\` and \`pnpm-workspace.yaml\` in sync
> with the licensed package — the Dockerfile handles this, see the
> \`AGENTS.md\` note in the repo for why.
`),
  },

  'self-hosting/https': {
    slug: 'self-hosting/https',
    title: 'HTTPS & remote access',
    description: 'Reach your backend securely from anywhere.',
    body: body(`
Local pairing works over LAN with zero setup. For access outside your
network, put the backend behind HTTPS.

## Recommended setup

A reverse proxy (Caddy, nginx, Traefik) terminating TLS in front of port
\`4173\`:

\`\`\`
your-domain.com → 127.0.0.1:4173
\`\`\`

WebSocket upgrade headers must be forwarded — conversations stream over
\`wss:\`.

## Threat model

- **Always** serve remote access over HTTPS; pairing secrets and session
  tokens travel over this channel.
- Keep \`--host 127.0.0.1\` on the backend and let the proxy listen
  publicly.
- Firewall the raw port; only the proxy should reach it.

## Tailscale alternative

A private tailnet gives you remote access without exposing anything
publicly — often the simplest safe option for a personal backend.
`),
  },

  'reference/shortcuts': {
    slug: 'reference/shortcuts',
    title: 'Keyboard shortcuts',
    description: 'Every shortcut in the workbench.',
    body: body(`
The workbench is keyboard-first. \`⌘\` is Cmd on macOS, Ctrl elsewhere.

## Global

| Keys | Action |
| --- | --- |
| \`⌘ K\` | Command palette — actions, skills, navigation |
| \`⌘ N\` | New conversation |
| \`⌘ ,\` | Settings |
| \`⌘ /\` | Toggle the left sidebar |

## Panels

| Keys | Action |
| --- | --- |
| \`⌘ 1\` | Conversation |
| \`⌘ 2\` | Git changes |
| \`⌘ 3\` | Terminal |
| \`⌘ 4\` | Kanban |

## Composer

| Keys | Action |
| --- | --- |
| \`Enter\` | Send |
| \`Shift Enter\` | New line |
| \`@\` | Mention a workspace file |
| \`#\` | Reference a capability |
`),
  },

  'reference/faq': {
    slug: 'reference/faq',
    title: 'FAQ',
    description: 'Questions that come up every time.',
    body: body(`
## Is TodeX free?

The client and backend are open source under the MIT license. You pay only
for the agents and models you connect — under your own accounts.

## Does my code leave my machine?

No. The backend runs where you put it, agents run under your credentials,
and the UI talks to your backend over an encrypted channel. Nothing is
proxied through us.

## Can I use several agents at once?

Yes — that is the point. Different conversations in one workspace can use
different providers and models.

## Web vs desktop?

Same workbench, same backend. The desktop app adds native integration
(notifications, menu bar); the web client needs nothing installed.

## Something is broken — where do I look?

1. \`todex-agentd\` logs on the host.
2. The browser console for client issues.
3. [GitHub issues](https://github.com/youtonghy/TodeX_desktop/issues) for
   everything else.
`),
  },
};

// Flattened page order for previous/next navigation.
export const docPageOrder: string[] = [];
for (const node of docNav) {
  const walk = (n: DocNavNode) => {
    if (n.page) docPageOrder.push(n.page);
    n.children?.forEach(walk);
  };
  node.children?.forEach(walk);
}

// Ancestor keys (branch ids) that must be expanded for a slug to be visible.
function findAncestors(slug: string, nodes: DocNavNode[], trail: string[]): string[] | null {
  for (const node of nodes) {
    if (node.id === slug || node.page === slug) return trail;
    if (node.children) {
      const hit = findAncestors(slug, node.children, [...trail, node.id]);
      if (hit) return hit;
    }
  }
  return null;
}

export function ancestorsOf(slug: string): string[] {
  return findAncestors(slug, docNav, []) ?? [];
}

// ---------- headless-tree data ----------

export type DocTreeItem = {
  title: string;
  page?: string;
  /** Group headers render plain (never collapsible, never navigable). */
  isSection?: boolean;
  children?: string[];
};

export const docsRootId = 'docs-root';

// Flat id → item map the tree's dataLoader reads.
export const docTreeItems: Record<string, DocTreeItem> = {
  [docsRootId]: { title: 'Docs', children: docNav.map((section) => section.id) },
};

export const docSectionIds: string[] = [];

for (const section of docNav) {
  docSectionIds.push(section.id);
  docTreeItems[section.id] = {
    title: section.title,
    isSection: true,
    children: section.children?.map((child) => child.id) ?? [],
  };
  const walk = (node: DocNavNode) => {
    docTreeItems[node.id] = {
      title: node.title,
      page: node.page,
      children: node.children?.map((child) => child.id),
    };
    node.children?.forEach(walk);
  };
  section.children?.forEach(walk);
}

// slug → nav item id. Today ids equal page slugs, but keep the lookup so the
// two can diverge without breaking selection.
export const pageToItemId: ReadonlyMap<string, string> = new Map(
  Object.entries(docTreeItems)
    .filter((entry): entry is [string, DocTreeItem & { page: string }] => Boolean(entry[1].page))
    .map(([id, item]) => [item.page, id]),
);

// Prunes docNav to nodes matching `query` (a matching node keeps its whole
// subtree so context is preserved), then flattens the result into the
// headless-tree item map the sidebar dataLoader reads. `expandedIds` lists
// every kept item so the filtered tree renders fully expanded.
export function filterDocTree(query: string): { items: Record<string, DocTreeItem>; expandedIds: string[] } {
  const q = query.trim().toLowerCase();
  const items: Record<string, DocTreeItem> = { [docsRootId]: { title: 'Docs', children: [] } };

  const prune = (node: DocNavNode): DocNavNode | null => {
    const children = node.children?.map(prune).filter((k): k is DocNavNode => k !== null);
    if (node.title.toLowerCase().includes(q)) return node;
    if (children?.length) return { ...node, children };
    return null;
  };

  const register = (node: DocNavNode) => {
    items[node.id] = { title: node.title, page: node.page, children: node.children?.map((c) => c.id) };
    node.children?.forEach(register);
  };

  for (const section of docNav) {
    const kept = section.title.toLowerCase().includes(q)
      ? section.children
      : section.children?.map(prune).filter((k): k is DocNavNode => k !== null);
    if (!kept?.length) continue;
    items[docsRootId].children!.push(section.id);
    items[section.id] = { title: section.title, isSection: true, children: kept.map((c) => c.id) };
    kept.forEach(register);
  }

  return { items, expandedIds: Object.keys(items).filter((id) => id !== docsRootId) };
}
