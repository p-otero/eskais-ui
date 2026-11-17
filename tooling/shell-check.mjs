// Drives the showcase where layout decides what shows: the Topbar's ⌘K dialog and Sidebar drawer, tabs and
// MobileNav labels at phone widths; CardHeader and SidePanel headers where actions wrap; SidePanel's narrow modes;
// a wrapping DataTable column; DescriptionList layouts; ring meters and stat deltas (?demo=<name>-check).
// Usage: node tooling/shell-check.mjs [--screenshots=<dir>] (after `bun run build:showcase`)
import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"

import { withShowcase } from "./showcase-browser.mjs"

const failures = []
const shotsArg = process.argv.find((arg) => arg.startsWith("--screenshots="))
const shots = shotsArg ? resolve(shotsArg.slice("--screenshots=".length)) : undefined
if (shots) mkdirSync(shots, { recursive: true })

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

async function shot(page, file, fullPage = false) {
  if (!shots) return
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(shots, file), animations: "disabled", fullPage })
  console.log(`     ${join(shots, file)}`)
}

// Rendered and inside the viewport. A dialog left in a hidden slot is open but has no box, and isn't in the
// accessibility tree either, so a role locator never finds it.
async function onScreen(locator) {
  const found = await locator.waitFor({ timeout: 3000 }).then(
    () => true,
    () => false,
  )
  if (!found) return false
  return locator.evaluate(async (element) => {
    // The transition starts a frame after data-starting-style goes, so wait for that before waiting for it to end.
    const started = () =>
      element.hasAttribute("data-starting-style") ? new Promise(requestAnimationFrame).then(started) : undefined
    await started()
    await new Promise(requestAnimationFrame)
    await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished))
    const box = element.getBoundingClientRect()
    return (
      element.checkVisibility() &&
      box.width > 0 &&
      box.height > 0 &&
      box.left >= -1 &&
      box.right <= innerWidth + 1 &&
      box.bottom <= innerHeight + 1
    )
  })
}

async function shell(page, width) {
  await page.setViewportSize({ width, height: 720 })
  await page.goto(`${new URL(page.url()).origin}/?demo=shell`)
  await page.getByRole("navigation", { name: "Workspace" }).first().waitFor({ state: "attached" })
  await page.evaluate(() => document.fonts.ready)
}

// The tab sits inside the list's box, clear of the edge fades (their widths are 0 on a side with nothing to scroll to).
async function clearOfFades(tab) {
  return tab.evaluate(async (element) => {
    const list = element.closest('[role="tablist"]')
    await new Promise((done) => setTimeout(done, 600))
    const style = getComputedStyle(list)
    const fadeLeft =
      Number.parseFloat(style.getPropertyValue("--fade-left")) *
      (style.getPropertyValue("--fade-left").includes("rem") ? 16 : 1)
    const fadeRight =
      Number.parseFloat(style.getPropertyValue("--fade-right")) *
      (style.getPropertyValue("--fade-right").includes("rem") ? 16 : 1)
    const box = element.getBoundingClientRect()
    const bounds = list.getBoundingClientRect()
    const ok = box.left >= bounds.left + fadeLeft - 1 && box.right <= bounds.right - fadeRight + 1
    return {
      ok,
      detail: `tab ${Math.round(box.left)}–${Math.round(box.right)}, clear ${Math.round(bounds.left + fadeLeft)}–${Math.round(bounds.right - fadeRight)}`,
    }
  })
}

