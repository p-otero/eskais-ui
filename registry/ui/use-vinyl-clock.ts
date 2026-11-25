import { useEffect, useEffectEvent } from "react"

const tickMs = 250

/** Advances a scrubber that has no media and no `value` of its own while it plays, a quarter second at a time. */
function useVinylClock(ticking: boolean, advance: (seconds: number) => void) {
  const onTick = useEffectEvent(advance)
  useEffect(() => {
    if (!ticking) return
    let last = performance.now()
    const timer = setInterval(() => {
      const now = performance.now()
      onTick((now - last) / 1000)
      last = now
    }, tickMs)
    return () => clearInterval(timer)
  }, [ticking])
}

export { useVinylClock }
