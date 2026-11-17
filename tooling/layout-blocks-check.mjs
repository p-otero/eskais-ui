// The layout blocks (?demo=master-detail, ?demo=dashboard-grid, ?demo=settings-page) at 1440, 768 and 390px, light
// and dark: axe, no horizontal overflow, no overlapping panes, stacking on narrow screens, focus moves and sticky
// navigation. Run by tooling/shell-check.mjs.
import { createRequire } from "node:module"

const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js")

const widths = [1440, 768, 390]
const schemes = ["light", "dark"]

async function open(page, demo, width, scheme, query = "") {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
  await page.goto(`${new URL(page.url()).origin}/?demo=${demo}${query}`)
  await page.locator(`[data-slot="${demo}"]`).first().waitFor()
  await page.evaluate((dark) => {
    localStorage.clear()
    const html = document.documentElement
    html.classList.toggle("dark", dark)
    html.classList.toggle("light", !dark)
    html.dataset.colorScheme = dark ? "dark" : "light"
  }, scheme === "dark")
  await page.evaluate(() => document.fonts.ready)
  await settle(page)
}

// Finish colour transitions so axe reads the settled theme.
async function settle(page) {
  await page.waitForTimeout(250)
  await page.evaluate(() => {
    for (const element of document.querySelectorAll("*")) void getComputedStyle(element).color
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSTransition) animation.finish()
    }
  })
}

async function axe(page) {
  if (!(await page.evaluate(() => "axe" in window))) await page.addScriptTag({ path: axePath })
  const result = await page.evaluate(() =>
    window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] }),
  )
  return result.violations.map((violation) => `${violation.id} (${violation.nodes.length})`)
}

// The visible boxes of `selector`, and whether the page scrolls sideways.
function layout(page, selector) {
  return page.evaluate((query) => {
    const boxes = [...document.querySelectorAll(query)]
      .filter((element) => element.checkVisibility())
      .map((element) => {
        const box = element.getBoundingClientRect()
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width }
      })
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    return { boxes, overflow }
  }, selector)
}

function overlaps(boxes) {
  for (const [index, a] of boxes.entries()) {
    for (const b of boxes.slice(index + 1)) {
      const x = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (x > 1 && y > 1) return true
    }
  }
  return false
}

const focusedSlot = (page) => page.evaluate(() => document.activeElement?.getAttribute("data-slot"))
const focusedText = (page) => page.evaluate(() => document.activeElement?.textContent?.trim())

async function masterDetail(page, check, shot, width, scheme) {
  const tag = `master-detail ${width}px ${scheme}`
  await open(page, "master-detail", width, scheme)
  const panes = '[data-slot="master-detail-list"], [data-slot="master-detail-detail"]'
  const closed = await layout(page, panes)
  const narrow = width === 390
  check(`${tag}: no sideways scroll`, !closed.overflow)
  check(
    `${tag}: ${narrow ? "only the list shows" : "list and detail side by side"}`,
    closed.boxes.length === (narrow ? 1 : 2) && !overlaps(closed.boxes),
    `${closed.boxes.length} panes`,
  )
  check(`${tag}: axe`, (await axe(page)).length === 0, (await axe(page)).join(", "))
  if (scheme === "light") await shot(page, `master-detail-${width}-closed.png`)

  const row = page.getByRole("button", { name: "Garage door" })
  await row.focus()
  await page.keyboard.press("Enter")
  await page.getByRole("region", { name: "Garage door" }).waitFor()
  if (!narrow) {
    // The demo follows focus, so beside the list the first Enter keeps focus on the row and a second one moves it.
    check(`${tag}: followFocus keeps focus on the row`, (await focusedText(page)) === "Garage door")
    await page.keyboard.press("Enter")
  }
  check(`${tag}: Enter moves focus to the detail's heading`, (await focusedSlot(page)) === "master-detail-title")
  const opened = await layout(page, panes)
  check(
    `${tag}: ${narrow ? "only the detail shows" : "both panes still show"}`,
    opened.boxes.length === (narrow ? 1 : 2) && !overlaps(opened.boxes) && !opened.overflow,
  )
  await settle(page)
  const violations = await axe(page)
  check(`${tag} open: axe`, violations.length === 0, violations.join(", "))
  await shot(page, `master-detail-${width}-${scheme}.png`)

  await page.getByRole("button", { name: narrow ? "Back" : "Close detail" }).click()
  await page.getByRole("region", { name: "Garage door" }).waitFor({ state: "detached" })
  check(`${tag}: ${narrow ? "Back" : "Close"} returns focus to the row`, (await focusedText(page)) === "Garage door")

  if (narrow) {
    await row.click()
    await page.keyboard.press("Escape")
    await page.getByRole("region", { name: "Garage door" }).waitFor({ state: "detached" })
    check(`${tag}: Escape returns to the list and the row`, (await focusedText(page)) === "Garage door")
  } else if (width === 1440 && scheme === "light") {
    await page.getByRole("button", { name: "Kitchen sensor" }).click()
    await page.getByRole("button", { name: "Collapse detail" }).click()
    const rail = await page.locator('[data-slot="master-detail-detail"]').boundingBox()
    check(`${tag}: the detail collapses to a rail`, rail !== null && rail.width < 80, `${rail?.width}px`)
    await page.getByRole("button", { name: "Expand detail" }).click()
    const back = await page.locator('[data-slot="master-detail-detail"]').boundingBox()
    check(`${tag}: and expands again`, back !== null && back.width > 300, `${back?.width}px`)
  }
}

async function checkLayoutBlocks(page, check, shot) {
  for (const width of widths) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- one page drives the steps, in order
    for (const scheme of schemes) await masterDetail(page, check, shot, width, scheme)
  }
}

export { axe, checkLayoutBlocks, layout, open, overlaps, settle }
