import { useEffect, useEffectEvent } from "react"

/** Calls `onTimeout` once the ejector has stayed armed, and idle, for `timeoutMs`; 0 never does. */
function useEjectorDisarmTimer(armedAndIdle: boolean, timeoutMs: number, onTimeout: () => void) {
  const timedOut = useEffectEvent(onTimeout)
  useEffect(() => {
    if (!armedAndIdle || timeoutMs <= 0) return
    const timer = setTimeout(timedOut, timeoutMs)
    return () => clearTimeout(timer)
  }, [armedAndIdle, timeoutMs])
}

export { useEjectorDisarmTimer }
