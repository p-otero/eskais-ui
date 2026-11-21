import { Code, H2, P, Pre, Ul } from "../../docs/prose"

import { holdCode, networkCode, patchCode, refetchCode } from "./snippets"

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
          <Code>{'{ inFlight: "cancel" }'}</Code> cancels the read of each query the patch writes instead of starting it
          again: the query keeps the patch and stops fetching, as after a mutation's <Code>settle</Code>, with no
          mutation. The read's late answer is dropped and nothing shows an error. A first read the patch writes nothing
          into still starts again, since its query would otherwise stay pending. <Code>"restart"</Code> is the default.
        </li>
        <li>
          <Code>{"{ awaitRestarted: true }"}</Code> resolves once every read the patch started again has settled,
          following each query through later restarts (another patch, an invalidation) to its latest read, and starts no
          read of its own. With <Code>throwOnError</Code> it rejects with the first failure, after retries; an aborted
          read never counts, and a later <Code>{'inFlight: "cancel"'}</Code> patch settles it with the data it wrote. It
          is the way to know a restarted read failed without the extra read <Code>refetch</Code> makes, for a resource
          whose every read overwrites per-item ETags. Awaiting the query's <Code>promise</Code> instead rejects with a
          silent <Code>CancelledError</Code> whenever another write restarts the read.
        </li>
        <li>
          <Code>{"{ refetch: true }"}</Code> reloads the whole key afterwards, as <Code>useInvalidateSource</Code> does,
          and the promise resolves once the shown queries have reloaded (<Code>throwOnError</Code> rejects on a failed
          reload). That reload restarts every read in flight under the key, so the patch leaves the restart to it rather
          than sending a request that is aborted at once. By default nothing new is requested and the patched queries
          count as fresh.
        </li>
        <li>
          The call resolves with what it did, as lists of query keys in the cache's order: <Code>written</Code>, the
          queries it wrote; <Code>cancelled</Code>, those whose read it stopped (<Code>{'inFlight: "cancel"'}</Code>);{" "}
          <Code>restarted</Code>, those whose read it started again (a written query's under <Code>"restart"</Code>, a
          first read it left empty, which restarts under <Code>"cancel"</Code> too, and with <Code>refetch</Code> every
          read that was in flight under the key); and <Code>refetched</Code>, those the <Code>refetch</Code> reload read
          that weren't reading. A cancelled query that is shown is read again by <Code>refetch</Code>, so it is in both.
          A read ran again when <Code>restarted</Code> or <Code>refetched</Code> isn't empty.{" "}
          <Code>awaitRestarted</Code> waits for exactly the <Code>restarted</Code> reads. A caller that ignores the
          result works as before.
        </li>
        <li>
          A patch is what the server holds now. For a change the server hasn't confirmed yet, use{" "}
          <Code>useSourceMutation</Code>'s <Code>optimistic</Code>, which rolls back on failure.
        </li>
      </Ul>

      <H2 id="hold">Cancel now, write later</H2>
      <P>
        A screen that fetches the answer itself, with another request than the query's on a first load, must stop the
        reads in flight before it waits, or one of them lands while it does. <Code>useHoldSource(source)</Code> returns
        a function that begins a hold (<Code>holdSource(client, source)</Code> outside React). The hold cancels every
        read in flight under the key at once and pauses the hooks' reads under it until it ends:{" "}
        <Code>hold.patch(changes, options)</Code> writes the answer and ends it, and <Code>hold.release()</Code> ends it
        without writing.
      </P>
      <Pre code={holdCode} />
      <Ul>
        <li>
          A paused read shows as fetching and sends nothing. A read the hold cancelled waits as one, so a first load
          stays pending and fetching, never pending and idle. A read a mount, a focus or reconnect refetch, a{" "}
          <Code>retry</Code> or an invalidation starts during the hold waits too, deduplicated as TanStack does.
        </li>
        <li>
          <Code>hold.patch</Code> is <Code>patch</Code> with <Code>{'inFlight: "cancel"'}</Code>: each query it writes
          keeps the answer and its paused read is dropped without a request, so a first load gets its first value from
          the caller. Every other paused read runs then, and is listed in <Code>restarted</Code>. <Code>refetch</Code>,{" "}
          <Code>awaitRestarted</Code> and <Code>throwOnError</Code> work as on <Code>patch</Code>, after the hold has
          ended, so the reload isn't paused.
        </li>
        <li>
          <Code>hold.release()</Code>, after the caller's fetch failed, lets every paused read run, each once: a first
          load reads with its own query function and nothing stays pending. It does nothing once the hold has ended. The
          hook releases the holds its component began when it unmounts. A <Code>patch</Code> after the hold ended still
          writes, as a cancelling patch.
        </li>
        <li>
          Holds nest and overlap: a read waits until every hold over its key has ended. A read the hooks don't own (a{" "}
          <Code>prefetchQuery</Code>) can't wait: the hold cancels it and starts it again when it ends, unless its patch
          writes that query. <Code>hold.cancelled</Code> lists the reads it stopped.
        </li>
        <li>
          The hold adds no request: the reads it cancels or pauses either get the caller's answer or run once when it
          ends, as they would have. Only a read already in flight when the hold begins and that it lets run afterwards
          is sent twice, the first time aborted.
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
