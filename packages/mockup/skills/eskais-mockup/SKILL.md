---
name: eskais-mockup
description: Builds a throwaway, offline HTML mockup of a screen from a project's own React components, so a person can look at and click through a proposed interface without a build server. Use when asked for a mockup, a preview, a design review or "show me what this screen would look like" in a project that ships components through a components.json and Tailwind. Runs with Bun only.
---

# Build a mockup

A mockup is one screen of the project's real components, with fixture data, built into a single HTML file that opens from disk, offline. It is a proposal, not a feature: no routes, no data fetching, no tests. The `screen.tsx` is the deliverable; `out.html` is a build artifact.

The CLI lives in the `@eskais/mockup` package and runs with Bun: `bun <mockup-package>/src/cli.ts <command>`. It reads the project's `components.json`, its Tailwind stylesheet and its tsconfig aliases, and builds with the project's own Tailwind and React.

## The loop

1. **`inspect`** prints the project, its stylesheet, Tailwind and React versions, themes, providers in the app entry, whether a `.mockups/wrapper.tsx` exists, and the exports of every file in the `ui`, `components`, `lib` and `hooks` aliases, one line per file. It lists value exports only, so a `*Props` type is not in the index.
2. **`inspect <Name…>`** prints a component's import line plus the text of its `*Props` type and its `cva` variants, about 200 tokens each. Use it instead of opening component sources. `--json` works for both forms.
3. **Write** `.mockups/<name>/screen.tsx` and `.mockups/<name>/fixtures.ts`. The screen default-exports one component whose data comes in as props, defaulting to the fixtures.
4. **`validate <name>`** builds the page, then reports every problem as `file:line:col rule message`: network calls, bare `<button>`/`<input>`/`<select>`/`<textarea>`, imports that skip the project's aliases, type errors from `bun check` (including a prop the component doesn't take), and a server render that throws. Exit codes: `0` fine, `1` problems to fix, `2` environment or usage error.
5. **Open** the printed `out.html` path in the host's preview: in T3, `html_preview` with that path. Never read `out.html` yourself (it is a megabyte of inlined JavaScript and CSS) and never open component sources to answer a layout question the mockup already answers.

## The files

- `screen.tsx` exports a component taking its data as props: `{ account = sampleAccount }: { account?: Account }`. Presentational only: no fetching, no `window`, no router. Behaviour is React state plus `setTimeout` promises for a saving or deleting state.
- `fixtures.ts` types the data and exports a sample of it. Reuse the project's own types when they import cleanly through an alias.
- `.mockups/wrapper.tsx` (optional, shared by every mockup) is `({ children }) => providers`. Add it when a screen needs a theme, i18n or query provider the app entry installs.
- `<project>/.mockups/.gitignore` holds `*`: mockups stay out of the repository. Never edit the project's own `.gitignore`.
- `manifest.json`, written by `build`, records the hashes, the project components the page bundled and the size.

The page ships with no network: every font and image is inlined. Set `font-sans` on the screen's root when the project's font comes from its theme; it is a utility, so the family is inlined into the stylesheet.

## Rules

- Use the project's control parts, never a bare `<button>`, `<input>`, `<select>` or `<textarea>`: a mockup that bypasses them misrepresents both the look and what a person can operate.
- Import through the project's aliases (`@/components/ui/button`) or relatively. A bare package must be one the project declares.
- If a component cannot do what the design needs, change the screen, not the project: report the gap to the user and keep the components untouched. A mockup never edits `registry/`, `src/components/` or the theme.
- Build one variant per scheme when the user wants both: `build <name> --scheme light --out <path>` and `--scheme dark`. `--theme compact` applies a density theme. `--scheme system` follows the viewer's setting.
- `clean [name]` removes one mockup, or all of them when no name is given.
- Read the project's `AGENTS.md` first: spacing, colour and typography roles apply to the screen as much as to a component.
