import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { Appearance } from "@/components/ui/appearance"
import { SkipLink } from "@/components/ui/skip-link"

import { App } from "./app"
import { appearance } from "./appearance"
import { CalendarCheck } from "./checks/calendar-check"
import { CardHeaderCheck } from "./checks/card-header-check"
import { DescriptionListCheck } from "./checks/description-list-check"
import { GaugeCheck } from "./checks/gauge-check"
import { IconTooltipCheck } from "./checks/icon-tooltip-check"
import { MobileNavCheck } from "./checks/mobile-nav-check"
import { ListBench } from "./checks/list-bench"
import { OverlayCheck } from "./checks/overlay-check"
import { PressCheck } from "./checks/press-check"
import { SidePanelCheck } from "./checks/side-panel-check"
import { TableCheck } from "./checks/table-check"
import { InboxDemo } from "./sections/inbox"
import { DashboardGridDemo, MasterDetailDemo } from "./sections/layout-blocks"
import { demoStatuses, PageDemo, type DemoStatus } from "./sections/page"
import { ShellDemo } from "./shell/shell-demo"
import { SiteDemo } from "./shell/site-demo"
import "./index.css"

const root = document.getElementById("root")
if (!root) throw new Error("Missing #root element")

// ?demo=page, site and shell render one demo alone, for phone-width screenshots; ?demo=<name>-check pages are the
// fixtures of tooling/<name>-check.mjs (card-header, mobile-nav, side-panel, table, description-list and gauge
// are shell-check.mjs's); ?demo=inbox is the keyboard-first inbox alone, ?demo=master-detail and dashboard-grid
// a layout block alone, and ?demo=list-bench the list tooling/list-bench.mjs times.
const params = new URLSearchParams(location.search)
const status = demoStatuses.find((name) => name === params.get("status")) ?? "success"
const demo = params.get("demo")

const standalone = new Set([
  "page",
  "site",
  "shell",
  "overlay-check",
  "card-header-check",
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
  "dashboard-grid",
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
  if (demo === "dashboard-grid") return <DashboardGridDemo />
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
