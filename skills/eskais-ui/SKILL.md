---
name: eskais-ui
description: Uses and extends Eskais UI, a shadcn-style registry of agent-native React components built on UI SDK. Use when adding Eskais UI components to an app (shadcn add @eskais/...), composing Button, Input, SearchField, Dialog, ConfirmDialog, Card or Badge, or adding a new component to the Eskais UI registry. Complements the official ui-sdk skill; load that one too.
---

# Eskais UI

Eskais UI components are UI SDK parts styled with Tailwind v4 and semantic tokens, copied into your project as source. Load the `ui-sdk` skill as well: everything it says about parts, controllers, change details and agents applies here unchanged.

## Install

1. In `components.json`, add the registry once:
   `"registries": { "@eskais": "https://raw.githubusercontent.com/p-otero/eskais-ui/<ref>/public/r/{name}.json" }`, where `<ref>` is a tag like `v0.1.0`, or `main`.
2. Aliases: shadcn writes `registry:ui` files to `aliases.ui` and `registry:lib` files to `aliases.lib`, and rewrites the registry's `@/components/ui`, `@/lib` and `@/lib/utils` imports to `ui`, `lib` and `utils`, so any prefix works. Set `components`, `ui`, `utils` and `lib` (e.g. `"~/components"`, `"~/components/ui"`, `"~/lib/utils"`, `"~/lib"`), and make each resolve through `compilerOptions.paths` in the root `tsconfig.json`: shadcn ignores `tsconfig.app.json` and `references`, and writes into a literal `@/` folder when an alias doesn't resolve.
3. Put `@layer ui-sdk;` as the first line of the global stylesheet, above `@import "tailwindcss"`.
4. `npx shadcn@latest add @eskais/theme @eskais/font-geist @eskais/button` (any item; dependencies come along). `font-geist` bundles the default font from npm; without it the theme falls back to the system font. `font-inter` is the alternative.
5. `theme` brings `utils`. Merge classes with its `cn` (`@/lib/utils`), never another one: it knows the theme's utilities, and a plain tailwind-merge drops `text-meta` from `cn("text-meta", "text-muted-foreground")`. Over a `lib/utils.ts` that `shadcn init` wrote, add with `--overwrite`.

## Choose

