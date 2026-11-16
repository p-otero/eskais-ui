import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { Appearance } from "@/components/ui/appearance"
import { SkipLink } from "@/components/ui/skip-link"

import { App } from "./app"
import { appearance } from "./appearance"
import { demoStatuses, PageDemo, type DemoStatus } from "./sections/page"
import { ShellDemo } from "./shell/shell-demo"
import { SiteDemo } from "./shell/site-demo"
import "./index.css"

const root = document.getElementById("root")
if (!root) throw new Error("Missing #root element")

// ?demo=page&status=error, ?demo=site and ?demo=shell render one demo alone, for screenshots at phone width.
const params = new URLSearchParams(location.search)
const status = demoStatuses.find((name) => name === params.get("status")) ?? "success"
const demo = params.get("demo")

function Demo() {
  if (demo === "page") {
    return (
      <>
        <SkipLink>Skip to content</SkipLink>
        <PageDemo status={status satisfies DemoStatus} as="main" />
      </>
    )
  }
  return demo === "shell" ? <ShellDemo /> : <SiteDemo />
}

createRoot(root).render(
  <StrictMode>
    {demo === "page" || demo === "site" || demo === "shell" ? (
      <Appearance appearance={appearance}>
        <Demo />
      </Appearance>
    ) : (
      <App />
    )}
  </StrictMode>,
)
