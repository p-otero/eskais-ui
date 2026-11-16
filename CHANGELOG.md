# Changelog

Versions follow [semver](https://semver.org). Before 1.0, a minor version can break compatibility. Release with `bun pm version <patch|minor|major>`, which bumps `package.json` and tags `vX.Y.Z`.

## Unreleased

### Added

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
