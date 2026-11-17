---
name: eskais-mockup
description: Builds a throwaway, offline HTML mockup of a screen from a project's own React components, so a person can look at and click through a proposed interface without a build server. Use when asked for a mockup, a preview, a design review or "show me what this screen would look like" in a project that ships components through a components.json and Tailwind. Runs with Bun only.
---

# Build a mockup

A mockup is one screen of the project's real components, with fixture data, built into a single HTML file that opens from disk, offline. It is a proposal, not a feature: no routes, no data fetching, no tests. The `screen.tsx` is the deliverable; `out.html` is a build artifact.

The CLI lives in the `@eskais/mockup` package and runs with Bun: `bun <mockup-package>/src/cli.ts <command>`. It reads the project's `components.json` (aliases and registries), its Tailwind stylesheet and its tsconfig aliases, and builds with the project's own Tailwind and React.

## The five levels

Use the first level that can express the design, and never skip one:

1. **The project's components**, own or installed from the registry, through its aliases.
2. **Eskais registry items the project has not installed**: import `@registry/<name>`. `build` fetches the item and its `registryDependencies` from the registry URL pinned in `components.json` into `.mockups/.registry/<ref>/`, compiles them, and records the exact `npx shadcn@latest add @eskais/<name>` in `manifest.install`. `inspect --registry` lists the items the project lacks. Network is used by `inspect` and `build` only; `out.html` stays offline.
3. **Composition in `.mockups/<name>/parts/*.tsx`**, built from levels 1 and 2.
4. **UI SDK primitives** (`@ui-sdk/react/<subpath>`) only for behaviour Eskais has no part for, styled exclusively with Eskais tokens, `cn`/`cva`, tone utilities and Eskais visual parts. A part file that imports one carries a `// sdk-reason: <why Eskais cannot do this>` line; each import becomes `manifest.sdkParts` (`part`, `primitive`, `reason`). A missing line fails `validate`.
5. **Never raw HTML controls** (`<button>`, `<input>`, `<select>`, `<textarea>`). If no level reaches the design, declare a gap for that part and stop it.

## The loop

1. **`inspect`** prints the project, stylesheet, Tailwind and React versions, themes, providers and the exports of every aliased file. `inspect <Name…>` prints a component's import line, `*Props` and `cva` variants. `inspect --registry` lists uninstalled registry items with one-line descriptions. `inspect --sdk` lists the installed `@ui-sdk/react` subpaths; `inspect --sdk <name>` gives one primitive's parts and props. `--json` works for all of them.
2. **Write** `.mockups/<name>/screen.tsx`, `fixtures.ts`, optional `parts/*.tsx`, optional `gaps.ts` and an optional shared `../wrapper.tsx`.
3. **`validate <name>`** builds the page, checks types, server-renders it, and reports every problem as `file:line:col rule message`: network calls, bare controls, imports outside the project (or `@registry/`), UI SDK imports that are not public subpaths, raw colours or arbitrary sizes in `parts/`, a missing `sdk-reason`, type errors and a render that throws. It prints a four-line summary of `install`, `proposed`, `sdkParts` and `gaps`. Exit codes: `0` fine, `1` problems to fix, `2` environment or usage error (including a fetched item whose npm packages the project does not declare).
4. **Open** the printed `out.html` path in the host's preview: in T3, `html_preview` with that path. Never read `out.html` yourself and never open component sources to answer a layout question the mockup answers.

## The files

- `screen.tsx` exports a component taking its data as props: `{ account = sampleAccount }: { account?: Account }`. Presentational only: no fetching, no `window`, no router. Behaviour is React state plus `setTimeout` promises for a saving or deleting state.
- **Start a screen from a layout block** when one fits, and fill its slots instead of laying out the page by hand: `@registry/master-detail` for a list with a detail pane.
- `fixtures.ts` types the data and exports a sample of it. Reuse the project's own types when they import cleanly through an alias.
- `parts/<part>.tsx` exports the components you propose to add. Each component with a `<Name>Props` type is recorded in `manifest.proposed` with its props (the members of that type).
- `gaps.ts` exports `gaps`: `{ component, missing, reason }[]` for a prop, variant or behaviour a part needed and levels 1–4 cannot give. It is recorded in `manifest.gaps`, so a design review sees the cost of the screen instead of guessing.
- `.mockups/wrapper.tsx` (optional, shared by every mockup) is `({ children }) => providers`, for a theme, i18n or query provider the app entry installs.
- `<project>/.mockups/.gitignore` holds `*`: mockups and the registry cache stay out of the repository. Never edit the project's own `.gitignore`.
- `manifest.json`, written by `build`, records the hashes, the project components the page bundled, install, proposed, sdkParts, gaps and the size.

The page ships with no network: every font and image is inlined. Set `font-sans` on the screen's root when the project's font comes from its theme; it is a utility, so the family is inlined into the stylesheet.

## Rules

- Use the project's control parts, never a bare `<button>`, `<input>`, `<select>` or `<textarea>`: a mockup that bypasses them misrepresents both the look and what a person can operate.
- Import through the project's aliases (`@/components/ui/button`), relatively, or through `@registry/<name>`. A bare package must be one the project declares.
- `parts/` use theme tokens and the Tailwind scale: no `bg-white`, `text-[#hex]`, `w-[13px]` or other raw colours and arbitrary sizes (`max-h-[calc(100%-2rem)]` and `w-[calc(100%-2rem)]` are allowed). `validate` rejects them.
- A UI SDK primitive that duplicates a part the project already installs (a `dialog`, `select`, `tabs`…) is a warning: use the Eskais part first.
- If a component cannot do what the design needs, change the screen or declare a gap, not the project: never edit `registry/`, `src/components/` or the theme.
- Build one variant per scheme when the user wants both: `build <name> --scheme light --out <path>` and `--scheme dark`. `--theme compact` applies a density theme. `--scheme system` follows the viewer's setting.
- `clean [name]` removes one mockup, or all of them when no name is given.
- Read the project's `AGENTS.md` first: spacing, colour and typography roles apply to the screen as much as to a component.
