---
name: eskais-ui
description: Uses and extends Eskais UI, a shadcn-style registry of agent-native React components built on UI SDK. Use when adding Eskais UI components to an app (shadcn add @eskais/...), composing Button, Input, SearchField, Dialog, ConfirmDialog, Card or Badge, or adding a new component to the Eskais UI registry. Complements the official ui-sdk skill; load that one too.
---

# Eskais UI

Eskais UI components are UI SDK parts styled with Tailwind v4 and semantic tokens, copied into your project as source. Load the `ui-sdk` skill as well: everything it says about parts, controllers, change details and agents applies here unchanged.

## Install

1. In `components.json`, add the registry once:
   `"registries": { "@eskais": "https://raw.githubusercontent.com/p-otero/eskais-ui/<ref>/public/r/{name}.json" }`, where `<ref>` is a tag like `v0.1.0`, or `main`.
2. Put `@layer ui-sdk;` as the first line of the global stylesheet, above `@import "tailwindcss"`.
3. `npx shadcn@latest add @eskais/theme @eskais/button` (any item; dependencies come along).

## Choose

| Need                       | Use                                                                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An action, possibly async  | `Button`: return a Promise from `onClick` for pending, no double press                                                                                                                                            |
| A labeled text input       | `Field` + `FieldLabel` + `Input`; `InputGroup` + `InputClear` for a clear button                                                                                                                                  |
| A search box               | `SearchField label onSearch`: Enter runs `onSearch`, Escape clears only when there is text                                                                                                                        |
| A modal                    | `Dialog` parts; `dismissible={false}` + `onDismissAttempt` for unsaved changes                                                                                                                                    |
| "Are you sure?"            | `ConfirmDialog onConfirm`: a returned Promise shows pending, closes on success, shows the error on failure                                                                                                        |
| Static grouping and labels | `Card` parts, `Badge`                                                                                                                                                                                             |
| Pick one of many, typed    | `Combobox` with `items` on the root, rendering options from `<ComboboxList>{(state) => state.items.map(…)}</ComboboxList>`. Static children aren't filtered, and agents then store the label instead of the value |

## Separate the layers

- **Generic UI** (open/close, pending, focus, dismissal): UI SDK, already inside the components. Don't rebuild it with `useState` + `useEffect`.
- **Reusable app behavior** (confirm before deleting, search on Enter): an Eskais UI composed component such as `ConfirmDialog` or `SearchField`.
- **Business logic** (requests, toasts, cache invalidation): always in your callback (`onConfirm`, `onSearch`). Components never run side effects of their own.

## Agents

- Create one bridge in the app with `createAgent` from `@ui-sdk/react/agent`. Pass an `allow` that checks `step.confirm` and asks a person.
- `ConfirmDialog` with `tone="destructive"` requires `agentConfirm`: a sentence saying what confirming does. It becomes `data-agent-confirm`, so agents must get approval.
- `SearchField` exposes a `submit` action to agents only when `onSearch` is set.
- Show the approval prompt as its own alert dialog (`createConfirm` from `@ui-sdk/react/alert-dialog`), not as page content: when the agent opens a modal such as `ConfirmDialog`, the rest of the page goes inert and an inline prompt can't be clicked.
- Every control needs a name a person would recognize; the agent finds it by that name.
- Test every interface with the agent test from the ui-sdk skill (`references/agent-ready.md`).

## Style

- Use the variants (`variant`, `size`) and the semantic tokens: `background`, `foreground`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `warning`, `info`, `border`, `input`, `ring`, `overlay`.
- Style state with UI SDK attributes: `data-pending`, `data-disabled`, `data-open`, `data-starting-style`, `data-ending-style`.
- Use the shape and density tokens instead of fixed sizes: `rounded-control`, `rounded-surface`, `h-control` (`-sm`, `-lg`), `px-control-x`, `p-surface`, `gap-surface`, `shadow-surface`. Surfaces that may turn glassy use `bg-<color>/(--glass-opacity)` and `backdrop-surface`.
- Themes are attribute scopes, not separate components: `data-theme="compact"` or `data-theme="glass"` on any element, nested freely. A theme only sets tokens; never branch on the theme in a component.
- Pass layout classes (margin, width, grid placement) through `className`. To change how a component looks, edit its file in `components/ui/`, which you own.
- Optional: `npx shadcn add @eskais/lint-rules` adds an oxlint config with `@shadcn/lint` rules (`no-restyle`, `no-raw-colors`…). Extend it from `.oxlintrc.json`.

## Add a component to the registry

1. Read the UI SDK page for the component. If UI SDK ships it, style its parts; don't reimplement.
2. If it doesn't, write a primitive with `definePrimitive` (`agent.actions` last) next to the component, as `search-field-primitive.ts` does, and render it with `createParts`.
3. Use `cnState` from `@/lib/utils` so a consumer's `className` can still be a function of state.
4. Size and shape it with the tokens above so every theme applies.
5. Add tests in `test/`: behavior with Testing Library, `mount`/`checkServer` for primitives, the agent test, and `allow` refused/approved for anything with `data-agent-confirm`.
6. Add the item to `registry.json`, run `bun run verify` and commit `public/r`.

## Keep it small

- Keep components short; split a file before it passes about 200 lines.
- Every screen state needs a decision: loading, empty, error, disabled, confirming.
- No `App*` wrapper layer and no providers the consumer must mount.
