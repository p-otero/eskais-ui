// Drives ?demo=popover-check in Chrome: hover opening (delay, crossing into it, closing on leave, Enter and a tap
// still open it), a defaultOpen popover staying open while its dialog takes initial focus, and ?demo=task-dialog
// opening with its header's AcceptancePopover open.
// Usage: node tooling/popover-check.mjs (after `bun run build:showcase`)
import { withShowcase } from "./showcase-browser.mjs"

const failures = []

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

async function center(locator) {
  const box = await locator.boundingBox()
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

await withShowcase(async (page) => {
  await page.goto(`${new URL(page.url()).origin}/?demo=popover-check`)
  const trigger = page.getByRole("button", { name: "Hover for criteria" })
  const hovered = page.getByRole("dialog", { name: "Hover criteria" })
  const start = await center(trigger)
  await page.mouse.move(start.x, start.y)
  await page.waitForTimeout(50)
  check("hover: nothing opens before the delay", !(await hovered.isVisible()))
  await hovered.waitFor()
  check("hover: opening leaves focus where it was", await page.evaluate(() => document.activeElement === document.body))
  const inside = await center(page.getByRole("button", { name: "Close criteria" }))
  await page.mouse.move(inside.x, inside.y, { steps: 8 })
  await page.waitForTimeout(400)
  check("hover: crossing into the popover keeps it open", await hovered.isVisible())
  const away = await center(page.getByText("Somewhere else on the page"))
  await page.mouse.move(away.x + 300, away.y, { steps: 8 })
  await hovered.waitFor({ state: "hidden" })
  check("hover: leaving it closes it", true)

  await trigger.focus()
  await page.waitForTimeout(300)
  check("hover: keyboard focus alone doesn't open it", !(await hovered.isVisible()))
  await page.keyboard.press("Enter")
  await hovered.waitFor()
  check(
    "hover: Enter opens it and moves focus in",
    await hovered.evaluate((element) => element.contains(document.activeElement)),
  )
  await page.keyboard.press("Escape")
  await hovered.waitFor({ state: "hidden" })

  const browser = page.context().browser()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const touch = await context.newPage()
  await touch.goto(page.url())
  await touch.getByRole("button", { name: "Hover for criteria" }).tap()
  await touch.getByRole("dialog", { name: "Hover criteria" }).waitFor()
  check("hover: a tap opens it on a touch screen", true)
  await context.close()

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

  await page.goto(`${new URL(page.url()).origin}/?demo=task-dialog&task=T-121&acceptance=1`)
  await page.getByRole("dialog", { name: /Back off webhook retries/ }).waitFor()
  await page.waitForTimeout(400)
  check(
    "task dialog: AcceptancePopover open from the start shows its criteria",
    await page.getByRole("dialog", { name: "Acceptance" }).isVisible(),
  )
})

if (failures.length > 0) {
  console.error(`\n${failures.length} popover check(s) failed`)
  process.exit(1)
}
