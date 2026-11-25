import { PillDialog } from "@/components/ui/pill-dialog"

export default function PillDialogDemo() {
  return (
    <PillDialog
      trigger="Run migration"
      title="Migrate the database?"
      description="After the migration you can't go back to the previous version."
      confirmLabel="Migrate"
      agentConfirm="Migrates the production database; it can't be undone"
      onConfirm={() => new Promise((done) => setTimeout(done, 900))}
    />
  )
}
