"use client"

import { useMemo, useState, useSyncExternalStore } from "react"

function createClock() {
  let seconds = 0
  let from: number | undefined
  return {
    read(startedAt: number | undefined, running: boolean) {
      if (startedAt === undefined) return 0
      if (running || from !== startedAt) {
        from = startedAt
        seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
      }
      return seconds
    },
  }
}

function subscribeSeconds(startedAt: number | undefined, running: boolean) {
  return (notify: () => void) => {
    if (startedAt === undefined || !running) return () => {}
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      timer = setTimeout(
        () => {
          notify()
          schedule()
        },
        1000 - ((Date.now() - startedAt) % 1000) + 5,
      )
    }
    schedule()
    return () => clearTimeout(timer)
  }
}

/** Whole seconds since `startedAt` (an epoch time in ms), counting while `running`. */
function useElapsedSeconds(startedAt: number | undefined, running: boolean) {
  const [clock] = useState(createClock)
  const subscribe = useMemo(() => subscribeSeconds(startedAt, running), [startedAt, running])
  return useSyncExternalStore(
    subscribe,
    () => clock.read(startedAt, running),
    () => 0,
  )
}

export { useElapsedSeconds }
