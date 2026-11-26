import type { NetworkMode } from "@tanstack/react-query"

/** `true` reloads a stale query on the event, `"always"` a fresh one too, `false` never. */
type RefetchTrigger = boolean | "always"

/**
 * When a query reloads on its own, per hook; otherwise the client's (`createDataClient`: no reload on focus, reload a
 * stale query on mount, and on reconnect unless `networkMode` is `"always"`). TanStack reloads a query when any hook that reads it asks to, so a resource
 * that must never reload this way (one whose reads overwrite per-item ETags kept for later writes) says so in
 * `defineResource`, for every screen.
 */
type RefetchOptions = {
  refetchOnWindowFocus?: RefetchTrigger
  refetchOnReconnect?: RefetchTrigger
  refetchOnMount?: RefetchTrigger
}

/** What every reading hook takes besides its request: when a read may run and when it reloads on its own. */
type ReadOptions = RefetchOptions & {
  enabled?: boolean
  /** When a read may run, as `createDataClient`'s `networkMode`; otherwise the client's. */
  networkMode?: NetworkMode
}

function networkModeOf(networkMode: NetworkMode | undefined) {
  return networkMode === undefined ? {} : { networkMode }
}

const refetchKeys = ["refetchOnWindowFocus", "refetchOnReconnect", "refetchOnMount"] as const

/** A query's `networkMode` and refetch triggers, the unset ones left out so the client's defaults apply. */
function readOptionsOf(options: ReadOptions): Omit<ReadOptions, "enabled"> {
  const picked: Omit<ReadOptions, "enabled"> = { ...networkModeOf(options.networkMode) }
  for (const name of refetchKeys) if (options[name] !== undefined) picked[name] = options[name]
  return picked
}

export { networkModeOf, readOptionsOf }
export type { ReadOptions, RefetchOptions, RefetchTrigger }
