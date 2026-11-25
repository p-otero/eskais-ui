import { useState, type RefObject } from "react"

import { Button } from "@/components/ui/button"
import { CodeBlock } from "@/components/ui/code-block"

import { agent } from "../agent"

type Entry = ReturnType<typeof agent.snapshot>[number]

// Workaround: UI SDK's bridge has no scoped snapshot, so read the page with the preview hidden from agents and
// without, and keep what only the second one sees.
function previewSnapshot(preview: HTMLElement) {
  preview.setAttribute("data-agent-hidden", "")
  const outside = new Set(agent.snapshot().map((entry) => entry.ref))
  preview.removeAttribute("data-agent-hidden")
  return agent.snapshot().filter((entry) => !entry.offPage && !outside.has(entry.ref) && entry.component !== "more")
}

function describe(entries: Entry[]) {
  return entries.map(({ ref: _ref, component, label, actions, confirm, ...state }) => {
    const shown: Record<string, unknown> = { component, label, actions }
    for (const key of ["value", "checked", "open", "items", "required", "multiple"] as const) {
      if (key in state) shown[key] = state[key as keyof typeof state]
    }
    if (confirm) shown.confirm = confirm
    return shown
  })
}

function AgentPanel({ preview }: { preview: RefObject<HTMLElement | null> }) {
  const [entries, setEntries] = useState<Entry[]>()
  return (
    <div className="flex flex-col gap-items">
      <div className="flex flex-wrap items-center gap-items">
        <Button
          variant="outline"
          onClick={() => {
            if (preview.current) setEntries(previewSnapshot(preview.current))
          }}
        >
          Read the preview as an agent
        </Button>
        <p className="text-body-sm text-muted-foreground" aria-live="polite">
          {entries === undefined
            ? "Runs agent.snapshot() from @ui-sdk/react/agent on the live preview above."
            : `${entries.length} ${entries.length === 1 ? "component" : "components"} an agent can read and operate.`}
        </p>
      </div>
      {entries !== undefined && entries.length > 0 && (
        <CodeBlock
          code={JSON.stringify(describe(entries), null, 2)}
          language="json"
          title="agent.snapshot()"
          maxHeight="28rem"
        />
      )}
    </div>
  )
}

export { AgentPanel }
