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

| Need                               | Use                                                                                                                                                                                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An action, possibly async          | `Button`: return a Promise from `onClick` for pending, no double press                                                                                                                                                                               |
| A labeled text input               | `Field` + `FieldLabel` + `Input`; `InputGroup` + `InputClear` for a clear button                                                                                                                                                                     |
| A search box                       | `SearchField label onSearch`: Enter runs `onSearch`, Escape clears only when there is text                                                                                                                                                           |
| A modal                            | `Dialog` parts; `dismissible={false}` + `onDismissAttempt` for unsaved changes                                                                                                                                                                       |
| "Are you sure?"                    | `ConfirmDialog onConfirm`: a returned Promise shows pending, closes on success, shows the error on failure                                                                                                                                           |
| Static grouping and labels         | `Card` parts, `Badge`                                                                                                                                                                                                                                |
| Pick one of many, typed            | `Combobox` with `items` on the root, rendering options from `<ComboboxList>{(state) => state.items.map(…)}</ComboboxList>`. Static children aren't filtered, and agents then store the label instead of the value                                    |
| Pick one of a few, all shown       | `RadioGroup` of `Radio` + `RadioIndicator`, each inside a `Label`; the `FieldLabel` names the group                                                                                                                                                  |
| An on/off setting                  | `Switch` beside its `FieldLabel` in a `Field` (lays out as a row); it renders its own thumb                                                                                                                                                          |
| A number on a range                | `Slider` parts; a range names each `SliderThumb` with `aria-label`                                                                                                                                                                                   |
| A button that stays pressed        | `Toggle`; `ToggleGroup` (`multiple`, `deselectable={false}`) for several sharing one value                                                                                                                                                           |
| A one-time code                    | `OTPInput` with `OTPInputSlot index` per character; one native input, so paste and autofill work                                                                                                                                                     |
| A typed, stepped number            | `NumberInput` + `NumberInputGroup`; step buttons are named "Decrease"/"Increase", override with `aria-label`                                                                                                                                         |
| A label outside a Field            | `Label htmlFor`: names any control, including a radio group, slider or switch                                                                                                                                                                        |
| Progress or a reading              | `Progress` (`value={null}` is indeterminate) or `Meter`; the track renders its indicator                                                                                                                                                             |
| A message in the page              | `Alert tone` with `AlertTitle`/`AlertDescription`; `announce` adds `role="alert"` for messages that appear later                                                                                                                                     |
| A status label                     | `StatusPill tone` (`neutral`, `info`, `success`, `warning`, `destructive`, `muted`), with an optional `dot`/`pulse`                                                                                                                                  |
| Related items as chips             | `DependencyChips` with an `aria-label`; pass `onSelect` to make each chip a button agents can press                                                                                                                                                  |
| A number that may be guessed       | `QuantityValue` with `{ value, quality, source }`: unknown shows `—`, never 0; estimated shows `~`                                                                                                                                                   |
| A time                             | `RelativeTime` with one `useNow()` per screen passed down as `now`, not one timer per time                                                                                                                                                           |
| Pass/fail criteria                 | `AcceptanceList`, and `AcceptanceBar` with `countAcceptance` for a compact summary                                                                                                                                                                   |
| Summary figures                    | `StatGroup` of `Stat` parts                                                                                                                                                                                                                          |
| Columns of items                   | `Board` with `BoardColumn` (collapsible, groups, `empty`); no drag and drop                                                                                                                                                                          |
| Which agent ran                    | `AgentBadge agent requested?`: long model ids truncate in the middle; a marker shows when what ran differs from what was asked                                                                                                                       |
| Is an agent alive                  | `LivenessIndicator` with `liveness` from your data; it never infers it from times                                                                                                                                                                    |
| Task or attempt status             | `TaskStatusPill`, `AttemptStatusPill`, `ContextModePill`                                                                                                                                                                                             |
| Tokens and cost                    | `UsageTable` / `UsageStat`; unknown stays `—`                                                                                                                                                                                                        |
| An agent task's attempts           | `AttemptTimeline`; older attempts collapse past five                                                                                                                                                                                                 |
| Approve or reject a proposal       | `ProposalActions` with `agentApproval` (`"confirm"` by default, `"allow"`, `"deny"`)                                                                                                                                                                 |
| A whole board of agent tasks       | `AgentTaskBoard` with `tasks` and `mode`; see below                                                                                                                                                                                                  |
| One agent task, compact            | `TaskCard` (selects through a stretched button; chips and proposal buttons stay their own tab stops)                                                                                                                                                 |
| One agent task, in full            | `TaskDetailPanel`: non-modal, Escape and a close button call `onClose`                                                                                                                                                                               |
| Menus, site navigation, paging, ⌘K | `ContextMenu`, `Menubar`, `NavigationMenu`, `Breadcrumb`, `Pagination page pageCount onPageChange labels`, `CommandDialog` + `Command` (pass `shortcut="mod+k"` to the trigger to opt in); `Accordion`, `HoverCard` for disclosure and link previews |

