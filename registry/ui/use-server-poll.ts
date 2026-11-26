"use client"

import type { QueryClient } from "@tanstack/react-query"
import { useEffect } from "react"

import { intervalOf, requestPoll, type PollOptions } from "@/components/ui/server-data-poll"

const separatorAbsentFromJsonHashes = "\n"

/**
 * Polls the queries under `queryKeys` as `options.refetchInterval` asks for this `state`, while mounted. With polling
 * off it sets no timer and adds no listener.
 */
function useServerPoll<State>(
  client: QueryClient,
  queryKeys: readonly (readonly unknown[])[],
  options: PollOptions<State> & { enabled?: boolean },
  state: State,
) {
  const intervalMs = intervalOf(options.refetchInterval, state, options.enabled !== false)
  const inBackground = options.refetchIntervalInBackground === true
  const queryHashes =
    intervalMs === false
      ? undefined
      : queryKeys
          .map((queryKey) => client.defaultQueryOptions({ queryKey }).queryHash)
          .join(separatorAbsentFromJsonHashes)
  useEffect(() => {
    if (queryHashes === undefined || intervalMs === false) return undefined
    const withdrawals = queryHashes
      .split(separatorAbsentFromJsonHashes)
      .map((queryHash) => requestPoll(client, queryHash, { intervalMs, inBackground }))
    return () => {
      for (const withdraw of withdrawals) withdraw()
    }
  }, [client, queryHashes, intervalMs, inBackground])
}

export { useServerPoll }
