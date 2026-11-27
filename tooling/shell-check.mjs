import { mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { join, resolve } from "node:path"

import { checkLayoutBlocks } from "./layout-blocks-check.mjs"
import { withShowcase } from "./showcase-browser.mjs"

const failures = []
const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js")
const shotsArg = process.argv.find((arg) => arg.startsWith("--screenshots="))
const shots = shotsArg ? resolve(shotsArg.slice("--screenshots=".length)) : undefined
if (shots) mkdirSync(shots, { recursive: true })
const onlyLayout = process.argv.includes("--only=layout")
const onlySidebarDensity = process.argv.includes("--only=sidebar-density")

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

async function onScreen(locator) {
  const found = await locator.waitFor({ timeout: 3000 }).then(
    () => true,
    () => false,
  )
  if (!found) return false
  return locator.evaluate(async (element) => {
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

const comfortableTitle = 11 * 16

async function checkSegmentsIn(page, dir) {
  await page.evaluate((value) => document.documentElement.setAttribute("dir", value), dir)
  const problems = await page.evaluate(() => {
    const found = []
    const roots = document.querySelectorAll('[data-slot="time-input"], [data-slot="date-input"]')
    for (const root of roots) {
      const probe = document.createElement("span")
      probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre"
      document.body.append(probe)
      const segments = [...root.querySelectorAll("[data-type]")].map((segment) => {
        const box = segment.getBoundingClientRect()
        const style = getComputedStyle(segment)
        probe.style.font = style.font
        probe.style.fontVariantNumeric = style.fontVariantNumeric
        probe.textContent = segment.value || segment.placeholder || segment.textContent
        const width = segment.type === "literal" ? box.width : probe.getBoundingClientRect().width
        const centre = box.left + box.width / 2
        const half = segment.tagName === "INPUT" ? Math.min(width, box.width) / 2 : box.width / 2
        return {
          type: segment.dataset.type,
          box,
          left: centre - half,
          right: centre + half,
          size: Number.parseFloat(style.fontSize),
        }
      })
      for (const [index, segment] of segments.entries()) {
        if (segment.type !== "literal" && (segment.box.width < 24 || segment.box.height < 24))
          found.push(
            `${root.dataset.slot} ${segment.type} is a ${segment.box.width.toFixed(1)}x${segment.box.height.toFixed(1)}px target`,
          )
        const next = segments[index + 1]
        if (!next) continue
        if (
          segment.box.right > next.box.left + 1.5 &&
          next.box.right > segment.box.left + 1.5 &&
          segment.type !== "literal" &&
          next.type !== "literal"
        )
          found.push(`${root.dataset.slot} ${segment.type} and ${next.type} overlap`)
        const rtl = getComputedStyle(root).direction === "rtl"
        const gap = rtl ? segment.left - next.right : next.left - segment.right
        if (gap > segment.size * 0.3 || gap < -1.5)
          found.push(`${root.dataset.slot} ${segment.type}→${next.type} gap ${gap.toFixed(1)}px`)
      }
      probe.remove()
    }
    return { found, count: roots.length }
  })
  check(
    `${dir}: ${problems.count} date and time inputs: segments sit close and are 24px targets`,
    problems.count > 0 && problems.found.length === 0,
    problems.found.slice(0, 4).join("; "),
  )
}

async function checkSegments(page) {
  await page.setViewportSize({ width: 1100, height: 900 })
  await page.goto(`${new URL(page.url()).origin}/`)
  await page.locator('[data-slot="time-input"]').first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  await checkSegmentsIn(page, "ltr")
  await checkSegmentsIn(page, "rtl")
  await page.evaluate(() => document.documentElement.removeAttribute("dir"))
  await shot(page, "time-input-segments.png")
}

async function axesAt(page, attributes) {
  return page.evaluate((next) => {
    const html = document.documentElement
    for (const name of ["data-theme", "data-density", "data-radius"]) {
      if (next[name]) html.setAttribute(name, next[name])
      else html.removeAttribute(name)
    }
    const [button, item, card] = ['[data-slot="button"]', '[data-slot="sidebar-item"]', '[data-slot="card"]'].map(
      (selector) =>
        [...document.querySelectorAll(selector)].find((element) => element.getBoundingClientRect().height > 0) ?? null,
    )
    const [buttonRadius, itemRadius, cardRadius] = [button, item, card].map((element) =>
      element ? Number.parseFloat(getComputedStyle(element).borderTopLeftRadius) : null,
    )
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      control: button.getBoundingClientRect().height,
      button: buttonRadius,
      item: itemRadius,
      card: cardRadius,
    }
  }, attributes)
}

async function checkThemeAxes(page) {
  for (const width of [1100, 390]) {
    await shell(page, width)
    const results = {}
    for (const density of ["default", "compact"]) {
      for (const radius of ["none", "sm", "md", "lg", "full"]) {
        const attributes = { "data-density": density === "default" ? undefined : density, "data-radius": radius }
        const result = await axesAt(page, attributes)
        results[`${density}/${radius}`] = result
        check(
          `${width}px ${density}/${radius}: the shell fits the viewport`,
          result.overflow <= 0,
          `${result.overflow}px over`,
        )
      }
    }
    const pairs = ["none", "sm", "md", "lg", "full"].map((radius) => [
      results[`default/${radius}`],
      results[`compact/${radius}`],
    ])
    check(
      `${width}px: compact density shortens controls at every radius`,
      pairs.every(([normal, compact]) => compact.control < normal.control),
      pairs.map(([normal, compact]) => `${normal.control}→${compact.control}`).join(", "),
    )
    for (const density of ["default", "compact"]) {
      const none = results[`${density}/none`]
      const full = results[`${density}/full`]
      const sm = results[`${density}/sm`]
      check(
        `${width}px ${density}: radius none squares buttons, items and cards; full makes pills`,
        none.button === 0 &&
          (none.item ?? 0) === 0 &&
          (none.card ?? 0) === 0 &&
          full.button >= full.control / 2 &&
          sm.button > 0,
        JSON.stringify({ none, full: { button: full.button, control: full.control } }),
      )
      check(
        `${width}px ${density}: the radius doesn't change the density`,
        new Set(["none", "sm", "md", "lg", "full"].map((radius) => results[`${density}/${radius}`].control)).size === 1,
      )
    }
    const alias = await axesAt(page, { "data-theme": "compact" })
    const md = results["compact/md"]
    check(
      `${width}px: data-theme="compact" is compact density with the md radius`,
      alias.control === md.control && alias.button === md.button && alias.card === md.card,
      JSON.stringify({ alias, md }),
    )
    const aliasLarge = await axesAt(page, { "data-theme": "compact", "data-radius": "full" })
    check(
      `${width}px: data-radius beside data-theme="compact" wins`,
      aliasLarge.button === results["compact/full"].button && aliasLarge.control === md.control,
    )
    const aliasDefault = await axesAt(page, { "data-theme": "compact", "data-density": "default" })
    check(
      `${width}px: data-density="default" beside data-theme="compact" keeps the default density`,
      aliasDefault.control === results["default/md"].control && aliasDefault.button === md.button,
    )
    await shot(page, `theme-axes-${width}.png`)
    await axesAt(page, {})
  }
}

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
  const narrow = await page.getByTestId("narrow-rings").evaluate((grid) => {
    const cell = (grid.clientWidth - 2 * Number.parseFloat(getComputedStyle(grid).columnGap)) / 3
    return {
      overflow: grid.scrollWidth - grid.clientWidth,
      cell: Math.round(cell),
      widths: [...grid.querySelectorAll('[role="meter"]')].map((meter) =>
        Math.round(meter.getBoundingClientRect().width),
      ),
      truncated: [...grid.querySelectorAll('[data-slot="meter-label"]')].map(
        (label) => label.scrollWidth > label.clientWidth,
      ),
    }
  })
  check(
    "Ring meter: a long truncating label stays inside a narrow grid column and truncates",
    narrow.overflow <= 0 &&
      narrow.widths.every((width) => width <= narrow.cell + 1) &&
      narrow.truncated[0] &&
      narrow.truncated[1] &&
      !narrow.truncated[2],
    JSON.stringify(narrow),
  )
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

async function checkFieldPlacement(page) {
  await page.setViewportSize({ width: 1100, height: 720 })
  await page.goto(`${new URL(page.url()).origin}/?demo=field-placement-check`)
  await page.locator("[data-case]").first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  const cases = await page.locator("[data-case]").evaluateAll((wrappers) =>
    wrappers.map((wrapper) => {
      const field = wrapper.querySelector('[data-slot="field"]')
      const label = field.querySelector("label").getBoundingClientRect()
      const control = field.querySelector('[data-slot="select-trigger"], input')
      const valueNode = field.querySelector('[data-slot="select-value"]') ?? control
      const box = valueNode.getBoundingClientRect()
      const style = getComputedStyle(valueNode)
      const value =
        (box.top + Number.parseFloat(style.paddingTop) + box.bottom - Number.parseFloat(style.paddingBottom)) / 2
      return {
        name: wrapper.dataset.case,
        placement: field.dataset.labelPlacement,
        label: { top: label.top, bottom: label.bottom },
        control: { top: control.getBoundingClientRect().top, bottom: control.getBoundingClientRect().bottom },
        value,
      }
    }),
  )
  for (const { name, placement, label, control, value } of cases) {
    const expected = /boxed|explicit-top/.test(name) ? "top" : name.split("-")[0]
    const center = (label.top + label.bottom) / 2
    const placed = {
      top: label.bottom <= control.top + 1,
      in: label.top >= control.top - 1 && center < value - 4,
      on: Math.abs(center - control.top) <= 3,
    }[placement]
    check(
      `field placement ${name}: label ${expected}, clear of the value`,
      placement === expected && placed,
      `${placement}, label ${Math.round(label.top)}–${Math.round(label.bottom)}, control top ${Math.round(control.top)}, value line ${Math.round(value)}`,
    )
  }
  await shot(page, "field-placement.png")
}

async function shellBlock(page, width, scheme, query = "") {
  await page.setViewportSize({ width, height: 800 })
  await page.emulateMedia({ colorScheme: scheme })
  await page.goto(`${new URL(page.url()).origin}/?demo=shell-block${query}`)
  await page.getByRole("main").waitFor()
  await page.evaluate((value) => {
    localStorage.clear()
    const html = document.documentElement
    html.classList.toggle("dark", value === "dark")
    html.classList.toggle("light", value === "light")
    html.setAttribute("data-color-scheme", value)
  }, scheme)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
}

async function axeClean(page, scope) {
  await page.waitForTimeout(300)
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.finish()
  })
  if (!(await page.evaluate(() => "axe" in window))) await page.addScriptTag({ path: axePath })
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"],
    })
    return result.violations.map(
      (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`,
    )
  })
  check(`${scope}: 0 axe violations`, violations.length === 0, violations.join("; "))
}

async function overlaps(page, withMain = true) {
  return page.evaluate((includeMain) => {
    const regions = [
      ["topbar", document.querySelector('[data-slot="topbar"]')],
      ["sidebar", document.querySelector('[data-slot="shell-sidebar"] nav')],
      ["main", includeMain ? document.querySelector('[data-slot="shell-main"]') : null],
      ["mobile-nav", document.querySelector('nav[aria-label="Bottom bar"]')],
    ]
      .filter(([, element]) => element?.checkVisibility())
      .map(([name, element]) => [name, element.getBoundingClientRect()])
      .filter(([, box]) => box.width > 0 && box.height > 0)
    const problems = []
    for (let i = 0; i < regions.length; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        const [a, boxA] = regions[i]
        const [b, boxB] = regions[j]
        if (a === "main" && b === "mobile-nav") continue
        const x = Math.min(boxA.right, boxB.right) - Math.max(boxA.left, boxB.left)
        const y = Math.min(boxA.bottom, boxB.bottom) - Math.max(boxA.top, boxB.top)
        if (x > 0.5 && y > 0.5) problems.push(`${a} and ${b} overlap by ${Math.round(x)}×${Math.round(y)}`)
      }
    }
    const scrollWidth = document.documentElement.scrollWidth
    if (scrollWidth > innerWidth) problems.push(`scrolls sideways to ${scrollWidth}px`)
    return { problems, names: regions.map(([name]) => name) }
  }, withMain)
}

function bottomBarRoom(page) {
  return page.evaluate(() => {
    const bar = document.querySelector('nav[aria-label="Bottom bar"]').getBoundingClientRect()
    const last = document.querySelector('[data-testid="last-card"]').getBoundingClientRect()
    const probe = document.createElement("div")
    probe.style.height = "var(--mobile-nav-offset)"
    document.body.append(probe)
    const offset = Math.round(probe.getBoundingClientRect().height)
    probe.remove()
    return {
      gap: Math.round(bar.top - last.bottom),
      bar: Math.round(bar.height),
      offset,
      fromBottom: Math.round(innerHeight - bar.bottom),
    }
  })
}

async function checkDrawer(page, scope, scheme) {
  const room = await bottomBarRoom(page)
  check(
    `${scope}: the page ends above the bottom bar, as tall as --mobile-nav-offset, at the viewport's bottom`,
    room.gap >= 0 && room.bar === room.offset && room.fromBottom === 0,
    JSON.stringify(room),
  )
  await page.getByRole("banner").getByRole("button", { name: "Open navigation" }).click()
  const drawer = page.getByRole("dialog", { name: "Main" })
  check(`${scope}: the topbar trigger opens the sidebar drawer`, await onScreen(drawer))
  const inbox = await drawer.getByRole("link", { name: /Inbox/ }).getAttribute("aria-current")
  check(`${scope}: the drawer marks the current route`, inbox === "page", inbox)
  await shot(page, `shell-390-${scheme}-drawer.png`)
  await axeClean(page, `${scope} drawer`)
  await page.keyboard.press("Escape")
  await drawer.waitFor({ state: "detached" })
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))
  check(`${scope}: Escape closes the drawer and focus returns to its trigger`, focused === "Open navigation", focused)
}

