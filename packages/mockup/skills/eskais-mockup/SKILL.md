---
name: eskais-mockup
description: Builds a throwaway, offline HTML mockup of a screen from a project's own React components, so a person can look at and click through a proposed interface without a build server. Use when asked for a mockup, a preview, a design review or "show me what this screen would look like" in a project that ships components through a components.json and Tailwind. Runs with Bun only.
---

# Build a mockup

A mockup is one screen of the project's real components, with fixture data, built into a single HTML file that opens from disk, offline. It is a proposal, not a feature: no routes, no data fetching, no tests. The `screen.tsx` is the deliverable; `out.html` is a build artifact.

## Run the CLI

The CLI is `packages/mockup/src/cli.ts` in the eskais-ui repository. It isn't on npm. It needs Bun 1.4 or newer and nothing else: it builds with the project's own Tailwind, React and aliases, read from `components.json`, its stylesheet and `tsconfig.json`.

1. Find a checkout: `ls ../eskais-ui/packages/mockup/src/cli.ts`, or ask the person where theirs is. Without one, `git clone --depth 1 https://github.com/p-otero/eskais-ui ../eskais-ui` (ask before cloning).
2. From the project root, run `bun ../eskais-ui/packages/mockup/src/cli.ts <command>`. Below, `mockup` stands for that.
3. If the project has `node_modules/.bin/eskais-mockup` (a person ran `bun link @eskais/mockup`), `bunx eskais-mockup <command>` is the same CLI. An `npm install` or `pnpm install` removes that link; fall back to the path.

## The five levels

Use the first level that can express the design, and never skip one:

1. **The project's components**, own or installed, through its aliases: `import { Button } from "@/components/ui/button"`. `mockup inspect` lists them; `mockup inspect Button Card` prints each one's import line, `*Props` and `cva` variants.
2. **Eskais registry items the project has not installed**: `import { Badge } from "@registry/badge"`. `mockup inspect --registry` lists them with one-line descriptions. `build` fetches the item and its `registryDependencies` from the registry URL in `components.json` into `.mockups/.registry/<ref>/` (`<ref>` is the commit pinned in the URL, or a hash of it), and records `npx shadcn@latest add @eskais/badge` in `manifest.install`. Two items may ship the same file when the copies are byte-identical, as `shadcn add` overwrites it; different copies of one file are an environment error naming the file and both items. Only `inspect` and `build` use the network; `out.html` stays offline.
3. **Composition in `.mockups/<name>/parts/*.tsx`**, built from levels 1 and 2. A component with a `<Name>Props` type is recorded in `manifest.proposed` with its props:

   ```tsx
   export type MemberRowProps = { member: Member; onRemove?: (id: string) => void }
   export function MemberRow({ member, onRemove }: MemberRowProps) { … }
   ```

4. **UI SDK primitives** (`@ui-sdk/react/<subpath>`) only for behaviour Eskais has no part for. `mockup inspect --sdk` lists the installed subpaths; `mockup inspect --sdk file-input` gives one primitive's import line and parts. Style it only with the project's tokens, `cn`/`cva` and its visual parts (`buttonVariants`). The part file carries a reason, recorded in `manifest.sdkParts`; without it `validate` fails:

   ```tsx
   import { FileInput, FileInputDropzone, FileInputTrigger } from "@ui-sdk/react/file-input"

   // sdk-reason: Eskais has no file input; UI SDK's FileInput gives the dropzone, the picker and the agent actions
   export function AvatarDrop() { … }
   ```

5. **A gap, never a raw control.** No bare `<button>`, `<input>`, `<select>` or `<textarea>`. If levels 1–4 can't reach the design, record it in `.mockups/<name>/gaps.ts` and leave that part out, so a review sees what the screen costs:

   ```ts
   export const gaps = [
     {
       component: "Button",
       missing: "a split button with a menu of roles",
       reason: "no Eskais part or composition gives one control",
     },
   ]
   ```

## The loop

