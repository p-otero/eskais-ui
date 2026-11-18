# Eskais UI: agent instructions

Eskais UI is a shadcn-style registry of React components built on Vercel UI SDK (`@ui-sdk/core`, `@ui-sdk/react`).

## Before building or changing a component

1. **Read the UI SDK docs first.** Load the `ui-sdk` skill (`.agents/skills/ui-sdk/SKILL.md`), then read `node_modules/@ui-sdk/react/docs/llms.txt` and the page of every component you touch. Don't guess the API: UI SDK is in beta and changes.
2. Read `skills/eskais-ui/SKILL.md` and its `references/` for the conventions of this registry, and "Add a component" below.

## Rules

- Every operable control is a UI SDK part. A bare `<button>` or `<input>` is invisible to agents. Never hand-roll a role UI SDK ships (dialog, menu, listbox, combobox, tabs…).
- Behavior UI SDK doesn't ship goes in a `definePrimitive` primitive with explicit `agent.actions`, rendered with `createParts`.
- Import UI SDK from its public entries (`@ui-sdk/react/dialog`), never `internal/*`.
- Every control has an accessible name. Style from `data-slot` and state attributes with the semantic tokens in `registry/styles/theme.css`.
- Destructive actions carry `data-agent-confirm`.
- Links follow on mouse press (`@fast-link/core`, through `Link`, `NavigationMenuLink` or `FastLinkRegion`), for navigation only: a press can't be cancelled by moving away (WCAG 2.5.2), so actions stay on `Button`s and menu items, and a link that confirms or changes something gets `fast={false}`. `data-no-fast-link` on an ancestor (`<body>` for the whole app) opts out. A `#/…` href is a hash route and follows on press (`location.hash` or `onFollow`); other `#…` hrefs are in-page anchors and stay native (`data-fast-link-hash-prefix` changes the prefix).
- Registry code (`registry/**`) must run in consumer browsers and in Node/npm/pnpm projects: no `bun`, `bun:*` or `node:*` imports.
- Registry code passes strict consumers' type-aware lint: `bun run lint` also runs `typescript/restrict-template-expressions` on `registry/**` (`tooling/oxlint-type-aware.json`). Convert a non-string in a template literal with `String()` or a formatter.
- No default copy in a specific language, except overridable accessible labels.
- Every interface gets the agent test (see the ui-sdk skill, `references/agent-ready.md`).

## Add a component

1. Read the UI SDK page for the component. If UI SDK ships it, style its parts; don't reimplement.
2. If it doesn't, write a primitive with `definePrimitive` (`agent.actions` last) next to the component, as `search-field-primitive.ts` does, and render it with `createParts`.
3. Never give a `registry/lib` file and a `registry/ui` file the same basename: `shadcn add` rewrites imports by basename and points one at the other in the consumer.
4. Use `cnState` from `@/lib/utils` so a consumer's `className` can still be a function of state.
5. A UI SDK part keeps its own `data-slot` over a prop. To give a part built on one (or on `Button`) its own slot, set it on the rendered element: `render={(part) => <button {...part} data-slot="list-item-primary" />}`. `test/data-slot.test.tsx` fails on a `data-slot` prop passed straight to one.
6. Size and shape it with the tokens below so every theme applies.
7. Add tests in `test/`: behavior with Testing Library, `mount`/`checkServer` for primitives, the agent test, and `allow` refused/approved for anything with `data-agent-confirm`.
8. Add the item to `registry.json`, run `bun run verify` and commit `public/r`.

## Agent skills

`skills/eskais-ui`, `skills/eskais-perf` and `packages/mockup/skills/eskais-mockup` ship to consumers as the `eskais-ui-skill`, `eskais-perf-skill` and `eskais-mockup-skill` registry items (`registry:file` with a `~/.agents/skills/<name>/` target). They are written for a project that installs Eskais UI, not for this repository: no `registry/`, `tooling/` or AGENTS.md paths. A new file in a skill joins its item's `files`; `test/registry-skills.test.ts` checks the targets, the references and `public/r`.

## Spacing

Spacing is chosen by role. The values change with the theme (compact is tighter), so never hand-pick a number.