async function checkPalette(page, scope, file) {
  await page.keyboard.press("ControlOrMeta+k")
  const palette = page.getByRole("dialog", { name: "Command palette" })
  check(`${scope}: Ctrl+K opens the palette`, await onScreen(palette))
  const inbox = await palette.getByRole("option", { name: "Inbox" }).getAttribute("aria-current")
  check(`${scope}: the palette marks the current route`, inbox === "page", inbox)
  const link = await palette
    .getByRole("option", { name: "Archive" })
    .evaluate((option) => `${option.tagName} ${option.getAttribute("href")}`)
  check(`${scope}: the palette's routes are links to their hrefs`, link === "A /archive", link)
  await shot(page, file)
  await axeClean(page, `${scope} palette`)
  await page.keyboard.type("stats")
  await page.keyboard.press("Enter")
  await palette.waitFor({ state: "detached" })
  const heading = await page.getByRole("main").getByRole("heading", { level: 1 }).textContent()
  const current = await page
    .locator('a[aria-current="page"], nav[aria-label="Bottom bar"] button[data-current]')
    .evaluateAll((marks) => marks.filter((mark) => mark.checkVisibility()).map((mark) => mark.textContent))
  check(
    `${scope}: Go to Reports (by keyword) navigates and marks it current`,
    heading === "Reports" && current.length > 0 && current.every((text) => /Reports|More/.test(text ?? "")),
    `${heading}; current: ${current.join(", ")}`,
  )

  await page.keyboard.press("ControlOrMeta+k")
  const search = palette.getByRole("combobox", { name: "Find a page or command" })
  await search.waitFor()
  check(
    `${scope}: after a route, Ctrl+K reopens the palette with focus in its search`,
    await search.evaluate((input) => input === document.activeElement),
  )
  const reopened = await search.inputValue()
  check(`${scope}: the palette reopens with an empty search`, reopened === "", JSON.stringify(reopened))
  await page.keyboard.type("arch")
  await page.keyboard.press("Escape")
  await palette.waitFor({ state: "detached" })
  const focused = await page.evaluate(() => ({
    inTopbar: !!document.activeElement?.closest('[data-slot="topbar"]'),
    name: document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent,
  }))
  check(
    `${scope}: one Escape closes the palette with text in it, focus back in the topbar`,
    focused.inTopbar,
    focused.name,
  )
}

