import { focusManager, type Query, type QueryCacheNotifyEvent, type QueryClient } from "@tanstack/react-query"

/**
 * How often a hook reloads its query while it's shown, in ms; `false` doesn't. A function of the hook's state decides
 * again after every render, so it can stop once a condition ends: `(state) => (state.data?.status === "pending" ? 2000 : false)`.
 */
type RefetchInterval<State> = number | false | ((state: State) => number | false)

type PollOptions<State> = {
  /**
   * Reloads the query every so many ms, counted from when its last read settled, so requests never stack. A poll is a
   * background refresh: the data stays, `fetching` and `polling` are true and `status` stays `success`. Hooks that read
   * the same key share one timer, at the shortest interval any of them asks for. Default false.
   */
  refetchInterval?: RefetchInterval<State>
  /**
   * Keeps polling while the document is hidden. Default false: polling stops while it's hidden and, once it's visible
   * again, reloads at once when an interval went by.
   */
  refetchIntervalInBackground?: boolean
}

type PollRequest = { intervalMs: number; inBackground: boolean }

type Poll = { requests: Set<PollRequest>; timer: ReturnType<typeof setTimeout> | undefined }

type Poller = { polls: Map<string, Poll>; stop: () => void }

const pollFetch: NonNullable<Query["state"]["fetchMeta"]> = {}
const pollers = new WeakMap<QueryClient, Poller>()

function intervalOf<State>(
  refetchInterval: RefetchInterval<State> | undefined,
  state: State,
  enabled: boolean,
): number | false {
  if (!enabled || refetchInterval === undefined || refetchInterval === false) return false
  const intervalMs = typeof refetchInterval === "function" ? refetchInterval(state) : refetchInterval
  return typeof intervalMs === "number" && Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : false
}

function shortestInterval(poll: Poll) {
  const visible = focusManager.isFocused()
  let shortest: number | undefined
  for (const { intervalMs, inBackground } of poll.requests) {
    if (!visible && !inBackground) continue
    if (shortest === undefined || intervalMs < shortest) shortest = intervalMs
  }
  return shortest
}

function schedule(client: QueryClient, queryHash: string, poll: Poll) {
  clearTimeout(poll.timer)
  poll.timer = undefined
  const query = client.getQueryCache().get(queryHash)
  const intervalMs = shortestInterval(poll)
  if (query === undefined || intervalMs === undefined || query.state.fetchStatus !== "idle") return
  const settledAt = Math.max(query.state.dataUpdatedAt, query.state.errorUpdatedAt)
  const delayMs = Math.max(0, settledAt + intervalMs - Date.now())
  poll.timer = setTimeout(() => {
    poll.timer = undefined
    if (query.state.fetchStatus !== "idle" || client.getQueryCache().get(queryHash) !== query) return
    query.fetch(undefined, { meta: pollFetch }).catch(() => undefined)
  }, delayMs)
}

function startPoller(client: QueryClient): Poller {
  const polls = new Map<string, Poll>()
  const onQueryEvent = (event: QueryCacheNotifyEvent) => {
    if (event.type !== "updated" && event.type !== "added") return
    const poll = polls.get(event.query.queryHash)
    if (poll !== undefined) schedule(client, event.query.queryHash, poll)
  }
  const onVisibilityChange = () => {
    for (const [queryHash, poll] of polls) schedule(client, queryHash, poll)
  }
  const unsubscribeCache = client.getQueryCache().subscribe(onQueryEvent)
  const unsubscribeFocus = focusManager.subscribe(onVisibilityChange)
  return {
    polls,
    stop: () => {
      unsubscribeCache()
      unsubscribeFocus()
    },
  }
}

function pollerOf(client: QueryClient) {
  const existing = pollers.get(client)
  if (existing !== undefined) return existing
  const poller = startPoller(client)
  pollers.set(client, poller)
  return poller
}

function pollOf(poller: Poller, queryHash: string) {
  const existing = poller.polls.get(queryHash)
  if (existing !== undefined) return existing
  const poll: Poll = { requests: new Set(), timer: undefined }
  poller.polls.set(queryHash, poll)
  return poll
}

function withdraw(client: QueryClient, poller: Poller, queryHash: string, poll: Poll, request: PollRequest) {
  poll.requests.delete(request)
  if (poll.requests.size > 0) {
    schedule(client, queryHash, poll)
    return
  }
  clearTimeout(poll.timer)
  poller.polls.delete(queryHash)
  if (poller.polls.size > 0) return
  poller.stop()
  pollers.delete(client)
}

/**
 * Polls the query with this hash while the request stands; the returned function withdraws it. Requests for the same
 * query share one timer, and the client's poller listens to the cache and to visibility only while a request stands.
 */
function requestPoll(client: QueryClient, queryHash: string, request: PollRequest): () => void {
  const poller = pollerOf(client)
  const poll = pollOf(poller, queryHash)
  poll.requests.add(request)
  schedule(client, queryHash, poll)
  return () => withdraw(client, poller, queryHash, poll, request)
}

/** Whether the query's read in flight is a poll's, which nobody asked for and nothing should announce. */
function isPollFetch(client: QueryClient, queryKey: readonly unknown[]) {
  return client.getQueryCache().find({ queryKey, exact: true })?.state.fetchMeta === pollFetch
}

export { intervalOf, isPollFetch, requestPoll }
export type { PollOptions, PollRequest, RefetchInterval }
