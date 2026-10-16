# AGENTS.md

## Styling notes

- `src/renderer/site/website.css` imports `@heroui/styles` at the top of the file, so site overrides below win on equal specificity. When overriding a HeroUI `Select.Trigger`'s `padding` shorthand (e.g. `.language-select`, `.release-select`), the chevron indicator is absolutely positioned (`inset-inline-end: 8px`, 16px wide) and needs its reserved space — always add back `padding-inline-end` (~28-30px) or the indicator will overlap the value text. Also set `align-items: center` on the overridden trigger: it is a flex row whose children otherwise stretch/pin to the top, while the absolutely positioned indicator stays vertically centered, so the icon/value and chevron end up misaligned. To hide the chevron (e.g. the icon-only language switcher on phones), target `[data-slot="select-default-indicator"]` — that is the slot HeroUI renders when `<Select.Indicator />` has no children; `[data-slot="select-indicator"]` alone misses it and the chevron overlaps the icon.

## Workbench UI (BoardUI) and the landing demo

- The workbench (`/app`, `src/renderer/workbench.tsx`) uses BoardUI, the same as the desktop client: source-owned components under `src/renderer/components/{base,application,foundations,ui,chat,settings}`, `hooks/`, `utils/cx.ts`, and the theme in `styles/{global,globals,theme,typography}.css`, imported through the `@/` alias. They are copied verbatim from `../TodeX_desktop/src/renderer`; change them there first and copy back. Only the public site (`site/`, `website.css`, `/docs`) still uses HeroUI/ReUI, and it loads its own styles, so the two never share CSS.
- Web-only code sits on top of the desktop renderer and must survive each sync: the browser platform bridge (`lib/webPlatform.ts`, `window.todexWeb`), IndexedDB-sealed keys (`lib/historyKeyStore.ts`, `lib/storage.ts`), the snapshot browser tab (`lib/browserSnapshot.ts` in `WorkbenchPanel`), Pi extensions (`PiExtensionPanel`, `session/piExtensionEffects.ts`, `session/providerCommands.ts`), `todex.web.*` storage keys, browser-safe shortcuts, and the local-data reset in Settings. Electron-only desktop pieces (`nativeViewHost`, `browserDesktop`, `debugLogger`, shell file actions, Cmd+W IPC, the directory picker) are left out.
- ESLint registers no-op `react-hooks`/`@next/next` rules for the BoardUI directories only, because the copied files carry disable comments for them.
- `/demo` (embedded by the landing page) is the real `App` on the desktop's demo fixtures and in-memory transport (`demo/fixtures.ts`, `demo/transport.ts`, same as desktop `?demo`). It shares the origin with `/app`, so `demo/isolate.ts` (imported first) swaps `localStorage` for an in-memory store and keeps history keys in memory; never let the demo write real storage. The landing page loads it with `?autoplay`: `demo/autoplay.ts` drives the real UI with a pointer (new conversation, type, send, open the work process) and answers its prompt with a scripted turn through `setDemoTurnScript`, the one web-only hook in `demo/transport.ts`; it pauses while the frame is scrolled away and stays off under reduced motion. Plain `/demo` remains identical to the desktop's `?demo`.

## Site docs page

- `/docs/*` is routed inside `src/renderer/site/entry.tsx` (not `main.tsx`) and renders `src/renderer/site/docs/DocsPage.tsx`. Left nav is the ReUI `tree` component (`src/renderer/components/reui/tree.tsx`) driven by `@headless-tree/react` `useTree`; content renders via `@heroui-pro/react/markdown`. Docs content is split into a locale-independent structure plus per-locale packs: `docsContent.ts` holds the tree seed (ids are URL slugs — keep them identical across locales), the tree dataLoader helpers, and `getDocsContent(locale)`; `docsContent.<locale>.ts` files (`en`, `zh-CN`, `ja`, `ko`) carry translated `sections` + `pages`, and untranslated pages fall back to English. `DocsPage` remounts on locale change because `useTree` captures the dataLoader once. Sections are non-folder items kept permanently expanded.
- `components.json` + root `tsconfig.json` exist so `pnpm dlx shadcn@latest add @reui/<name>` resolves the `@reui` registry and the `@renderer/*` alias. The registry reads `REUI_LICENSE_KEY` from the environment (`.env.local`, gitignored — never commit it). Generated ReUI files use `cn` (the npm package) and lucide icons; swap lucide imports for `@remixicon/react` to match the app.

