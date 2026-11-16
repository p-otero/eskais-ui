import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { Appearance } from "@/components/ui/appearance"
import { SkipLink } from "@/components/ui/skip-link"

import { App } from "./app"
import { appearance } from "./appearance"
import { demoStatuses, PageDemo, type DemoStatus } from "./sections/page"
import "./index.css"

const root = document.getElementById("root")
if (!root) throw new Error("Missing #root element")

// ?demo=page&status=error renders the page demo alone, for screenshots at phone width.
const params = new URLSearchParams(location.search)
const status = demoStatuses.find((name) => name === params.get("status")) ?? "success"

createRoot(root).render(
  <StrictMode>
    {params.get("demo") === "page" ? (
      <Appearance appearance={appearance}>
        <SkipLink>Skip to content</SkipLink>
        <PageDemo status={status satisfies DemoStatus} as="main" />
      </Appearance>
    ) : (
      <App />
    )}
  </StrictMode>,
)