async function checkShellAt(page, width, scheme) {
  const scope = `Shell ${width}px ${scheme}`
  await shellBlock(page, width, scheme)
  const top = await overlaps(page)
  await shot(page, `shell-${width}-${scheme}.png`)
  await axeClean(page, scope)
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(200)
  const end = await overlaps(page, false)
  const problems = [...top.problems, ...end.problems]
  check(`${scope}: ${top.names.join(", ")} don't overlap, at the top or the end`, problems.length === 0, problems)
  if (width === 390) await checkDrawer(page, scope, scheme)
  await page.evaluate(() => scrollTo(0, 0))
  await checkPalette(page, scope, `shell-${width}-${scheme}-palette.png`)
}

async function checkFill(page, width) {
  await shellBlock(page, width, "light", "&main=fill")
  const fill = await page.evaluate(() => {
    const main = document.querySelector('[data-slot="shell-main"]').getBoundingClientRect()
    const workspace = document.querySelector('[data-slot="document-workspace"]').getBoundingClientRect()
    const topbar = document.querySelector('[data-slot="topbar"]').getBoundingClientRect()
    const bar = document.querySelector('nav[aria-label="Bottom bar"]')
    const barTop = bar?.checkVisibility() ? bar.getBoundingClientRect().top : innerHeight
    return {
      mainTop: Math.round(main.top - topbar.bottom),
      mainBottom: Math.round(barTop - main.bottom),
      workspace: Math.round(main.height - workspace.height),
      pageScroll: document.documentElement.scrollHeight - innerHeight,
    }
  })
  check(
    `Shell main=fill ${width}px: a DocumentWorkspace fills main from the topbar to the bottom edge, no page scroll`,
    fill.mainTop === 0 && fill.mainBottom === 0 && fill.workspace === 0 && fill.pageScroll <= 0,
    JSON.stringify(fill),
  )
}

