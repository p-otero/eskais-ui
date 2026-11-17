import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ThemedImage } from "@/components/ui/themed-image"

import { A, Article, Code, DocTable, DocTitle, H2, H3, Ol, P, Pre, Ul } from "../docs/prose"
import htmlDark from "./mockups/html-dark.webp"
import htmlLight from "./mockups/html-light.webp"
import tsxDark from "./mockups/tsx-dark.webp"
import tsxLight from "./mockups/tsx-light.webp"

const commands = `# from your project, with a checkout of eskais-ui next to it
bun ../eskais-ui/packages/mockup/src/cli.ts inspect
bun ../eskais-ui/packages/mockup/src/cli.ts inspect Button Dialog Table
bun ../eskais-ui/packages/mockup/src/cli.ts validate api-keys
bun ../eskais-ui/packages/mockup/src/cli.ts build api-keys --scheme dark --out api-keys-dark.html
bun ../eskais-ui/packages/mockup/src/cli.ts clean api-keys`

const layout = `.mockups/
  .gitignore        # "*", written by build: mockups stay out of the repository
  wrapper.tsx       # optional, shared: ({ children }) => providers
  api-keys/
    screen.tsx      # default-exports the screen; data comes in as props
    fixtures.ts     # the types and a sample of the data
    manifest.json   # written by build: hashes, bundled components, size
    out.html        # written by build: one offline file`

const screen = `import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"

import { sampleKeys, type ApiKey } from "./fixtures"

export default function ApiKeys({ keys = sampleKeys }: { keys?: ApiKey[] }) {
  return (
    <main className="flex flex-col gap-section p-inset-surface font-sans">
      <PageHeader title="API keys" eyebrow="Workspace" actions={<Button>Create key</Button>} />
      {/* tabs, table, dialogs… */}
    </main>
  )
}`

const validateOutput = `.mockups/api-keys/screen.tsx:42:9 bare-control a bare <select> is invisible to agents and unstyled; use the project's own control part
.mockups/api-keys/screen.tsx:57:14 type TS2322: Type '{ children: string; tone: string; }' is not assignable to type 'IntrinsicAttributes & ButtonProps'.`

type Row = { metric: string; html: string; tsx: string; change: string }

const results: Row[] = [
  { metric: "Model calls", html: "93", tsx: "63", change: "−32%" },
  { metric: "Output tokens", html: "143k", tsx: "56.5k", change: "−60%" },
  { metric: "of which reasoning", html: "96.9k", tsx: "38.3k", change: "−60%" },
  { metric: "Uncached input tokens", html: "239k", tsx: "152k", change: "−36%" },
  { metric: "Cache read tokens", html: "13.9M", tsx: "5.84M", change: "−58%" },
  { metric: "Cost (API-equivalent)", html: "$0.163", tsx: "$0.074", change: "−55%" },
  { metric: "Wall time (approx.)", html: "~28 min", tsx: "~12 min", change: "−57%" },
  {
    metric: "Agent deliverable",
    html: "89.6 KB, 2,720 lines of HTML",
    tsx: "21 KB screen.tsx + 1.5 KB fixtures.ts",
    change: "",
  },
  { metric: "Built page", html: "90 KB", tsx: "887 KB (components and fonts inlined)", change: "" },
]

const shots = [
  {
    title: "A: hand-written HTML",
    light: htmlLight,
    dark: htmlDark,
    width: 1200,
    height: 640,
    alt: "The API keys screen written as one HTML file: an app bar, a page header with Create key, Active and Revoked tabs, and a table of four keys with scope badges and row menus.",
  },
  {
    title: "B: TSX with @eskais/mockup",
    light: tsxLight,
    dark: tsxDark,
    width: 1200,
    height: 458,
    alt: "The same API keys screen built from the project's own components: a page header with Create key, Active and Revoked tabs, and a card with a table of four keys, scope badges and row menus.",
  },
]

