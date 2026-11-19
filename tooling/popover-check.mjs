// Drives ?demo=popover-check in Chrome: a popover open from the start stays open while its dialog takes initial
// focus, and closes as usual once focus leaves it.
// Usage: node tooling/popover-check.mjs (after `bun run build:showcase`)
import { withShowcase } from "./showcase-browser.mjs"

const failures = []

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

await withShowcase(async (page) => {
  await page.goto(`${new URL(page.url()).origin}/?demo=popover-check`)
  await page.getByRole("button", { name: "Open task" }).click()
  const task = page.getByRole("dialog", { name: "Task with an open popover" })
  await task.waitFor()
  await page.waitForTimeout(400)
  const popover = page.getByRole("dialog", { name: "Acceptance criteria" })
  check("defaultOpen in a dialog: the popover is open after the dialog took focus", await popover.isVisible())
  check(
    "defaultOpen in a dialog: the dialog holds focus",
    await task.evaluate((element) => element === document.activeElement),
  )
  await page.getByRole("button", { name: "After the popover" }).focus()
  await page.waitForTimeout(200)
  check("defaultOpen in a dialog: focus leaving it then closes it", !(await popover.isVisible()))
  await page.keyboard.press("Escape")
  await task.waitFor({ state: "hidden" })
})

if (failures.length > 0) {
  console.error(`\n${failures.length} popover check(s) failed`)
  process.exit(1)
}