async function checkPaletteReopen(page) {
  await page.setViewportSize({ width: 1024, height: 700 })
  await page.goto(`${new URL(page.url()).origin}/?demo=palette-reopen-check`)
  const palette = page.getByRole("dialog", { name: "Palette" })
  const search = palette.getByRole("combobox", { name: "Find a command" })
  await page.getByRole("button", { name: /Open palette/ }).waitFor()
  await page.keyboard.press("ControlOrMeta+k")
  await search.waitFor()
  const first = await search.elementHandle()
  await page.keyboard.type("lab")
  await page.keyboard.press("Enter")
  await palette.waitFor({ state: "hidden" })
  const ran = await page.getByRole("status", { name: "Last command" }).textContent()
  check("Kept-mounted palette: Enter runs the command and closes it", ran === "lab", ran)

  await page.keyboard.press("ControlOrMeta+k")
  await search.waitFor()
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
  const state = await search.evaluate(
    (input, before) => ({
      focused: input === document.activeElement,
      same: input === before,
      value: input.value,
      highlighted: document.querySelector('[data-slot="command-item"][data-highlighted]')?.textContent,
    }),
    first,
  )
  check(
    "Kept-mounted palette: Ctrl+K reopens it empty, the first command highlighted, focus in the same search field",
    state.focused && state.same && state.value === "" && state.highlighted === "Apollo",
    JSON.stringify(state),
  )
}

