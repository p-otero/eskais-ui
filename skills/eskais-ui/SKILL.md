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
3. `npx shadcn@latest add @eskais/theme @eskais/font-geist @eskais/button` (any item; dependencies come along). `font-geist` bundles the default font from npm; without it the theme falls back to the system font. `font-inter` is the alternative.

## Choose

| Need                               | Use                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------                                                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------                                                                                                                 |
| An action, possibly async          | `Button`: return a Promise from `onClick` for pending, no double press                                                                                                                                                                                                                                                                                               |
| A labeled text input               | `Field` + `FieldLabel` + `Input`; `InputGroup` + `InputClear` for a clear button                                                                                                                                                                                                                                                                                     |
| A search box                       | `SearchField label onSearch`: Enter runs `onSearch`, Escape clears only when there is text                                                                                                                                                                                                                                                                           |
| A modal                            | `Dialog` parts; `DialogContent size` (`sm`…`full`), `DialogBody` scrolls between header and footer, a bottom sheet on narrow screens unless `sheet={false}`; `dismissible={false}` + `onDismissAttempt` for unsaved changes                                                                                                                                          |
| "Are you sure?"                    | `ConfirmDialog onConfirm`: a returned Promise shows pending, closes on success, shows the error on failure                                                                                                                                                                                                                                                           |
| Static grouping and labels         | `Card` parts, `Badge tone`                                                                                                                                                                                                                                                                                                                                           |
| Pick one of many, typed            | `Combobox` with `items` on the root, rendering options from `<ComboboxList>{(state) => state.items.map(…)}</ComboboxList>`. Static children aren't filtered, and agents then store the label instead of the value                                                                                                                                                    |
| Pick one of a few, all shown       | `RadioGroup` of `Radio` + `RadioIndicator`, each inside a `Label`; the `FieldLabel` names the group                                                                                                                                                                                                                                                                  |
| An on/off setting                  | `Switch` beside its `FieldLabel` in a `Field` (lays out as a row); it renders its own thumb                                                                                                                                                                                                                                                                          |
| A number on a range                | `Slider` parts; a range names each `SliderThumb` with `aria-label`                                                                                                                                                                                                                                                                                                   |
| A button that stays pressed        | `Toggle`; `ToggleGroup` (`multiple`, `deselectable={false}`) for several sharing one value                                                                                                                                                                                                                                                                           |
| A one-time code                    | `OTPInput` with `OTPInputSlot index` per character; one native input, so paste and autofill work                                                                                                                                                                                                                                                                     |
| A typed, stepped number            | `NumberInput` + `NumberInputGroup`; step buttons are named "Decrease"/"Increase", override with `aria-label`                                                                                                                                                                                                                                                         |
| A label outside a Field            | `Label htmlFor`: names any control, including a radio group, slider or switch                                                                                                                                                                                                                                                                                        |
| Progress or a reading              | `Progress` (`value={null}` is indeterminate) or `Meter`; the track renders its indicator                                                                                                                                                                                                                                                                             |
| A message in the page              | `Alert tone` with `AlertTitle`/`AlertDescription`; `announce` adds `role="alert"` for messages that appear later                                                                                                                                                                                                                                                     |
| A status label                     | `StatusPill tone` (the shared tones plus `muted`), with an optional `dot`/`pulse`; `StatusDot tone label` alone                                                                                                                                                                                                                                                      |
| Related items as chips             | `DependencyChips` with an `aria-label`; pass `onSelect` to make each chip a button agents can press                                                                                                                                                                                                                                                                  |
| A number that may be guessed       | `QuantityValue` with `{ value, quality, source }`: unknown shows `—`, never 0; estimated shows `~`                                                                                                                                                                                                                                                                   |
| A time                             | `RelativeTime` with one `useNow()` per screen passed down as `now`, not one timer per time                                                                                                                                                                                                                                                                           |
| Pass/fail criteria                 | `AcceptanceList`, and `AcceptanceBar` with `countAcceptance` for a compact summary                                                                                                                                                                                                                                                                                   |
| Summary figures                    | `StatGroup` of `Stat` parts                                                                                                                                                                                                                                                                                                                                          |
| Columns of items                   | `Board` with `BoardColumn` (collapsible, groups, `empty`); no drag and drop                                                                                                                                                                                                                                                                                          |
| Which agent ran                    | `AgentBadge agent requested?`: a provider avatar (initials on a stable color, or your `avatars`), long model ids truncate in the middle, a marker when what ran differs                                                                                                                                                                                              |
| Is an agent alive                  | `LivenessIndicator` with `liveness` from your data; it never infers it from times                                                                                                                                                                                                                                                                                    |
| Task or attempt status             | `TaskStatusPill`, `AttemptStatusPill`, `ContextModePill`                                                                                                                                                                                                                                                                                                             |
| Tokens and cost                    | `UsageGrid` (dense tiles, for a detail view), `UsageTable` (rows, side-by-side columns) or `UsageStat`; unknown stays `—`                                                                                                                                                                                                                                            |
| An agent task's attempts           | `AttemptTimeline`; older attempts collapse past five                                                                                                                                                                                                                                                                                                                 |
| Approve or reject a proposal       | `ProposalActions` with `agentApproval` (`"confirm"` by default, `"allow"`, `"deny"`)                                                                                                                                                                                                                                                                                 |
| A whole board of agent tasks       | `AgentTaskBoard` with `tasks` and `mode`; see below                                                                                                                                                                                                                                                                                                                  |
| One agent task, compact            | `TaskCard` (selects through a stretched button; chips and proposal buttons stay their own tab stops)                                                                                                                                                                                                                                                                 |
| One agent task, in full            | `TaskDetailDialog` (modal, or `presentation="drawer"`) or `TaskDetailPanel` (non-modal); Escape and a close button call `onClose`                                                                                                                                                                                                                                    |
| A bar pinned to an edge            | `Floating side align strategy` (`sticky` default, `fixed`, `absolute`) + `FloatingContent`; put a `FilterBar` or other UI SDK controls inside. Sticky bars go last in their scroll container                                                                                                                                                                         |
| Files and screenshots on an item   | `AttachmentStrip attachments aria-label max size onOpen`: image thumbnails open a built-in `Lightbox`, files open `href`; `+N` reveals the rest. `AttachmentThumb` alone. Agents get `openAttachment(id)`                                                                                                                                                            |
| One image of a set, full size      | `Lightbox items index onIndexChange open onOpenChange`: arrow keys, counter, fit or actual size, open original; `srcDark` follows the theme without a flash. Agents get `next`, `previous`, `goTo(index)`                                                                                                                                                            |
| Where work is in a pipeline        | `StageTrack stages current aria-label` (`variant="pill"` for only the current stage, `getHref` for links); `StageFilter stages counts value onValueChange` is a toggle group to filter by stage                                                                                                                                                                      |
| Dense rows or entity cards         | `List aria-label` + `ListGroup label count` + `ListItem id title leading subtitle status meta trailing actions href/onSelect selected`; `variant="card"` for cards; `value`/`onValueChange` on `List` makes it a Listbox. Agents get `select(id)`                                                                                                                    |
| Dates, layout or data table        | `Calendar`/`DatePicker` (ISO, `locale`, `timeZone`), `Carousel`, `Resizable`, `Sidebar` (rail, drawer), `DataTable` (typed columns, `renderPagination`), `PageHeader`, `FilterBar` (a Toolbar)                                                                                                                                                                       |
| Menus, site navigation, paging, ⌘K | `ContextMenu`, `Menubar`, `NavigationMenu`, `Breadcrumb`, `Pagination page pageCount onPageChange labels`, `CommandDialog` + `Command` (pass `shortcut="mod+k"` to the trigger to opt in); `Accordion`, `HoverCard` for disclosure and link previews                                                                                                                 |
| A chart                            | `ChartContainer config aria-labelledby` + Recharts (`accessibilityLayer`), `ChartTooltip`/`ChartLegend` + `…Content`, `ChartDataTable`. every series meets 3:1 on the card, aqua (`--chart-3`) only just, so still add a legend or value labels. Series with a meaning take `var(--series-positive)`, `--series-negative`, `--series-target` or `--series-remaining` |