## Docker / CI notes

- Self-hosting: `TODEX_BACKENDS` (`server/backends.ts`) pins the backends. The server then serves `GET /api/config` (ids and names only), proxies `/backend/<id>/` REST and WebSocket upgrades (`createWebServer` wires the `upgrade` listener; the proxy middleware runs before compression/helmet), redirects `/` to `/app` and narrows `connect-src` to `'self'`. The proxy always overwrites `Origin` with a fixed non-local value so the backend's anonymous loopback path can never be reached through it — keep that. The workbench loads the config before installing the bridge (`lib/webDeployment.ts`, `window.todexWeb.deployment`) and passes `managed` to the shared `BackendConnectionSettings`. Proxied backend URLs carry a path prefix, which the protocol URL builders (`normalizeServerUrl`, `buildHttpUrl`, `buildV2WebSocketUrl`, `joinServerPath`) preserve.
- Server-side runtime dependencies are only `express`, `compression` and `helmet`; client libraries belong in `devDependencies` (vite bundles them) so the runtime image's `pnpm install --prod` stays small.

- In `Dockerfile`, `hpsetup` (deps stage) installs `@heroui-pro/react@latest` and its peer deps, rewriting `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` in the image. The `build` stage's `COPY . .` restores the repo copies, so the deps-stage copies are copied back right after to keep manifests in sync with `node_modules`. Without this, pnpm 11's `verifyDepsBeforeRun` (default `install`) detects drift on `pnpm run` and reinstalls the unlicensed npm stub over the licensed package contents, breaking typecheck with `TS2307`.

## Planning gate

- Before starting a task that spans modules or repositories, changes product behavior, public interfaces/APIs, or data schemas/migrations, touches security or permissions, or carries compatibility or deployment risk, invoke the `plan-gate` skill: investigate read-only, present its full plan, and wait for the user to approve or amend it before implementing. For these gated tasks, the approved plan is the reviewable result and authorization covers investigation and planning until approval. Simple, localized, low-risk changes proceed directly without the gate.

## Sibling repositories (cross-repo access)

TodeX lives in sibling checkouts under the same parent directory:

- `../TodeX_backend` — Rust backend/API server (`docs/API.md` holds the API contract)
- `../TodeX_desktop` — Electron desktop client; keep shared UI, screens, styles, and session logic in sync with it (mirror of the Dual-Client Synchronization rules in its `AGENTS.md`)

When a task requires it — keeping the dual clients in sync, aligning client calls with the backend API contract, or a change that explicitly spans repos — read and edit those sibling repositories directly at their paths, even though they sit outside this repository. Follow each repo's own `AGENTS.md` while working inside it. Commit and push in each repository separately per its Git delivery rules; never mix another repo's changes into this repository's commits.

## Git delivery

- Before starting each task, sync with the remote so the work is based on the latest code: `git fetch`, then fast-forward the current branch to its upstream (`git pull --ff-only`), and create any task worktree from the updated branch. If the fast-forward is blocked (diverged history, or uncommitted changes in the same files), do not stash, reset, or rebase the user's work; base the task on the fetched upstream instead (for example, a worktree from `origin/<branch>`) and mention it in the final response.
- Do every complex task — anything beyond a parameter change or a few localized lines — in a dedicated Git worktree on its own branch, not in the main checkout, which may hold the user's uncommitted work. Install dependencies inside the worktree (`pnpm install`) before running builds or checks.
- Hand the result back locally: bring the branch into the main checkout (fast-forward or cherry-pick) without modifying the user's uncommitted changes, rerun the relevant checks there, then remove the worktree and its branch.
- After completing each task, create one or more Git commits for the changes made in that task.
- Group commits by change category or repository responsibility when the task includes unrelated changes.
- Run the relevant validation commands before committing whenever practical, and mention any validation that could not be run.
- Push the created commits to the current branch's upstream remote after committing.
- If committing or pushing is blocked, report the blocker explicitly and leave the working tree status clear in the final response.
- Do not include unrelated local changes in a task commit. Preserve user changes unless the user explicitly asks to modify or discard them.