| Utility                           | Role                                                                            | Default           | Compact             |
| --------------------------------- | ------------------------------------------------------------------------------- | ----------------- | ------------------- |
| `gap-inline`                      | icon + text, or parts inside one control, chip or row                           | 0.375rem          | 0.25rem             |
| `gap-items`                       | siblings in a list or stack: cards in a column, chips, buttons, form fields     | 0.5rem            | 0.375rem            |
| `gap-group`                       | groups inside a surface: header vs body, dialog sections                        | 1rem              | 0.75rem             |
| `gap-section`                     | surfaces on a page: board columns, stat cards, a page's blocks                  | 1.5rem            | 1rem                |
| `px-inset-chip` / `py-inset-chip` | pills, badges, chips, kbd                                                       | 0.5rem / 0.125rem | 0.375rem / 0.125rem |
| `px-inset-item` / `py-inset-item` | menu and list items, small cards (task card, usage tile), table cells           | 0.625rem / 0.5rem | 0.5rem / 0.375rem   |
| `px-control-x`                    | buttons, inputs, selects                                                        | 0.875rem          | 0.625rem            |
| `p-inset-surface`                 | cards, dialogs, panels, popovers (`p-surface` still works as an alias)          | 1.5rem            | 1rem                |
| `p-control-inset`                 | the rim of a control-height bar around `-sm` items: tab list, segmented control | 2px               | 2px                 |

`inline`, `items`, `group`, `section`, `inset-surface` and `control-inset` are Tailwind spacing values, so every spacing utility takes them: `p-inline` pads a menu's popup like parts of one control, `pb-group` separates an accordion panel, `-mx-inline` lets a menu separator bleed through that padding. The chip and item insets exist only as `px-`/`py-`; for a negative bleed or an offset tied to them, use the variable: `-mx-(--item-padding-x)`, `start-(--item-padding-x)`.

1. In `registry/**`, spacing (padding, margin, gap, `space-x/y`, inset offsets used as spacing) uses only role tokens. Allowed: `0`, `px` and 1px optical nudges. Anything else needs `// oxlint-disable-next-line p-otero/spacing-tokens -- <reason>`. `p-otero/spacing-tokens` enforces this.
2. A component never sets outer margin. The parent spaces its children with `gap-*`.
3. Choose by relationship, not by look: parts of the same thing use `gap-inline` (inside one control or row) or `gap-items` (siblings); distinct groups use `gap-group`; separate surfaces use `gap-section`.
4. Sizes (`size-*`, `h-*`, `w-*`) are not spacing. Leave them, but prefer the tokens (`h-control`, `size-control-sm`).

## Theme item

`bun run registry:build` copies `registry/styles/*.css` into the theme items of `registry.json` (`tooling/sync-theme.ts`). shadcn mirrors every `cssVars.light`/`dark` entry into the consumer's `@theme inline`, as `--color-x: var(--x)` for a value that starts with `hsl`, `rgb`, `#` or `oklch` and as a self-reference `--x: var(--x)` for anything else.

1. Only a colour with its own `--color-x` in `@theme inline` goes to `cssVars`; sync-theme moves seeds, shapes, shadows and colours computed with `var()`, `color()` or `color-mix()` to `css` rules on `:root` and `.dark`. A test fails otherwise.
2. `@theme inline` defines the whole radius scale, `sm` to `4xl`, so it replaces the one `shadcn init` writes.
3. The base rules use the `@apply` lists `shadcn init` writes; shadcn merges an item's `@apply` into an existing one.
4. `node tooling/consumer-check.mjs` installs the theme into the stylesheet `shadcn init` writes (`tooling/fixtures`) and fails on a self-reference, a leftover radius, a duplicated base rule or a second `add` that changes the file, also after Prettier has formatted it.
5. shadcn merges a rule by its exact selector or at-rule params, and formatters put each selector of a list on its own line and wrap past 80 columns. So sync-theme writes one rule per selector, and every key in an item's `css` fits in 80 columns at four spaces per level; a test fails otherwise. Write a long `@supports not (a or b)` as two nested `@supports not`.

## Elevation

Two levels: surfaces (`shadow-surface`, `rounded-surface`, `backdrop-surface`) and floating UI.

