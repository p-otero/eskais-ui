import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { Appearance } from "@/components/ui/appearance"
import { SkipLink } from "@/components/ui/skip-link"

import { App } from "./app"
import { appearance } from "./appearance"
import { CalendarCheck } from "./checks/calendar-check"
import { CardHeaderCheck } from "./checks/card-header-check"
import { IconTooltipCheck } from "./checks/icon-tooltip-check"
import { MobileNavCheck } from "./checks/mobile-nav-check"
import { ListBench } from "./checks/list-bench"
import { OverlayCheck } from "./checks/overlay-check"
import { PressCheck } from "./checks/press-check"
import { InboxDemo } from "./sections/inbox"
import { demoStatuses, PageDemo, type DemoStatus } from "./sections/page"
import { ShellDemo } from "./shell/shell-demo"
import { SiteDemo } from "./shell/site-demo"
import "./index.css"

const root = document.getElementById("root")
if (!root) throw new Error("Missing #root element")

// ?demo=page&status=error, ?demo=site and ?demo=shell render one demo alone, for screenshots at phone width;
// ?demo=overlay-check, card-header-check, mobile-nav-check, icon-tooltip-check, calendar-check and press-check are
// fixtures for tooling/overlay-check.mjs, shell-check.mjs, icon-tooltip-check.mjs, calendar-check.mjs and
// press-check.mjs; ?demo=inbox is the keyboard-first inbox alone, ?demo=list-bench the list tooling/list-bench.mjs
// times.
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
