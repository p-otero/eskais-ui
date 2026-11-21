import EnvironmentsExample from "../../../../site/src/guides/row-actions/environments"

/** ?demo=list-row-actions: worktree environments whose rows hold Open, Copy and Start/Stop, beside their detail. */
function ListRowActionsDemo() {
  return (
    <main className="flex h-dvh flex-col p-inset-surface narrow:p-0">
      <h1 className="sr-only">Environments</h1>
      <EnvironmentsExample className="min-h-0 flex-1" />
    </main>
  )
}

export { ListRowActionsDemo }
