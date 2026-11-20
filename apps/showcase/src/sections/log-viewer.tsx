import { useState } from "react"
import { PauseIcon, PlayIcon, Trash2Icon, ZapIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { LogViewer } from "@/components/ui/log-viewer"
import { createLogStore } from "@/components/ui/log-viewer-store"

import { useSimulatedLogs } from "../hooks/use-simulated-logs"
import { simulatedLines } from "./log-fixtures"
import { Section } from "../section"

const sources = [{ id: "frontend" }, { id: "backend" }, { id: "db", label: "postgres" }]

/** A local environment's three services streaming into one LogViewer, with pause, a 10,000-line burst and clear. */
function LogViewerDemo({
  className,
  linesPerSecond = 40,
  streaming = true,
  prefill = 300,
}: {
  className?: string
  linesPerSecond?: number
  streaming?: boolean
  prefill?: number
}) {
  const [store] = useState(() => {
    const created = createLogStore({ maxLines: 5000 })
    created.append(simulatedLines(0, prefill))
    return created
  })
  const [running, setRunning] = useState(streaming)
  const burst = useSimulatedLogs(store, { running, linesPerSecond, from: prefill })
  return (
    <LogViewer
      store={store}
      label="Environment output"
      sources={sources}
      timestamps
      className={className}
      actions={
        <>
          <Button
            variant="ghost"
            size="icon"
            aria-label={running ? "Pause stream" : "Resume stream"}
            onClick={() => setRunning((value) => !value)}
          >
            {running ? <PauseIcon /> : <PlayIcon />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Append 10,000 lines" onClick={() => burst(10_000)}>
            <ZapIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear log"
            data-agent-confirm="Clears every line from the log"
            onClick={() => store.clear()}
          >
            <Trash2Icon />
          </Button>
        </>
      }
    />
  )
}

function LogViewerSection() {
  return (
    <Section
      title="Log viewer"
      description="LogViewer streams process output: ANSI colours on theme tokens, follow tail with a jump button, a source filter, search, error navigation (F8) and copy."
    >
      {/* Paused at first: the rest of the showcase is measured by checks that need a still page. */}
      <LogViewerDemo className="h-96 w-full" streaming={false} />
    </Section>
  )
}

export { LogViewerDemo, LogViewerSection }