1. **`mockup inspect`** prints the project, stylesheet, Tailwind and React versions, themes, providers and the exports of every aliased file. Add `--json` to any `inspect` for JSON. Read this instead of opening component sources.
2. **Write** `.mockups/<name>/screen.tsx`, `fixtures.ts`, optional `parts/*.tsx`, optional `gaps.ts` and an optional shared `.mockups/wrapper.tsx`.
3. **`mockup validate <name>`** builds the page, checks types (with the referenced tsconfig that sets `jsx` when the root one only lists `references`), server-renders it, and prints every problem as `file:line:col rule message`, then a four-line summary:

   ```text
   ok .mockups/team/out.html  485 kB (305 kB js, 179 kB css, 75 kB fonts)
   install 2: badge, tone
   proposed 2: AvatarDrop (0 props), MemberRow (2 props)
   sdkParts 1: AvatarDrop ← @ui-sdk/react/file-input
   gaps 1: Button (a split button with a menu of roles)
   ```

   Rules: `no-network`, `bare-control`, `import-specifier` (an alias, a relative path, `@registry/` or a declared package), `sdk-subpath` (only public `@ui-sdk/react/<subpath>` entries), `sdk-reason`, `shadcn/no-raw-colors` and `shadcn/no-arbitrary-values` (in `parts/`), `type` and `render`. A UI SDK primitive that duplicates a part the project installs (a `dialog`, `select`, `tabs`…) is a warning. Exit codes: `0` fine, `1` problems to fix, `2` environment or usage error (no `components.json`, an unknown flag, an unreachable registry, or a fetched item whose npm packages the project doesn't declare). Fix and re-run until it prints `ok`.

4. **Open** the printed `out.html` in the host's preview (in T3 Code, `html_preview` with that path), or hand the path to the person. Never read `out.html` yourself: it is hundreds of kilobytes of inlined code.
5. **Report** the summary: what to install, the parts proposed, the UI SDK parts and why, and the gaps.

## The files

- `screen.tsx` default-exports a component taking its data as props: `{ members = sampleMembers }: { members?: Member[] }`. Presentational only: no fetching, no `window`, no router. Behaviour is React state plus `setTimeout` promises for a saving or deleting state.
- **Start a screen from a layout block** when one fits, and fill its slots instead of laying out the page by hand: `@registry/master-detail` for a list with a detail pane, `@registry/dashboard-grid` for a dashboard, `@registry/settings-page` for a settings page.
- `fixtures.ts` types the data and exports a sample of it. Reuse the project's own types when they import cleanly through an alias.
- `parts/<part>.tsx`, `gaps.ts`: levels 3–5 above.
- `.mockups/wrapper.tsx` (optional, shared by every mockup) is `({ children }) => providers`, for a theme, i18n or query provider the app entry installs.
- `build` writes `.mockups/.gitignore` with `*`: mockups and the registry cache stay out of the repository. Never edit the project's own `.gitignore`.
- `manifest.json`, written by `build`, records the hashes, the project components the page bundled, `install`, `proposed`, `sdkParts`, `gaps` and the size.

The page ships with no network: every font and image is inlined. Set `font-sans` on the screen's root when the project's font comes from its theme.

## Rules

- Read the project's `AGENTS.md` first, if it has one: spacing, colour and typography roles apply to the screen as much as to a component.
- Start a whole screen from a block rather than composing its frame: an application screen inside `Shell` (`@registry/shell`, from a list of routes), a documentation page inside `DocsLayout`, a landing page from `landing-page`. Put only the page's own content in `parts/`.
- A notes, wiki or docs-editing screen starts from `@registry/document-workspace`: fill its slots (`explorer`, `tabs`, `document`, `aside`, `quickOpen`…) with `MarkdownEditor` or `MarkdownView` instead of laying out columns, drawers and a mode switch in `parts/`.
- `parts/` use theme tokens and the Tailwind scale: no `bg-white`, `text-[#hex]`, `w-[13px]` or other raw colours and arbitrary sizes (`max-h-[calc(100%-2rem)]` and `w-[calc(100%-2rem)]` are allowed).
- If a component can't do what the design needs, change the screen or record a gap, not the project: never edit `src/components/`, the theme or installed registry files for a mockup.
- One variant per scheme when the person wants both: `mockup build <name> --scheme light --out <name>-light.html` and `--scheme dark`. `--theme compact` applies a density theme; `--scheme system` (the default) follows the viewer.
- `mockup clean <name>` removes one mockup; `mockup clean` removes the whole `.mockups` folder, registry cache included.
- Other flags: `--project <dir>` when the project isn't the current folder, `--css <file>` when `components.json` names no stylesheet, `--max <n>` to print more than 20 problems.
