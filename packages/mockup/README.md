# @eskais/mockup

Builds a throwaway, offline HTML mockup of one screen from a project's own React components, and checks it. It runs with Bun 1.4 or newer, has no npm dependencies and reads the project's `components.json`, stylesheet and tsconfig aliases. The full guide is [/docs/mockups](https://p-otero.github.io/eskais-ui/docs/mockups/) on the docs site.

A project installs it from the registry as the `eskais-mockup-cli` item, which copies `src/` into `.agents/tools/eskais-mockup/`:

```bash
npx shadcn@latest add @eskais/eskais-mockup-cli
bun .agents/tools/eskais-mockup/cli.ts <command>
bun .agents/tools/eskais-mockup/cli.ts --version
```

From a checkout of this repository, the same CLI runs by path, from the project: `bun <eskais-ui checkout>/packages/mockup/src/cli.ts <command>`, where `<eskais-ui checkout>` is the path to your checkout. Everything in `src/` ships to consumers, so it imports only `node:*` modules and its own files by relative path, and finds `template.html` beside itself. `src/version.ts` is written by `bun run registry:build` from the root `package.json`.

## Commands

| Command                 | What it does                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `inspect [Names…]`      | Lists the project's components, or prints each named one's import line, `*Props` and `cva` variants.                      |
| `inspect --registry`    | Lists the registry items the project hasn't installed.                                                                    |
| `inspect --sdk [name…]` | Lists the installed `@ui-sdk/react` subpaths, or one primitive's parts.                                                   |
| `build <name>`          | Bundles `.mockups/<name>/screen.tsx` into `out.html` (`out-<state>-<theme>.html` with `--state`), writes `manifest.json`. |
| `validate <name>`       | Builds the page, checks the page and the sources, then prints the install, proposed, sdkParts, gaps and screenshots.      |
| `gallery [dir]`         | Writes `<dir>/gallery.html` (`.mockups` by default) with every screenshot, and lists them.                                |
| `clean [name]`          | Removes one mockup, or the whole `.mockups` folder.                                                                       |

Flags: `--project <dir>`, `--css <file>` (the stylesheet only), `--tsconfig <file>`, `--tailwind <dir>` (a workspace package that installs Tailwind), `--state <name>|all` (`build`, `validate`: a named state from `fixtures.ts`), `--theme <name>`, `--scheme light|dark|system`, `--out <file>`, `--max <n>`, `--json` (`inspect`, `gallery`) and `--gallery` (`build`, `validate`: write the gallery and print its path last). Exit codes: `0` fine, `1` problems to fix, `2` an environment or usage error.

## Present every screen

A mockup isn't reviewed until the person has seen every screen, in every state and theme. Build one page per state and theme, named `out-<state>-<theme>.html` in the mockup's folder, and capture each as a PNG with the same name beside it:

```bash
bun .agents/tools/eskais-mockup/cli.ts build team --scheme dark --out .mockups/team/out-empty-dark.html
chrome --headless --hide-scrollbars --window-size=1280,800 \
  --screenshot=.mockups/team/out-empty-dark.png "file://$PWD/.mockups/team/out-empty-dark.html"
bun .agents/tools/eskais-mockup/cli.ts gallery
```

The theme is the last segment of the name (`light`, `dark`, `system` or a theme name such as `compact`), the state everything before it; `out.html` is the default state in the system theme. `gallery` prints one line per screenshot, the pages that have no PNG, and then the total:

```text
team  default  light  .mockups/team/out-light.png  .mockups/team/out-light.html
team  empty  dark  .mockups/team/out-empty-dark.png  .mockups/team/out-empty-dark.html
gallery .mockups/gallery.html  2 screenshots: 1 screen, 2 states, 2 themes
```

`gallery.html` groups the screenshots by screen, then state, then theme, with headings, alt text such as `team, empty state, dark theme` and a link from each image to its page. It is one self-contained file with relative paths, lazy-loaded images, no script and no network, so it opens from `file://` and the folder can be zipped and shared. With no screenshots, `gallery` writes nothing, says so and exits `1`.

An agent with the `eskais-mockup` skill ends every mockup task this way: it embeds every PNG in its reply with its `out-*.html` path, links the gallery and checks that the number of images equals the count `gallery` printed.
