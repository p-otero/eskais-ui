import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { Appearance } from "@/components/ui/appearance"
import { SkipLink } from "@/components/ui/skip-link"

import { App } from "./app"
import { appearance } from "./appearance"
import { CalendarCheck } from "./checks/calendar-check"
import { CardHeaderCheck } from "./checks/card-header-check"
import { PaletteReopenCheck } from "./checks/palette-reopen-check"
import { DescriptionListCheck } from "./checks/description-list-check"
import { FieldPlacementCheck } from "./checks/field-placement-check"
import { GaugeCheck } from "./checks/gauge-check"
import { IconTooltipCheck } from "./checks/icon-tooltip-check"
import { MasterDetailCheck } from "./checks/master-detail-check"
import { MobileNavCheck } from "./checks/mobile-nav-check"
import { ListBench } from "./checks/list-bench"
import { OverlayCheck } from "./checks/overlay-check"
import { PressCheck } from "./checks/press-check"
import { SidePanelCheck } from "./checks/side-panel-check"
import { TableCheck } from "./checks/table-check"
import { ServerDataCheck } from "./checks/server-data-check"
import { DocumentWorkspacePage } from "./sections/document-workspace"
import { InboxDemo } from "./sections/inbox"
import { DashboardGridDemo, MasterDetailDemo, SettingsPageDemo } from "./sections/layout-blocks"
import { demoStatuses, PageDemo, type DemoStatus } from "./sections/page"
import { ShellBlockDemo } from "./shell/shell-block-demo"
import { ShellDemo } from "./shell/shell-demo"
import { SiteDemo } from "./shell/site-demo"
import "./index.css"

const root = document.getElementById("root")
if (!root) throw new Error("Missing #root element")

// ?demo=page, site, shell, inbox, list-bench, shell-block, master-detail, dashboard-grid, settings-page and
// document-workspace render one demo alone (phone-width screenshots); ?demo=<name>-check pages are tooling/<name>-
// check.mjs fixtures (shell-check's: card-header, description-list, field-placement, gauge, mobile-nav, palette-reopen,
// side-panel, table, master-detail); server-data-check takes ?ui=search|chips|panel|list.
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
  "shell-block",
  "document-workspace",
  "server-data-check",
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
  if (demo === "card-header-check") return <CardHeaderCheck />
  if (demo === "palette-reopen-check") return <PaletteReopenCheck />
  if (demo === "field-placement-check") return <FieldPlacementCheck />
  if (demo === "mobile-nav-check") return <MobileNavCheck />
  if (demo === "icon-tooltip-check") return <IconTooltipCheck />
  if (demo === "inbox") return <InboxDemo />
  if (demo === "list-bench") return <ListBench />
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
  if (demo === "shell-block") return <ShellBlockDemo />
  if (demo === "document-workspace") return <DocumentWorkspacePage />
  if (demo === "server-data-check") return <ServerDataCheck />
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