## AgentTaskBoard

`npx shadcn add @eskais/agent-task-board` installs the board and every piece it uses.

- **Snapshot or live.** `mode="snapshot"` needs `generatedAt`: it is the board's "now", shown in a banner, and times never refresh. It shows no approve or reject actions. `mode="live"` refreshes times every 30 s, paused while the page is hidden; pass `now` only for tests and screenshots.
- **One clock.** The board calls `useNow` once and passes `now` down. When you compose `TaskCard` or `TaskDetailPanel` yourself, do the same: one `useNow()` per screen, never one timer per time.
- **Labels.** English by default. Override any string with `labels={{ columns: { done: "Shipped" } }}`, or pass `labels={agentTaskBoardLabelsEs}` from `@/components/ui/agent-task-board` for Spanish, including the pieces inside (status, liveness, usage, attempts). Pass `locale` and `timeZone` for formatting.
- **Agents.** The board's root exposes `selectTask`, `setView`, `filter` and `openThread`. In live mode with `onApproveProposal`/`onRejectProposal`, `agentApproval` decides what an agent may do: `"confirm"` (default) asks a person through your bridge's `allow`, `"allow"` acts without asking, `"deny"` hides the actions from agents. People's buttons are the same either way.
- **State.** `view`, `filters`, `columns` and `selectedTaskId` are each controlled or uncontrolled (`defaultView`, `defaultFilters`, `defaultSelectedTaskId`). Cancelled tasks are hidden until `columns` shows them.
- **Static.** It works as one HTML file with no network: `node tooling/static-board.mjs` builds and checks one.

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
- Use the shape and density tokens instead of fixed sizes: `rounded-control`, `rounded-choice` (checkbox, textarea), `rounded-surface`, `h-control` (`-sm`, `-lg`), `px-control-x`, `p-surface`, `gap-surface`, `shadow-surface`. Surfaces that may turn glassy use `bg-<color>/(--glass-opacity)` and `backdrop-surface`.
- Themes are attribute scopes, not separate components: `data-theme="compact"` or `data-theme="glass"` on any element, nested freely. A theme only sets tokens; never branch on the theme in a component.
- Pass layout classes (margin, width, grid placement) through `className`. To change how a component looks, edit its file in `components/ui/`, which you own.
- Optional: `npx shadcn add @eskais/lint-rules` adds an oxlint config with `@shadcn/lint` rules (`no-restyle`, `no-raw-colors`…). Extend it from `.oxlintrc.json`.

## Add a component to the registry

1. Read the UI SDK page for the component. If UI SDK ships it, style its parts; don't reimplement.
2. If it doesn't, write a primitive with `definePrimitive` (`agent.actions` last) next to the component, as `search-field-primitive.ts` does, and render it with `createParts`.
3. Never give a `registry/lib` file and a `registry/ui` file the same basename: `shadcn add` rewrites imports by basename and points one at the other in the consumer.
4. Use `cnState` from `@/lib/utils` so a consumer's `className` can still be a function of state.
5. Size and shape it with the tokens above so every theme applies.
6. Add tests in `test/`: behavior with Testing Library, `mount`/`checkServer` for primitives, the agent test, and `allow` refused/approved for anything with `data-agent-confirm`.
7. Add the item to `registry.json`, run `bun run verify` and commit `public/r`.

## Keep it small

- Keep components short; split a file before it passes about 200 lines.
- Every screen state needs a decision: loading, empty, error, disabled, confirming.
- No `App*` wrapper layer and no providers the consumer must mount.
