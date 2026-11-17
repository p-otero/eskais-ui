import { Button } from "@/components/ui/button"
import { SidePanel } from "@/components/ui/side-panel"
import { StatusPill } from "@/components/ui/status-pill"

// ?demo=side-panel-check: the fixture tooling/shell-check.mjs measures. A 24rem panel whose header holds a
// StatusPill and a small Button, as the consumer reported, and one with only a pill.
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

function SidePanelCheck() {
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