## AgentTaskBoard

`npx shadcn add @eskais/agent-task-board` installs the board and every piece it uses.

- **Snapshot or live.** `mode="snapshot"` needs `generatedAt`: it is the board's "now", shown in a banner, and times never refresh. It shows no approve or reject actions. `mode="live"` refreshes times every 30 s, paused while the page is hidden; pass `now` only for tests and screenshots.
- **One clock.** The board calls `useNow` once and passes `now` down. When you compose `TaskCard` or `TaskDetailPanel` yourself, do the same: one `useNow()` per screen, never one timer per time.
- **Labels.** English by default. Override any string with `labels={{ columns: { done: "Shipped" } }}`, or pass `labels={agentTaskBoardLabelsEs}` from `@/components/ui/agent-task-board` for Spanish, including the pieces inside (status, liveness, usage, attempts). Pass `locale` and `timeZone` for formatting.
- **Agents.** The board's root exposes `selectTask`, `setView`, `filter`, `openThread` and `openLink` (`openLink(taskId, labelOrHref)`, with `onOpenLink`). A Button rendered as a link has no `press` for agents, so links open through that action. In live mode with `onApproveProposal`/`onRejectProposal`, `agentApproval` decides what an agent may do: `"confirm"` (default) asks a person through your bridge's `allow`, `"allow"` acts without asking, `"deny"` hides the actions from agents. People's buttons are the same either way.
- **Detail.** `detailPresentation="dialog"` (default) opens a selected task in an `xl` dialog, two columns from 56rem; `"drawer"` slides it in from the right; `"side"` keeps a non-modal panel so the board stays usable while reading. With a modal open, the board's controls are hidden from agents, but its `selectTask`, `filter` and `setView` still work.
- **Columns.** The collapse toggle ends each header (shown on hover, focus, touch or while collapsed). `columnAccent="tint"` (default) marks each column with its tone, `taskStatusAccentTones` overridden by `columnTones`; the status icons follow. Order comes from `columns`.
- **Links.** `TaskView.links` (`pull-request`, `branch`, `commit`, `issue`, `external`, with an optional `state`) list in the detail's side column; a card shows an icon link to its pull request. `renderLink` replaces each, `onOpenLink` takes over the click. A thread with `href` or `onOpenThread` gets an "Open thread" button with its id in the tooltip.
- **Slots.** `renderAttachments(task)` and `renderLocation(task)` fill the detail's main and side columns.
- **Density.** `density="auto"` (default) applies compact shape and spacing while the board is 75rem wide or less; `"compact"` always, `"comfortable"` never. It needs `@eskais/theme-compact`.
- **State.** `view`, `filters`, `columns` and `selectedTaskId` are each controlled or uncontrolled (`defaultView`, `defaultFilters`, `defaultSelectedTaskId`). Cancelled tasks are hidden until `columns` shows them.
- **Static.** It works as one HTML file with no network: `node tooling/static-board.mjs` builds and checks one.

