# Eskais UI

UI SDK-first, agent-native React components, distributed as a shadcn-style registry.

- Built on [Vercel UI SDK](https://ui-sdk.dev) (`@ui-sdk/core`, `@ui-sdk/react`). Behavior, focus, ARIA and agent support come from UI SDK; Eskais UI adds styles, semantic tokens and a few composed components.
- Agents can read and operate the components through `createAgent`. Destructive actions require a person's approval.
- React 19, strict TypeScript, Tailwind CSS v4. Consumers need Node with npm or pnpm; Bun is only used to develop this repo.

> Status: v0.1 in development. UI SDK is in beta (pinned to `0.1.0-beta.5`), so expect breaking changes.

## Catalog

| Item             | Built on                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `button`         | UI SDK `Button`: variants, async pending, focusable when disabled                                                            |
| `field`, `input` | UI SDK `Field`, `Input`, `InputGroup`, `InputClear`                                                                          |
| `search-field`   | Own primitive (`definePrimitive`) with a `submit` agent action                                                               |
| `dialog`         | UI SDK `Dialog`                                                                                                              |
| `confirm-dialog` | UI SDK `AlertDialog` with an async `action` and `data-agent-confirm`                                                         |
| `card`, `badge`  | `renderElement`, presentational                                                                                              |
| Overlays         | `tooltip`, `popover`, `drawer`, `dropdown-menu`, `toast`                                                                     |
| Selection        | `select`, `combobox`, `segmented-control`, `checkbox`, `textarea`, `token-input` (removable tokens, labels mode)             |
| Form controls    | `radio-group`, `switch`, `slider`, `toggle`, `toggle-group`, `label`                                                         |
| Inputs, feedback | `otp-input`, `number-input`, `progress`, `meter`, `alert`                                                                    |
| Structure        | `tabs`, `collapsible`, `scroll-area`, `separator`, `avatar`                                                                  |
| Display          | `skeleton`, `empty`, `kbd`, `table` (sortable headers)                                                                       |
| Status           | `status-pill`, `dependency-chips`, `acceptance-list`, `stat`                                                                 |
| Values and time  | `quantity` (honest values), `relative-time` (`useNow`)                                                                       |
| Layout           | `board` (columns, collapsible, groups)                                                                                       |
| Agent tasks      | `agent-task-types`, `agent-badge` (provider avatars), `liveness-indicator`, `task-status` (pills, icons)                     |
| Agent history    | `usage` (table, compact grid), `attempt-timeline`                                                                            |
| Agent board core | `agent-task-board-core` (logic, labels, agent actions), `proposal-actions`                                                   |
| Agent task board | `task-card`, `task-detail-panel`, `agent-task-board` (the full board)                                                        |
| Data and layout  | `calendar`, `date-picker`, `carousel` (`CarouselStatus`: "1 of 3"), `resizable`, `sidebar`                                   |
| Data tables      | `data-table` (sort, select, pages), `page-header`, `filter-bar`                                                              |
| Charts           | `chart` (Recharts v3, `--chart-1`…`--chart-5`, tooltip, legend, `ChartDataTable`)                                            |
| Navigation       | `accordion`, `hover-card`, `context-menu`, `menubar`, `navigation-menu`, `breadcrumb`, `pagination`, `command` (⌘K palette)  |
| `theme`          | Color, shape, density and surface tokens; the default rounded look                                                           |
| `theme-compact`  | Denser controls and tighter radii inside `data-theme="compact"`                                                              |
| `theme-glass`    | Translucent, blurred surfaces inside `data-theme="glass"`                                                                    |
| `palettes`       | Colour presets inside `data-palette="blue"` (also `neutral`, `violet`, `green`, `orange`)                                    |
| `font-geist`     | Geist Variable from `@fontsource-variable/geist`, bundled (the default font); `font-inter` for Inter Variable                |
| `appearance`     | `createAppearance` + `<Appearance>`: `.dark` and `data-theme` on `<html>`, following the system scheme                       |
| `lint-rules`     | Optional oxlint config for consumers: `@p-otero/oxlint-rules` React and spacing presets plus `@shadcn/lint`                  |
| `test-utils`     | Testing Library helpers that find toasts and alerts past UI SDK's live regions (`getToast`, `queryAlerts`, `resetAnnouncer`) |

## Use it

The registry installs from GitHub. Add it once to `components.json`:

```json
{
  "registries": {
    "@eskais": "https://raw.githubusercontent.com/p-otero/eskais-ui/main/public/r/{name}.json"
  }
}
```

Registry files import `@/components/ui/…`, `@/lib/…` and `@/lib/utils`; shadcn writes each file through your aliases and rewrites those imports to them, so any prefix works (`~/`, `#/`, a monorepo package). It needs these `aliases` in `components.json`:

```json
{
  "aliases": {
    "components": "~/components",
    "ui": "~/components/ui",
    "utils": "~/lib/utils",
    "lib": "~/lib"
  }
}
```

`components` and `utils` are required by shadcn; `ui` defaults to `<components>/ui` and `lib` to the folder of `utils`. Every alias must resolve through `compilerOptions.paths` in the **root** `tsconfig.json` (or `jsconfig.json`; `#` aliases through `imports` in `package.json`). shadcn reads no other file and doesn't follow `references`, so with Vite's template, which keeps `paths` in `tsconfig.app.json`, add them to `tsconfig.json` too. Otherwise shadcn writes the files into a folder literally named `@` (or `~`).

Subpath imports in `package.json` work instead of `paths`, with no bundler alias: Node, TypeScript and Vite all read them.

```json
{
  "imports": {
    "#components/*": "./src/components/*",
    "#ui/*": "./src/components/ui/*",
    "#lib/*": "./src/lib/*",
    "#hooks/*": "./src/hooks/*"
  }
}
```

Set the aliases to `#components`, `#ui`, `#lib/utils`, `#lib` and `#hooks`. shadcn then writes imports with their extension (`#ui/button.tsx`, `#ui/form-context.ts`, `#lib/utils.ts`), because Node resolves subpath imports to exact files, so add `"allowImportingTsExtensions": true` to `compilerOptions` (it needs `noEmit`, as in Vite's template). Write your own imports the same way: `import { Button } from "#ui/button.tsx"`.

Keep the extension out of the mapping. `ui` holds `.ts` files next to the `.tsx` ones (`form-context.ts`, `form-messages.ts`, every `*-primitive.ts`), so a mapping that appends one, like `"#ui/components/*": "./src/components/ui/*.tsx"`, can't reach them: shadcn then writes `#ui/components/form-context` with no extension, and it resolves to a `.tsx` file that doesn't exist. No pattern fixes that, since an import without an extension doesn't say which file it means. `node tooling/consumer-check.mjs npm imports` checks the mapping above with `form`, and `imports-tsx` checks that the `.tsx` one still fails.

A `ui/` folder isn't required: a flat layout, with every component in `src/components`, works too. Point both aliases at that folder:

```json
{
  "imports": {
    "#components/*": "./src/components/*",
    "#ui/*": "./src/components/*",
    "#lib/*": "./src/lib/*",
    "#hooks/*": "./src/hooks/*"
  }
}
```

The aliases stay the same (`#components`, `#ui`, `#lib/utils`, `#lib`, `#hooks`), and shadcn writes the files into `src/components`. In the files it writes, it imports one component from another through the first alias that matches, `components`: `form-actions.tsx` imports `#components/form-context.ts`, not `#ui/form-context.ts`. Both resolve to the same file, so your own code can import either way (`#ui/button.tsx` or `#components/button.tsx`). With a `ui/` folder, as above, every import between components is `#ui/…`. `node tooling/consumer-check.mjs npm imports-flat` checks the flat layout with `form`.

Two things to know when you run shadcn:

- **Package manager.** shadcn installs dependencies with the manager it finds from your lockfile, or from `packageManager` in `package.json`. In a pnpm project without a lockfile yet, set `"packageManager": "pnpm@<version>"`, or shadcn falls back to npm.
- **Windows paths with a dotted folder.** shadcn 4.23.0 on Windows drops everything after a folder whose name starts with a dot, so a project under `C:\Users\me\.t3\…` gets its files written to `C:\Users\me\`. Run shadcn from a path without dotted folders, or map the project to a drive letter first: `subst X: C:\Users\me\.t3\worktrees\app`, then `cd /d X:\` and run it there (`subst X: /d` removes the mapping).

Replace `main` with a tag (`v0.1.0`) to pin a version. Then add `@layer ui-sdk;` as the first line of your global CSS and run:

```bash
npx shadcn@latest add @eskais/theme @eskais/button @eskais/confirm-dialog
```

`theme` brings `utils`: its `cn` knows the theme's utilities (`text-meta`, `text-body`, `gap-items`, `rounded-surface`…), which another `cn` reads as colours or unknown classes, so `cn("text-meta", "text-muted-foreground")` would drop the size. If `shadcn init` already wrote `lib/utils.ts`, add with `--overwrite` (or answer yes when asked) so ours replaces it; without the flag shadcn skips files that exist.

## Font

The theme asks for Geist Variable (`--font-sans`) and falls back to the system font. `npx shadcn@latest add @eskais/font-geist` installs `@fontsource-variable/geist` and adds `@import "@fontsource-variable/geist";` to your CSS, so the font ships with your bundle, with no CDN. `@eskais/font-inter` does the same for Inter Variable.

## Themes

Components read tokens (`rounded-control`, `h-control`, `p-inset-surface`, `gap-items`, `bg-card/(--glass-opacity)`), so a theme is only CSS. Install the themes you want and switch them at runtime with an attribute, no reinstall:

```bash
npx shadcn@latest add @eskais/theme-compact @eskais/theme-glass
```

```html
<html data-theme="compact">
  <section data-theme="glass">…</section>
</html>
```

Themes nest: a glass zone inside a compact page stays compact. Tune glass live by setting `--glass-opacity` (and `--glass-blur`) on the element that has `data-theme="glass"` or on a descendant. Glass falls back to solid surfaces when the browser lacks `backdrop-filter` or the user asks for reduced transparency. Theme and color scheme are app-level choices, not component props. `npx shadcn@latest add @eskais/appearance` keeps them in sync on `<html>`:

```tsx
const appearance = createAppearance({ colorScheme: "system", theme: "default" })
appearance.apply() // before the first render, so the page doesn't flash

root.render(
  <Appearance appearance={appearance}>
    <App />
  </Appearance>,
)
```

`"system"` follows `prefers-color-scheme` live through `.dark`; `appearance.colorScheme.set("dark")` and `appearance.theme.set("compact")` change them, and `storage: { colorScheme, theme }` (from `createLocalStorage`) keeps them between visits. `"default"` leaves `data-theme` off. It needs no server, so it works in a static `file://` page. To avoid a flash before any script loads, put this in `<head>`:

```html
<script>
  document.documentElement.classList.toggle("dark", matchMedia("(prefers-color-scheme: dark)").matches)
</script>
```

## Theming

Colours derive from a few seed tokens, in light and dark:

```css
:root {
  --brand: oklch(0.5 0.2 262); /* primary, ring and accent */
  --link-brand: oklch(0.55 0.2 260); /* links and the caret; a blue by default */
  --neutral-hue: 262; /* tints the greys… */
  --neutral-chroma: 0.008; /* …by this much; 0 keeps them neutral */
  --radius: 1rem; /* control, checkbox and surface corners */
}
```

- **Set `--link-brand`** to colour links apart from the brand. It defaults to a blue, so links keep a hue under the near-black neutral brand; their lightness is clamped to keep 4.5:1. The palettes set it to their brand.
- **Set `--brand`.** `--primary-foreground` follows it, near-white or near-black, and reaches at least 4.5:1 on any sRGB colour. Dark mode lightens a dark brand on its own. Keep the brand itself at 4.5:1 on white, since links use it as text.
- **Pick a preset.** `npx shadcn@latest add @eskais/palettes`, then put `data-palette="blue"` on `<html>` or on any element; it combines with `data-theme` and `.dark`. `createAppearance({ palette: "blue" })` keeps it on `<html>`. Every preset meets 4.5:1 for text and 3:1 for controls.
- **Override any token.** Set `--primary`, `--muted` or any other token in `:root` or `.dark` to take it over completely.
- The showcase has a Theme panel that edits the seeds live, checks contrast and copies the CSS.

Derived colours use CSS relative colour syntax: Chrome 119, Firefox 128, Safari 18 and later. Older browsers keep the default neutral look.

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