async function checkTabs(page, dir) {
  await shell(page, 320)
  if (dir === "rtl") await page.evaluate(() => document.documentElement.setAttribute("dir", "rtl"))
  const tabs = page.getByRole("tablist", { name: "Workspace views" })
  await tabs.getByRole("tab", { name: "Overview" }).focus()
  await page.keyboard.press("End")
  const last = tabs.getByRole("tab", { name: "Settings" })
  const end = await clearOfFades(last)
  check(`${dir} 320px: End reveals the last tab clear of the fade`, end.ok, end.detail)
  if (dir === "ltr") await shot(page, "tabs-320.png")
  const back = dir === "rtl" ? "ArrowRight" : "ArrowLeft"
  await page.keyboard.press(back)
  await page.keyboard.press(back)
  await page.keyboard.press(back)
  await page.keyboard.press(back)
  const middle = await clearOfFades(page.locator('[role="tab"]:focus'))
  check(`${dir} 320px: arrowing back reveals the focused tab`, middle.ok, middle.detail)
  await page.keyboard.press("Home")
  const first = await clearOfFades(tabs.getByRole("tab", { name: "Overview" }))
  check(`${dir} 320px: Home reveals the first tab`, first.ok, first.detail)
  // A tab cut off at either edge, chosen by pointer near its visible end.
  const partial = await tabs.getByRole("tab").evaluateAll((all) => {
    const bounds = all[0].closest('[role="tablist"]').getBoundingClientRect()
    return all.find((tab) => {
      const box = tab.getBoundingClientRect()
      const cutStart = box.left < bounds.left - 1 && box.right > bounds.left + 8
      const cutEnd = box.right > bounds.right + 1 && box.left < bounds.right - 8
      return cutStart || cutEnd
    })?.textContent
  })
  if (partial) {
    await tabs.getByRole("tab", { name: partial, exact: true }).dispatchEvent("click")
    const clicked = await clearOfFades(tabs.getByRole("tab", { name: partial, exact: true }))
    check(
      `${dir} 320px: selecting a tab under the fade by pointer reveals it`,
      clicked.ok,
      `${partial}: ${clicked.detail}`,
    )
  }
}

// Beside the action, the title column keeps at least this much; below it the action wraps under the title.
const comfortableTitle = 11 * 16

async function checkCardHeaders(page) {
  await page.setViewportSize({ width: 1100, height: 900 })
  await page.goto(`${new URL(page.url()).origin}/?demo=card-header-check`)
  await page.getByTestId("card-26rem-wide").waitFor()
  await page.evaluate(() => document.fonts.ready)
  const cases = ["15rem", "19rem", "22rem", "26rem"].flatMap((width) =>
    ["short", "wide"].flatMap((kind) => ["card", "section"].map((part) => ({ width, kind, part }))),
  )
  const results = await Promise.all(
    cases.map(({ width, kind, part }) =>
      page.getByTestId(`${part}-${width}-${kind}`).evaluate((card) => {
        const header = card.querySelector('[data-slot="card-header"]')
        const title = card.querySelector('[data-slot="card-title"]').getBoundingClientRect()
        const description = card.querySelector('[data-slot="card-description"]').getBoundingClientRect()
        const action = card.querySelector('[data-slot="card-action"]').getBoundingClientRect()
        const bounds = header.getBoundingClientRect()
        const padding = Number.parseFloat(getComputedStyle(header).paddingRight)
        return {
          below: action.top >= description.bottom - 1,
          titleWidth: Math.round(Math.max(title.width, description.width)),
          overflow: action.right > bounds.right - padding + 1 || title.right > bounds.right - padding + 1,
        }
      }),
    ),
  )
  cases.forEach(({ width, kind, part }, index) => {
    const result = results[index]
    check(
      `card header ${width} ${kind} action (${part})`,
      !result.overflow && (result.below || result.titleWidth >= comfortableTitle),
      `${result.below ? "action below" : "action beside"}, title ${result.titleWidth}px`,
    )
  })
  await shot(page, "card-header-widths.png", true)
}

async function checkSidePanelHeader(page) {
  await page.setViewportSize({ width: 1100, height: 900 })
  await page.goto(`${new URL(page.url()).origin}/?demo=side-panel-check`)
  await page.getByTestId("side-panel-both").waitFor()
  await page.evaluate(() => document.fonts.ready)
  const kinds = ["both", "pill"]
  const results = await Promise.all(
    kinds.map((kind) =>
      page.getByTestId(`side-panel-${kind}`).evaluate((box) => {
        const panel = box.querySelector('[data-slot="side-panel"]').getBoundingClientRect()
        const heading = box.querySelector('[data-slot="side-panel-heading"]').getBoundingClientRect()
        const description = box.querySelector('[data-slot="side-panel-description"]')
        const actions = box.querySelector('[data-slot="side-panel-actions"]').getBoundingClientRect()
        const header = box.querySelector('[data-slot="side-panel-header"]').getBoundingClientRect()
        const lines = Math.round(
          description.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(description).lineHeight),
        )
        return {
          width: Math.round(panel.width),
          below: actions.top >= heading.bottom - 1,
          headingWidth: Math.round(heading.width),
          lines,
          overflow: actions.right > header.right + 1,
        }
      }),
    ),
  )
  kinds.forEach((kind, index) => {
    const result = results[index]
    check(
      `SidePanel 24rem header, ${kind}: the title keeps room or the actions wrap below`,
      result.width === 384 &&
        !result.overflow &&
        (result.below || result.headingWidth >= comfortableTitle) &&
        result.lines <= 3,
      `${result.below ? "actions below" : "actions beside"}, heading ${result.headingWidth}px, description ${result.lines} lines`,
    )
  })
  await shot(page, "side-panel-24rem.png", true)
}

