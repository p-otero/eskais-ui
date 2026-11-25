import { useEffect, useRef } from "react"

import type { LogStore } from "@/components/ui/log-viewer-store"

import { simulatedLines } from "../sections/log-fixtures"

function useSimulatedLogs(
  store: LogStore,
  { running, linesPerSecond, from = 0 }: { running: boolean; linesPerSecond: number; from?: number },
) {
  const next = useRef(from)
  useEffect(() => {
    if (!running) return undefined
    const perTick = Math.max(1, Math.round(linesPerSecond / 20))
    const timer = setInterval(() => {
      store.append(simulatedLines(next.current, perTick))
      next.current += perTick
    }, 50)
    return () => clearInterval(timer)
  }, [store, running, linesPerSecond])
  return (count: number) => {
    store.append(simulatedLines(next.current, count))
    next.current += count
  }
}

export { useSimulatedLogs }
