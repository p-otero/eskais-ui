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