async function checkSidePanelNarrow(page) {
  await page.setViewportSize({ width: 375, height: 720 })
  const origin = new URL(page.url()).origin
  const boxes = () =>
    page.evaluate(() =>
      Object.fromEntries(
        Object.entries({
          layout: '[data-testid="layout"]',
          list: '[data-testid="list"]',
          panel: '[data-slot="side-panel"]',
        }).map(([key, selector]) => [key, document.querySelector(selector)?.getBoundingClientRect().toJSON()]),
      ),
    )

  await page.goto(`${origin}/?demo=side-panel-check&narrow=stack`)
  await page.getByRole("complementary").waitFor()
  await page.evaluate(() => document.fonts.ready)
  let { layout, list, panel } = await boxes()
  check(
    "SidePanel narrow=stack: the list keeps the full width and the panel follows below it",
    Math.abs(list.width - layout.width) <= 2 &&
      Math.abs(panel.width - layout.width) <= 2 &&
      panel.top >= list.bottom - 1,
    `list ${Math.round(list.width)}px wide, panel at ${Math.round(panel.top)} below ${Math.round(list.bottom)}`,
  )
  await shot(page, "side-panel-narrow-stack.png", true)

  await page.goto(`${origin}/?demo=side-panel-check&narrow=overlay`)
  await page.getByRole("complementary").waitFor()
  ;({ layout, list, panel } = await boxes())
  check(
    "SidePanel narrow=overlay: the panel covers its positioned parent",
    Math.abs(panel.top - layout.top) <= 2 &&
      Math.abs(panel.width - layout.width) <= 2 &&
      panel.bottom >= list.bottom - 1,
  )
  await shot(page, "side-panel-narrow-overlay.png")

  await page.goto(`${origin}/?demo=side-panel-check&narrow=sheet`)
  const sheet = page.getByRole("dialog", { name: "Webhook retries" })
  check("SidePanel narrow=sheet: a visible bottom sheet", await onScreen(sheet))
  const inside = await sheet.evaluate((element) => element.contains(document.activeElement))
  check("SidePanel narrow=sheet: focus moves into the sheet", inside)
  await shot(page, "side-panel-narrow-sheet.png")
  await page.keyboard.press("Escape")
  await sheet.waitFor({ state: "detached" })
  const focused = await page.evaluate(() =>
    document.activeElement?.closest("[data-item-id]")?.getAttribute("data-item-id"),
  )
  check("SidePanel narrow=sheet: Escape closes it and focus returns to the row", focused === "Webhook retries", focused)
}

async function checkTableWrap(page) {
  await page.setViewportSize({ width: 1100, height: 700 })
  await page.goto(`${new URL(page.url()).origin}/?demo=table-check`)
  const table = page.getByTestId("table")
  await table.getByRole("cell").first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  const cells = await table
    .locator("tbody tr")
    .first()
    .getByRole("cell")
    .evaluateAll((all) =>
      all.map((cell) => ({
        lines: Math.round(cell.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(cell).lineHeight)),
        cut: cell.scrollWidth > cell.clientWidth + 1,
        ellipsis: getComputedStyle(cell).textOverflow === "ellipsis",
      })),
    )
  const [, title, summary] = cells
  check(
    "DataTable wrap: the wrapped column shows its whole text on several lines",
    summary.lines >= 2 && !summary.cut && !summary.ellipsis,
    `${summary.lines} lines`,
  )
  check("DataTable wrap: the column beside it still truncates with an ellipsis", title.cut && title.ellipsis)
  const titleCell = table.locator("tbody tr").first().getByRole("cell").nth(1)
  await titleCell.hover()
  const hint = await titleCell.getAttribute("title")
  check(
    "DataTable wrap: a cut-off cell shows its whole text in a title on hover",
    hint?.startsWith("Webhook retries"),
    hint,
  )
  await shot(page, "table-wrap.png")
}

