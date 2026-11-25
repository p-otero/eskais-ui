import { PillDialog } from "@/components/ui/pill-dialog"
import { RetroTv } from "@/components/ui/retro-tv"

import "../../../../registry/styles/pill-dialog.css"
import "../../../../registry/styles/retro-tv.css"

function RetroTvScenario() {
  return (
    <div className="w-full max-w-3xl">
      <RetroTv label="Sales monitor">
        <div className="flex h-full flex-col justify-between p-inset-surface text-caption">
          <span>Sales · today</span>
          <span className="text-display">€12,430</span>
          <span className="text-muted-foreground">312 orders</span>
        </div>
      </RetroTv>
    </div>
  )
}

function PillDialogScenario() {
  return (
    <PillDialog
      trigger="Run migration"
      title="Migrate the database?"
      confirmLabel="Migrate"
      agentConfirm="Migrates the database"
      onConfirm={() => {}}
    />
  )
}

export { PillDialogScenario, RetroTvScenario }
