# AGENTS.md

## Styling notes

- `src/renderer/site/website.css` imports `@heroui/styles` at the top of the file, so site overrides below win on equal specificity. When overriding a HeroUI `Select.Trigger`'s `padding` shorthand (e.g. `.language-select`, `.release-select`), the chevron indicator is absolutely positioned (`inset-inline-end: 8px`, 16px wide) and needs its reserved space — always add back `padding-inline-end` (~28-30px) or the indicator will overlap the value text. Also set `align-items: center` on the overridden trigger: it is a flex row whose children otherwise stretch/pin to the top, while the absolutely positioned indicator stays vertically centered, so the icon/value and chevron end up misaligned. To hide the chevron (e.g. the icon-only language switcher on phones), target `[data-slot="select-default-indicator"]` — that is the slot HeroUI renders when `<Select.Indicator />` has no children; `[data-slot="select-indicator"]` alone misses it and the chevron overlaps the icon.

## Site docs page

- `/docs/*` is routed inside `src/renderer/site/entry.tsx` (not `main.tsx`) and renders `src/renderer/site/docs/DocsPage.tsx`. Left nav is the ReUI `tree` component (`src/renderer/components/reui/tree.tsx`) driven by `@headless-tree/react` `useTree`; content renders via `@heroui-pro/react/markdown`. Docs content is split into a locale-independent structure plus per-locale packs: `docsContent.ts` holds the tree seed (ids are URL slugs — keep them identical across locales), the tree dataLoader helpers, and `getDocsContent(locale)`; `docsContent.<locale>.ts` files (`en`, `zh-CN`, `ja`, `ko`) carry translated `sections` + `pages`, and untranslated pages fall back to English. `DocsPage` remounts on locale change because `useTree` captures the dataLoader once. Sections are non-folder items kept permanently expanded.
- `components.json` + root `tsconfig.json` exist so `pnpm dlx shadcn@latest add @reui/<name>` resolves the `@reui` registry and the `@renderer/*` alias. The registry reads `REUI_LICENSE_KEY` from the environment (`.env.local`, gitignored — never commit it). Generated ReUI files use `cn` (the npm package) and lucide icons; swap lucide imports for `@remixicon/react` to match the app.

## Docker / CI notes

- In `Dockerfile`, `hpsetup` (deps stage) installs `@heroui-pro/react@latest` and its peer deps, rewriting `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` in the image. The `build` stage's `COPY . .` restores the repo copies, so the deps-stage copies are copied back right after to keep manifests in sync with `node_modules`. Without this, pnpm 11's `verifyDepsBeforeRun` (default `install`) detects drift on `pnpm run` and reinstalls the unlicensed npm stub over the licensed package contents, breaking typecheck with `TS2307`.

## Git delivery

- Do every complex task — anything beyond a parameter change or a few localized lines — in a dedicated Git worktree on its own branch, not in the main checkout, which may hold the user's uncommitted work. Install dependencies inside the worktree (`pnpm install`) before running builds or checks.
- Hand the result back locally: bring the branch into the main checkout (fast-forward or cherry-pick) without modifying the user's uncommitted changes, rerun the relevant checks there, then remove the worktree and its branch.
- After completing each task, create one or more Git commits for the changes made in that task.
- Group commits by change category or repository responsibility when the task includes unrelated changes.
- Run the relevant validation commands before committing whenever practical, and mention any validation that could not be run.
- Push the created commits to the current branch's upstream remote after committing.
- If committing or pushing is blocked, report the blocker explicitly and leave the working tree status clear in the final response.
- Do not include unrelated local changes in a task commit. Preserve user changes unless the user explicitly asks to modify or discard them.
