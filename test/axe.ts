import axe from "axe-core"

async function axeViolations(root: Element) {
  const result = await axe.run(root, { rules: { "color-contrast": { enabled: false } } })
  return result.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.html).join(", ")}`)
}

export { axeViolations }