| Need                               | Use                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------                                                                                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------                                                                                                                                                         |
| An action, possibly async          | `Button`: return a Promise from `onClick` for pending, no double press; `loading` for work it didn't start (spinner in the leading icon's place, `aria-busy`, presses ignored, focus kept). `size="icon"` requires `aria-label`                                                                                                                                                                              |
| A form with validation             | `Form schema defaultValues onSubmit messages label` + `FormField name label` around one control, `FormRootError`, `FormActions submitLabel`; see "Forms" below. `FieldSet legend` groups fields                                                                                                                                                                                                              |
| A form in a modal                  | `FormDialog trigger title schema defaultValues onSubmit submitLabel cancelLabel` with `FormField` children: closes on success, blocks Escape while pending, `confirmDiscard`, `reviewStep`                                                                                                                                                                                                                   |
| A labeled text input               | `Field` + `FieldLabel` + `Input`; `InputGroup` + `InputClear` for a clear button                                                                                                                                                                                                                                                                                                                             |
| A search box                       | `SearchField label onSearch`: Enter runs `onSearch`, Escape clears only when there is text                                                                                                                                                                                                                                                                                                                   |
| A modal                            | `Dialog` parts; `DialogContent size` (`sm`…`full`), `DialogBody` scrolls between header and footer, a bottom sheet on narrow screens unless `sheet={false}`; `dismissible={false}` + `onDismissAttempt` for unsaved changes; `initialFocus` on the content, never React `autoFocus`; keep it mounted and drive `open` (focus still returns if it unmounts while open)                                        |
| "Are you sure?"                    | `ConfirmDialog onConfirm`: a returned Promise shows pending, closes on success, shows the error on failure                                                                                                                                                                                                                                                                                                   |
| Static grouping and labels         | `Card` parts (a titled card is a `section` named by its title; `CardEyebrow`, `CardAction`, `CardTitle headingLevel`, `surface`), `Badge tone`                                                                                                                                                                                                                                                               |
| Pick one of a list                 | `Select options placeholder` (`{ value, label, disabled?, description? }`, or groups `{ label, options }`); `clearable="None"` adds a choice that sets `null`. Parts (`SelectTrigger`, `SelectContent`, `SelectItem`) still work as children                                                                                                                                                                 |
| The platform's own picker          | `NativeSelect options placeholder clearable` in a `Field`: a styled native `<select>` for touch-heavy forms. Agents see it through its own primitive (a bare `<select>` or `FieldControl` is invisible to them)                                                                                                                                                                                              |
| Pick one of many, typed            | `Combobox` with `items` on the root, rendering options from `<ComboboxList>{(state) => state.items.map(…)}</ComboboxList>`. Static children aren't filtered, and agents then store the label instead of the value                                                                                                                                                                                            |
| Pick one of a few, all shown       | `RadioGroup` of `Radio` + `RadioIndicator`, each inside a `Label`; the `FieldLabel` names the group                                                                                                                                                                                                                                                                                                          |
| An on/off setting                  | `Switch` beside its `FieldLabel` in a `Field` (lays out as a row); it renders its own thumb                                                                                                                                                                                                                                                                                                                  |
| A number on a range                | `Slider` parts; a range names each `SliderThumb` with `aria-label`                                                                                                                                                                                                                                                                                                                                           |
| A button that stays pressed        | `Toggle`; `ToggleGroup` (`multiple`, `deselectable={false}`) for several sharing one value                                                                                                                                                                                                                                                                                                                   |
| A one-time code                    | `OTPInput` with `OTPInputSlot index` per character; one native input, so paste and autofill work                                                                                                                                                                                                                                                                                                             |
| A typed, stepped number            | `NumberInput` + `NumberInputGroup`; step buttons are named "Decrease"/"Increase", override with `aria-label`                                                                                                                                                                                                                                                                                                 |
| A label outside a Field            | `Label htmlFor`: names any control, including a radio group, slider or switch                                                                                                                                                                                                                                                                                                                                |
| Loading, error and empty for data  | `DataState status data error onRetry labels>{(data) => …}</DataState>` from `states`: never empty while pending or after an error, keeps the last success busy during a refetch; `data` counts only with `status="success"` (`placeholderData` for a busy first paint). Alone: `LoadingState label variant`, `ErrorState title message onRetry retryLabel details`, `Empty size` (`inline`, `panel`, `page`) |
| A loading indicator                | `Spinner` (`size` sm, md, lg): decorative by default; `label` makes it a `role="status"`. Pulses instead of spinning under reduced motion                                                                                                                                                                                                                                                                    |
| Progress or a reading              | `Progress` (`value={null}` is indeterminate) or `Meter`; the track renders its indicator                                                                                                                                                                                                                                                                                                                     |
| A message in the page              | `Alert tone` with `AlertTitle`/`AlertDescription`, `action` for a trailing button; `live` for messages that appear later (`role="alert"` for warning/destructive, `role="status"` otherwise)                                                                                                                                                                                                                 |
| A status label                     | `StatusPill tone` (the shared tones plus `muted`), with an optional `dot`/`pulse`; `StatusDot tone label` alone                                                                                                                                                                                                                                                                                              |
| Related items as chips             | `DependencyChips` with an `aria-label`; pass `onSelect` to make each chip a button agents can press                                                                                                                                                                                                                                                                                                          |
| A number that may be guessed       | `QuantityValue` with `{ value, quality, source }`: unknown shows `—`, never 0; estimated shows `~`                                                                                                                                                                                                                                                                                                           |
| A time                             | `RelativeTime` with one `useNow()` per screen passed down as `now`, not one timer per time                                                                                                                                                                                                                                                                                                                   |
| Pass/fail criteria                 | `AcceptanceList`, and `AcceptanceBar` with `countAcceptance` for a compact summary                                                                                                                                                                                                                                                                                                                           |
| Summary figures                    | `StatGroup` of `Stat` parts                                                                                                                                                                                                                                                                                                                                                                                  |
| Columns of items                   | `Board` with `BoardColumn` (collapsible, groups, `empty`); no drag and drop                                                                                                                                                                                                                                                                                                                                  |
| Which agent ran                    | `AgentBadge agent requested?`: a provider avatar (initials on a stable color, or your `avatars`), long model ids truncate in the middle, a marker when what ran differs                                                                                                                                                                                                                                      |
| Is an agent alive                  | `LivenessIndicator` with `liveness` from your data; it never infers it from times                                                                                                                                                                                                                                                                                                                            |
| Task or attempt status             | `TaskStatusPill`, `AttemptStatusPill`, `ContextModePill`                                                                                                                                                                                                                                                                                                                                                     |
| Tokens and cost                    | `UsageGrid` (dense tiles, for a detail view), `UsageTable` (rows, side-by-side columns) or `UsageStat`; unknown stays `—`                                                                                                                                                                                                                                                                                    |
| An agent task's attempts           | `AttemptTimeline`; older attempts collapse past five                                                                                                                                                                                                                                                                                                                                                         |
| Approve or reject a proposal       | `ProposalActions` with `agentApproval` (`"confirm"` by default, `"allow"`, `"deny"`)                                                                                                                                                                                                                                                                                                                         |
| A whole board of agent tasks       | `AgentTaskBoard` with `tasks` and `mode`; see below                                                                                                                                                                                                                                                                                                                                                          |
| One agent task, compact            | `TaskCard` (selects through a stretched button; chips and proposal buttons stay their own tab stops)                                                                                                                                                                                                                                                                                                         |
| One agent task, in full            | `TaskDetailDialog` (modal, or `presentation="drawer"`) or `TaskDetailPanel` (non-modal); Escape and a close button call `onClose`                                                                                                                                                                                                                                                                            |
| A bar pinned to an edge            | `Floating side align strategy` (`sticky` default, `fixed`, `absolute`) + `FloatingContent`; put a `FilterBar` or other UI SDK controls inside. Sticky bars go last in their scroll container                                                                                                                                                                                                                 |
| Files and screenshots on an item   | `AttachmentStrip attachments aria-label max size onOpen`: image thumbnails open a built-in `Lightbox`, files open `href`; `+N` reveals the rest. `AttachmentThumb` alone. Agents get `openAttachment(id)`                                                                                                                                                                                                    |
| One image of a set, full size      | `Lightbox items index onIndexChange open onOpenChange`: arrow keys, counter, fit or actual size, open original; `srcDark` follows the theme without a flash. Agents get `next`, `previous`, `goTo(index)`                                                                                                                                                                                                    |
| Where work is in a pipeline        | `StageTrack stages current aria-label` (`variant="pill"` for only the current stage, `getHref` for links); `StageFilter stages counts value onValueChange` is a toggle group to filter by stage                                                                                                                                                                                                              |
| Dense rows or entity cards         | `List aria-label` + `ListGroup label count` + `ListItem id title leading subtitle status meta trailing actions href/onSelect selected`; `variant="card"` for cards; `value`/`onValueChange` on `List` makes it a Listbox. Agents get `select(id)`                                                                                                                                                            |
| A page's column                    | `PageLayout width header` (`dense`, `wide`, `full`; `variant="workspace"` for app screens). Renders `<main id="main">` only with `as="main"`, since the shell may own `<main>`; never a live region                                                                                                                                                                                                          |
| A titled block on a page           | `Section title eyebrow description action footer headingLevel surface padding`: Card composed; `surface="dashed"` for a create tile, `"none"` for no box                                                                                                                                                                                                                                                     |
| A public site's header             | `SiteHeader label brand items actions renderLink`: a floating pill; links that don't fit move into "More" (measured, in order), `items` with children become dropdowns, a drawer with every link on narrow screens, `data-scrolled` once the page scrolls. Put a `SkipLink` before it                                                                                                                        |
| An app screen's header             | `Topbar brand leading center centerCompact trailing`: sticky, a bottom border, `centerCompact` replaces the centre on narrow screens. `SidebarTrigger controller collapsed` from `@eskais/sidebar` toggles a `Sidebar` (give it `trigger={false}`) through the same `createSidebarController()`                                                                                                              |
| Navigation on a phone              | `MobileNav label items overflow`: a bottom tab bar, up to five links (icon over label, `current`, `badge`), More for the rest, shown at `narrow:` only unless `always`. Hide the `Sidebar` with `narrow:hidden` and give the page `narrow:mb-(--mobile-nav-offset)` so it ends above the bar                                                                                                                 |
| Skip past navigation               | `SkipLink` first in `<body>` (text required; `target` is an id or ref, default `"main"`; focuses it without changing the URL, safe in hash routers), with `PageLayout as="main"` or your own `<main id="main">`                                                                                                                                                                                              |
| Many tabs in little space          | `TabsList` scrolls on its own when its tabs don't fit (`scrollable="auto"`): edge fades, pointer-only scroll buttons (aria-hidden, not for agents), arrow keys reach every tab, works in rtl. `scrollable={false}` opts out                                                                                                                                                                                  |
| A page title                       | `PageHeader title eyebrow description actions tabs breadcrumb headingLevel`; `tabs` holds a `TabsList` inside a `Tabs` that wraps the page; actions wrap below the title on narrow screens                                                                                                                                                                                                                   |
| A date and a time together         | `DateTimePicker value onValueChange min max locale timeZone labels={{ time }}` in a `Field`: one local `"YYYY-MM-DDTHH:mm"` value; the time has its own label, which must not repeat the date label's words; `TimeInput` alone for a time of day                                                                                                                                                             |
| Dates, layout or data table        | `Calendar`/`DatePicker` (ISO, `locale`, `timeZone`), `Carousel`, `Resizable`, `Sidebar` (rail, drawer), `DataTable` (typed columns, `renderPagination`), `PageHeader`, `FilterBar` (a Toolbar)                                                                                                                                                                                                               |
| Menus, site navigation, paging, ⌘K | `ContextMenu`, `Menubar`, `NavigationMenu`, `Breadcrumb`, `Pagination page pageCount onPageChange labels`, `CommandDialog` + `Command` (pass `shortcut="mod+k"` to the trigger to opt in); `Accordion`, `HoverCard` for disclosure and link previews                                                                                                                                                         |
| A chart                            | `ChartContainer config aria-labelledby` + Recharts (`accessibilityLayer`), `ChartTooltip`/`ChartLegend` + `…Content`, `ChartDataTable`. every series meets 3:1 on the card, aqua (`--chart-3`) only just, so still add a legend or value labels. Series with a meaning take `var(--series-positive)`, `--series-negative`, `--series-target` or `--series-remaining`                                         |
| Write or show Markdown             | `MarkdownEditor label value onChange` (debounced; `onConflict` when a new `value` meets unsent edits) keeps the Markdown byte for byte and shows marks only while the caret is in their span; `codeLanguages={markdownCodeLanguages}` from `@eskais/markdown-editor-languages` is opt-in, `labels={markdownEditorLabelsEs}` for Spanish. `MarkdownView markdown` renders it read-only                        |

