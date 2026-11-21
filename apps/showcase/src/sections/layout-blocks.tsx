import { lazy, Suspense, type CSSProperties } from "react"

import DashboardGridExample from "../../../site/src/examples/dashboard-grid"
import MasterDetailExample from "../../../site/src/examples/master-detail"
import SettingsPageExample from "../../../site/src/examples/settings-page"

// Loads apart so the row-actions demo stays out of the page chunk the vitals measure.
const EnvironmentsExample = lazy(() => import("../../../site/src/guides/row-actions/environments"))

/** The layout blocks alone: ?demo=master-detail fills the window, for tooling/shell-check.mjs and screenshots. */
function MasterDetailDemo() {
  return (
    <main className="flex h-dvh flex-col p-inset-surface narrow:p-0">
      <h1 className="sr-only">Devices</h1>
      <MasterDetailExample className="min-h-0 flex-1" />
    </main>
  )
}

/** ?demo=list-row-actions: worktree environments whose rows hold Open, Copy and Start/Stop, beside their detail. */
function ListRowActionsDemo() {
  return (
    <main className="flex h-dvh flex-col p-inset-surface narrow:p-0">
      <h1 className="sr-only">Environments</h1>
      <Suspense>
        <EnvironmentsExample className="min-h-0 flex-1" />
      </Suspense>
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

/** ?demo=settings-page: the settings page under a sticky bar, as in an app shell. */
function SettingsPageDemo() {
  return (
    <>
      <header
        data-testid="app-bar"
        className="sticky top-0 z-sticky flex h-(--topbar-height) items-center border-b bg-background px-inset-surface"
      >
        <span className="text-title-sm">Workspace</span>
      </header>
      <main
        className="mx-auto flex w-full max-w-5xl flex-col gap-group p-inset-surface"
        style={{ "--docs-top": "var(--topbar-height)" } as CSSProperties}
      >
        <h1 className="text-display-sm tracking-tight">Settings</h1>
        <SettingsPageExample />
      </main>
    </>
  )
}

export { DashboardGridDemo, ListRowActionsDemo, MasterDetailDemo, SettingsPageDemo }
