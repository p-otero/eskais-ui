import { useSyncExternalStore } from "react"

const listeners = new Set<() => void>()
let ticker: ReturnType<typeof setInterval> | undefined
let second = 0

function subscribe(notify: () => void) {
  listeners.add(notify)
  if (!ticker) {
    second = Math.floor(Date.now() / 1000)
    ticker = setInterval(() => {
      second = Math.floor(Date.now() / 1000)
      for (const listener of listeners) listener()
    }, 1000)
  }
  return () => {
    listeners.delete(notify)
    if (listeners.size || !ticker) return
    clearInterval(ticker)
    ticker = undefined
  }
}

const now = () => second || Math.floor(Date.now() / 1000)
const onServer = () => null

/** The current second, in seconds since 1970, ticking once a second; `null` on the server and before hydration. */
function useTeletextClock(): number | null {
  return useSyncExternalStore(subscribe, now, onServer)
}

export { useTeletextClock }
