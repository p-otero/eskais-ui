import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { Appearance } from "@/components/ui/appearance"
import { SkipLink } from "@/components/ui/skip-link"
import { ToastStack } from "@/components/ui/toast"

import { App } from "./app"
import { appearance } from "./appearance"
import { CalendarCheck } from "./checks/calendar-check"
import { CardHeaderCheck } from "./checks/card-header-check"
import { PaletteReopenCheck } from "./checks/palette-reopen-check"
import { DescriptionListCheck } from "./checks/description-list-check"
import { DiffBench } from "./checks/diff-bench"
import { FieldPlacementCheck } from "./checks/field-placement-check"
import { GaugeCheck } from "./checks/gauge-check"
import { IconTooltipCheck } from "./checks/icon-tooltip-check"
import { MasterDetailCheck } from "./checks/master-detail-check"
import { SettingsPageCheck } from "./checks/settings-page-check"
import { MobileNavCheck } from "./checks/mobile-nav-check"
import { GitBench } from "./checks/git-bench"
import { ListBench } from "./checks/list-bench"
import { OverlayCheck } from "./checks/overlay-check"
import { PressCheck } from "./checks/press-check"
import { SidePanelCheck } from "./checks/side-panel-check"
import { SortableCheck } from "./checks/sortable-check"
import { TableCheck } from "./checks/table-check"
import { ServerDataCheck } from "./checks/server-data-check"
import { TreeFocusCheck } from "./checks/tree-focus-check"
import { GitViewCheck } from "./checks/git-view-check"
import { AgentWorkspace } from "./sections/agent-workspace"
import { PerfPage } from "./perf/perf-page"
import { DocumentWorkspacePage } from "./sections/document-workspace"
import { CommitBranchesDemo, CommitTrailDemo } from "./sections/git"
import { InboxDemo } from "./sections/inbox"
import { DashboardGridDemo, MasterDetailDemo, SettingsPageDemo } from "./sections/layout-blocks"
import { demoStatuses, PageDemo, type DemoStatus } from "./sections/page"
import { ShellBlockDemo } from "./shell/shell-block-demo"
import { ShellDemo } from "./shell/shell-demo"
import { SiteDemo } from "./shell/site-demo"
import "./index.css"

const root = document.getElementById("root")
if (!root) throw new Error("Missing #root element")

// ?demo=page, site, shell, inbox, list-bench, shell-block, master-detail, dashboard-grid, settings-page,
// document-workspace, agent-workspace and commit-history render one demo alone; ?demo=<name>-check pages are the
// fixtures of tooling/<name>-check.mjs (shell-check's: card-header, description-list, field-placement, gauge,
// mobile-nav, palette-reopen, side-panel, table, master-detail, settings-page); *-bench and ?demo=perf pages are the benchmarks'.
const params = new URLSearchParams(location.search)
const status = demoStatuses.find((name) => name === params.get("status")) ?? "success"
const demo = params.get("demo")

const standalone = new Set([
  "page",
  "site",
  "shell",
  "overlay-check",
  "card-header-check",
  "palette-reopen-check",
  "field-placement-check",
  "mobile-nav-check",
  "icon-tooltip-check",
  "inbox",
  "list-bench",
  "diff-bench",
  "calendar-check",
  "press-check",
  "side-panel-check",
  "table-check",
  "description-list-check",
  "gauge-check",
  "master-detail",
  "master-detail-check",
  "dashboard-grid",
  "settings-page",
  "settings-page-check",
  "shell-block",
  "document-workspace",
  "server-data-check",
  "agent-workspace",
  "commit-history",
  "commit-branches",
  "commit-bench",
  "git-tree-bench",
  "perf",
  "sortable-check",
  "tree-focus-check",
  "git-view-check",
])

function Demo() {
  if (demo === "page") {
    return (
      <>
        <SkipLink>Skip to content</SkipLink>
        <PageDemo status={status satisfies DemoStatus} as="main" />
      </>
    )
  }
  if (demo === "overlay-check") return <OverlayCheck />
  if (demo === "sortable-check") return <SortableCheck />
  if (demo === "tree-focus-check") return <TreeFocusCheck />
  if (demo === "git-view-check") return <GitViewCheck />
  if (demo === "card-header-check") return <CardHeaderCheck />
  if (demo === "palette-reopen-check") return <PaletteReopenCheck />
  if (demo === "field-placement-check") return <FieldPlacementCheck />
  if (demo === "mobile-nav-check") return <MobileNavCheck />
  if (demo === "icon-tooltip-check") return <IconTooltipCheck />
  if (demo === "inbox") return <InboxDemo />
  if (demo === "list-bench") return <ListBench />
  if (demo === "diff-bench") return <DiffBench />
  if (demo === "calendar-check") return <CalendarCheck />
  if (demo === "press-check") return <PressCheck />
  if (demo === "side-panel-check") return <SidePanelCheck />
  if (demo === "table-check") return <TableCheck />
  if (demo === "description-list-check") return <DescriptionListCheck />
  if (demo === "gauge-check") return <GaugeCheck />
  if (demo === "master-detail") return <MasterDetailDemo />
  if (demo === "master-detail-check") return <MasterDetailCheck />
  if (demo === "dashboard-grid") return <DashboardGridDemo />
  if (demo === "settings-page") return <SettingsPageDemo />
  if (demo === "settings-page-check") return <SettingsPageCheck />
  if (demo === "shell-block") return <ShellBlockDemo />
  if (demo === "document-workspace") return <DocumentWorkspacePage />
  if (demo === "server-data-check") return <ServerDataCheck />
  if (demo === "agent-workspace") {
    return (
      <main className="p-inset-surface">
        <AgentWorkspace />
        <ToastStack />
      </main>
    )
  }
  if (demo === "commit-bench") return <GitBench kind="commits" />
  if (demo === "git-tree-bench") return <GitBench kind="files" />
  if (demo === "commit-branches") {
    return (
      <main className="flex min-h-dvh items-start justify-center bg-background p-inset-surface">
        <CommitBranchesDemo />
      </main>
    )
  }
  if (demo === "commit-history") {
    return (
      <main className="flex min-h-dvh items-start justify-center bg-background p-inset-surface">
        <CommitTrailDemo />
      </main>
    )
  }
  if (demo === "perf") return <PerfPage />
  return demo === "shell" ? <ShellDemo /> : <SiteDemo />
}

createRoot(root).render(
  <StrictMode>
    {demo !== null && standalone.has(demo) ? (
      <Appearance appearance={appearance}>
        <Demo />
      </Appearance>
    ) : (
      <App />
    )}
  </StrictMode>,
)
