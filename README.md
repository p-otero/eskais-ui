# Eskais UI

UI SDK-first, agent-native React components, distributed as a shadcn-style registry.

- Built on [Vercel UI SDK](https://ui-sdk.dev) (`@ui-sdk/core`, `@ui-sdk/react`). Behavior, focus, ARIA and agent support come from UI SDK; Eskais UI adds styles, semantic tokens and a few composed components.
- Agents can read and operate the components through `createAgent`. Destructive actions require a person's approval.
- React 19, strict TypeScript, Tailwind CSS v4. Consumers need Node with npm or pnpm; Bun is only used to develop this repo.

> Status: v0.1 in development. UI SDK is in beta (pinned to `0.1.0-beta.5`), so expect breaking changes.

## Catalog

| Item             | Built on                                                             |
| ---------------- | -------------------------------------------------------------------- |
| `button`         | UI SDK `Button`: variants, async pending, focusable when disabled    |
| `field`, `input` | UI SDK `Field`, `Input`, `InputGroup`, `InputClear`                  |
| `search-field`   | Own primitive (`definePrimitive`) with a `submit` agent action       |
| `dialog`         | UI SDK `Dialog`                                                      |
| `confirm-dialog` | UI SDK `AlertDialog` with an async `action` and `data-agent-confirm` |
| `card`, `badge`  | `renderElement`, presentational                                      |
| `theme`          | Color, shape, density and surface tokens; the default rounded look   |
| `theme-compact`  | Denser controls and tighter radii inside `data-theme="compact"`      |
| `theme-glass`    | Translucent, blurred surfaces inside `data-theme="glass"`            |
| `lint-rules`     | Optional `@shadcn/lint` config for consumers                         |

## Use it

The registry installs from GitHub. Add it once to `components.json`:

```json
{
  "registries": {
    "@eskais": "https://raw.githubusercontent.com/p-otero/eskais-ui/main/public/r/{name}.json"
  }
}
```

Replace `main` with a tag (`v0.1.0`) to pin a version. Then add `@layer ui-sdk;` as the first line of your global CSS and run:

```bash
npx shadcn@latest add @eskais/theme @eskais/button @eskais/confirm-dialog
```

## Themes

Components read tokens (`rounded-control`, `h-control`, `p-surface`, `bg-card/(--glass-opacity)`), so a theme is only CSS. Install the themes you want and switch them at runtime with an attribute, no reinstall:

```bash
npx shadcn@latest add @eskais/theme-compact @eskais/theme-glass
```

```html
<html data-theme="compact">
  <section data-theme="glass">…</section>
</html>
```

Themes nest: a glass zone inside a compact page stays compact. Tune glass live by setting `--glass-opacity` (and `--glass-blur`) on the element that has `data-theme="glass"` or on a descendant. Glass falls back to solid surfaces when the browser lacks `backdrop-filter` or the user asks for reduced transparency. To persist a choice, `createPreference({ attribute: "data-theme", global: true })` from `@ui-sdk/core` does it; the showcase shows how.

Notes while UI SDK is in beta:

- `shadcn add` writes `^0.1.0-beta.5` for `@ui-sdk/*`. Change it to the exact version, since later betas can break.
- pnpm 11+ refuses packages younger than `minimumReleaseAge`. Add `@ui-sdk/*` to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`.

## Develop

```bash
bun install
bun run dev        # showcase
bun run verify     # lint, format check, typecheck, tests, registry build
```

See [AGENTS.md](AGENTS.md) for conventions and [docs/research](docs/research) for the decisions behind the design.

## License

MIT
