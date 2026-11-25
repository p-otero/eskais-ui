import { useState } from "react"

import { LogViewer } from "@/components/ui/log-viewer"
import { createLogStore, type LogStore } from "@/components/ui/log-viewer-store"

import { simulatedLines } from "../sections/log-fixtures"

declare global {
  var logBench:
    | {
        store: LogStore
        /** Appends `count` lines at once. */
        burst: (count: number) => void
        /** Appends `perSecond` lines a second, every 16 ms, until `stop`. */
        stream: (perSecond: number) => void
        stop: () => void
      }
    | undefined
}

const params = new URLSearchParams(location.search)
const maxLines = Number(params.get("max") ?? 10_000)
const wrap = params.get("wrap") === "true"

function createBench() {
  const store = createLogStore({ maxLines })
  let next = 0
  let timer: ReturnType<typeof setInterval> | undefined
  const burst = (count: number) => {
    store.append(simulatedLines(next, count))
    next += count
  }
  globalThis.logBench = {
    store,
    burst,
    stream(perSecond) {
      clearInterval(timer)
      const perTick = Math.max(1, Math.round((perSecond * 16) / 1000))
      timer = setInterval(() => burst(perTick), 16)
    },
    stop: () => clearInterval(timer),
  }
  return store
}

function LogBench() {
  const [store] = useState(createBench)
  return (
    <main className="flex h-dvh flex-col p-inset-surface">
      <LogViewer
        store={store}
        label="Benchmark log"
        sources={["frontend", "backend", "db"]}
        timestamps
        defaultWrap={wrap}
        className="min-h-0 flex-1"
      />
    </main>
  )
}

export { LogBench }
