import { List, ListItem } from "@/components/ui/list-item"
import { StatusDot } from "@/components/ui/status-pill"

declare global {
  var listBench: { mounted?: number; start: number } | undefined
}

const params = new URLSearchParams(location.search)
const count = Number(params.get("rows") ?? 2000)
const virtualize = params.get("virtualize") === "false" ? false : "auto"
const rows = Array.from({ length: count }, (_, index) => ({
  id: `ROW-${String(index + 1)}`,
  title: `Row ${String(index + 1)}: a message subject long enough to wrap on narrow screens`,
  from: index % 3 === 0 ? "Maya Kowalski" : "Deploy bot",
}))

globalThis.listBench = { start: performance.now() }

// Records when the first rows have painted: a frame, then a task after it.
function markMounted(node: HTMLElement | null) {
  if (!node) return
  requestAnimationFrame(() => {
    const channel = new MessageChannel()
    channel.port1.addEventListener("message", () => {
      if (globalThis.listBench) globalThis.listBench.mounted = performance.now() - globalThis.listBench.start
    })
    channel.port1.start()
    channel.port2.postMessage(null)
  })
}

/** ?demo=list-bench&rows=2000&virtualize=false: the list tooling/list-bench.mjs times. */
function ListBench() {
  return (
    <main ref={markMounted} className="flex h-dvh flex-col p-inset-surface">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <List
          aria-label="Benchmark rows"
          items={rows}
          virtualize={virtualize}
          estimateSize={56}
          renderItem={(row) => (
            <ListItem
              id={row.id}
              title={row.title}
              subtitle={row.from}
              leading={<StatusDot tone="info" label="Unread" />}
              trailing="9:30"
              onSelect={() => {}}
            />
          )}
        />
      </div>
    </main>
  )
}

export { ListBench }
