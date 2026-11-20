import { Code, H2, P, Pre, Ul } from "../../docs/prose"

import { networkCode, patchCode, refetchCode } from "./snippets"

/** The guide's sections on `usePatchSource` and the refetch triggers. */
export function PatchAndRefetch() {
  return (
    <>
      <H2 id="patch">Writing a change the app learned of elsewhere</H2>
      <P>
        When the server tells the app what changed outside a mutation (a push event, a socket message, another request's
        answer), <Code>usePatchSource(source)</Code> returns <Code>patch(changes, options)</Code>, which writes it into
        every cached query under the key, mounted or not, without a request. <Code>changes.items(rows)</Code> maps the
        rows of each page and infinite list (totals stay), and <Code>changes.resource(current, queryKey)</Code> each
        other query, <Code>undefined</Code> leaving one alone.{" "}
        <Code>patchSource(client, source, changes, options)</Code> does the same outside React.
      </P>
      <Pre code={patchCode} />
      <Ul>
        <li>
          A read in flight under the key left before the change and could answer with the data from before it. So each
          read whose query the patch writes, and each first read (no data yet, so nothing to patch), is cancelled
          silently and started again in the same batch, with or without <Code>refetch</Code>: the number of requests
          stays the same, nothing is left pending, and the old request's answer or <Code>AbortError</Code> is dropped. A
          read of a query the patch leaves alone goes on.
        </li>
        <li>
          <Code>{"{ refetch: true }"}</Code> reloads the whole key afterwards, as <Code>useInvalidateSource</Code> does,
          and the promise resolves once the shown queries have reloaded (<Code>throwOnError</Code> rejects on a failed
          reload). By default nothing new is requested and the patched queries count as fresh.
        </li>
        <li>
          A patch is what the server holds now. For a change the server hasn't confirmed yet, use{" "}
          <Code>useSourceMutation</Code>'s <Code>optimistic</Code>, which rolls back on failure.
        </li>
      </Ul>

      <H2 id="refetch">Reloading on focus, reconnect and mount</H2>
      <P>
        <Code>refetchOnWindowFocus</Code>, <Code>refetchOnReconnect</Code> and <Code>refetchOnMount</Code> decide when a
        query reloads on its own: <Code>true</Code> when it is stale, <Code>"always"</Code> even when it is fresh,{" "}
        <Code>false</Code> never. <Code>createDataClient</Code> sets the app's defaults (no reload on focus; a stale
        query reloads on mount, and on reconnect unless <Code>networkMode</Code> is <Code>"always"</Code>, as in
        TanStack), and <Code>useServerQuery</Code>, <Code>defineResource</Code>, <Code>useServerResource</Code>,{" "}
        <Code>useServerPage</Code>, <Code>useServerInfinite</Code> and <Code>useServerTotal</Code> take their own. On{" "}
        <Code>useServerResource</Code> the call's option wins over the definition's, and a page's total follows its
        page.
      </P>
      <Pre code={refetchCode} />
      <P>
        Never reload a resource whose reads overwrite per-item ETags (or versions) that a later write sends back: a read
        on focus or reconnect while a person edits a row hands them the ETag of a version they never saw, and the save
        that should have failed with a conflict overwrites it. Set <Code>refetchOnWindowFocus: false</Code> and{" "}
        <Code>refetchOnReconnect: false</Code> on its <Code>defineResource</Code>, since TanStack reloads a query when
        any hook that reads it asks to, and write each save's answer with <Code>settle</Code> or <Code>patch</Code>.
      </P>
    </>
  )
}

/** The guide's section on `networkMode`. */
export function NetworkMode() {
  return (
    <>
      <H2 id="network-mode">Offline and network mode</H2>
      <P>
        TanStack Query's default <Code>networkMode</Code>, <Code>"online"</Code>, pauses every read and write after the
        browser fires <Code>offline</Code>, until it fires <Code>online</Code>: a read stays pending, never reaching its
        error state, and a write waits. When the backend is local (Electron IPC, a server on localhost) or the app shows
        its own offline UI, use <Code>"always"</Code>, on <Code>createDataClient</Code> for every query and mutation or
        on one hook: <Code>useServerQuery</Code>, <Code>defineResource</Code> and <Code>useServerResource</Code>,{" "}
        <Code>useServerPage</Code>, <Code>useServerInfinite</Code>, <Code>useServerTotal</Code> and{" "}
        <Code>useSourceMutation</Code> take <Code>networkMode</Code>. <Code>"offlineFirst"</Code> runs the first attempt
        and pauses only the retries, for a service worker cache. With <Code>"always"</Code>, a stale query no longer
        reloads when the browser comes back online, as in TanStack; <Code>refetchOnReconnect: true</Code> keeps it.
      </P>
      <Pre code={networkCode} />
    </>
  )
}
