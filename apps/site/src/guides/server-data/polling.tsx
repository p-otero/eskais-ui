import { Code, H2, P, Pre, Ul } from "../../docs/prose"

import { pollingCode } from "./snippets"

export function Polling() {
  return (
    <>
      <H2 id="polling">Polling</H2>
      <P>
        <Code>refetchInterval</Code> reloads a query every so many ms while it's shown, on <Code>useServerQuery</Code>,{" "}
        <Code>useServerResource</Code>, <Code>useServerPage</Code> and <Code>useServerInfinite</Code>, and on{" "}
        <Code>ServerDataTable</Code> and <Code>ServerList</Code>. A function of the hook's state decides again after
        every render and stops the polling once it returns <Code>false</Code>, so a screen that waits for a login or a
        job asks only while the answer is pending.
      </P>
      <Pre code={pollingCode} />
      <Ul>
        <li>
          The next poll is counted from when the last read settled, so a slow server never gets two requests at once,
          and any other read of the query (a mutation's refresh, a patch) pushes it back. A hold pauses it like any
          read.
        </li>
        <li>
          It stops while the document is hidden, and once it's visible again reloads at once when an interval went by.{" "}
          <Code>refetchIntervalInBackground</Code> keeps it going.
        </li>
        <li>
          A poll is a background refresh: the data stays, <Code>fetching</Code> and <Code>polling</Code> are true and{" "}
          <Code>status</Code> stays <Code>success</Code>. A failed poll follows the retry rules and keeps the last data
          beside the error. The table and list don't mark their rows busy or say "Loading…" for a poll; leave{" "}
          <Code>polling</Code> out of your own status the same way.
        </li>
        <li>
          Screens that read the same key share one timer, at the shortest interval any of them asks for, and it stops
          when the last one unmounts or moves to another key. With polling off the hooks set no timer.
        </li>
      </Ul>
    </>
  )
}
