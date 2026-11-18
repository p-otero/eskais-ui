// ?demo=server-data-check in Chrome, 1440 and 390px, light and dark, each filter UI: axe, scroll, overlap; the live
// region, "Loading…" past 400 ms, focus on the pressed control, the URL, chips, and the panel as a sheet when narrow.
// Usage: node tooling/server-data-check.mjs [--screenshots <dir>] (after `bun run build:showcase`)
import { mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { join, resolve } from "node:path"

import { withShowcase } from "./showcase-browser.mjs"

const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js")
const flag = process.argv.indexOf("--screenshots")
const shots = flag === -1 ? undefined : resolve(process.argv[flag + 1] ?? "screenshots/server-data")
if (shots) mkdirSync(shots, { recursive: true })

const failures = []

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

const widths = [1440, 390]
const schemes = ["light", "dark"]
const uis = [
  { ui: "search", hash: "#?q=login" },
  { ui: "chips", hash: "#?status=open,blocked&points=gte:3" },
  { ui: "panel", hash: "#?status=blocked" },
]

function status(page) {
  return page.locator("[data-slot=server-data-table-footer] output")
}

let runs = 0

// A new query string each time, so `goto` loads the page again instead of only changing the hash. The showcase
// starts in light mode; dark is set on <html> the way `createAppearance` does.
async function open(page, { ui, hash = "", width, scheme, delay = 500 }) {
  await page.setViewportSize({ width, height: width > 800 ? 900 : 844 })
  const origin = new URL(page.url()).origin
  runs += 1
  await page.goto(`${origin}/?demo=server-data-check&ui=${ui}&delay=${String(delay)}&run=${String(runs)}${hash}`)
  await status(page)
    .filter({ hasText: /^Showing|^No results/ })
    .waitFor()
  if (scheme === "dark")
    await page.evaluate(() => {
      document.documentElement.classList.remove("light")
      document.documentElement.classList.add("dark")
      document.documentElement.dataset.colorScheme = "dark"
    })
}

async function axe(page) {
  if (!(await page.evaluate(() => "axe" in window))) await page.addScriptTag({ path: axePath })
  return page.evaluate(async () => {
    const result = await window.axe.run(document.querySelector("main"), { resultTypes: ["violations"] })
    return result.violations.map((violation) => `${violation.id} (${String(violation.nodes.length)})`)
  })
}

// Controls in the toolbar and footer whose boxes overlap, other than one inside another.
function overlaps(page) {
  return page.evaluate(() => {
    const selector = [
      "[data-slot=filter-scope] button",
      "[data-slot=filter-scope] input",
      "[data-slot=server-data-table-footer] output",
      "[data-slot=server-data-table-footer] button",
      "[data-slot=server-data-table-footer] [role=combobox]",
    ].join(",")
    const elements = [...document.querySelectorAll(selector)].filter((element) => element.getClientRects().length > 0)
    const found = []
    for (const [index, a] of elements.entries()) {
      for (const b of elements.slice(index + 1)) {
        if (a.contains(b) || b.contains(a)) continue
        const one = a.getBoundingClientRect()
        const two = b.getBoundingClientRect()
        const width = Math.min(one.right, two.right) - Math.max(one.left, two.left)
        const height = Math.min(one.bottom, two.bottom) - Math.max(one.top, two.top)
        if (width > 1 && height > 1)
          found.push(`${a.textContent?.trim() || a.tagName} × ${b.textContent?.trim() || b.tagName}`)
      }
    }
    return found
  })
}

async function settle(page) {
  await page.waitForTimeout(250)
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSTransition) animation.finish()
    }
  })
}

