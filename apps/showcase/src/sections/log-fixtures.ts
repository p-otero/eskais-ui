import type { LogInput } from "@/components/ui/log-viewer-store"

const ESC = "\u001b"
const sgr = (codes: string, text: string) => `${ESC}[${codes}m${text}${ESC}[0m`

const routes = ["/api/tasks", "/api/projects/42", "/api/session", "/api/search?q=deploy", "/api/users/7/avatar"]
const tables = ["tasks", "projects", "sessions", "audit_log"]

function frontendLine(n: number): string {
  const kind = n % 7
  if (kind === 0)
    return `${sgr("2", "12:00:00")} ${sgr("36;1", "[vite]")} ${sgr("32", "hmr update")} ${sgr("2", `/src/routes/task-${String(n % 40)}.tsx`)}`
  if (kind === 1) return `${sgr("36;1", "[vite]")} page reload ${sgr("2", "src/main.tsx")}`
  if (kind === 2) return `  ${sgr("32", "➜")}  ${sgr("1", "Local:")}   ${sgr("36", "http://localhost:5173/")}`
  if (kind === 3) return `${sgr("33", "[warn]")} React: each child in a list should have a unique "key" prop (TaskRow)`
  if (kind === 4)
    return `${sgr("38;5;208", "transforming")} (${String(200 + (n % 300))}) ${sgr("38;2;120;180;255", "node_modules/.vite/deps")}`
  if (kind === 5) return `${sgr("90", "✓")} built in ${String(300 + (n % 900))}ms`
  return `${sgr("35", "[tsc]")} ${sgr("4", "src/api/client.ts")} checked, ${sgr("1;32", "0 errors")}`
}

function backendLine(n: number): { text: string; level: string } {
  const route = routes[n % routes.length] ?? "/"
  if (n % 23 === 0) {
    return {
      text: `${sgr("31;1", "ERROR")} ${route} failed: connect ECONNREFUSED 127.0.0.1:6379 (redis)`,
      level: "error",
    }
  }
  if (n % 11 === 0)
    return { text: `${sgr("33", "WARN")} slow request ${route} took ${String(800 + (n % 400))}ms`, level: "warn" }
  const status = n % 9 === 0 ? 404 : 200
  const color = status === 200 ? "32" : "33"
  return {
    text: `${sgr("34", "INFO")} ${sgr("1", "GET")} ${route} ${sgr(color, String(status))} ${String(3 + (n % 60))}ms`,
    level: "info",
  }
}

function dbLine(n: number): { text: string; level: string } {
  const table = tables[n % tables.length] ?? "tasks"
  if (n % 31 === 0) {
    return {
      text: `ERROR:  duplicate key value violates unique constraint "${table}_pkey" DETAIL: Key (id)=(${String(n)}) already exists.`,
      level: "error",
    }
  }
  if (n % 5 === 0)
    return { text: `LOG:  checkpoint complete: wrote ${String(n % 97)} buffers (0.${String(n % 9)}%)`, level: "info" }
  return {
    text: `LOG:  duration: ${String((n % 50) / 10)} ms  statement: SELECT * FROM ${table} WHERE id = $1`,
    level: "debug",
  }
}

const start = Date.UTC(2026, 10, 20, 9, 0, 0)

function simulatedLine(n: number): LogInput {
  const time = start + n * 37
  const service = n % 5
  if (service <= 1) return { text: frontendLine(n), source: "frontend", time }
  if (service <= 3) return { ...backendLine(n), source: "backend", time }
  return { ...dbLine(n), source: "db", time }
}

function simulatedLines(from: number, count: number) {
  return Array.from({ length: count }, (_, offset) => simulatedLine(from + offset))
}

export { simulatedLine, simulatedLines }
