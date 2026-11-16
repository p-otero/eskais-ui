# Changelog

Versions follow [semver](https://semver.org). Before 1.0, a minor version can break compatibility. Release with `bun pm version <patch|minor|major>`, which bumps `package.json` and tags `vX.Y.Z`.

## Unreleased

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