## Elevation

Surfaces (cards, columns, panels) use `shadow-surface`. Anything that floats (popover, menu, list popup, toast, dialog, a `Floating` bar) uses the floating level: `surface-floating`, or its parts `shadow-floating`, `rounded-floating`, `bg-floating`, `backdrop-floating`, `border-floating-border`. Tokens: `--floating-shadow`, `--floating-radius`, `--floating-backdrop`, `--floating-opacity`, `--floating-border`, `--floating-offset` (see AGENTS.md "Elevation"). The fill is translucent and blurred by default, opaque without `backdrop-filter` or with reduced transparency. `data-elevation="flat"` on any ancestor removes the depth. Never use viewport-height units (`vh`, `dvh`, `h-screen`) to place floating UI; it takes its position from its container.

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

- Use the variants (`variant`, `size`) and the semantic tokens: `background`, `foreground`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `warning`, `info`, `border`, `input`, `input-strong`, `field`, `ring`, `overlay`, and `link`/`link-soft` for link text and a caret (4.5:1 on background, card and muted). `accent` is a surface, never a text colour.
- Text fields take a soft `border-input` edge on a `bg-field` fill; checkboxes, radios and switch tracks, which nothing else identifies, take `input-strong` (3:1).
- Style state with UI SDK attributes: `data-pending`, `data-disabled`, `data-open`, `data-starting-style`, `data-ending-style`.
- Use the shape and density tokens instead of fixed sizes: `rounded-control`, `rounded-choice` (checkbox, textarea), `rounded-surface`, `h-control` (`-sm`, `-lg`), `shadow-surface`, and the spacing roles below. Surfaces that may turn glassy use `bg-<color>/(--glass-opacity)` and `backdrop-surface`.
- Theme and color scheme are app-level: `createAppearance({ colorScheme: "system" })` and `<Appearance appearance={…}>` from `@eskais/appearance` keep `.dark`, `data-color-scheme` and `data-theme` on `<html>` in sync; call `appearance.apply()` before the first render. Without any script the theme still follows `prefers-color-scheme: dark`, unless `<html>` has `data-color-scheme="light"` or `class="light"` (render one from the server for a saved light choice). Don't add a theme prop to a component.
- Colour: set the seeds `--brand`, `--neutral-hue`, `--neutral-chroma` (and `--radius`) in `:root`; primary, its foreground, ring, accent and greys derive from them in light and dark. Or use a preset from `@eskais/palettes` with `data-palette="blue"` (`neutral`, `violet`, `green`, `orange`) on any element, or `createAppearance({ palette })`. To take over one colour, set that token in `:root` or `.dark`. Keep a custom brand at 4.5:1 on the background.
- Themes are attribute scopes, not separate components: `data-theme="compact"` or `data-theme="glass"` on any element, nested freely. A theme only sets tokens; never branch on the theme in a component.
- Pass layout classes (margin, width, grid placement) through `className`. To change how a component looks, edit its file in `components/ui/`, which you own.
- Optional: `npx shadcn add @eskais/lint-rules` adds an oxlint config with `@shadcn/lint` rules (`no-restyle`, `no-raw-colors`…). Extend it from `.oxlintrc.json`.