function sidebarMetrics(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Main"]')
    const item = [...nav.querySelectorAll('[data-slot="sidebar-item-container"] > a')].find(
      (link) => link.getBoundingClientRect().height > 0,
    )
    const labels = [...nav.querySelectorAll('[data-slot="sidebar-group-label"]')]
    const groups = [...nav.querySelectorAll('[data-slot="sidebar-group"]')]
    const probe = document.createElement("div")
    probe.style.height = "var(--control-height)"
    document.querySelector('[data-slot="shell-main"]').append(probe)
    const mainControl = probe.getBoundingClientRect().height
    probe.remove()
    return {
      width: Math.round(nav.getBoundingClientRect().width),
      item: item.getBoundingClientRect().height,
      label: labels[0]?.getBoundingClientRect().height ?? 0,
      groupGap:
        groups.length > 1 ? groups[1].getBoundingClientRect().top - groups[0].getBoundingClientRect().bottom : 0,
      itemRadius: Number.parseFloat(getComputedStyle(item).borderTopLeftRadius),
      mainControl,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }
  })
}

async function setPage(page, attributes) {
  await page.evaluate((next) => {
    const html = document.documentElement
    for (const [name, value] of Object.entries(next)) {
      if (value) html.setAttribute(name, value)
      else html.removeAttribute(name)
    }
  }, attributes)
  await page.waitForTimeout(250)
}

async function railWidth(page) {
  await page.getByRole("main").click({ position: { x: 5, y: 5 } })
  await page.keyboard.press("ControlOrMeta+b")
  await page.waitForTimeout(400)
  const width = await page
    .getByRole("navigation", { name: "Main" })
    .evaluate((nav) => Math.round(nav.getBoundingClientRect().width))
  await page.keyboard.press("ControlOrMeta+b")
  await page.waitForTimeout(400)
  return width
}