async function checkDescriptionList(page) {
  await page.setViewportSize({ width: 1100, height: 900 })
  await page.goto(`${new URL(page.url()).origin}/?demo=description-list-check`)
  await page.getByTestId("grid-wide").waitFor()
  await page.evaluate(() => document.fonts.ready)
  const measure = (id) =>
    page.getByTestId(id).evaluate((list) => {
      const items = [...list.querySelectorAll('[data-slot="description-item"]')]
      const tops = new Set(items.map((item) => Math.round(item.getBoundingClientRect().top)))
      const first = items[0]
      const term = first.querySelector("dt").getBoundingClientRect()
      const details = first.querySelector("dd").getBoundingClientRect()
      return { rows: tops.size, beside: Math.abs(term.top - details.top) < term.height }
    })
  const [inlineWide, inlineNarrow, gridWide, gridNarrow] = await Promise.all(
    ["inline-wide", "inline-narrow", "grid-wide", "grid-narrow"].map((id) => measure(id)),
  )
  check("DescriptionList inline: term beside details in a wide list", inlineWide.beside)
  check("DescriptionList inline: term above details under 24rem of list", !inlineNarrow.beside)
  check(
    "DescriptionList grid: three columns at 40rem (4 items in 2 rows)",
    gridWide.rows === 2,
    `${gridWide.rows} rows`,
  )
  check("DescriptionList grid: one column at 20rem", gridNarrow.rows === 4, `${gridNarrow.rows} rows`)
  await shot(page, "description-list-layouts.png", true)
}

async function checkGauges(page) {
  await page.setViewportSize({ width: 1100, height: 900 })
  await page.goto(`${new URL(page.url()).origin}/?demo=gauge-check`)
  const storage = page.getByRole("meter", { name: "Storage" })
  await storage.waitFor()
  await page.evaluate(() => document.fonts.ready)
  const ring = await storage.evaluate((meter) => {
    const arc = meter.querySelector('[data-slot="meter-ring-arc"]')
    const value = meter.querySelector('[data-slot="meter-value"]').getBoundingClientRect()
    const box = meter.querySelector("svg").getBoundingClientRect()
    return {
      dash: arc.getAttribute("stroke-dasharray"),
      centred:
        Math.abs(value.left + value.width / 2 - (box.left + box.width / 2)) < 2 &&
        Math.abs(value.top + value.height / 2 - (box.top + box.height / 2)) < 2,
      now: meter.getAttribute("aria-valuenow"),
    }
  })
  check(
    "Ring meter: role=meter with its value, the arc at 68 of 100",
    ring.now === "68" && ring.dash === "68 100",
    ring.dash,
  )
  check("Ring meter: the value sits in the centre of the ring", ring.centred)
  const sizes = await page
    .getByTestId("rings")
    .locator("svg")
    .evaluateAll((svgs) => svgs.map((svg) => Math.round(svg.getBoundingClientRect().width)))
  check("Ring meter: sm < md < lg", sizes[0] < sizes[1] && sizes[1] < sizes[2], sizes.join(", "))
  const deltas = await page
    .getByTestId("stats")
    .locator('[data-slot="stat-delta"]')
    .evaluateAll((all) =>
      all.map((delta) => ({
        direction: delta.dataset.direction,
        tone: delta.dataset.tone,
        spoken: delta.querySelector(".sr-only")?.textContent,
      })),
    )
  check(
    "StatDelta: up, down, inverted down and flat, in words and in their tones",
    JSON.stringify(deltas.map((delta) => [delta.direction, delta.tone])) ===
      JSON.stringify([
        ["up", "success"],
        ["down", "destructive"],
        ["down", "success"],
        ["flat", "neutral"],
      ]) && deltas[0].spoken === "up 12%",
    deltas.map((delta) => delta.spoken).join(" | "),
  )
  await shot(page, "gauges.png")
  await page.emulateMedia({ reducedMotion: "reduce" })
  const duration = await storage.evaluate(
    (meter) => getComputedStyle(meter.querySelector('[data-slot="meter-ring-arc"]')).transitionDuration,
  )
  check("Ring meter: no animation under reduced motion", Number.parseFloat(duration) <= 0.01, duration)
  await page.emulateMedia({ reducedMotion: "no-preference" })
}