await withShowcase(async (page) => {
  for (const { ui, hash } of uis) {
    for (const width of widths) {
      for (const scheme of schemes) {
        const label = `${ui} ${String(width)}px ${scheme}`
        await open(page, { ui, hash, width, scheme, delay: 0 })
        const dark = await page.evaluate(() => document.documentElement.classList.contains("dark"))
        check(`${label}: color scheme applied`, dark === (scheme === "dark"))
        if (ui === "panel") {
          await page.getByRole("button", { name: /^Filters/ }).click()
          await (
            width > 800
              ? page.getByRole("complementary", { name: "Filters" })
              : page.getByRole("dialog", { name: "Filters" })
          ).waitFor()
        }
        await settle(page)
        const violations = await axe(page)
        check(`${label}: 0 axe violations`, violations.length === 0, violations.join(", "))
        const scroll = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
        check(`${label}: no horizontal scroll`, scroll <= 0, `${String(scroll)}px`)
        if (width > 800) {
          const table = await page.evaluate(() => {
            const scroller = document.querySelector("[data-slot=data-table] [data-slot=scroll-area-viewport]")
            return scroller ? scroller.scrollWidth - scroller.clientWidth : 0
          })
          check(`${label}: the table fits without scrolling sideways`, table <= 0, `${String(table)}px`)
        }
        const overlapping = await overlaps(page)
        check(`${label}: no overlapping controls`, overlapping.length === 0, overlapping.join("; "))
        if (shots) await page.screenshot({ path: join(shots, `${ui}-${String(width)}-${scheme}.png`), fullPage: true })
      }
    }
  }

  for (const width of widths) {
    await open(page, { ui: "search", width, scheme: "light", delay: 700 })
    const next = page.getByRole("button", { name: "Next page" })
    check(
      `${String(width)}px: the live region says what is shown`,
      (await status(page).textContent()) === "Showing 1–10 of 312",
    )
    await next.click()
    const quiet = await status(page).textContent()
    check(`${String(width)}px: no "Loading…" before 400 ms`, quiet !== "Loading…", JSON.stringify(quiet))
    await status(page).filter({ hasText: "Loading…" }).waitFor({ timeout: 2000 })
    check(`${String(width)}px: "Loading…" once the load takes 400 ms`, true)
    await status(page).filter({ hasText: "Showing 11–20 of 312" }).waitFor()
    check(`${String(width)}px: the live region after paging`, true)
    check(
      `${String(width)}px: focus stays on Next page`,
      await next.evaluate((element) => element === document.activeElement || element.contains(document.activeElement)),
    )
    check(`${String(width)}px: the page is in the URL`, (await page.evaluate(() => location.hash)).includes("page=2"))
    const rows = page.getByRole("table", { name: "Tasks" }).locator("tbody tr")
    check(
      `${String(width)}px: row navigation starts at the first row`,
      (await rows.first().getAttribute("tabindex")) === "0",
    )
    await page.keyboard.press("Shift+Tab")
    await page.keyboard.press("Tab")
    check(
      `${String(width)}px: focus moved by keyboard, not by the load`,
      await next.evaluate((element) => element === document.activeElement || element.contains(document.activeElement)),
    )
  }

  await open(page, { ui: "chips", width: 1440, scheme: "light", delay: 0 })
  await page.getByRole("button", { name: "Add filter" }).click()
  await page.getByRole("menuitem", { name: "Status" }).click()
  await page.getByRole("checkbox", { name: "Done" }).click()
  await status(page)
    .filter({ hasText: /of 78$/ })
    .waitFor()
  await page.keyboard.press("Escape")
  check("chips: a pick filters at once", await page.getByRole("button", { name: "Status: Done" }).isVisible())
  check("chips: the filter is in the URL", (await page.evaluate(() => location.hash)).includes("status=done"))

  await open(page, { ui: "panel", width: 1440, scheme: "light", delay: 0 })
  await page.getByRole("button", { name: /^Filters/ }).click()
  const side = page.getByRole("complementary", { name: "Filters" })
  check(
    "panel 1440px: a side panel, not a dialog",
    (await side.isVisible()) && (await page.getByRole("dialog").count()) === 0,
  )
  await side.getByRole("checkbox", { name: "Blocked" }).click()
  await side.getByRole("button", { name: "Apply filters" }).click()
  await page.getByRole("button", { name: "Filters 1" }).waitFor()
  check("panel 1440px: Apply filters and the trigger counts them", true)

  await open(page, { ui: "panel", width: 390, scheme: "light", delay: 0 })
  await page.getByRole("button", { name: /^Filters/ }).click()
  const sheet = page.getByRole("dialog", { name: "Filters" })
  await sheet.waitFor()
  check("panel 390px: a bottom sheet", (await sheet.getAttribute("data-side")) === "bottom")
  await sheet.getByRole("checkbox", { name: "Open" }).click()
  await sheet.getByRole("button", { name: "Apply filters" }).click()
  await sheet.waitFor({ state: "hidden" })
  check("panel 390px: Apply closes the sheet", true)
})

if (failures.length > 0) {
  console.error(`\n${String(failures.length)} server data checks failed`)
  process.exit(1)
}
console.log(`\nServer data check passed${shots ? `; screenshots in ${shots}` : ""}.`)
