# AGENTS.md

## Styling notes

- `src/renderer/site/website.css` imports `@heroui/styles` at the top of the file, so site overrides below win on equal specificity. When overriding a HeroUI `Select.Trigger`'s `padding` shorthand (e.g. `.language-select`, `.release-select`), the chevron indicator is absolutely positioned (`inset-inline-end: 8px`, 16px wide) and needs its reserved space — always add back `padding-inline-end` (~28-30px) or the indicator will overlap the value text.
