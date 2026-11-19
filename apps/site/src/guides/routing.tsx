import { A, Article, Code, DocTable, DocTitle, H2, P, Pre, Ul } from "../docs/prose"

const adapters = `import { createUrlParam } from "@/lib/url-param"
import { hashRouter } from "@/lib/url-router"

// #/devices?device=a1: the route stays /devices, only its query changes.
const device = createUrlParam("device", { router: hashRouter() })

<MasterDetail label="Devices" url={device} … />`

const ownRouter = `import type { UrlRouter } from "@/lib/url-router"

// Your router's own API, so it never sees a URL it didn't write.
const appRouter: UrlRouter = {
  read: () => ({ path: router.current.path, params: new URLSearchParams(router.current.query) }),
  navigate: (to, { replace }) => router.go(to.path, Object.fromEntries(to.params), { replace }),
  href: (to) => router.href(to.path, Object.fromEntries(to.params)),
  subscribe: (listener) => router.onChange(listener),
}

const device = createUrlParam("device", { router: appRouter })
const tasks = routerUrlState(appRouter) // for ServerDataTable urlState`

const controlled = `// The route is #/devices/<id>: the app owns it, the block follows it.
const id = useRoute().params.id ?? null

<MasterDetail
  label="Devices"
  selectedId={id}
  onSelectedIdChange={(next) => navigate(next === null ? "/devices" : \`/devices/\${next}\`)}
  …
/>`

export default function Routing() {
  return (
    <Article>
      <DocTitle
        eyebrow="Getting started"
        title="Routing and the URL"
        description="Blocks that keep state in the URL go through a small router adapter, so a hash router keeps its route and an app with its own route contract keeps control."
      />

      <H2 id="adapter">The router adapter</H2>
      <P>
        <Code>MasterDetail url</Code>, <Code>SettingsPage url</Code> and <Code>ServerDataTable urlState</Code> never
        assume a router. They take an adapter, and the adapters can go through a <Code>UrlRouter</Code> from{" "}
        <A to="/docs/components/url-router">url-router</A>: four functions over the app&apos;s location.
      </P>
      <DocTable
        label="UrlRouter"
        head={["Member", "What it does"]}
        rows={[
          [<Code key="m">read()</Code>, "The location now: { path, params }."],
          [<Code key="m">navigate(to, {"{ replace }"})</Code>, "Goes there, adding a history entry unless replace."],
          [<Code key="m">href(to)</Code>, "The href of a location, for a link that opens in a new tab."],
          [
            <Code key="m">subscribe(listener)</Code>,
            "Calls listener when the location may have changed; returns the unsubscribe.",
          ],
        ]}
      />
      <DocTable
        label="Built-in routers"
        head={["Router", "Location", "Use it with"]}
        rows={[
          [
            <Code key="r">hashRouter()</Code>,
            <Code key="l">#/devices?device=a1</Code>,
            "A router that reads location.hash: the path stays, the query changes, hrefs are #/path?query.",
          ],
          [
            <Code key="r">historyRouter()</Code>,
            <Code key="l">/devices?device=a1</Code>,
            "A router that reads the path and query string; the hash is kept on writes.",
          ],
          [
            <Code key="r">memoryRouter(initial)</Code>,
            <Code key="l">/devices?device=a1</Code>,
            "Tests and server rendering; it records entries.",
          ],
        ]}
      />
      <Pre code={adapters} />
      <P>
        <Code>createUrlParam</Code> ships in the <Code>url-param</Code> item, which <Code>master-detail</Code> and{" "}
        <Code>settings-page</Code> install. Without <Code>router</Code>, <Code>createUrlParam(name)</Code> keeps its old
        behaviour: the value in <Code>location.search</Code> (or <Code>{'{ in: "hash" }'}</Code> for a hash route&apos;s
        query).
      </P>

      <H2 id="own-router">Your router&apos;s own API</H2>
      <P>
        When the app&apos;s router rewrites URLs it didn&apos;t write, or a query on every route is unwelcome, wrap the
        router in the same shape. The blocks then navigate through it, and its links, guards and scroll handling stay in
        charge.
      </P>
      <Pre code={ownRouter} />

      <H2 id="settings">Settings section links</H2>
      <P>
        A <Code>SettingsPage</Code> navigation entry is a link, so it can open in a new tab. Its href comes from the{" "}
        <Code>url</Code> adapter: through <Code>hashRouter()</Code> it is <Code>#/settings?section=security</Code>,
        which fast links follow as a hash route on press and a new tab opens on the same route. Without <Code>url</Code>{" "}
        it is <Code>#security</Code>, an in-page anchor that stays native. <Code>getHref</Code> overrides both, and{" "}
        <Code>navigation="buttons"</Code> renders buttons that only scroll, for sections that have no address of their
        own.
      </P>
      <Pre
        code={`<SettingsPage url={createUrlParam("section", { router: hashRouter() })}>…</SettingsPage>
<SettingsPage navigation="buttons">…</SettingsPage>`}
      />

      <H2 id="controlled">Controlled selection</H2>
      <P>
        A route contract of the app&apos;s own, like a path segment per item, is not a query param. Skip the adapter and
        control the block from the route:
      </P>
      <Pre code={controlled} />
      <Ul>
        <li>
          <Code>MasterDetail selectedId onSelectedIdChange</Code>: the route opens the item; a press, Close, Back or an
          agent calls back, and <Code>details.cancel()</Code> refuses.
        </li>
        <li>
          <Code>SettingsPage currentSection onSectionChange</Code>: the same for the section being read.
        </li>
      </Ul>
    </Article>
  )
}