## Global search (⌘K)

A search that loads results from the server, opened from the `Topbar` with `mod+k`:

```tsx
import { useAsyncOptions } from "@ui-sdk/react/async-options"

function GlobalSearch() {
  const [dialog] = useState(() => createCommandDialogController())
  const results = useAsyncOptions(searchWorkspace, { debounce: 200, immediate: true }) // (query, { signal }) => Promise<{ value, label }[]>
  return (
    <CommandDialog controller={dialog}>
      <CommandDialogTrigger shortcut="mod+k">
        <SearchIcon />
        <span className="narrow:sr-only">Search the workspace</span>
        <CommandDialogShortcut />
      </CommandDialogTrigger>
      <CommandDialogContent title="Search the workspace">
        <Command
          filter={false}
          status={results.status}
          onQueryChange={(query) => results.setQuery(query)}
          onLoadMore={results.loadMore}
          onAction={(value) => {
            navigate(value)
            dialog.close()
          }}
        >
          <CommandInput aria-label="Search the workspace" />
          <CommandStatus>{(state) => (state.loading ? "Searching…" : `${state.count} results`)}</CommandStatus>
          <CommandEmpty>
            {(state) => (state.empty && !state.loading ? `Nothing matches “${state.query}”` : null)}
          </CommandEmpty>
          <CommandList>
            {results.items.map((item) => (
              <CommandItem key={item.value} value={item.value} label={item.label}>
                {item.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </CommandDialogContent>
    </CommandDialog>
  )
}
```

