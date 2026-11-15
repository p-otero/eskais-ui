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
