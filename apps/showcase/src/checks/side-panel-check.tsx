import { useState } from "react"

import { Button } from "@/components/ui/button"
import { List, ListItem } from "@/components/ui/list-item"
import { SidePanel, type SidePanelNarrow } from "@/components/ui/side-panel"
import { StatusPill } from "@/components/ui/status-pill"

const cases = {
  both: (
    <>
      <StatusPill tone="info">In review</StatusPill>
      <Button size="sm" variant="outline">
        Assign
      </Button>
    </>
  ),
  pill: <StatusPill tone="success">Done</StatusPill>,
}

const issues = ["Webhook retries", "Audit log export", "Billing seats", "Search ranking", "Invite emails"]

function NarrowLayout({ narrow }: { narrow: SidePanelNarrow }) {
  const [openId, setOpenId] = useState<string | null>(issues[0] ?? null)
  return (
    <main className="flex flex-col gap-group p-inset-surface">
      <h1 className="text-title">Issues</h1>
      <div data-testid="layout" className="relative flex min-h-80 rounded-surface border">
        <div data-testid="list" className="min-w-0 flex-1 p-inline">
          <List aria-label="Issues">
            {issues.map((title) => (
              <ListItem
                key={title}
                id={title}
                title={title}
                selected={openId === title}
                onSelect={() => setOpenId(title)}
              />
            ))}
          </List>
        </div>
        <SidePanel
          open={openId !== null}
          onOpenChange={(open) => {
            if (!open) setOpenId(null)
          }}
          title={openId ?? ""}
          description="Opened two days ago"
          actions={<StatusPill tone="info">In review</StatusPill>}
          narrow={narrow}
          returnFocus={() =>
            document.querySelector<HTMLElement>(
              `[data-item-id="${CSS.escape(openId ?? "")}"] [data-slot=list-item-primary]`,
            )
          }
        >
          <p className="text-body">Retries stop once the first attempt times out.</p>
        </SidePanel>
      </div>
    </main>
  )
}

const narrowModes = new Set<string>(["stack", "overlay", "sheet"] satisfies SidePanelNarrow[])

function SidePanelCheck() {
  const narrow = new URLSearchParams(location.search).get("narrow")
  if (narrow !== null && narrowModes.has(narrow)) return <NarrowLayout narrow={narrow as SidePanelNarrow} />
  return (
    <main className="flex flex-wrap items-start gap-section p-section">
      {(["both", "pill"] as const).map((kind) => (
        <div key={kind} data-testid={`side-panel-${kind}`} className="flex h-96 rounded-surface border">
          <SidePanel
            open
            onOpenChange={() => {}}
            title="Webhook retries stop after the first timeout"
            description="Opened by Ana Ruiz in the payments project two days ago"
            actions={cases[kind]}
            scope={`side-panel-check-${kind}`}
          >
            <p className="text-body">Retries stop once the first attempt times out.</p>
          </SidePanel>
        </div>
      ))}
    </main>
  )
}

export { SidePanelCheck }