function ResultsTable() {
  return (
    <Table aria-label="Benchmark results: hand-written HTML against @eskais/mockup TSX" className="text-body-sm">
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Measure</TableHead>
          <TableHead scope="col">A: hand-written HTML</TableHead>
          <TableHead scope="col">B: @eskais/mockup TSX</TableHead>
          <TableHead scope="col">B vs A</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((row) => (
          <TableRow key={row.metric}>
            <TableHead scope="row" className="font-medium text-foreground">
              {row.metric}
            </TableHead>
            <TableCell className="tabular-nums">{row.html}</TableCell>
            <TableCell className="tabular-nums">{row.tsx}</TableCell>
            <TableCell className="tabular-nums">{row.change}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function Screenshots() {
  return (
    <div className="grid grid-cols-2 gap-group narrow:grid-cols-1">
      {shots.map((shot) => (
        <figure key={shot.title} className="flex min-w-0 flex-col gap-items">
          <ThemedImage
            src={shot.light}
            srcDark={shot.dark}
            alt={shot.alt}
            width={shot.width}
            height={shot.height}
            loading="lazy"
            className="h-auto w-full rounded-surface border bg-card"
          />
          <figcaption className="text-caption text-muted-foreground">{shot.title}</figcaption>
        </figure>
      ))}
    </div>
  )
}

export default function Mockups() {
  return (
    <Article>
      <DocTitle
        eyebrow="Getting started"
        title="Mockups"
        description="Sketch a screen as TSX with your project's own components and fixture data, then build it into one offline HTML file and check it."
      />

      <H2 id="what">What it is</H2>
      <P>
        <Code>@eskais/mockup</Code> is a command-line tool for proposals. An agent or a person writes one screen as a
        React component that uses the project's real Eskais UI components, with sample data in a fixtures file. The CLI
        bundles it with the project's own Tailwind stylesheet, React and aliases into a single HTML file that opens from
        disk with no network, and <Code>validate</Code> reports what to fix.
      </P>
      <Ul>
        <li>Use it to show a screen before building it: a design review, a "what would this look like", a variant.</li>
        <li>
          It is a proposal, not a feature: no routes, no data fetching, no tests. The <Code>screen.tsx</Code> is the
          deliverable; <Code>out.html</Code> is a build artifact.
        </li>
        <li>
          It works in any project with a <Code>components.json</Code>, a Tailwind stylesheet and a{" "}
          <Code>tsconfig.json</Code>, not only this registry.
        </li>
      </Ul>

      <H2 id="install">Install</H2>
      <P>
        The CLI runs with Bun 1.4 or newer and isn't published to npm yet: run <Code>src/cli.ts</Code> from a checkout
        of the <A href="https://github.com/p-otero/eskais-ui">eskais-ui repository</A>. It reads the project's{" "}
        <Code>components.json</Code>, its stylesheet and its tsconfig aliases from the current folder or the nearest one
        above it, and builds with the project's own Tailwind and React.
      </P>
      <P>
        For an agent, copy <Code>packages/mockup/skills/eskais-mockup</Code> into its skills folder. The skill holds the
        loop below and the rules a mockup follows.
      </P>
      <Pre code={commands} language="bash" />

      <H2 id="commands">Commands</H2>
      <DocTable
        label="Commands"
        head={["Command", "What it does"]}
        rows={[
          [
            <Code key="c">inspect</Code>,
            "Prints the project, its stylesheet, Tailwind and React versions, themes, providers in the app entry, whether a .mockups/wrapper.tsx exists, and the value exports of every file in the ui, components, lib and hooks aliases.",
          ],
          [
            <Code key="c">inspect Names…</Code>,
            "Prints each component's import line, its *Props type and its cva variants, about 200 tokens each: a cheaper read than the source.",
          ],
          [<Code key="c">build name</Code>, "Bundles .mockups/name/screen.tsx into out.html and writes manifest.json."],
          [
            <Code key="c">validate name</Code>,
            "Builds the page, then checks the page and the sources and prints every problem.",
          ],
          [<Code key="c">clean [name]</Code>, "Removes one mockup, or the whole .mockups folder without a name."],
        ]}
      />
      <DocTable
        label="Flags"
        head={["Flag", "Commands", "Effect"]}
        rows={[
          [<Code key="f">--json</Code>, "inspect", "Prints JSON instead of text."],
          [<Code key="f">--project dir</Code>, "all", "The project folder, when it isn't the current one."],
          [<Code key="f">--css file</Code>, "all", "The stylesheet, when components.json doesn't name one."],
          [<Code key="f">--max n</Code>, "build, validate", "How many problems to print (20 by default)."],
          [<Code key="f">--theme name</Code>, "build, validate", "Applies a theme, such as compact."],
          [
            <Code key="f">--scheme light|dark|system</Code>,
            "build, validate",
            "Fixes the colour scheme; system (the default) follows the viewer.",
          ],
          [<Code key="f">--out file</Code>, "build, validate", "Where to write the page instead of out.html."],
        ]}
      />
      <P>
        Exit codes: <Code>0</Code> fine, <Code>1</Code> problems to fix, <Code>2</Code> an environment or usage error,
        such as no <Code>components.json</Code> or an unknown flag.
      </P>

      <H2 id="files">The files</H2>
      <Pre code={layout} language="plaintext" />
      <Ul>
        <li>
          <Code>screen.tsx</Code> default-exports one component whose data comes in as props, defaulting to the
          fixtures. Presentational only: no fetching, no <Code>window</Code>, no router. Behaviour is React state.
        </li>
        <li>
          <Code>fixtures.ts</Code> types the data and exports a sample. Reuse the project's own types when they import
          through an alias.
        </li>
        <li>
          <Code>wrapper.tsx</Code> is optional and shared by every mockup: add it when a screen needs a provider the app
          entry installs.
        </li>
        <li>
          <Code>manifest.json</Code> records the date, theme and scheme, hashes of the screen and fixtures, the project
          components the page bundled and its size.
        </li>
      </Ul>
      <Pre code={screen} title=".mockups/api-keys/screen.tsx" />

      <H2 id="validate">What validate checks</H2>
      <Ol>
        <li>
          <strong>The page is one offline file:</strong> no external script, stylesheet, image, <Code>@import</Code> or{" "}
          <Code>url()</Code> that isn't inlined, no viewport height unit, and no React development build.
        </li>
        <li>
          <strong>No network:</strong> <Code>fetch</Code>, <Code>XMLHttpRequest</Code>, <Code>WebSocket</Code> or{" "}
          <Code>EventSource</Code> in the sources (<Code>no-network</Code>).
        </li>
        <li>
          <strong>No bare controls:</strong> a <Code>&lt;button&gt;</Code>, <Code>&lt;input&gt;</Code>,{" "}
          <Code>&lt;select&gt;</Code> or <Code>&lt;textarea&gt;</Code> instead of the project's own part (
          <Code>bare-control</Code>).
        </li>
        <li>
          <strong>The project's imports:</strong> an alias, a relative path or a package the project declares (
          <Code>import-specifier</Code>).
        </li>
        <li>
          <strong>Types:</strong> <Code>bun check</Code> on the screen with the project's tsconfig, so a prop a
          component doesn't take fails (<Code>type</Code>).
        </li>
        <li>
          <strong>A server render:</strong> the screen, inside the wrapper, renders without throwing (
          <Code>render</Code>).
        </li>
      </Ol>
      <P>
        Each problem is one line, <Code>file:line:col rule message</Code>, so an agent can fix it without opening the
        page. Never read <Code>out.html</Code> itself: it is about a megabyte of inlined JavaScript and CSS. Open it in
        a browser or the host's preview.
      </P>
      <Pre code={validateOutput} language="plaintext" />

      <H2 id="why">Why mockups in TSX</H2>
      <P>
        An agent asked for a mockup usually writes one HTML file. It looks right, but it re-implements the styles,
        dialogs, menus and keyboard handling by hand, and nothing of it survives into the real screen. We measured the
        difference on one screen.
      </P>

      <H3 id="method">Method</H3>
      <Ul>
        <li>
          The same model on both sides, DeepSeek V4.1 Flash with maximum thinking, the same brief and fresh threads.
          Neither side had built the screen before.
        </li>
        <li>
          The screen, "API keys": a page header with an action; Active and Revoked tabs with counts; a six-column table
          with scope badges and a row menu; a create-key dialog with a required name, scope checkboxes, an expiry select
          and a show-once key with Copy; a revoke confirmation that moves rows between tabs; an empty state; light and
          dark from <Code>prefers-color-scheme</Code>.
        </li>
        <li>A wrote one hand-written HTML file. B wrote a TSX mockup and built it with this CLI.</li>
        <li>Both covered the whole brief with no console errors.</li>
        <li>
          The numbers were measured from the provider's usage logs, not reported by the agents. Cost is what the tokens
          would cost at API prices.
        </li>
      </Ul>

      <H3 id="results">Results</H3>
      <ResultsTable />

      <H3 id="screenshots">The two screens</H3>
      <P>Both screenshots follow the site's light or dark theme.</P>
      <Screenshots />

      <H3 id="takeaways">What changed</H3>
      <Ul>
        <li>
          B needed one <Code>validate</Code> run: the problems came back as lines to fix, not as screenshots to read.
        </li>
        <li>
          B's 21 KB of TSX uses the project's real components and can be the start of the real screen. A's 2,720 lines
          of HTML are thrown away and re-implement dialogs, menus, focus and keyboard handling by hand.
        </li>
        <li>
          The built page is bigger for B (887 KB against 90 KB) because the components, React and fonts are inlined.
          Nobody reads it; it opens offline.
        </li>
      </Ul>
      <Alert tone="warning">
        <AlertTitle>One screen, one run</AlertTitle>
        <AlertDescription>
          This is n=1: one screen, one model, one run per side. The direction is clear, but repeat it with more screens
          and models before treating the numbers as firm. The raw numbers and how to repeat the experiment are in{" "}
          <A href="https://github.com/p-otero/eskais-ui/blob/main/packages/mockup/BENCHMARKS.md">BENCHMARKS.md</A>.
        </AlertDescription>
      </Alert>
    </Article>
  )
}
