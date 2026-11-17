# Changelog

Versions follow [semver](https://semver.org). Before 1.0, a minor version can break compatibility. Release with `bun pm version <patch|minor|major>`, which bumps `package.json` and tags `vX.Y.Z`.

## Unreleased

## 0.2.0 (2026-11-17)

### Added

- Fast links: `Link`, `ButtonLink` and `NavigationMenuLink` follow a same-origin link on a primary mouse press instead of on release, with `@fast-link/core` 0.0.2 (through `onFollow`, or `location.assign`). `fast={false}` opts a link out and `data-no-fast-link` on any ancestor a region or the app; `FastLinkRegion` and `useFastLink` cover plain anchors. A `render`ed router link or a link with its own `onClick` stays on click unless it has `onFollow`.
- Icons come from `lucide-react` (1.73.0): every hand-drawn icon in the registry is now a lucide import, and the items that use one depend on it. `icon` adds `Icon`, which names an icon for screen readers (`<Icon icon={TrashIcon} label="Deleted" />`). The `eskais/no-inline-icons` lint rule flags any other `<svg>` in `registry/**`.
- Deprecated: `ChevronIcon` from `select` and `PanelIcon` from `sidebar` (import `ChevronDownIcon` and `PanelLeftIcon` from `lucide-react`). `CloseIcon` is no longer exported from `task-detail-parts`. `select` still exports lucide's `CheckIcon`.
- `StepDialog` `resultStep={{ title, render: (result, { close, restart }) => … }}` (opt-in) shows what `onSubmit` resolved with inside the dialog instead of closing: focus moves to the result heading, Done (`labels.done`) and Escape close it, and `restart` starts over from step 1. `onOpenChange` now gets `details.reason` (`submit`, `done`, `cancel`, `escape`, `outside`, `dismiss`, `trigger`).
- `icon` item: `<Icon icon={TrashIcon} label="…" />` for meaningful icons; `eskais/no-inline-icons` rejects hand-drawn SVG icons in the registry.
- Keyboard-first lists: `shortcuts` (`useShortcut`, `ShortcutScope`, `ShortcutHint`, `Button`/`DropdownMenuItem` `shortcut`), `shortcuts-dialog` (`?`), `row-navigation` (j/k, Home/End, PageUp/PageDown, Enter, x) in List, DataTable and the AgentTaskBoard table and backlog, `virtual-rows` (TanStack Virtual past 200 rows), `SidePanel` and the `inbox` block.
- `@eskais/mockup` (`packages/mockup`, run from the repo with Bun): build a screen as TSX with the project's own components and fixtures into one offline HTML file, then `validate` it. A `/docs/mockups` guide covers it, with an A/B benchmark against hand-written HTML (`packages/mockup/BENCHMARKS.md`).
- `bun run test:compiler`: the showcase built with React Compiler, with the browser checks run on it (in CI).

### Changed

- Lint: the shared `@p-otero/oxlint-rules` presets replace the local rules (`p-otero/spacing-tokens`, `p-otero/no-low-value-comments`); effects live in hooks (`use-*.ts`); the `lint-rules` item ships the `react` and `ui-tailwind` presets.
- Shell: the global search dialog sits beside `Topbar` (only triggers in `center`/`centerCompact`); `SidebarTrigger` opens the sidebar drawer on narrow screens; tabs scroll the active tab clear of the fade; `CardHeader` wraps its action below the title sooner; dialog focus return never steals focus from another modal; `MobileNav` labels shrink or wrap and its offset includes the border; plain `Field`s inherit `Form`'s `labelPlacement`; option and item arrays accept `readonly`.
- `DocsLayout`: on narrow screens the header row scrolls with the page instead of covering it.

### Fixed

- `useFormFieldArray` takes `keyName` like react-hook-form's `useFieldArray` (`useFormFieldArray("components", { keyName: "fieldKey" })`), typed by a third type parameter, so rows whose items carry their own `id` keep it. `createForm().useFormFieldArray` infers it too.
- `FormDialog` `reviewStep.prepare(values, { form })` gets the form instance. Values it returns are written into the form, so Edit shows them and they are submitted; values it writes through `form` without returning any are parsed again and reviewed. Returned values win.
- `formIssueMessage` writes a reserved `@@form:` prefix, so every code round-trips: `formIssueMessage("email")` used to come back as `invalid` with the text "email". A coded issue's `message` is now `undefined`, not the code, so a `messages` function that prefers `issue.message` no longer prints the raw code. Messages in the earlier `code|{json}` form still read.
- `select.tsx` writes its internal empty value with an escape sequence instead of a raw NUL character, which made git treat the file as binary. A test fails on any raw control character other than tab, LF and CR in `registry`, `apps`, `tooling` and `test`.
- README and skill: a flat layout (`#ui/*` and `#components/*` on one `src/components` folder) is supported, and shadcn then writes the imports between components as `#components/x.tsx`. The `imports-flat` consumer check covers it.

## 0.1.0 (2026-11-16)

First release. The docs site is published to GitHub Pages from each release, and the registry can be pinned to the tag: `https://raw.githubusercontent.com/p-otero/eskais-ui/v0.1.0/public/r/{name}.json`.

### Added

- AgentTaskBoard: `filterControls` chooses which built-in filter controls show, so a host picker can replace one; hidden filters still apply and agents can still set them, and "Clear filters" leaves them alone.
- AgentTaskBoard: a "No stage" toggle ends the stage filter (`stageFilterNone`, `labels.filters.noStage`) and matches tasks without a location through the exported `NO_STAGE`, which `filter({ stage })` also takes by its label; `StageFilter` takes `noStage`, and `countByStage` counts those tasks under `NO_STAGE`.
- AgentTaskBoard: `renderBacklogActions(task)` adds host controls to each backlog row after Approve/Reject, in snapshot mode too, and `renderCardActions(task)` to each card; `TaskCard` takes `renderActions`.
- Registry items: `utils`, `theme`, `button`, `field`, `input`, `search-field`, `dialog`, `confirm-dialog`, `card`, `badge`, `lint-rules`.
- `search-field` primitive built with `definePrimitive`, with a `submit` agent action.
- `confirm-dialog` with async confirm, inline errors and required `agentConfirm` for destructive actions.
- Shape, density and surface tokens; the default theme is rounded and roomy.
- `theme-compact` and `theme-glass`, applied at runtime with `data-theme` and nestable; glass is tunable with `--glass-opacity`.
- Showcase app with an agent bridge panel and a theme picker (UI SDK `createPreference`, `SegmentedControl`, `Slider`).
- Tests: behavior, primitive, axe and agent tests (including `allow` refusal and approval).
- Overlays: `tooltip`, `popover`, `drawer`, `dropdown-menu`, `toast`.
- Selection: `select`, `combobox`, `segmented-control`, `checkbox`, `textarea`.
- Structure and display: `tabs`, `collapsible`, `scroll-area`, `separator`, `avatar`, `skeleton`, `empty`, `kbd`, `table`.
- Browser check in CI: axe and pixel contrast in Chrome for the default and compact themes, with the dialog, a listbox and a menu open. Glass is checked by hand.

- Board pieces: `board`, `status-pill`, `dependency-chips`, `acceptance-list`, `stat`, `quantity`, `relative-time`.
- Theme: `rounded-choice` radius, board column size tokens, and the `content-auto` and `text-vertical` utilities.
- Agent task pieces: `agent-task-types`, `agent-badge`, `liveness-indicator`, `task-status`, `usage`, `attempt-timeline`, `agent-task-board-core` and `proposal-actions`, with English labels and Spanish presets.
- `task-card`, `task-detail-panel` and `agent-task-board`: the full agent task board with filters, a board or sortable table view, a summary, a non-modal detail panel, snapshot and live modes, and a complete Spanish preset (`agentTaskBoardLabelsEs`).
- The board primitive takes a `controller` (`createAgentTaskBoardController`), so a person's controls go through the same actions as an agent's.
- Theme: `--task-panel-width` and `--task-panel-max-height`.
- CI builds the board as one self-contained HTML file with Bun and opens it from `file://` with the network blocked.
- Navigation and overlays: `accordion`, `hover-card`, `context-menu`, `menubar`, `navigation-menu`, `breadcrumb`, `pagination` (standalone, with overridable labels) and `command` with a `CommandDialog` palette whose ⌘K shortcut is opt-in.
- Forms: `radio-group`, `switch`, `slider`, `toggle`, `toggle-group`, `otp-input`, `number-input`, `label`, `progress`, `meter` and `alert`; the showcase's glass opacity uses the registry `Slider`.
- Data and layout: `calendar`, `date-picker`, `carousel`, `resizable`, `sidebar` (icon rail, drawer on narrow screens), `data-table` (sort, selection, `renderPagination`) with `page-header` and `filter-bar`; theme tokens `--sidebar-width` and `--sidebar-rail-width`.
- Provider avatars for agents (`AgentAvatar`, initials on a stable provider color; images or icons through the board's `agentAvatars` and `AgentRef.avatar`), `TaskStatusIcon`, and a flatter Linear-style `TaskCard`.
- `UsageGrid`: usage as dense tiles; the task detail uses it and sets its facts beside the acceptance list.
- `chart` on Recharts v3 (`recharts@3.10.1`, installed only with this item): `ChartContainer` with a series config, tooltip and legend content, and `ChartDataTable`; theme tokens `--chart-1`…`--chart-5`.

- `DialogContent` takes `size` (`sm`, `md` default, `lg`, `xl`, `full`) and `sheet` (a bottom sheet at `narrow:` width, on by default); `DialogBody` scrolls between a header and footer that stay in view, and long unbroken text wraps. Theme tokens `--dialog-opacity`, `--dialog-width`, `--dialog-max-height`, `--sheet-max-height`.
- `AgentTaskBoard`: `columnAccent` and `columnTones` colour each column with the shared tones (`taskStatusAccentTones`); `TaskView.links` with `renderLink`, `onOpenLink` and an `openLink` agent action; `renderAttachments` and `renderLocation` slots in the detail.
- `TaskLinks` and `PullRequestLink` (`task-links`), `AcceptanceList evidence="disclosure"`, `UsageGrid variant="compact"`, and a `tone` on `BoardColumn` and `TaskStatusIcon`.
- Soft tone tokens `--{tone}-soft`, `--{tone}-soft-foreground` and `--{tone}-border` for `neutral`, `info`, `success`, `warning`, `destructive` and the new `violet`, a decorative category tone (also `--violet` and `--violet-foreground`) in the `Tone` type and every toned component. Badge, StatusPill, list item icon tiles and the alert and toast edges use them instead of `bg-*/10` and `border-*/30`. `--skeleton` (`bg-skeleton`) fills `Skeleton`. The contrast check covers them in both modes and every palette.
- Floating labels: `Field labelPlacement` (`top`, `in`, `on`), with `Form` and `FormField` passing it through. `in` floats the label inside the control, `on` sets it on the border over `--field-label-surface`. The theme adds the `field-floated` variant, `h-field-control` and the `field-label-surface-card`/`-popover` utilities.
- `CommandDialogOpenButton`: a second way to open a `CommandDialog`, like a `Topbar`'s `centerCompact` icon, that opens through the controller and is hidden from agents, so the dialog keeps its agent label.

### Changed

- The task detail dialog is `xl` and sets a side column (meta, work, usage, links, location) beside the goal, acceptance and activity once it is 56rem wide; acceptance evidence folds into a disclosure and each attempt's usage toggle sits in its title row.
- A board column's collapse toggle moved to the end of its header with a fold icon and a tooltip, shown on hover or focus (always on touch and while collapsed).
- A thread with an `href` or `onOpenThread` opens from an "Open thread" button (`labels.openThread`) with its id in the tooltip; the bare id is never shown as text.
- `TaskStatusIcon` colours follow the column tones, so a proposal's icon is neutral, not warning.
- Dialogs and drawers fill with `--dialog-opacity`, so the task detail passes contrast under light glass.
- Fields share one surface style (`fieldSurfaceClassName`), and a `Field` holding a checkbox lays out as a row.

- Reduced motion stops infinite animations instead of making them flicker.
- `registry/lib/agent-task-board.ts` is now `agent-task-board-model.ts`, so it doesn't share a basename with `registry/ui/agent-task-board.tsx`. It also exports `activeAttempt` and `attemptCount`.
- Board labels gain `card`, `panel`, `table` and `filters.clearSearch`.
- The `theme` item ships the `dark` variant: `dark:` follows `.dark` and, before any script runs, the system scheme unless `<html>` opts into light. It stays below the one-line variant `shadcn` writes, which Tailwind then ignores.
- Installing `theme` into a stylesheet that `shadcn init` already wrote leaves no `--x: var(--x)` self-references in `@theme inline`: seeds, shapes, shadows and computed colours ship as `css` rules on `:root` and `.dark`. The radius scale runs to `4xl` and replaces the one `shadcn init` writes, and the base rules use the same `@apply` lists, so they merge instead of repeating.
- `theme` depends on `utils`: the theme's utilities (`text-meta`, `gap-items`, `rounded-surface`…) only merge correctly with its `cn`, which now also replaces `rounded-control`/`-choice`/`-surface`/`-floating` and `shadow-surface`/`-floating` with another radius or shadow.
- `text-caption`, `text-body-sm` and `text-body` no longer set a font weight, so `<strong>`, `<b>` and `<th>` keep theirs; meta, title and display steps still set one. `StageFilter` counts set `font-normal` to keep their look.
- `--link` and `--link-soft` derive from a new `--link-brand` seed (a blue, `oklch(0.55 0.2 260)`, by default) instead of `--brand`, so links keep a hue under the neutral palette. The colour palettes set it to their brand; the showcase theme editor edits it and adds it to the CSS snippet.
- The install docs list the `components.json` aliases shadcn needs to place registry files and rewrite their imports (`components`, `ui`, `utils`, `lib`, resolving through `paths` in the root `tsconfig.json`), and `consumer-check` installs through `~/` aliases.
- AGENTS.md and the skill say `--accent` is a surface only, never text or a stroke (use `border-input-strong`, `border-primary`, `ring-ring` or `text-link`); a unit test greps the registry for it.

### Fixed

- The skill's ⌘K recipe renders the `CommandDialog` beside the `Topbar`, with only its triggers in `center` and `centerCompact`: `center` is hidden on narrow screens, and a dialog inside it opened with no box. `tooling/shell-check.mjs` (part of `test:browser`) opens it at phone width.
- On narrow screens a `SidebarTrigger` opens its `Sidebar`'s drawer through the shared controller instead of rendering nothing, and a `Sidebar` with `trigger={false}` drops its in-place drawer button (`narrowTrigger` sets that alone). `<Topbar leading={<SidebarTrigger controller={…} />}>` is now one pattern for desktop and phone.
- A scrollable `TabsList` scrolls the selected or focused tab into view clear of the edge fades (by keyboard, pointer, an agent or on load, also inside `PageHeader`'s `tabs`), in either direction and without animating under reduced motion. It scrolls only the list, never the page.
- `CardHeader` (and `Section`) with an action is a wrapping row: the heading grows from an 11rem basis (`--card-heading-basis`), so a wide action wraps below the title as soon as the title would get narrower than that, instead of squeezing it to 8rem at a fixed 17rem container breakpoint. The heading parts sit in a `card-heading` wrapper; a `CardAction` must be a direct child.
- `Dialog`, `Drawer` and `ConfirmDialog` give focus back on close only from inside themselves, or from `<body>` while no other modal is open. A dialog that left the page while another modal opened (one whose focus moves in a frame later, like many third-party modals) pulled focus back to its opener behind that modal, which then closed. `useFocusReturn(finalFocus, ref)` takes the content's ref and returns `attach` for it.
- `MobileNav`: `--mobile-nav-offset` includes the bar's 1px top border, so a page's last line no longer hides under it. Labels never truncate: in a slot under 4.5rem they step down to the meta size, and they wrap to two short lines when they still don't fit ("Wellness" fits at 320px with five routes). The docs spell out the slots: up to five routes without `overflow`, four and More with it. `items` and `overflow` take readonly arrays.
- A `Form`'s `labelPlacement` reaches plain `Field`s inside it too, not only `FormField`s, unless the Field sets its own or holds a control that can't float its label. `FieldLabelPlacementDefault` (from `field`) provides that default.
- Readonly arrays are accepted wherever the registry takes options or items: `Select` `options` (and their groups) and `items`, `NativeSelect` `options`, `Combobox` `items` (now a thin wrapper over UI SDK's, whose type is mutable), `SiteHeader` `items`, `DataTable` `selection`, `DependencyChips` `items`, `AttemptTimeline` `attempts`, `StepForm`/`StepDialog` `steps` and `fields`, `UsageTable` `columns`, and `AgentTaskBoard` `tasks`, `columns` and `stages`. A type test covers each.
