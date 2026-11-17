import DashboardGridExample from "../../../site/src/examples/dashboard-grid"
import MasterDetailExample from "../../../site/src/examples/master-detail"

/** The layout blocks alone: ?demo=master-detail fills the window, for tooling/shell-check.mjs and screenshots. */
function MasterDetailDemo() {
  return (
    <main className="flex h-dvh flex-col p-inset-surface narrow:p-0">
      <h1 className="sr-only">Devices</h1>
      <MasterDetailExample className="min-h-0 flex-1" />
    </main>
  )
}

/** ?demo=dashboard-grid: the dashboard demo on a page, with its loading switch. */
function DashboardGridDemo() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-group p-inset-surface">
      <h1 className="text-display-sm tracking-tight">Lab</h1>
      <DashboardGridExample />
    </main>
  )
}

export { DashboardGridDemo, MasterDetailDemo }
