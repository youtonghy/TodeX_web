# AGENTS.md

## Styling notes

- `src/renderer/site/website.css` imports `@heroui/styles` at the top of the file, so site overrides below win on equal specificity. When overriding a HeroUI `Select.Trigger`'s `padding` shorthand (e.g. `.language-select`, `.release-select`), the chevron indicator is absolutely positioned (`inset-inline-end: 8px`, 16px wide) and needs its reserved space — always add back `padding-inline-end` (~28-30px) or the indicator will overlap the value text.

## Docker / CI notes

- In `Dockerfile`, `hpsetup` (deps stage) installs `@heroui-pro/react@latest` and its peer deps, rewriting `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` in the image. The `build` stage's `COPY . .` restores the repo copies, so the deps-stage copies are copied back right after to keep manifests in sync with `node_modules`. Without this, pnpm 11's `verifyDepsBeforeRun` (default `install`) detects drift on `pnpm run` and reinstalls the unlicensed npm stub over the licensed package contents, breaking typecheck with `TS2307`.
