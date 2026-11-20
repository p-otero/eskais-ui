import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { A, Article, Code, DocTable, DocTitle, H2, H3, Ol, P, Pre, Ul } from "../docs/prose"
import { releaseTag, skillsCliVersion } from "../registry"
import {
  agentPrompt,
  checkoutCommands,
  galleryOutput,
  helloOutput,
  helloScreen,
  inspectRegistry,
  inspectSdk,
  installCommands,
  layout,
  levelFive,
  levelFour,
  levelOne,
  levelThree,
  levelTwo,
  presentCommands,
  presentReply,
  quickstart,
  screen,
  validateOk,
  validateProblems,
} from "./mockups/snippets"
import { ResultsTable, Screenshots } from "./mockups/benchmark"

export default function Mockups() {
  return (
    <Article>
      <DocTitle
        eyebrow="Get started"
        title="Mockups"
        description="Sketch a screen as TSX with your project's own components and fixture data, then build it into one offline HTML file and check it."
      />

      <H2 id="quickstart">Quickstart</H2>
      <P>
        From an empty folder to a validated <Code>out.html</Code>: four commands and one file. You need Node with npx
        and <A href="https://bun.sh">Bun</A> 1.4 or newer.
      </P>
      <Pre code={quickstart} language="bash" />
      <Ol>
        <li>Create a Vite app with Tailwind and a components.json, without prompts.</li>
        <li>
          Add the <Code>@eskais</Code> registry to <Code>components.json</Code>.
        </li>
        <li>
          Install the theme, two components and the mockup CLI, which lands in <Code>.agents/tools/eskais-mockup</Code>{" "}
          (see <A to="/docs/mockups#install">Install</A>). <Code>--overwrite</Code> replaces the <Code>button.tsx</Code>{" "}
          and <Code>utils.ts</Code> that <Code>shadcn init</Code> wrote, and <Code>-y</Code> accepts the new theme.
        </li>
        <li>
          Write the screen, put <Code>@layer ui-sdk;</Code> on the first line of <Code>src/index.css</Code> (see{" "}
          <A to="/docs/installation#stylesheet">Installation</A>), and validate.
        </li>
      </Ol>
      <Pre code={helloScreen} title=".mockups/hello/screen.tsx" />
      <P>
        <Code>validate</Code> builds the page and prints where it wrote it; open that file in a browser. In an existing
        project with a <Code>components.json</Code>, skip straight to the last step.
      </P>
      <Pre code={helloOutput} language="plaintext" />

      <H2 id="agents">For agents</H2>
      <P>
        An agent follows the same loop with the <Code>eskais-mockup</Code> skill. Install it into the project (see{" "}
        <A to="/docs/agent-skills">Agent skills</A> for pointing your agent at it):
      </P>
      <Pre
        code={`npx skills@${skillsCliVersion} add p-otero/eskais-ui@${releaseTag} --full-depth --skill eskais-mockup -a universal -y`}
        language="bash"
      />
      <P>Then ask for a screen in plain words:</P>
      <Pre code={agentPrompt} language="plaintext" title="Prompt" />
      <Ol>
        <li>
          The agent runs <Code>inspect</Code> to learn the project's components instead of reading their sources, and{" "}
          <Code>inspect --registry</Code> or <Code>--sdk</Code> when a part is missing.
        </li>
        <li>
          It writes <Code>screen.tsx</Code>, <Code>fixtures.ts</Code> and, when needed, <Code>parts/</Code> and{" "}
          <Code>gaps.ts</Code>, walking the <A to="/docs/mockups#levels">five levels</A> in order.
        </li>
        <li>
          It runs <Code>validate</Code> until it prints <Code>ok</Code>, fixing each <Code>file:line:col</Code> line.
        </li>
        <li>
          It builds a page per state and theme, captures each as a PNG (it never reads the HTML) and runs{" "}
          <Code>gallery</Code>.
        </li>
        <li>
          It <A to="/docs/mockups#present">presents every screen</A>: each screenshot as an image in its reply, with its{" "}
          <Code>out-*.html</Code> path, a link to the gallery and a count that matches the one <Code>gallery</Code>{" "}
          printed. Then it reports the summary: what to install, the parts it proposes, the UI SDK parts it used and
          why, and the gaps.
        </li>
      </Ol>
      <P>
        The skill runs the CLI from <Code>.agents/tools/eskais-mockup</Code>, and installs it with shadcn when it's
        missing. Every rule it follows is on this page.
      </P>

      <H2 id="install">Install</H2>
      <P>
        The CLI is a registry item, <Code>eskais-mockup-cli</Code>: shadcn copies its source into{" "}
        <Code>.agents/tools/eskais-mockup</Code> and Bun 1.4 or newer runs it from there. It has no npm dependencies and
        needs no install step. It reads your project's <Code>components.json</Code>, its stylesheet and its tsconfig
        aliases from the current folder or the nearest one above it, and builds with the project's own Tailwind and
        React, so the project can use npm, pnpm or Bun.
      </P>
      <Pre code={installCommands} language="bash" />
      <P>
        <Code>--version</Code> prints the release it came from. Update it with the registry, like a component:{" "}
        <Code>npx shadcn@latest add @eskais/eskais-mockup-cli --overwrite</Code>. The folder starts with a dot, so
        TypeScript's <Code>include</Code> globs leave it out of the app's type-check and build; a linter that walks
        every file still reads it, and it passes Vite's ESLint config and <Code>lint-rules</Code>. It needs a TypeScript
        project (<Code>tsx: true</Code> in <Code>components.json</Code>): in a JavaScript one shadcn renames the files
        to <Code>.js</Code>, and Bun can't run them.
      </P>
      <H3 id="install-checkout">From a checkout</H3>
      <P>
        Working on eskais-ui itself, run the same CLI from the repository's <Code>packages/mockup/src</Code>, by path or
        linked with Bun. <Code>bun link @eskais/mockup</Code> leaves <Code>package.json</Code> alone, but the next{" "}
        <Code>npm install</Code> or <Code>pnpm install</Code> removes the link; <Code>bun unlink</Code> in the checkout
        unregisters it.
      </P>
      <Pre code={checkoutCommands} language="bash" />

      <H2 id="levels">The five levels</H2>
      <P>
        Each part of a screen comes from the first level that can express it, and no level is skipped. The levels keep a
        mockup honest: it shows what the project can build today, and records what it can't.
      </P>
      <H3 id="level-1">1. The project's components</H3>
      <P>
        Whatever the project has, its own or installed from a registry, through its aliases. <Code>inspect</Code> lists
        them and <Code>inspect Button Card</Code> prints each one's import line, props and variants.
      </P>
      <Pre code={levelOne} />
      <H3 id="level-2">2. Registry items the project hasn't installed</H3>
      <P>
        Import an Eskais item as <Code>@registry/&lt;name&gt;</Code>. <Code>build</Code> fetches it and its{" "}
        <Code>registryDependencies</Code> from the registry URL in <Code>components.json</Code> into{" "}
        <Code>.mockups/.registry/&lt;ref&gt;/</Code> (the commit pinned in the URL, or a hash of the URL), compiles them
        into the page and records the install command in <Code>manifest.install</Code>. Only <Code>inspect</Code> and{" "}
        <Code>build</Code> use the network; the page stays offline.
      </P>
      <Pre code={levelTwo} />
      <Pre code={inspectRegistry} language="plaintext" title="inspect --registry" />
      <H3 id="level-3">3. A composition in parts/</H3>
      <P>
        A component the screen proposes, built from levels 1 and 2 in <Code>.mockups/&lt;name&gt;/parts/</Code>. Each
        one with a <Code>&lt;Name&gt;Props</Code> type is recorded in <Code>manifest.proposed</Code> with its props.
      </P>
      <Pre code={levelThree} />
      <H3 id="level-4">4. UI SDK primitives, with a reason</H3>
      <P>
        Only for behaviour Eskais has no part for. Import from a public <Code>@ui-sdk/react/&lt;subpath&gt;</Code>,
        style it only with the project's tokens, <Code>cn</Code>/<Code>cva</Code> and visual parts, and say why on a{" "}
        <Code>{"// sdk-reason:"}</Code> line. It's recorded in <Code>manifest.sdkParts</Code>; a part without the line
        fails <Code>validate</Code>, and a primitive that duplicates an installed part (a dialog, a select) is a
        warning.
      </P>
      <Pre code={levelFour} />
      <Pre code={inspectSdk} language="plaintext" title="inspect --sdk" />
      <H3 id="level-5">5. A recorded gap, never a raw control</H3>
      <P>
        No bare <Code>&lt;button&gt;</Code>, <Code>&lt;input&gt;</Code>, <Code>&lt;select&gt;</Code> or{" "}
        <Code>&lt;textarea&gt;</Code>. When no level reaches the design, leave that part out and record it in{" "}
        <Code>gaps.ts</Code>, so a review sees what the screen would cost.
      </P>
      <Pre code={levelFive} language="ts" />

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
          [
            <Code key="c">inspect --registry</Code>,
            "Lists the items of each registry in components.json that the project hasn't installed, with one-line descriptions, and caches the registry index under .mockups/.registry.",
          ],
          [
            <Code key="c">inspect --sdk [name…]</Code>,
            "Without a name, lists the public @ui-sdk/react subpaths the project installs and their parts. With names, prints each primitive's import line and parts.",
          ],
          [
            <Code key="c">build name</Code>,
            "Bundles .mockups/name/screen.tsx into out.html, fetching @registry/ items first, and writes manifest.json.",
          ],
          [
            <Code key="c">validate name</Code>,
            "Builds the page, checks the page and the sources, prints every problem and then the install, proposed, sdkParts, gaps and screenshots summary.",
          ],
          [
            <Code key="c">gallery [dir]</Code>,
            "Writes dir/gallery.html (.mockups by default) with every out-*.png screenshot, grouped by screen, state and theme and linked to its page, then lists them and prints the total. Exits 1 when there are none.",
          ],
          [<Code key="c">clean [name]</Code>, "Removes one mockup, or the whole .mockups folder without a name."],
        ]}
      />
      <DocTable
        label="Flags"
        head={["Flag", "Commands", "Effect"]}
        rows={[
          [<Code key="f">--registry</Code>, "inspect", "Lists the registry items the project hasn't installed."],
          [<Code key="f">--sdk</Code>, "inspect", "Lists the installed UI SDK subpaths, or details the named ones."],
          [<Code key="f">--json</Code>, "inspect, gallery", "Prints JSON instead of text."],
          [
            <Code key="f">--gallery</Code>,
            "build, validate",
            "Writes .mockups/gallery.html after a passing run and prints its path and count last.",
          ],
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
        such as no <Code>components.json</Code>, an unknown flag, an unreachable registry, or a fetched item whose npm
        packages the project doesn't declare.
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
          <Code>parts/</Code> and <Code>gaps.ts</Code> are levels 3 to 5. <Code>wrapper.tsx</Code> is optional and
          shared by every mockup: add it when a screen needs a provider the app entry installs.
        </li>
        <li>
          <Code>manifest.json</Code> records the date, theme and scheme, hashes of the screen and fixtures, the project
          components the page bundled, <Code>install</Code>, <Code>proposed</Code>, <Code>sdkParts</Code>,{" "}
          <Code>gaps</Code> and the size.
        </li>
      </Ul>
      <Pre code={screen} title=".mockups/team/screen.tsx" />

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
          <strong>The project's imports:</strong> an alias, a relative path, <Code>@registry/</Code> or a package the
          project declares (<Code>import-specifier</Code>); UI SDK only from its public subpaths (
          <Code>sdk-subpath</Code>).
        </li>
        <li>
          <strong>Parts:</strong> theme tokens and the Tailwind scale in <Code>parts/</Code>, no raw colours or
          arbitrary sizes (<Code>shadcn/no-raw-colors</Code>, <Code>shadcn/no-arbitrary-values</Code>), and a{" "}
          <Code>{"// sdk-reason:"}</Code> line in a part that uses a UI SDK primitive (<Code>sdk-reason</Code>).
        </li>
        <li>
          <strong>Types:</strong> <Code>bun check</Code> on the mockup with the project's tsconfig, so a prop a
          component doesn't take fails (<Code>type</Code>). When the root <Code>tsconfig.json</Code> only lists{" "}
          <Code>references</Code>, as Vite's template does, it uses the referenced config that sets <Code>jsx</Code>.
        </li>
        <li>
          <strong>A server render:</strong> the screen, inside the wrapper, renders without throwing (
          <Code>render</Code>).
        </li>
      </Ol>
      <P>
        Each problem is one line, <Code>file:line:col rule message</Code>, so an agent can fix it without opening the
        page. After the problems, five lines summarize what the screen needs: the items to install, the parts it
        proposes, the UI SDK primitives it used, the gaps and how many screenshots sit beside its pages. Both runs below
        are real, on the Team screen above in the quickstart's app:
      </P>
      <Pre code={validateOk} language="plaintext" title="A screen that passes" />
      <Pre code={validateProblems} language="plaintext" title="A copy with four problems" />
      <P>
        Never read <Code>out.html</Code> itself: it is hundreds of kilobytes of inlined JavaScript and CSS. Open it in a
        browser or the host's preview.
      </P>

      <H2 id="present">Present every screen</H2>
      <P>
        A mockup is for looking at, so it isn't done until the person has seen every screen in every state and theme.
        Build one page per state and theme, named <Code>out-&lt;state&gt;-&lt;theme&gt;.html</Code> in the mockup's
        folder (the theme is the last segment: <Code>light</Code>, <Code>dark</Code>, <Code>system</Code> or a theme
        name such as <Code>compact</Code>), and capture each as a PNG with the same name beside it, with any browser.
        Then run <Code>gallery</Code>:
      </P>
      <Pre code={presentCommands} language="bash" />
      <Pre code={galleryOutput} language="plaintext" title="gallery" />
      <P>
        <Code>gallery.html</Code> groups the screenshots by screen, then state, then theme, under headings, with alt
        text such as <Code>team, empty state, dark theme</Code> and each image linked to its page. It is one file with
        relative paths, lazy-loaded images, no script and no network: it opens from <Code>file://</Code>, and the{" "}
        <Code>.mockups</Code> folder can be zipped and shared. With no screenshots, <Code>gallery</Code> writes nothing,
        says so and exits <Code>1</Code>; a page with no PNG is named so it can be captured.
      </P>
      <P>
        An agent with the <Code>eskais-mockup</Code> skill finishes every mockup task this way. It embeds every PNG in
        its reply with its <Code>out-*.html</Code> path, links the gallery and checks that the number of images equals
        the count <Code>gallery</Code> printed. It never only lists or describes a screen the person hasn't seen, and a
        coordinator relaying a worker's mockups keeps the images too.
      </P>
      <Pre code={presentReply} language="md" title="The agent's reply" />

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
