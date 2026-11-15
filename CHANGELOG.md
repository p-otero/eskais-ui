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

### Changed

- Fields share one surface style (`fieldSurfaceClassName`), and a `Field` holding a checkbox lays out as a row.

- Reduced motion stops infinite animations instead of making them flicker.
- `registry/lib/agent-task-board.ts` is now `agent-task-board-model.ts`, so it doesn't share a basename with `registry/ui/agent-task-board.tsx`. It also exports `activeAttempt` and `attemptCount`.
- Board labels gain `card`, `panel`, `table` and `filters.clearSearch`.