| Token                 | Utility                                      | Default                                                          | Compact / glass / dark                                |
| --------------------- | -------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| `--floating-shadow`   | `shadow-floating`                            | three layers, up to `0 16px 36px -8px` at 14%                    | dark: deeper, with a 5% top highlight; glass: its own |
| `--floating-radius`   | `rounded-floating`                           | a `-sm` item's radius plus `gap-inline` (22px), concentric       | compact: 0.75rem                                      |
| `--floating-backdrop` | `backdrop-floating`                          | `blur(16px) saturate(1.5)`                                       | glass: 1.5 × `--glass-blur`                           |
| `--floating-opacity`  | `bg-floating` (popover colour at this alpha) | 85%; 100% without `backdrop-filter` or with reduced transparency | glass: `--glass-opacity` + 15%                        |
| `--floating-border`   | `border-floating-border`                     | foreground at 10% (light), white at 12% (dark)                   |                                                       |
| `--floating-offset`   | `bottom-floating`, `p-floating`…             | 1rem: a `Floating` bar's distance from its container's edge      | compact: 0.75rem                                      |

`surface-floating` combines them (border, radius, popover fill, shadow, backdrop, popover text colour); popovers, menus, select and combobox lists, date picker, hover card, navigation menu and toasts use it. Dialogs and drawers take the shadow, border and radius but are opaque reading surfaces (`bg-popover`, no backdrop blur) in every theme, glass included: a translucent fill over the dimmed backdrop reads grey and drops text below 4.5:1. Glass stays on chrome: popovers, menus, toasts, sidebar and cards. Tooltips take `shadow-floating`.

1. Anything that floats above the page uses this level; in-page surfaces (cards, board columns, panels) stay on `shadow-surface`.
2. To override the radius, use the parts (`rounded-lg border border-floating-border bg-floating shadow-floating backdrop-floating`) rather than `surface-floating` plus `rounded-*`: utility order decides which radius wins.
3. `data-elevation="flat"` on `<html>` or any ancestor drops the floating shadow, backdrop and translucency, also inside a glass scope.

## Text colours

| Token         | Utility          | Role                                                   | Light                                            | Dark                                                    |
| ------------- | ---------------- | ------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------- |
| `--link`      | `text-link`      | inline links, Button `variant="link"`, link-like chips | `--link-brand`, lightness capped at 0.5          | `--link-brand` mirrored like `--primary`, at least 0.74 |
| `--link-soft` | `text-link-soft` | quieter links (wikilinks, references), an editor caret | `--link-brand` at 55% chroma, lightness 0.42–0.5 | the same, lightness 0.74–0.82                           |

