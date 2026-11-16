import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App } from "./app"
import { appearance } from "./appearance"
import "./index.css"

const root = document.getElementById("root")
if (!root) throw new Error("Missing #root element")

appearance.apply()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
