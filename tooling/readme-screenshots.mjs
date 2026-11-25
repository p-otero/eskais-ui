import { mkdirSync, statSync } from "node:fs"
import { join, resolve } from "node:path"

import { setAppearance, withShowcase } from "./showcase-browser.mjs"

const out = resolve(import.meta.dirname, "..", "docs", "images")
const width = 1280
mkdirSync(out, { recursive: true })

async function capture(page, element, file) {
  await element.evaluate((node) => {
    node.style.cssText =
      "position: fixed; inset: 0 0 auto 0; padding: 24px; background: var(--background); z-index: 9999"
  })
  await page.waitForTimeout(400)
  const box = await element.boundingBox()
  if (!box) throw new Error(`${file} has no box`)
  const path = join(out, file)
  await page.screenshot({ path, animations: "disabled", clip: { x: 0, y: 0, width, height: Math.ceil(box.height) } })
  console.log(path, `${Math.round(statSync(path).size / 1024)} KB`)
}

await withShowcase(
  async (page) => {
    await setAppearance(page, "default", "light")
    const board = page.getByRole("region", { name: "AgentTaskBoard" }).locator('[data-slot="agent-task-board"]')
    await capture(page, board, "agent-task-board.png")
  },
  { viewport: { width, height: 1400 }, colorScheme: "light" },
)
