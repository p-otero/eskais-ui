import DashboardGridExample from "../../../../site/src/examples/dashboard-grid"

/** ?demo=dashboard-grid: the dashboard demo on a page, with its loading switch. */
function DashboardGridDemo() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-group p-inset-surface">
      <h1 className="text-display-sm tracking-tight">Lab</h1>
      <DashboardGridExample />
    </main>
  )
}

export { DashboardGridDemo }
