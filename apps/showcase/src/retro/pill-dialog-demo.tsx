import { useState } from "react"

import { Label } from "@/components/ui/label"
import { PillDialog } from "@/components/ui/pill-dialog"
import { Switch } from "@/components/ui/switch"

import { agent } from "../agent"
import "../../../../registry/styles/pill-dialog.css"

declare global {
  interface Window {
    /** Read by tooling/retro-check.mjs: the agent bridge. */
    pillProbe?: { agent: typeof agent }
  }
}

window.pillProbe = { agent }

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms))

function PillDialogDemo() {
  const [result, setResult] = useState("Nothing chosen yet.")
  const [fails, setFails] = useState(false)
  return (
    <main className="flex min-h-dvh justify-center bg-background p-inset-surface text-foreground">
      <div className="flex w-full max-w-3xl flex-col items-start gap-group">
        <h1 className="text-display-sm tracking-tight">Pill dialog</h1>
        <div className="flex flex-wrap gap-items">
          <PillDialog
            trigger="Run migration"
            title="Migrate the database?"
            description="After the migration you can't go back to the previous version."
            confirmLabel="Migrate"
            agentConfirm="Migrates the production database; it can't be undone"
            pendingAnnouncement="Migrating"
            onOpenChange={(open, details) => {
              if (!open)
                setResult(`Closed: ${details.returnValue === undefined ? details.reason : String(details.returnValue)}`)
            }}
            onConfirm={async () => {
              await wait(900)
              if (fails) {
                setFails(false)
                throw new Error("The migration server didn't answer. Try again.")
              }
            }}
          />
        </div>
        <Label>
          <Switch checked={fails} onCheckedChange={setFails} />
          Fail the next migration
        </Label>
        <p className="text-body-sm text-muted-foreground" aria-live="polite">
          {result}
        </p>
      </div>
    </main>
  )
}

export { PillDialogDemo }
