import { notifyManager, type Query, type QueryClient, type QueryKey } from "@tanstack/react-query"

import {
  holds,
  isPaused,
  knowsHolds,
  runPatch,
  type Hold,
  type PatchOptions,
  type PatchResult,
  type SourcePatch,
} from "@/components/ui/server-data-cache"

/** A hold's patch always cancels the reads in flight of the queries it writes, which started before the answer. */
type HoldPatchOptions = Omit<PatchOptions, "inFlight">

type SourceHold<T, Data = unknown> = {
  /** The queries whose read in flight the hold stopped when it began. */
  readonly cancelled: readonly QueryKey[]
  /** Whether the hold is still open: neither `patch` nor `release` has ended it. */
  readonly active: boolean
  /**
   * Ends the hold and writes the answer, as `patch` with `inFlight: "cancel"`: a written query keeps the patch and its
   * paused read is dropped without a request; every other paused read runs now. After the hold has ended (`release`,
   * or the component that made it unmounted), it still writes, as a plain patch with `inFlight: "cancel"`.
   */
  patch: (changes: SourcePatch<T, Data>, options?: HoldPatchOptions) => Promise<PatchResult>
  /** Ends the hold without writing: every read it paused or stopped runs now. Does nothing once the hold has ended. */
  release: () => void
}

function runAgain(client: QueryClient, query: Query) {
  if (client.getQueryCache().get(query.queryHash) !== query || query.state.fetchStatus !== "idle") return false
  query.fetch().catch(() => undefined)
  return true
}

/**
 * Cancels every read in flight under the key now and pauses the hooks' reads under it, which show as fetching and send
 * nothing, until `hold.patch` writes the caller's own answer or `hold.release` gives up; then the paused reads run,
 * except a written query's.
 */
function holdSource<T, Data = unknown>(client: QueryClient, source: { key: readonly unknown[] }): SourceHold<T, Data> {
  const { key } = source
  let end: (() => void) | undefined
  const hold: Hold = {
    key,
    ended: new Promise<void>((resolve) => {
      end = resolve
    }),
  }
  const open = holds.get(client) ?? new Set<Hold>()
  holds.set(client, open)
  open.add(hold)
  // A read no hook owns would send its request again at once if restarted, so it is stopped and runs when the hold ends.
  const stopped: Query[] = []
  const cancelled = notifyManager.batch(() => {
    const inFlight = client
      .getQueryCache()
      .findAll({ queryKey: key, fetchStatus: "fetching" })
      .filter((query) => !isPaused(query))
    for (const query of inFlight) {
      if (knowsHolds(query)) {
        void query.cancel({ silent: true })
        query.fetch().catch(() => undefined)
      } else {
        void query.cancel({ revert: true })
        stopped.push(query)
      }
    }
    return inFlight.map((query) => query.queryKey)
  })
  const close = () => {
    if (!open.delete(hold)) return false
    end?.()
    return true
  }
  return {
    cancelled,
    get active() {
      return open.has(hold)
    },
    patch: (changes, options = {}) => {
      const paused = client.getQueryCache().findAll({ queryKey: key, fetchStatus: "fetching" }).filter(isPaused)
      const held = close()
      return runPatch(client, key, changes, { ...options, inFlight: "cancel" }, (written) => {
        if (!held) return []
        const resumed = paused.filter((query) => !written.has(query))
        // With `refetch` the reload right after stands in for these restarts.
        if (options.refetch !== true) {
          for (const query of stopped) if (!written.has(query) && runAgain(client, query)) resumed.push(query)
        }
        return resumed
      })
    },
    release: () => {
      if (!close()) return
      notifyManager.batch(() => {
        for (const query of stopped) runAgain(client, query)
      })
    },
  }
}

export { holdSource }
export type { HoldPatchOptions, SourceHold }