async function checkSidebarDensity(page) {
  let compactItem = 0
  for (const scheme of ["light", "dark"]) {
    await shellBlock(page, 1100, scheme)
    const following = await sidebarMetrics(page)
    await shellBlock(page, 1100, scheme, "&sidebarDensity=compact")
    const compact = await sidebarMetrics(page)
    await shot(page, `sidebar-compact-1100-${scheme}.png`)
    check(
      `Shell 1100px ${scheme}: a compact sidebar in a default page is narrower with shorter items, main keeps the default density`,
      compact.width < following.width && compact.item < following.item && compact.mainControl === following.mainControl,
      JSON.stringify({ following, compact }),
    )
    compactItem = compact.item
    check(`Shell 1100px ${scheme}: a compact sidebar in a default page doesn't overflow`, compact.overflow <= 0)
  }

  await shellBlock(page, 1100, "light")
  const defaultRail = await railWidth(page)
  await shellBlock(page, 1100, "light", "&sidebarDensity=compact")
  const compactRail = await railWidth(page)
  check(
    "Shell 1100px: a compact sidebar's rail follows its own control height",
    compactRail < defaultRail,
    `${defaultRail}→${compactRail}`,
  )

  await shellBlock(page, 1100, "light", "&sidebarDensity=default")
  await setPage(page, { "data-density": "compact" })
  const kept = await sidebarMetrics(page)
  await setPage(page, { "data-density": undefined })
  const reference = await sidebarMetrics(page)
  check(
    "Shell 1100px: a default sidebar in a compact page keeps its width and items while main goes compact",
    kept.width === reference.width &&
      kept.item === reference.item &&
      kept.mainControl < reference.mainControl &&
      kept.overflow <= 0,
    JSON.stringify({ kept, reference }),
  )
  await setPage(page, { "data-density": "compact" })
  const keptRail = await railWidth(page)
  check(
    "Shell 1100px: a default sidebar's rail in a compact page stays default",
    keptRail === defaultRail,
    `${keptRail} vs ${defaultRail}`,
  )
  await setPage(page, { "data-density": undefined })

  await shellBlock(page, 1100, "light", "&sidebarDensity=compact")
  for (const radius of ["none", "sm", "md", "lg", "full"]) {
    for (const theme of [undefined, "glass", "liquid"]) {
      await setPage(page, { "data-radius": radius, "data-theme": theme })
      const result = await sidebarMetrics(page)
      check(
        `Shell 1100px compact sidebar ${theme ?? "default"}/${radius}: fits, items keep the compact height${radius === "none" ? " and square corners" : ""}`,
        result.overflow <= 0 && result.item === compactItem && (radius !== "none" || result.itemRadius === 0),
        JSON.stringify(result),
      )
    }
  }
  await setPage(page, { "data-radius": undefined, "data-theme": undefined })

  for (const scheme of ["light", "dark"]) {
    for (const width of [1100, 390]) {
      const results = {}
      for (const value of ["default", "compact"]) {
        await shellBlock(page, width, scheme, `&groupGap=${value}&groupHeaderHeight=${value}`)
        if (width === 390) {
          await page.getByRole("banner").getByRole("button", { name: "Open navigation" }).click()
          await onScreen(page.getByRole("dialog", { name: "Main" }))
        }
        results[value] = await sidebarMetrics(page)
        await shot(page, `sidebar-knobs-${value}-${width}-${scheme}.png`)
      }
      const { default: normal, compact } = results
      check(
        `Shell ${width}px ${scheme}: groupGap and groupHeaderHeight compact shrink the group gap and the label`,
        compact.groupGap < normal.groupGap && compact.label < normal.label && compact.overflow <= 0,
        JSON.stringify({ normal, compact }),
      )
    }
  }

  await shellBlock(page, 1100, "light", "&groupGap=0px&groupHeaderHeight=1.5rem")
  const exact = await sidebarMetrics(page)
  check(
    "Shell 1100px: a length sets the group gap and the label height exactly",
    Math.round(exact.groupGap) === 0 && Math.round(exact.label) === 24,
    JSON.stringify(exact),
  )

  for (const scheme of ["light", "dark"]) {
    await shellBlock(page, 390, scheme, "&sidebarDensity=compact")
    await page.getByRole("banner").getByRole("button", { name: "Open navigation" }).click()
    const drawer = page.getByRole("dialog", { name: "Main" })
    check(`Shell 390px ${scheme}: the compact sidebar's drawer opens on screen`, await onScreen(drawer))
    const drawerResult = await sidebarMetrics(page)
    const drawerDensity = await drawer.evaluate((dialog) =>
      dialog.closest("[data-density]")?.getAttribute("data-density"),
    )
    check(
      `Shell 390px ${scheme}: the drawer is compact without overflow, main keeps the page's density`,
      drawerDensity === "compact" && drawerResult.overflow <= 0 && drawerResult.mainControl > drawerResult.item,
      JSON.stringify({ drawerDensity, drawerResult }),
    )
    await shot(page, `sidebar-compact-390-${scheme}-drawer.png`)
  }
}

