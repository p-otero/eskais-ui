import { A, Article, Code, DocTable, DocTitle, H2, P, Pre, Ul } from "../docs/prose"

const perfCode = `bun run perf                       # every scenario, normal and React Compiler builds, 1× and 4× CPU
bun run perf --only=list-1k,table --cpu=1 --skip=held,overlays,mount,site,bundle
bun run perf:ci                    # the budgets CI holds, in about a minute`

const abCode = `bun run perf --builds=normal@before --only=table --skip=overlays,mount,site,bundle
# change the code
bun run perf --builds=normal@after --only=table --skip=overlays,mount,site,bundle
bun run perf --no-build --builds=normal@before,normal@after --repeat=3 --only=table \\
  --skip=overlays,mount,site,bundle --name=ab`

const lazyCode = `const MarkdownEditor = lazy(() =>
  import("@/components/ui/markdown-editor").then((m) => ({ default: m.MarkdownEditor })),
)`

export default function Performance() {
  return (
    <Article>
      <DocTitle
        eyebrow="Getting started"
        title="Performance"
        description="What each key press may cost, how Eskais measures it in Chrome, and how to measure your own screens."
      />

      <P>
        Eskais is built for keyboard-heavy applications: moving through a list, a table or a board, opening a palette,
        following a link. Each of those is measured in Chrome on a production build, at full speed and with the CPU
        slowed four times, and the counts that don't depend on the machine are held in CI.
      </P>

      <H2 id="budgets">What a key press may cost</H2>
      <P>
        These are exact counts: components React renders per key press (the most any of 20 presses caused) and forced
        layouts (style or layout the browser had to compute inside script) per press. A pull request that raises one
        fails until it fits or says why the budget moved.
      </P>
      <DocTable
        label="Per key press budgets"
        head={["Scenario", "Renders", "Forced layouts"]}
        rows={[
          ["List, 1,000 rows, j/k", "10 (the two rows that change)", "2.05"],
          ["List, 10,000 rows, virtualized", "36", "2.7"],
          ["DataTable, 1,000 rows, ↓/↑", "95", "3.4"],
          [<Code key="c">DataTable navigation="cells"</Code>, "4 (two cells)", "2.2"],
          ["Board, 200 cards, arrows and j/k", "4 (two cards' primary parts)", "4.85"],
          ["Dropdown menu, sidebar, Shell sidebar, explorer", "0", "1–3"],
          ["Command palette, 300 commands, ↓", "6 (the row that scrolls in)", "1"],
          ["Calendar, arrows within a month", "2", "2.85"],
        ]}
      />
      <P>
        A move renders the same with 10,000 rows as with 1,000: roving focus tells only the item losing focus and the
        item taking it. The board holds 16 composited layers at rest (26 in the glass theme), and every registry item
        has a gzip budget, today's size plus 5%: <Code>link</Code> 25.5 KB, <Code>list-item</Code> 77.6 KB,{" "}
        <Code>data-table</Code> 82.8 KB, <Code>markdown-editor</Code> 246.6 KB with CodeMirror, React excluded and UI
        SDK included.
      </P>

      <H2 id="times">Measured times</H2>
      <P>
        Key to next paint: from the key press to the first frame painted after it, at the 95th percentile, on a desktop
        CPU. A frame is 16 ms at 60 Hz.
      </P>
      <DocTable
        label="Measured times"
        head={["Scenario", "1×", "4× CPU slowdown"]}
        rows={[
          ["List, 1,000 rows, j/k", "8.5 ms", "25 ms"],
          ["List, 10,000 rows, j/k", "10.3 ms", "17 ms"],
          ["DataTable, 1,000 rows, ↓", "12.1 ms", "23 ms"],
          ["Board, arrows", "11.5 ms", "32 ms"],
          ["Command palette, open to first frame", "26 ms", "141 ms"],
          ["Docs site, link press to page painted, after a 150 ms hover", "19 ms", "—"],
        ]}
      />
      <P>
        Times vary by machine and from run to run, so CI holds counts, and times are compared with interleaved runs of
        the two versions on one machine. The full method and every result are in the repository's{" "}
        <Code>docs/perf/REPORT.md</Code>.
      </P>

      <H2 id="harness">The harness</H2>
      <P>
        In the Eskais repository, <Code>bun run perf</Code> drives system Chrome through Playwright and the DevTools
        protocol over fixtures of every hot path (lists, tables, the board, palettes, menus, tabs, typing, Shell,
        MasterDetail, DocumentWorkspace, server data), the overlays, mount, site navigation and bundle sizes. It prints
        tables and writes a JSON file with every press.
      </P>
      <Pre code={perfCode} />
      <P>To compare a change, build both versions under names and run them interleaved:</P>
      <Pre code={abCode} />
      <Ul>
        <li>Read the counts first: renders per press and forced layouts are exact, so a change in them is real.</li>
        <li>Then the p50 and p95 key to next paint, and the dropped frames of a held key at 4×.</li>
        <li>
          Repeat 4× runs (<Code>--repeat=3</Code>): one run at 4× can move by half. Run nothing else while measuring.
        </li>
      </Ul>

      <H2 id="load">Load and layout shift</H2>
      <P>
        <Code>bun run perf:vitals</Code> loads pages cold on a slow 4G profile and reports TTFB, FCP, LCP, CLS and INP,
        with the elements each layout shift moved; perf:ci holds CLS at 0.01 or less on the blocks and the server-data
        components. What keeps them there:
      </P>
      <Ul>
        <li>
          Images have a size: <Code>width</Code> and <Code>height</Code>, an <Code>aspect-*</Code> box, or in Markdown
          the size after a <Code>|</Code> in the alt text (<Code>A chart|640x360</Code>) or{" "}
          <Code>MarkdownView imageSize</Code>.
        </li>
        <li>
          Loading states keep the size of what replaces them: DataTable placeholder rows are one text line high, and
          ServerDataTable and ServerList show enough placeholders to push their footer out of view, as the first page
          will.
        </li>
        <li>
          What sits below lazily loaded content goes in the same <Code>Suspense</Code> boundary, so it appears with it.
        </li>
        <li>
          <Code>content-visibility: auto</Code> didn't pay on Eskais's lists, settings, dashboards or docs, and broke
          scrolling to a heading in a long MarkdownView; measure before you reach for it.
        </li>
      </Ul>

      <H2 id="your-app">Measuring your own screens</H2>
      <Ul>
        <li>Measure a production build: a development build is several times slower and changes what is slow.</li>
        <li>
          React DevTools' Profiler shows which components rendered for one key press and why. A row that renders when
          another row changes has an unstable prop or callback: keep <Code>getKey</Code>, <Code>renderItem</Code> and
          handlers stable.
        </li>
        <li>
          Chrome's Performance panel, with the CPU slowed four times, shows long tasks, forced layouts (purple inside a
          script) and Interaction to Next Paint for each press.
        </li>
        <li>
          Load the heaviest items where they show, with <Code>lazy()</Code> at the route, and start the import on
          intent: <Code>onIntent</Code> on <Code>Link</Code> runs on a 65 ms hover, focus or a mouse press (see{" "}
          <A to="/docs/keyboard">Keyboard and long lists</A>).
        </li>
      </Ul>
      <Pre code={lazyCode} />
      <P>
        The <A to="/docs/agent-skills">eskais-perf skill</A> gives a coding agent the same checks, the budgets above and
        the patterns that keep a screen within them.
      </P>
    </Article>
  )
}