- `filter={false}` keeps the server's order; `useAsyncOptions` debounces, aborts stale requests through `signal` and keeps the last results while loading. Pass `status` so the list gets `aria-busy` and `CommandStatus` announces counts.
- The dialog returns focus to the trigger that opened it, and `onOpenChange` on `CommandDialog` reports both ways. `shortcut` is opt-in and only listens while the trigger is mounted.
- Prefer one trigger whose text goes `narrow:sr-only`. A second trigger elsewhere (`<CommandDialogTrigger controller={dialog}>`, like a `Topbar`'s `centerCompact`) works for people, but in UI SDK 0.1.0-beta.5 the dialog then has no agent label: agents press it by `ref` with the trigger's name as the argument.

## AgentTaskBoard

`npx shadcn add @eskais/agent-task-board` installs the board and every piece it uses.

- **Snapshot or live.** `mode="snapshot"` needs `generatedAt`: it is the board's "now", shown in a banner, and times never refresh. It shows no approve or reject actions. `mode="live"` refreshes times every 30 s, paused while the page is hidden; pass `now` only for tests and screenshots.
- **One clock.** The board calls `useNow` once and passes `now` down. When you compose `TaskCard` or `TaskDetailPanel` yourself, do the same: one `useNow()` per screen, never one timer per time.
- **Labels.** English by default. Override any string with `labels={{ columns: { done: "Shipped" } }}`, or pass `labels={agentTaskBoardLabelsEs}` from `@/components/ui/agent-task-board` for Spanish, including the pieces inside (status, liveness, usage, attempts). Pass `locale` and `timeZone` for formatting.
- **Agents.** The board's root exposes `selectTask`, `setView` (`"board"`, `"table"`, `"backlog"`), `filter` (`project`, `profile`, `model`, `query`, and `stage` as a list of stage ids), `openThread` and `openLink` (`openLink(taskId, labelOrHref)`, with `onOpenLink`). A Button rendered as a link has no `press` for agents, so links open through that action. In live mode with `onApproveProposal`/`onRejectProposal`, `agentApproval` decides what an agent may do: `"confirm"` (default) asks a person through your bridge's `allow`, `"allow"` acts without asking, `"deny"` hides the actions from agents. People's buttons are the same either way.
- **Detail.** `detailPresentation="dialog"` (default) opens a selected task in an `xl` dialog, two columns from 56rem; `"drawer"` slides it in from the right; `"side"` keeps a non-modal panel so the board stays usable while reading. With a modal open, the board's controls are hidden from agents, but its `selectTask`, `filter` and `setView` still work.
- **Columns.** The collapse toggle ends each header (shown on hover, focus, touch or while collapsed). `columnAccent="tint"` (default) marks each column with its tone, `taskStatusAccentTones` overridden by `columnTones`; the status icons follow. Order comes from `columns`.
- **Links.** `TaskView.links` (`pull-request`, `branch`, `commit`, `issue`, `external`, with an optional `state`) list in the detail's side column; a card shows an icon link to its pull request. `renderLink` replaces each, `onOpenLink` takes over the click. A thread with `href` or `onOpenThread` gets an "Open thread" button with its id in the tooltip.
- **Attachments.** `TaskView.attachments` (the `Attachment` type of `@eskais/attachments`) show as an `AttachmentStrip` in the detail's main column, images opening a `Lightbox`; a card shows a paperclip count. Agents use the strip's `openAttachment(id)`. `renderAttachments(task)` replaces the strip.
- **Location.** Pass `stages` (the `Stage[]` of `@eskais/stage-track`, in order) and set `TaskView.location = { stage, href? }`: cards show a `StagePill`, the detail's side column a `StageTrack`, and the toolbar a `StageFilter` row with counts that sets `filters.stage`. `renderLocation(task)` replaces the track.
- **Backlog.** `view="backlog"` lists proposals and to-do tasks that aren't ready as `ListItem` rows in two `ListGroup`s with counts; live proposals keep Approve/Reject. A row opens the detail like a card.
- **Density.** `density="auto"` (default) applies compact shape and spacing while the board is 75rem wide or less; `"compact"` always, `"comfortable"` never. It needs `@eskais/theme-compact`.
- **State.** `view`, `filters`, `columns` and `selectedTaskId` are each controlled or uncontrolled (`defaultView`, `defaultFilters`, `defaultSelectedTaskId`). Cancelled tasks are hidden until `columns` shows them.
- **Static.** It works as one HTML file with no network: `node tooling/static-board.mjs` builds and checks one.

## Forms

`npx shadcn add @eskais/form` brings react-hook-form and `@hookform/resolvers`. The schema is any Standard Schema: Zod, Valibot, ArkType or Effect Schema.

- **Fields.** `<FormField name label description required>` wraps one control and binds it by `name`: `Input`, `Textarea`, `NumberInput`, `Select`, `Combobox`, `Checkbox`, `Switch`, `RadioGroup`, `Slider`, `DatePicker`, `SegmentedControl`, `ToggleGroup`. Checkbox and Switch bind `checked`, the rest `value`/`onValueChange`. For your own control pass `bind="checked"`, an adapter, or `render={(field) => …}`; inside it, `useFormField()` returns `value`, `onChange`, `invalid`, `error`. Give every field a default value.
- **Submit.** `onSubmit(values, { setError })` gets the parsed values. A returned Promise shows the submit Button's `loading`, disables the fields (`disableWhilePending={false}` keeps them) and ignores a second submit. Don't add your own pending state.
- **Server errors.** Throw `new FormServerError(message, { email: "Taken" })`, an object `{ fieldErrors, message }`, or a Standard Schema issue list (`toFormErrors` reads all three). Field errors land on their fields; the message, and errors for fields that aren't rendered, in `<FormRootError />` (an `Alert tone="destructive" live`). Any other error shows its `message` there. Focus then moves to the first invalid field, or to the root error.
- **Messages.** English by default. `messages={formMessagesEs}`, your own dictionary (strings with `{min}`, `{max}`, `{label}`, or functions), or a function of the issue for any i18n library: `messages={(issue) => t(`form.${issue.code}`, { ...issue.params, field: issue.label })}`, or `createFormMessages(t)`. Return `undefined` to fall back to the defaults, then to the schema's own message. `<FormField messages>` wins over the form's.
- **Issues.** `{ code, field, label?, params, message? }`. Codes: `required` (an empty value), `minLength`/`maxLength` and `minItems`/`maxItems` (`params.min`/`max`), `min`/`max`, `email`, `url`, `pattern`, `invalid` (no known validator; `message` is the schema's), `server` (a plain-text server error). A schema message that looks like a key (`"form.email.taken"`) is its own code, so schemas can carry translation keys. A server error may be `{ code, params?, message? }` instead of text: `{ fieldErrors: { email: { code: "email.taken" } } }`.
- **Actions.** `<FormActions submitLabel pendingLabel cancel onCancel secondaryAction>` stacks on narrow screens. `tone="destructive"` requires `confirm`, the sentence an agent must show a person; it becomes `data-agent-confirm` on the submit button.
- **In a dialog.** `FormDialog` takes the Form props plus `trigger` (or `open`/`onOpenChange`), `title`, `description`, `size`, `submitLabel`, `cancelLabel`, `pendingLabel`, `secondaryAction` and `returnFocus`. The body scrolls between the header and the actions; on narrow screens it is a bottom sheet. It closes when `onSubmit` resolves, and a thrown error keeps it open. Escape, outside presses and Cancel do nothing while pending. `confirmDiscard="Discard changes?"` (with `discardLabel`, `keepEditingLabel`) asks before closing with unsaved changes. `reviewStep={{ render: (values) => …, editLabel, confirmLabel }}` validates, shows a review, and runs `onSubmit` on confirm; a server field error returns to the fields.
- **Agents.** Fields are their own UI SDK parts, so agents fill them by label. With a `label` (or `aria-labelledby`), the form itself offers `submit` and `reset`; a destructive form hides them so the gated button is the only way.

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

- Use the variants (`variant`, `size`) and the semantic tokens: `background`, `foreground`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `warning`, `info`, `border`, `input`, `input-strong`, `field`, `ring`, `overlay`, and `link`/`link-soft` for link text and a caret (4.5:1 on background, card and muted). `accent` is a surface (hover and selected fills) only: never a text colour or a stroke. For a stroke use `border-input-strong`, `border-primary` or `ring-ring`; for coloured text, `text-link`.
- Text fields take a soft `border-input` edge on a `bg-field` fill; checkboxes, radios and switch tracks, which nothing else identifies, take `input-strong` (3:1).
- Style state with UI SDK attributes: `data-pending`, `data-disabled`, `data-open`, `data-starting-style`, `data-ending-style`.
- Use the shape and density tokens instead of fixed sizes: `rounded-control`, `rounded-choice` (checkbox, textarea), `rounded-surface`, `h-control` (`-sm`, `-lg`), `shadow-surface`, and the spacing roles below. Surfaces that may turn glassy use `bg-<color>/(--glass-opacity)` and `backdrop-surface`.
- Theme and color scheme are app-level: `createAppearance({ colorScheme: "system" })` and `<Appearance appearance={…}>` from `@eskais/appearance` keep `.dark`, `data-color-scheme` and `data-theme` on `<html>` in sync; call `appearance.apply()` before the first render. Without any script the theme still follows `prefers-color-scheme: dark`, unless `<html>` has `data-color-scheme="light"` or `class="light"` (render one from the server for a saved light choice). The `dark:` variant does too: the theme item appends its `@custom-variant dark { … }` block below the one-line `@custom-variant dark (&:is(.dark *))` that shadcn writes, and Tailwind uses the last one, so keep it last. Don't add a theme prop to a component.
- Tones: `neutral`, `info`, `success`, `warning`, `destructive` say what a status means; `violet` is a category tone (a label or kind), never a status. For a tinted chip or surface use the soft tokens, `bg-{tone}-soft text-{tone}-soft-foreground border-{tone}-border`, not `bg-{tone}/10`; for a loading placeholder, `Skeleton` or `bg-skeleton`.
- Colour: set the seeds `--brand`, `--link-brand` (links and the caret, a blue by default), `--neutral-hue`, `--neutral-chroma` (and `--radius`) in `:root`; primary, its foreground, ring, accent and greys derive from them in light and dark. Or use a preset from `@eskais/palettes` with `data-palette="blue"` (`neutral`, `violet`, `green`, `orange`) on any element, or `createAppearance({ palette })`. To take over one colour, set that token in `:root` or `.dark`. Keep a custom brand at 4.5:1 on the background.
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

## Toasts

- Place `<ToastStack />` once (or pass a `toaster` from `createToaster()`), and call `toast()`, `toast.success()`… from your handlers.
- Its close buttons are named "Dismiss". Pass `labels={{ close: "Cerrar" }}` in the page's language (`closeLabel` is deprecated).
- Each type leads with a decorative icon in its tone colour: `info` a circled i, `success` a check, `warning` a triangle, `error` a circled exclamation mark, `loading` a spinner, and `default` none. It is `aria-hidden`, so the title has to say what happened. In your own `Toast` composition, render `<ToastIcon type={item.type} />` before the title.
- The region takes no pointer events: only the toasts themselves cover the page, so buttons beside or behind the stack stay clickable.
- Timers pause while focus is in a toast, and while the pointer rests on one for `hoverDelay` ms (300 by default). A pointer that only passes over doesn't hold them.

## Testing toasts and alerts

UI SDK announces toasts through two visually hidden live regions it appends to `<body>`: `role="status"` (polite) and `role="alert"` (assertive), both marked `data-ui-sdk-announcer`. They stay for the page's life and keep the last text they announced, so after a toast closes `getByRole("alert")` and `getByText("Saved")` can still find its copy there.

- Find a toast by its part, not by text on the whole page: `[data-slot="toast"]`, or `within(screen.getByRole("region", { name: "Notifications" }))` while a toast is showing (the region is only a landmark then).
- `npx shadcn add @eskais/test-utils` adds the helpers to `lib/test-utils.ts`. It needs `@testing-library/dom` (a dev dependency).
  - `getToast(text)` / `queryToast(text)`: the showing toast with an element whose text matches; both throw when several match, `getToast` also when none does. `queryToasts()` lists them, newest first, without toasts animating out.
  - `queryAlerts()` / `queryStatuses()`: `role="alert"` / `role="status"` elements without the live regions.
  - `isAnnouncer(node)`: whether a node is in a live region. `ignoreAnnouncer` is an `ignore` for text queries: `screen.getByText("Saved", { ignore: ignoreAnnouncer })`.
  - `readAnnouncements()`: `{ polite, assertive }`, what the live regions hold. A toast is announced about 200ms after it shows.
  - `resetAnnouncer()`: removes the live regions; UI SDK makes new ones on the next announcement. UI SDK exports no reset of its own, so call it in `afterEach`, after Testing Library's `cleanup`.

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
