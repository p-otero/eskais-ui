import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"

import { setAppearance, withShowcase } from "./showcase-browser.mjs"

const out = resolve(process.argv[2] ?? "screenshots")
mkdirSync(out, { recursive: true })

async function shot(target, file) {
  await target.screenshot({ path: join(out, file), animations: "disabled" })
  console.log(join(out, file))
}

await withShowcase(async (page) => {
  const section = (name) => page.getByRole("region", { name })

  await shot(section("Button"), "01-button.png")
  await page.getByRole("button", { name: "Save (async)" }).click()
  await shot(section("Button"), "02-button-pending.png")

  await page.getByRole("textbox", { name: "Email" }).focus()
  await shot(section("Input"), "03-input.png")

  const search = page.getByRole("searchbox", { name: "Search projects" })
  await search.fill("atlas")
  await search.press("Enter")
  await shot(section("SearchField"), "04-search-field.png")

  await shot(section("Card and Badge"), "05-card-badge.png")

  await page.getByRole("button", { name: "Rename project" }).click()
  await page.getByRole("dialog", { name: "Rename Apollo" }).waitFor()
  await page.waitForTimeout(250)
  await shot(page, "06-dialog.png")
  await page.keyboard.press("Escape")
  await page.getByRole("dialog", { name: "Rename Apollo" }).waitFor({ state: "hidden" })

  await page.getByRole("button", { name: "Delete project" }).click()
  await page.getByRole("alertdialog", { name: "Delete Apollo?" }).waitFor()
  await page.getByRole("button", { name: "Delete forever" }).click()
  await shot(page, "07-confirm-pending.png")
  await page.getByRole("alert").filter({ hasText: "Couldn't delete" }).waitFor()
  await shot(page, "08-confirm-error.png")
  await page.getByRole("button", { name: "Cancel" }).click()
  await page.getByRole("alertdialog", { name: "Delete Apollo?" }).waitFor({ state: "detached" })

  await page.getByRole("button", { name: "Agent: delete Apollo" }).click()
  await page.getByRole("alertdialog", { name: "Agent needs approval" }).waitFor()
  await page.waitForTimeout(250)
  await shot(page, "09-agent-approval.png")
  await page.getByRole("button", { name: "Deny" }).click()
  await page.getByText("refused:").waitFor()
  await shot(section("Agent bridge"), "10-agent-refused.png")

  await page.evaluate(() => window.scrollTo(0, 0))
  for (const theme of ["default", "compact", "glass"]) {
    for (const mode of ["light", "dark"]) {
      await setAppearance(page, theme, mode)
      await shot(page, `theme-${theme}-${mode}.png`)
    }
  }
  const glassOpacity = page.getByRole("slider", { name: "Glass opacity" })
  await glassOpacity.focus()
  for (let step = 0; step < 6; step++) await page.keyboard.press("ArrowLeft")
  await shot(page, "theme-glass-dark-30.png")
})