1. Both derive from the `--link-brand` seed, not `--brand`, so links keep a hue under the near-black neutral brand. It defaults to a blue, `oklch(0.55 0.2 260)`; the coloured palettes set it to their brand.
2. Both reach 4.5:1 on `background`, `card` and `muted` in every palette and mode; `bun run test:browser` checks it. A custom `--link-brand` keeps that, since the lightness is clamped.
3. `--accent` is a surface (hover and selected fills) with `accent-foreground` on it, and nothing else: never a text colour (`text-accent`) or a stroke (`border-accent`, `ring-accent`, `outline-accent`, `stroke-`, `fill-`, `decoration-`, `divide-accent`). It is a near-background tint with no contrast guarantee. For a stroke use `border-input-strong` (a control's edge, 3:1), `border-primary` or `ring-ring` (selected or focused); for coloured text, `text-link`. A unit test greps `registry/**`.
4. Pair a link colour with an underline (at rest or on hover) so it doesn't rely on colour alone.

## Dark mode

`.dark` on `<html>` (set by `createAppearance`) switches the tokens. Before any script runs, `@media (prefers-color-scheme: dark)` applies the same tokens to `:root:where(:not(.light, [data-color-scheme="light"]))`, so a server-rendered or script-free page follows the system.

1. An explicit light choice opts out: `createAppearance().apply()` (and UI SDK's `Preferences`) write `data-color-scheme` with the choice (`system`, `light`, `dark`) on `<html>`. A server that knows the choice can render `<html data-color-scheme="light">` or `class="light"`.
2. The fallback repeats the `.dark` declarations at the same specificity; a test fails if the two drift apart. Change both together.
3. The theme's `dark:` variant follows the same rule, and the `theme` item ships it as a `@custom-variant dark { … }` block. shadcn also writes its one-line `@custom-variant dark (&:is(.dark *))` into any stylesheet that has no custom variant yet, above what the item adds; Tailwind keeps the last definition, so the theme's block wins as long as it stays below. `node tooling/consumer-check.mjs` checks it in Chrome. The registry components use tokens, not `dark:`, so they work either way.

## Chart series

Categorical series use `--chart-1` to `--chart-5`. A series with a meaning uses a series token instead:

| Token                | Utility (`bg-`, `fill-`, `stroke-`, `text-`) | Role                               | From                                    |
| -------------------- | -------------------------------------------- | ---------------------------------- | --------------------------------------- |
| `--series-positive`  | `series-positive`                            | gains, done, within budget         | `--success`                             |
| `--series-negative`  | `series-negative`                            | losses, failures, over budget      | `--destructive`                         |
| `--series-target`    | `series-target`                              | a goal, forecast or reference line | `--foreground` 80% over `--background`  |
| `--series-remaining` | `series-remaining`                           | what is left: a track, a burn-down | `--muted-foreground` 70% over `--muted` |

Each reaches 3:1 on `background` and `card` in both modes and every palette (`bun run test:browser` checks it). In a chart config, pass `color: "var(--series-positive)"`. Still add a legend or labels, and dash a target line, so meaning never rests on colour alone.

## Tone

One vocabulary says what a status means: `Tone` from `@/lib/tone` (`@eskais/tone`).

| Tone          | Meaning                                         | Solid (marks, dots, indicators)    |
| ------------- | ----------------------------------------------- | ---------------------------------- |
| `neutral`     | no judgement: draft, queued, unknown            | `muted-foreground`                 |
| `info`        | something to know, in progress                  | `info`                             |
| `success`     | done, healthy, passed                           | `success`                          |
| `warning`     | needs attention soon                            | `warning`                          |
| `destructive` | failed, blocked, irreversible                   | `destructive`                      |
| `violet`      | a category (a label, a kind of item), no status | `violet`, with `violet-foreground` |

Every tone also has soft tokens, for chips and tinted surfaces: `--{tone}-soft` (the fill, clearly visible in dark mode too), `--{tone}-soft-foreground` (text on it, at least 4.5:1) and `--{tone}-border` (its edge), as `bg-info-soft text-info-soft-foreground border-info-border`. Badge, StatusPill, list item icon tiles and the alert and toast edges use them; never tint with an opacity modifier (`bg-info/10`, `border-info/30`), which disappears over a dark or glass surface. `bg-skeleton` is the loading placeholder fill, translucent so it shows on any surface. `bun run test:browser` checks all of them in both modes and every palette.

| Component          | Prop                     | Default          | Notes                                                                                                                                        |
| ------------------ | ------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `Badge`            | `tone`                   | none (`variant`) | `variant` (`default`, `secondary`, `outline`) is the look of an untoned badge; tone values passed as `variant` still work and are deprecated |
| `Alert`            | `tone`                   | `info`           |                                                                                                                                              |
| `StatusPill`       | `tone`                   | `neutral`        | also `muted`, for an inactive state                                                                                                          |
| `StatusDot`        | `tone`, `label`, `pulse` | `neutral`        | a dot with a screen-reader `label`; the pulse stops under reduced motion                                                                     |
| `Progress`/`Meter` | `tone` on the root       | none (`primary`) | colours the indicator                                                                                                                        |
| `Toast`            | `tone`, or from the type | from `type`      | `toastTone(type)`: `error` is `destructive`, `default` and `loading` are `neutral`; `ToastIcon` draws the tone (a spinner for `loading`)     |

Never add a component-specific word for these (`error`, `danger`, `positive`); map it to a tone.

## Typography

Text is sized by role. Each `text-*` step sets size and line height, and the meta, title and display steps a weight too; compact tightens them. Caption, body-sm and body set no weight, so the text keeps what it inherits or its element gives it: a `<strong>`, `<b>` or `<th>` stays bold.

| Utility           | Role                                                        | Default (size/line/weight) | Compact (size/line) |
| ----------------- | ----------------------------------------------------------- | -------------------------- | ------------------- |
| `text-meta`       | eyebrows, kickers, overlines; pair with `tracking-meta`     | 11/14/500                  | 11/14               |
| `text-caption`    | hints, timestamps, table footnotes                          | 12/16/inherited            | 11.5/15             |
| `text-body-sm`    | secondary text, descriptions in dense UI                    | 13/18/inherited            | 12/16               |
| `text-body`       | default UI and reading text                                 | 14/20/inherited            | 13/18               |
| `text-title-sm`   | card, panel and list-group titles                           | 15/20/600                  | 14/18               |
| `text-title`      | dialog, drawer and section titles                           | 18/24/600                  | 16/22               |
| `text-display-sm` | page titles, stat values                                    | 24/28/650                  | 20/24               |
| `text-display`    | hero numbers, empty-state headlines                         | 28/32/700                  | 24/28               |
| `text-entry`      | text a person types: inputs, textareas, selects, editors    | 14/20/inherited            | 14/20               |
| `tracking-meta`   | 0.12em, for `text-meta`; uppercase is the caller's choice   |                            |                     |
| `tracking-tight`  | -0.012em, for titles and display text                       |                            |                     |
| `font-mono`       | ids, hashes, code, keyboard shortcuts (Geist Mono Variable) |                            |                     |

`text-entry` is 16/24 on a coarse pointer, in every theme: iOS Safari zooms into a focused field whose text is under 16px. Every text-entry control in `registry/**` uses it (an editor that reads at the body size takes `pointer-coarse:text-entry`), and `node tooling/touch-check.mjs` measures them on an emulated phone. Never stop the zoom with `maximum-scale` or `user-scalable=no` in the viewport meta: that blocks pinch-zoom (WCAG 1.4.4).

Sizes are in rem, from `--type-<step>-size` and `--type-<step>-leading`. Override the weight with `font-*` and the line height with `leading-*` (a title on one line inside a tight header keeps `leading-none`). `font-geist` installs Geist and Geist Mono.

## Layers and motion

| Utility           | Value                        | Role                                                     |
| ----------------- | ---------------------------- | -------------------------------------------------------- |
| `z-sticky`        | 20                           | sticky headers, a `Floating` bar                         |
| `z-overlay`       | 40                           | dialog and drawer backdrops and content                  |
| `z-popover`       | 50                           | popovers, menus, list popups, tooltips (above dialogs)   |
| `z-toast`         | 60                           | the toast region, above everything else                  |
| `duration-micro`  | 140ms                        | hover and press feedback, popovers, menus, tooltips      |
| `duration-panel`  | 180ms                        | panels that resize or slide: accordion, sidebar, toasts  |
| `duration-dialog` | 200ms                        | dialogs and their backdrop                               |
| `ease-standard`   | `cubic-bezier(0.2, 0, 0, 1)` | every token-timed transition: quick start, gentle settle |

1. In `registry/**`, never write `z-50`, `duration-150` or another number for these: pick the role. A local `z-10` that lifts one part above its sibling (a stretched link) is fine.
2. Popovers, menus and toasts use the browser's top layer where it exists, so the z-index orders them only where it doesn't and against page content.
3. `prefers-reduced-motion: reduce` collapses every transition and animation in `@layer base`; components add `motion-reduce:` only to swap a movement for a fade.

## Touch targets

On a coarse pointer (`@media (pointer: coarse)`), controls reach a hit area of at least `--control-height-touch` (2.75rem, 44px) without changing how they look on a desktop.

| Mechanism                                       | Used by                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `touch-target` class: a centered `::before`     | Button (all sizes, icon too), Toggle, tabs, segmented control items, checkbox, radio, switch      |
| `pointer-coarse:h-(--control-height-touch)`     | sidebar items, which stack edge to edge                                                           |
| `pointer-coarse:min-h-(--control-height-touch)` | a `Label` or `Field` row that holds a checkbox, radio or switch, so stacked choices don't overlap |

1. Add `touch-target` to any new operable control smaller than 44px. It sets `position: relative` in `@layer components`, so an `absolute` or `fixed` utility still wins; don't put it on an element that uses its own `::before`.
2. The hit area grows into the surrounding space. Where controls stack closer than 44px, grow the row on coarse pointers instead (`pointer-coarse:` variant) so neighbouring hit areas don't overlap.

## Breakpoint

`narrow:` is a variant for viewports 760px wide and below (`@custom-variant narrow (@media (width <= 47.5rem))`, shipped with `@eskais/theme`). Use it for layout that must change on a phone-sized screen: stack a row, hide a secondary column, let a dialog fill the width.

1. It is about the viewport width, not density. The `compact` _theme_ (`data-theme="compact"`) tightens sizes and spacing at any width; `narrow:` never changes tokens. Combine them freely.
2. Prefer container queries (`@container`, `@md:`) for a component that lives in panels of different widths; `narrow:` is for page layout.
3. It is a max-width variant, so write the wide layout first and override it: `flex-row narrow:flex-col`.

## Icons

Icons come from `lucide-react`, imported by name the way shadcn does: `import { ChevronDownIcon, XIcon } from "lucide-react"`. Every item whose files import it lists `lucide-react` in `dependencies`, without a version; a test fails otherwise. Its floor is the exact pin in `package.json` and the apps, one across the repo: the oldest release that exports every icon in use and is at least 7 days old (see "Dependencies").

1. Never draw an icon by hand. `eskais/no-inline-icons` flags every `<svg>` element in `registry/**` and `apps/**` (showcase and site), whatever the function is called. A drawing that isn't an icon (the spinner's arc, task status rings, a stage marker's tick, an avatar placeholder, a grip, a brand logo) disables it on the line before: `// oxlint-disable-next-line eskais/no-inline-icons -- <reason>` (`{/* … */}` inside JSX children).
2. Lucide hides an icon from assistive tech (and so from agents) unless it gets an `aria-*`, `role` or `title` prop. A decorative icon needs nothing. A meaningful one, with no text beside it, uses `<Icon icon={XIcon} label="…" />` from `icon`.
3. Size comes from the parent (`[&_svg]:size-4` in Button, Badge, menu items, inputs) or a `size-*` class: `size-3.5` beside `text-body-sm`, `size-4` beside `text-body`, `size-5` beside a title. Classes override lucide's `size` prop (24 by default, so an unsized icon is 24px). Keep lucide's stroke of 2; a tick in a small indicator (checkbox, select) takes `strokeWidth={2.5}` or `3`.
4. Colour is `currentColor`: set a text colour (`text-muted-foreground`, `text-success`). Mirror direction icons in right-to-left with `rtl:-scale-x-100` or `rtl:rotate-180`.
5. An icon-only control shows its name in a tooltip. Use `Button`/`Toggle` (or a button-like trigger) with `size="icon"` and an `aria-label`; any other icon-only control goes inside `ControlTooltip label` from `tooltip`. `tooltip={false}` only when a visible label sits beside it. `eskais/icon-button-needs-label` flags an icon-only `Button` or `Toggle` without both.

## Dependencies

shadcn installs an item's npm `dependencies` before it writes any file. A consumer whose package manager holds back young releases (pnpm's `minimumReleaseAge`, Renovate's `minimumReleaseAge`) can't add the item at all when one pin is too fresh: pnpm fails with `ERR_PNPM_NO_MATURE_MATCHING_VERSION`.

1. Every npm dependency in `registry.json` is an exact version (`name@1.2.3`) published at least 7 days ago. A test fails on a range or a missing version, except for the names in `unversionedDependencies` in `tooling/check-dependency-age.mjs` (only `lucide-react`), which items list without a version and whose floor, the exact version in the root `package.json`, is checked like a pin. `node tooling/check-dependency-age.mjs` reads the publish times from registry.npmjs.org and fails on a younger release; CI runs it in the `registry` job with `--require-network`, and offline it skips with a message.
2. Bump only to a release at least 7 days old, and prefer the oldest one that has what the code uses.
3. A pin that can't wait goes in `youngDependencyExceptions` in that script, at its exact version and with the reason (UI SDK: its first release is from 2026-11-12). The check says when an exception is old enough to remove.
4. `node tooling/consumer-check.mjs pnpm release-age` adds `dialog` (and with it `lucide-react`) under a 7-day `minimumReleaseAge` that excludes only those exceptions and the test app's own build tools.
5. A dependency the consumer is likely to have already (`lucide-react`) goes in without a version. shadcn 4.23 skips a versionless dependency that `package.json` already lists, and installs any spec with a version: an exact pin rewrites the consumer's spec and downgrades a newer install with npm, pnpm and bun, npm rewrites a range to `^<latest>`, and bun writes the range over the consumer's spec. Without a version a new project gets the newest release its package manager allows. Every `consumer-check` scenario asserts the `lucide-react` spec in `package.json` and the installed version after `add`, and `existing-lucide` starts from 1.70.0 with npm and pnpm.

## Lint

`.oxlintrc.json` extends the `base`, `react`, `react-agents` and `ui-tailwind` presets of [`@p-otero/oxlint-rules`](https://github.com/p-otero/oxlint-rules) (pinned to a commit) and adds `@shadcn/lint` and the local `eskais` plugin (`tooling/oxlint-plugin-eskais`: `eskais/no-inline-icons` on `registry/**` and `eskais/icon-button-needs-label` everywhere). Rules from that package are `p-otero/<rule>`.

1. Every suppression says why: `// oxlint-disable-next-line <rule> -- <reason>` (`p-otero/require-suppression-reason`).
2. Effects live in hook modules: a `use-*.ts` file next to the component (`registry/ui/use-board-focus.ts`) or a `hooks/` folder (`p-otero/no-effect-outside-hooks`). Before writing one, derive during render, act in the event handler, read a subscription with `useSyncExternalStore`, or read the latest props in an Effect with `useEffectEvent`. A new hook file in `registry/ui` joins its item's `files` in `registry.json`.
3. `p-otero/spacing-tokens` runs on `registry/**` only, with the roles in "Spacing" below.
4. The component-shape rules (`one-public-component`, `component-name-matches-file`, `max-component-lines`, `no-large-private-component`) are off: a registry file exports a component's parts together (`Card`, `CardHeader`, `CardTitle`…), as shadcn does, and the showcase and site name their demos `…Demo`.
5. `max-lines` (400) is off for tests, tooling scripts, site content and `*-labels.ts` dictionaries.
6. React Compiler: `bun run test:compiler` builds the showcase with `babel-plugin-react-compiler` (`apps/showcase/react-compiler.ts`) and runs the overlay, fast-link, icon tooltip, shell and contrast checks on it. The build fails when a registry component or hook hits a compiler diagnostic not listed in `allowed` there. React Compiler 1.0 can't compile a `try … finally`, a conditional inside `try`, or a default parameter built from `||`/`&&`, so keep those out of components and hooks.

The `lint-rules` item ships consumers the `react` and `ui-tailwind` presets with `@shadcn/lint`, the component-shape rules off, spacing tokens as warnings and `eskais/icon-button-needs-label` (from `registry/rules/eskais-oxlint-plugin.js`, which the repo's plugin also loads).

## Comments

- Don't narrate what the code does; rename and restructure until the intent is obvious.
- Comment only non-obvious rationale: upstream bugs or workarounds, platform or protocol constraints, security or performance reasoning.
- No commented-out code. No TODO without a linked issue. `p-otero/no-low-value-comments` enforces this.

## Commands

| Task           | Command                                                          |
| -------------- | ---------------------------------------------------------------- |
| Lint           | `bun run lint`                                                   |
| Format         | `bun run format`                                                 |
| Typecheck      | `bun run typecheck`                                              |
| Tests          | `bun run test`                                                   |
| Registry       | `bun run registry:build`, then commit `public/r`                 |
| Everything     | `bun run verify`                                                 |
| Showcase       | `bun run dev`                                                    |
| Clean consumer | `node tooling/consumer-check.mjs npm` (or `pnpm`)                |
| Dependency age | `node tooling/check-dependency-age.mjs`: 7 days or older         |
| Contrast (CI)  | `bun run test:browser`: axe and pixel contrast in Chrome         |
| Contrast glass | `bun run test:browser:glass`: by hand, not in CI                 |
| React Compiler | `bun run test:compiler`: compiler build, then the browser checks |
