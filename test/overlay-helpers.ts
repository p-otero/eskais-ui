import { act } from "@testing-library/react"
import axe from "axe-core"

async function axeViolations(root: Element) {
  const result = await axe.run(root, { rules: { "color-contrast": { enabled: false } } })
  return result.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.html).join(", ")}`)
}

// Some UI SDK state, like agent registration, lands a tick after mounting.
function settle(ms = 0) {
  return act(() => new Promise((resolve) => setTimeout(resolve, ms)))
}

export { axeViolations, settle }
