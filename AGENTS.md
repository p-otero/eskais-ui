# Eskais UI: agent instructions

Eskais UI is a shadcn-style registry of React components built on Vercel UI SDK (`@ui-sdk/core`, `@ui-sdk/react`).

## Before building or changing a component

1. **Read the UI SDK docs first.** Load the `ui-sdk` skill (`.agents/skills/ui-sdk/SKILL.md`), then read `node_modules/@ui-sdk/react/docs/llms.txt` and the page of every component you touch. Don't guess the API: UI SDK is in beta and changes.
2. Read `skills/eskais-ui/SKILL.md` for the conventions of this registry.

## Rules

- Every operable control is a UI SDK part. A bare `<button>` or `<input>` is invisible to agents. Never hand-roll a role UI SDK ships (dialog, menu, listbox, combobox, tabs…).
- Behavior UI SDK doesn't ship goes in a `definePrimitive` primitive with explicit `agent.actions`, rendered with `createParts`.
- Import UI SDK from its public entries (`@ui-sdk/react/dialog`), never `internal/*`.
- Every control has an accessible name. Style from `data-slot` and state attributes with the semantic tokens in `registry/styles/theme.css`.
- Destructive actions carry `data-agent-confirm`.
- Registry code (`registry/**`) must run in consumer browsers and in Node/npm/pnpm projects: no `bun`, `bun:*` or `node:*` imports.
- No default copy in a specific language, except overridable accessible labels.
- Every interface gets the agent test (see the ui-sdk skill, `references/agent-ready.md`).

## Spacing

Spacing is chosen by role. The values change with the theme (compact is tighter), so never hand-pick a number.

| Utility                           | Role                                                                            | Default           | Compact             |
| --------------------------------- | ------------------------------------------------------------------------------- | ----------------- | ------------------- |
| `gap-inline`                      | icon + text, or parts inside one control, chip or row                           | 0.375rem          | 0.25rem             |
| `gap-items`                       | siblings in a list or stack: cards in a column, chips, buttons, form fields     | 0.5rem            | 0.375rem            |
| `gap-group`                       | groups inside a surface: header vs body, dialog sections                        | 1rem              | 0.75rem             |
| `gap-section`                     | surfaces on a page: board columns, stat cards, a page's blocks                  | 1.5rem            | 1rem                |
| `px-inset-chip` / `py-inset-chip` | pills, badges, chips, kbd                                                       | 0.5rem / 0.125rem | 0.375rem / 0.125rem |
| `px-inset-item` / `py-inset-item` | menu and list items, small cards (task card, usage tile), table cells           | 0.625rem / 0.5rem | 0.5rem / 0.375rem   |
| `px-control-x`                    | buttons, inputs, selects                                                        | 0.875rem          | 0.625rem            |
| `p-inset-surface`                 | cards, dialogs, panels, popovers (`p-surface` still works as an alias)          | 1.5rem            | 1rem                |
| `p-control-inset`                 | the rim of a control-height bar around `-sm` items: tab list, segmented control | 2px               | 2px                 |

`inline`, `items`, `group`, `section`, `inset-surface` and `control-inset` are Tailwind spacing values, so every spacing utility takes them: `p-inline` pads a menu's popup like parts of one control, `pb-group` separates an accordion panel, `-mx-inline` lets a menu separator bleed through that padding. The chip and item insets exist only as `px-`/`py-`; for a negative bleed or an offset tied to them, use the variable: `-mx-(--item-padding-x)`, `start-(--item-padding-x)`.

1. In `registry/**`, spacing (padding, margin, gap, `space-x/y`, inset offsets used as spacing) uses only role tokens. Allowed: `0`, `px` and 1px optical nudges. Anything else needs `// oxlint-disable-next-line eskais/spacing-tokens -- <reason>`. `eskais/spacing-tokens` enforces this.
2. A component never sets outer margin. The parent spaces its children with `gap-*`.
3. Choose by relationship, not by look: parts of the same thing use `gap-inline` (inside one control or row) or `gap-items` (siblings); distinct groups use `gap-group`; separate surfaces use `gap-section`.
4. Sizes (`size-*`, `h-*`, `w-*`) are not spacing. Leave them, but prefer the tokens (`h-control`, `size-control-sm`).

## Comments

- Don't narrate what the code does; rename and restructure until the intent is obvious.
- Comment only non-obvious rationale: upstream bugs or workarounds, platform or protocol constraints, security or performance reasoning.
- No commented-out code. No TODO without a linked issue. `eskais/no-low-value-comments` enforces this.

## Commands

| Task           | Command                                                  |
| -------------- | -------------------------------------------------------- |
| Lint           | `bun run lint`                                           |
| Format         | `bun run format`                                         |
| Typecheck      | `bun run typecheck`                                      |
| Tests          | `bun run test`                                           |
| Registry       | `bun run registry:build`, then commit `public/r`         |
| Everything     | `bun run verify`                                         |
| Showcase       | `bun run dev`                                            |
| Clean consumer | `node tooling/consumer-check.mjs npm` (or `pnpm`)        |
| Contrast (CI)  | `bun run test:browser`: axe and pixel contrast in Chrome |
| Contrast glass | `bun run test:browser:glass`: by hand, not in CI         |