async function checkMobileNav(page) {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto(`${new URL(page.url()).origin}/?demo=mobile-nav-check`)
  const nav = page.getByRole("navigation", { name: "Primary" })
  await nav.waitFor()
  await page.evaluate(() => document.fonts.ready)
  const links = await nav.getByRole("link").count()
  const more = await nav.getByRole("button", { name: "More" }).count()
  check("MobileNav: five routes without overflow fill five slots, no More", links === 5 && more === 0, `${links} links`)
  const labels = await nav.locator('[data-slot="mobile-nav-label"]').evaluateAll((spans) =>
    spans.map((span) => {
      const slot = span.parentElement.getBoundingClientRect()
      const box = span.getBoundingClientRect()
      return {
        text: span.textContent,
        clipped: span.scrollWidth > span.clientWidth + 1,
        outside: box.left < slot.left - 0.5 || box.right > slot.right + 0.5 || box.bottom > slot.bottom + 0.5,
        size: getComputedStyle(span).fontSize,
      }
    }),
  )
  for (const label of labels) {
    check(`MobileNav 320px: "${label.text}" shows whole, inside its slot`, !label.clipped && !label.outside, label.size)
  }
  const gap = await page.evaluate(() => {
    const bar = document.querySelector('nav[aria-label="Primary"]').getBoundingClientRect()
    const main = document.querySelector('[data-testid="page"]')
    return Math.round(bar.height - Number.parseFloat(getComputedStyle(main).marginBottom))
  })
  check("MobileNav: --mobile-nav-offset covers the bar, border included", gap === 0, `bar minus offset ${gap}px`)
  await shot(page, "mobile-nav-320.png")

  await page.goto(`${new URL(page.url()).origin}/?demo=mobile-nav-check&overflow`)
  await nav.waitFor()
  const routes = await nav.getByRole("link").count()
  const moreButton = await nav.getByRole("button", { name: "More" }).count()
  check("MobileNav: with overflow, four routes and More", routes === 4 && moreButton === 1, `${routes} links`)
}

await withShowcase(async (page) => {
  await shell(page, 375)
  const search = page.getByRole("dialog", { name: "Search the workspace" })
  await page.getByRole("button", { name: "Search the workspace" }).click()
  check("narrow: the compact search button opens a visible dialog", await onScreen(search))
  await shot(page, "topbar-search-narrow.png")
  await page.keyboard.press("Escape")
  await search.waitFor({ state: "detached" })
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Search the workspace")
  await page.keyboard.press("ControlOrMeta+k")
  check("narrow: mod+k opens a visible dialog", await onScreen(search))
  await page.keyboard.press("Escape")
  await search.waitFor({ state: "detached" })

  const banner = page.getByRole("banner")
  check(
    "narrow: one drawer button, in the Topbar",
    (await page.getByRole("button", { name: "Open navigation" }).count()) === 1,
  )
  await banner.getByRole("button", { name: "Open navigation" }).click()
  const drawer = page.getByRole("dialog", { name: "Workspace" })
  check("narrow: the Topbar's SidebarTrigger opens a visible sidebar drawer", await onScreen(drawer))
  await shot(page, "sidebar-drawer-narrow.png")
  await page.keyboard.press("Escape")
  await drawer.waitFor({ state: "detached" })
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))
  check("narrow: closing the drawer returns focus to the Topbar trigger", focused === "Open navigation", focused)

  await checkTabs(page, "ltr")
  await checkTabs(page, "rtl")
  await shell(page, 320)
  await page.goto(`${new URL(page.url()).origin}/?demo=shell&view=Settings`)
  const preselected = await clearOfFades(page.getByRole("tab", { name: "Settings" }))
  check("320px: a tab selected on load is scrolled into view", preselected.ok, preselected.detail)

  await checkCardHeaders(page)
  await checkSidePanelHeader(page)
  await checkSidePanelNarrow(page)
  await checkTableWrap(page)
  await checkDescriptionList(page)
  await checkGauges(page)
  await checkMobileNav(page)
})

if (failures.length > 0) {
  console.error(`\n${failures.length} shell check(s) failed`)
  process.exit(1)
}
