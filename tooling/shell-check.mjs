// Drives the showcase where layout decides whether things show: ⌘K and the Sidebar drawer from the Topbar at phone
// widths, scrollable tabs, MobileNav labels, CardHeader widths and the layout blocks (layout-blocks-check.mjs).
// Usage: node tooling/shell-check.mjs [--screenshots=<dir>] [--only=layout] (after `bun run build:showcase`)
import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"

import { checkLayoutBlocks } from "./layout-blocks-check.mjs"
import { withShowcase } from "./showcase-browser.mjs"

const failures = []
const shotsArg = process.argv.find((arg) => arg.startsWith("--screenshots="))
const shots = shotsArg ? resolve(shotsArg.slice("--screenshots=".length)) : undefined
if (shots) mkdirSync(shots, { recursive: true })
const onlyLayout = process.argv.includes("--only=layout")

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
  await checkLayoutBlocks(page, check, shot)
  if (onlyLayout) return
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
  await checkMobileNav(page)
})

if (failures.length > 0) {
  console.error(`\n${failures.length} shell check(s) failed`)
  process.exit(1)
}