## Spacing

Pick spacing by the relationship between the things it separates, never by a number; each role tightens under `data-theme="compact"`.

| Utility                           | Role                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `gap-inline`                      | icon + text, or parts inside one control, chip or row                            |
| `gap-items`                       | siblings in a list or stack: cards in a column, chips, buttons, form fields      |
| `gap-group`                       | groups inside a surface: header vs body, dialog sections                         |
| `gap-section`                     | surfaces on a page                                                               |
| `px-inset-chip` / `py-inset-chip` | pills, badges, chips, kbd                                                        |
| `px-inset-item` / `py-inset-item` | menu and list items, small cards, table cells                                    |
| `px-control-x`                    | buttons, inputs, selects                                                         |
| `p-inset-surface`                 | cards, dialogs, panels, popovers (`p-surface` is an alias)                       |
| `p-control-inset`                 | the rim of a control-height bar around `-sm` items (tab list, segmented control) |

- `inline`, `items`, `group`, `section` and `inset-surface` work with any spacing utility (`p-inline`, `pb-group`, `-mx-inline`). The chip and item insets are `px-`/`py-` only; otherwise use the variable, as in `-mx-(--item-padding-x)`.
- Components never set their own outer margin; the parent spaces children with `gap-*`. Pass margin through `className` only when composing.
- Sizes (`size-*`, `h-*`, `w-*`) aren't spacing; prefer `h-control` and friends.
- In the registry, `eskais/spacing-tokens` rejects numeric spacing (`gap-2`, `md:px-1`). The exceptions are `0`, `px`, and a disable comment that gives the reason.

## Tone

Status meaning has one vocabulary across Badge, Alert, StatusPill, StatusDot, Progress, Meter and Toast: `tone` is `neutral`, `info`, `success`, `warning` or `destructive` (`Tone` from `@/lib/tone`). Badge's `variant` is only its untoned look (`default`, `secondary`, `outline`); `variant="success"` and friends still work but are deprecated. A toast's tone comes from its type (`toastTone`: `error` is `destructive`).

## Layers and motion

Stack with `z-sticky` < `z-overlay` (dialogs) < `z-popover` < `z-toast`, never a number. Time transitions with `duration-micro` (140ms: hover, popovers, tooltips), `duration-panel` (180ms: accordion, sidebar, toasts) or `duration-dialog` (200ms), with `ease-standard`. Reduced motion is handled globally by the theme.

## Touch targets

On touch screens (`pointer: coarse`) buttons, toggles, tabs, segmented items, checkboxes, radios and switches get an invisible hit area of at least 44px (`--control-height-touch`); sidebar items and label rows around a choice grow to 44px. Desktop looks the same. Give a new small control the `touch-target` class; where controls stack tighter than 44px, grow the row with `pointer-coarse:min-h-(--control-height-touch)` instead.

## Narrow screens

`narrow:` applies at 760px viewport width and below (`flex-row narrow:flex-col`). It is unrelated to the `compact` density theme, which changes sizes at any width. Prefer container queries for components placed in panels of different widths.

## Typography

Pick text size by role, not by number: `text-meta` (eyebrows; with `tracking-meta`, uppercase if you want), `text-caption`, `text-body-sm`, `text-body`, `text-title-sm` (card titles), `text-title` (dialog titles), `text-display-sm` (page titles, stat values) and `text-display`. Each sets size, line height and weight, and tightens under `data-theme="compact"`; see AGENTS.md "Typography" for the values. `tracking-tight` (-0.012em) suits titles; `font-mono` is Geist Mono (installed by `font-geist`).

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