async function checkShell(page) {
  const cases = ["light", "dark"].flatMap((scheme) => [1440, 768, 390].map((width) => ({ scheme, width })))
  await cases.reduce(
    (previous, { scheme, width }) => previous.then(() => checkShellAt(page, width, scheme)),
    Promise.resolve(),
  )

  await shellBlock(page, 1440, "light")
  await page.keyboard.press("Tab")
  const skip = page.getByRole("link", { name: "Skip to content" })
  check("Shell: Tab reaches the skip link first", await skip.evaluate((link) => link === document.activeElement))
  await page.keyboard.press("Enter")
  const onMain = await page.evaluate(() => document.activeElement?.tagName === "MAIN" && location.hash === "")
  check("Shell: the skip link focuses main without changing the URL", onMain)

  await shellBlock(page, 1440, "light")
  const collapsedBy = async () =>
    page.getByRole("navigation", { name: "Main" }).evaluate((nav) => nav.hasAttribute("data-collapsed"))
  await page.getByRole("main").click({ position: { x: 5, y: 5 } })
  await page.keyboard.press("ControlOrMeta+b")
  const collapsedByShortcut = await collapsedBy()
  await page.keyboard.press("ControlOrMeta+b")
  check("Shell: sidebarShortcut collapses and expands the sidebar", collapsedByShortcut && !(await collapsedBy()))

  await checkFill(page, 1440)
  await checkFill(page, 390)
  await checkSidebarDensity(page)

  await shellBlock(page, 1440, "light", "&router=hash")
  const sidebar = page.getByRole("navigation", { name: "Main" })
  await sidebar.getByRole("link", { name: "Archive" }).click()
  await page.waitForFunction(() => location.hash === "#/archive")
  await sidebar
    .locator('[aria-current="page"]', { hasText: "Archive" })
    .waitFor({ timeout: 2000 })
    .catch(() => {})
  const archived = await page.getByRole("main").getByRole("heading", { level: 1 }).textContent()
  const marked = await sidebar.getByRole("link", { name: "Archive" }).getAttribute("aria-current")
  check(
    "Shell hash router: a #/route link routes and becomes current",
    archived === "Archive" && marked === "page",
    `${archived}, ${marked}`,
  )
  await shellBlock(page, 390, "light", "&router=hash")
  const bar = page.getByRole("navigation", { name: "Bottom bar" })
  await bar.getByRole("link", { name: "Calendar" }).click()
  await page.waitForFunction(() => location.hash === "#/calendar")
  await bar
    .locator('[aria-current="page"]', { hasText: "Calendar" })
    .waitFor({ timeout: 2000 })
    .catch(() => {})
  const calendar = await bar.getByRole("link", { name: "Calendar" }).getAttribute("aria-current")
  check("Shell hash router 390px: the bottom bar routes and marks the route", calendar === "page", calendar)
}

await withShowcase(async (page) => {
  if (onlySidebarDensity) return checkSidebarDensity(page)
  await checkLayoutBlocks(page, check, shot)
  if (onlyLayout) return
  await checkShell(page)
  await checkPaletteReopen(page)
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
  await checkFieldPlacement(page)
  await checkSegments(page)
  await checkThemeAxes(page)
})

if (failures.length > 0) {
  console.error(`\n${failures.length} shell check(s) failed`)
  process.exit(1)
}
