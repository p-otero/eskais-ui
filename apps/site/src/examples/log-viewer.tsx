import { useState } from "react"
import { PauseIcon, PlayIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { LogViewer } from "@/components/ui/log-viewer"
import { createLogStore, type LogInput } from "@/components/ui/log-viewer-store"

const ESC = "\u001b"
const color = (code: string, text: string) => `${ESC}[${code}m${text}${ESC}[0m`
const routes = ["/api/tasks", "/api/projects/42", "/api/session", "/api/search?q=deploy"]

// A local environment's three services: Vite's coloured output, an API log with levels, and Postgres.
function line(n: number): LogInput {
  const route = routes[n % routes.length] ?? "/"
  const time = Date.UTC(2026, 10, 20, 9, 0, 0) + n * 41
  if (n % 3 === 0) {
    const text =
      n % 2 === 0
        ? `${color("36;1", "[vite]")} ${color("32", "hmr update")} ${color("2", `/src/routes/task-${String(n % 40)}.tsx`)}`
        : `${color("38;5;208", "transforming")} (${String(200 + (n % 300))}) ${color("38;2;120;180;255", "node_modules/.vite/deps")}`
    return { text, source: "frontend", time }
  }
  if (n % 3 === 1) {
    if (n % 19 === 0) {
      return {
        text: `${color("31;1", "ERROR")} ${route} failed: connect ECONNREFUSED 127.0.0.1:6379`,
        source: "backend",
        level: "error",
        time,
      }
    }
    return {
      text: `${color("34", "INFO")} ${color("1", "GET")} ${route} ${color("32", "200")} ${String(3 + (n % 60))}ms`,
      source: "backend",
      level: "info",
      time,
    }
  }
  if (n % 29 === 2) {
    return {
      text: `ERROR:  duplicate key value violates unique constraint "tasks_pkey"`,
      source: "db",
      level: "error",
      time,
    }
  }
  return {
    text: `LOG:  duration: ${String((n % 50) / 10)} ms  statement: SELECT * FROM tasks WHERE id = $1`,
    source: "db",
    time,
  }
}

const store = createLogStore({ maxLines: 5000 })
let next = 0
store.append(Array.from({ length: 200 }, () => line(next++)))

let timer: ReturnType<typeof setInterval> | undefined

export default function LogViewerDemo() {
  const [streaming, setStreaming] = useState(false)
  // A stream that stops on its own after 30 seconds, so the page goes quiet when nobody is watching.
  const toggle = () => {
    clearInterval(timer)
    if (streaming) {
      setStreaming(false)
      return
    }
    const stopAt = Date.now() + 30_000
    timer = setInterval(() => {
      if (Date.now() > stopAt) {
        clearInterval(timer)
        setStreaming(false)
        return
      }
      store.append(Array.from({ length: 4 }, () => line(next++)))
    }, 50)
    setStreaming(true)
  }

  return (
    <LogViewer
      store={store}
      label="Environment output"
      sources={["frontend", "backend", { id: "db", label: "postgres" }]}
      timestamps
      className="h-96 w-full"
      actions={
        <Button variant="ghost" size="icon" aria-label={streaming ? "Pause stream" : "Stream lines"} onClick={toggle}>
          {streaming ? <PauseIcon /> : <PlayIcon />}
        </Button>
      }
    />
  )
}
