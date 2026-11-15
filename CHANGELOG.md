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

### Changed

- Fields share one surface style (`fieldSurfaceClassName`), and a `Field` holding a checkbox lays out as a row.

- Reduced motion stops infinite animations instead of making them flicker.
