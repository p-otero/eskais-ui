// Smoke test for the built docs site (`bun run test:site`): axe, console errors and horizontal scroll on a few
// pages; on a 390px phone, nothing covers a page's first heading, ⌘K search opens and breadcrumbs route on the
// client; "?" from several layouts and the Keyboard shortcuts button open the Shortcuts Dialog with the demo's keys.
import { createRequire } from "node:module"

import { openPage, withSite } from "./site-browser.mjs"

const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js")

const pages = [
  "",
  "docs/installation/",
  "docs/icons/",
  "docs/components/button/",
  "docs/components/form/",
  "docs/components/agent-task-board/",
  "docs/components/inbox/",
  "docs/components/master-detail/",
  "docs/components/dashboard-grid/",
  "docs/components/settings-page/",
  "docs/components/shortcuts-dialog/",
  "docs/components/shell/",
  "docs/keyboard/",
  "docs/mockups/",
  "docs/agent-skills/",
  "docs/server-data/",
  "docs/components/server-data-table/",
  "docs/components/filter-panel/",
]
const viewports = [
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
]
const schemes = ["light", "dark"]

// Finish colour transitions so axe reads the settled theme, not a frame of the previous one.
async function settle(page) {
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSTransition) animation.finish()
    }
  })
}

const failures = []

const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }

// Problems with `selector`'s first match: outside the viewport, or under a fixed or sticky element across it.
function coverage(page, selector) {
  return page.evaluate((query) => {
    const target = document.querySelector(query)
    if (!target) return [`no ${query}`]
    const box = target.getBoundingClientRect()
    const problems = []
    if (box.top < 0 || box.bottom > innerHeight) problems.push(`${query} spans ${box.top}-${box.bottom}px`)
    for (const element of document.querySelectorAll("body *")) {
      const style = getComputedStyle(element)
      if ((style.position !== "fixed" && style.position !== "sticky") || style.visibility === "hidden") continue
      const rect = element.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0 || rect.right <= box.left || rect.left >= box.right) continue
      if (rect.top < box.bottom && rect.bottom > box.top) {
        const slot = element.getAttribute("data-slot") ?? element.tagName.toLowerCase()
        problems.push(`${query} at ${box.top}px is under ${style.position} ${slot} ending at ${rect.bottom}px`)
      }
    }
    return problems
  }, selector)
}

async function checkPhone(browser, origin) {
  const context = await browser.newContext(phone)
  const page = await context.newPage()
  for (const path of ["docs/installation/", "docs/components/", "docs/components/button/"]) {
    await page.goto(origin + path)
    await page.locator("main h1").waitFor()
    await page.waitForLoadState("networkidle")
    for (const problem of await coverage(page, "main h1")) failures.push(`/${path} 390px: ${problem}`)
    await page.locator("main h1").evaluate((heading) => heading.scrollIntoView())
    for (const problem of await coverage(page, "main h1")) failures.push(`/${path} 390px scrolled: ${problem}`)
  }

  await page.goto(origin)
  await page.waitForLoadState("networkidle")
  const search = page.getByRole("button", { name: "Search docs" })
  const geometry = await search.evaluate((button) => {
    const box = button.getBoundingClientRect()
    const icon = button.querySelector("svg.lucide").getBoundingClientRect()
    const control = parseFloat(getComputedStyle(button).getPropertyValue("--control-height")) * 16
    return {
      size: [box.width, box.height, control],
      offset: [icon.x + icon.width / 2 - (box.x + box.width / 2), icon.y + icon.height / 2 - (box.y + box.height / 2)],
    }
  })
  if (geometry.size.some((side) => Math.abs(side - geometry.size[2]) > 0.5))
    failures.push(`search 390px: ${geometry.size.slice(0, 2).join("x")}, not a ${geometry.size[2]}px square`)
  if (geometry.offset.some((offset) => Math.abs(offset) > 0.5))
    failures.push(`search 390px: icon off centre by ${geometry.offset.join(", ")}px`)
  const dialog = page.getByRole("dialog", { name: "Search the docs" })
  await page.keyboard.press("ControlOrMeta+k")
  if (!(await dialog.isVisible())) failures.push("search 390px: ⌘K doesn't open the dialog")
  await page.keyboard.press("Escape")
  await dialog.waitFor({ state: "hidden" })
  await search.tap()
  if (!(await dialog.isVisible())) failures.push("search 390px: tapping the button doesn't open the dialog")
  console.log("/ 390px: search and first headings checked")
  await context.close()
}

// Each crumb, followed by mouse (on press) and by touch, must route without reloading the page.
async function checkBreadcrumbs(browser, origin) {
  for (const [name, options] of [
    ["1440px", { viewport: { width: 1440, height: 900 } }],
    ["390px", phone],
  ]) {
    const context = await browser.newContext(options)
    const page = await context.newPage()
    const start = `${origin}docs/components/button/`
    await page.goto(start)
    await page.waitForLoadState("networkidle")
    const crumbs = page.getByRole("navigation", { name: "Breadcrumb" })
    const links = await crumbs.getByRole("link").evaluateAll((anchors) => anchors.map((anchor) => anchor.href))
    if (links.length !== 2) failures.push(`breadcrumb ${name}: ${links.length} links, expected Docs and Foundations`)
    if ((await crumbs.locator('[aria-current="page"]').textContent()) !== "Button")
      failures.push(`breadcrumb ${name}: the current page isn't marked`)
    for (const [index, href] of links.entries()) {
      if (page.url() !== start) {
        await page.goto(start)
        await page.waitForLoadState("networkidle")
      }
      await page.evaluate(() => (window.sameDocument = true))
      const link = crumbs.getByRole("link").nth(index)
      if (options.hasTouch) await link.tap()
      else await link.click()
      await page.waitForURL(href)
      if (!(await page.evaluate(() => window.sameDocument)))
        failures.push(`breadcrumb ${name}: ${href} reloaded the page`)
      const target = new URL(href).hash || "main h1"
      await page.locator(target).waitFor()
      await page.waitForTimeout(300)
      for (const problem of await coverage(page, target)) failures.push(`breadcrumb ${name} → ${href}: ${problem}`)
    }
    console.log(`breadcrumb ${name}: ${links.length} crumbs followed`)
    await context.close()
  }
}

// The docs shell: the sidebar starts at the Topbar's bottom edge and reaches the viewport's, nothing of it sits
// under the Topbar (also after scrolling), the breadcrumb sits in the main column, and the trigger collapses the
// sidebar, which stays collapsed after a reload.
function shellGeometry(page) {
  return page.evaluate(() => {
    const topbar = document.querySelector('[data-slot="docs-layout"] > [data-slot="topbar"]')
    const sidebar = document.querySelector('[data-slot="docs-layout-sidebar"] nav[aria-label="Documentation"]')
    const main = document.querySelector('[data-slot="docs-layout-main"]')
    const crumbs = document.querySelector('nav[aria-label="Breadcrumb"]')
    if (!topbar || !sidebar || !main || !crumbs) {
      return { problems: ["the topbar, sidebar, main column or breadcrumb is missing"], width: -1 }
    }
    const bar = topbar.getBoundingClientRect()
    const side = sidebar.getBoundingClientRect()
    const problems = []
    if (Math.abs(side.top - bar.bottom) > 0.5) problems.push(`sidebar top ${side.top}px, topbar bottom ${bar.bottom}px`)
    if (Math.abs(side.bottom - innerHeight) > 0.5) problems.push(`sidebar ends at ${side.bottom}px of ${innerHeight}px`)
    for (const element of sidebar.querySelectorAll('a, [data-slot="sidebar-group-label"]')) {
      const box = element.getBoundingClientRect()
      const y = box.top + box.height / 2
      if (box.width === 0 || y <= side.top || y >= Math.min(side.bottom, innerHeight)) continue
      // Only what the topbar draws over counts: an item scrolled out of the sidebar's own scroll box isn't drawn.
      const hit = document.elementFromPoint(box.left + Math.min(8, box.width / 2), y)
      if (hit && !sidebar.contains(hit) && topbar.contains(hit))
        problems.push(`"${element.textContent}" is under the topbar`)
    }
    if (!main.contains(crumbs)) problems.push("the breadcrumb isn't in the main column")
    const column = main.getBoundingClientRect()
    const trail = crumbs.getBoundingClientRect()
    if (trail.left < column.left - 0.5 || trail.right > column.right + 0.5) {
      problems.push("the breadcrumb leaves the main column")
    }
    for (let node = crumbs; node; node = node.parentElement) {
      const position = getComputedStyle(node).position
      if (position === "sticky" || position === "fixed") {
        problems.push(`the breadcrumb is in a ${position} ${node.dataset.slot ?? node.tagName.toLowerCase()}`)
      }
    }
    return { problems, width: side.width }
  })
}

async function checkShell(browser, origin) {
  for (const width of [1920, 1440, 1100, 768]) {
    for (const path of ["docs/theming/", "docs/components/", "docs/components/button/"]) {
      const { page, context } = await openPage(browser, origin + path, { width, height: 900 })
      await page.locator("main h1").waitFor()
      const scope = `shell /${path} ${width}px`
      for (const problem of (await shellGeometry(page)).problems) failures.push(`${scope}: ${problem}`)
      await page.mouse.move(width / 2, 450)
      await page.mouse.wheel(0, 2400)
      await page.waitForTimeout(200)
      for (const problem of (await shellGeometry(page)).problems) failures.push(`${scope} scrolled: ${problem}`)
      if (path === "docs/components/button/") {
        await page.getByRole("button", { name: "Collapse sidebar" }).click()
        await page.waitForTimeout(400)
        const { width: collapsed } = await shellGeometry(page)
        if (collapsed !== 0) failures.push(`${scope}: the collapsed sidebar is ${collapsed}px wide`)
        await page.reload()
        await page.locator("main h1").waitFor()
        const expand = page.getByRole("button", { name: "Expand sidebar" })
        if (await expand.isVisible()) {
          await expand.click()
          await page.waitForTimeout(400)
          if ((await shellGeometry(page)).width === 0) failures.push(`${scope}: the sidebar doesn't expand again`)
        } else failures.push(`${scope}: the sidebar doesn't stay collapsed after a reload`)
      }
      await context.close()
    }
  }
  const context = await browser.newContext(phone)
  const page = await context.newPage()
  await page.goto(`${origin}docs/components/button/`)
  await page.locator("main h1").waitFor()
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Open navigation" }).tap()
  const drawer = page.getByRole("dialog", { name: "Documentation" })
  if (!(await drawer.getByRole("link", { name: "Installation" }).isVisible())) {
    failures.push("shell 390px: the trigger doesn't open the sidebar's drawer")
  }
  await context.close()
  console.log("docs shell: 4 widths, collapse and drawer checked")
}

// The theme editor fits its card at every width, draws its colour area and swatches, and recolours the site.
async function checkThemeEditor(browser, origin) {
  for (const width of [1440, 1100, 768, 390]) {
    const { page, context } = await openPage(browser, `${origin}docs/theming/`, { width, height: 900 })
    const scope = `theme editor ${width}px`
    const editor = page.locator('[data-slot="theme-editor-card"]')
    await editor.scrollIntoViewIfNeeded()
    const layout = await editor.evaluate((card) => {
      const edge = card.getBoundingClientRect()
      // Content inside a box that scrolls sideways, like the preset row on a phone, is clipped to that box.
      const clipped = (element) => {
        for (let node = element.parentElement; node && node !== card; node = node.parentElement) {
          if (getComputedStyle(node).overflowX !== "visible") return true
        }
        return false
      }
      const problems = []
      for (const element of card.querySelectorAll("*")) {
        const box = element.getBoundingClientRect()
        if (box.width === 0 || box.height === 0 || clipped(element)) continue
        if (box.left < edge.left - 0.5 || box.right > edge.right + 0.5) {
          const name = element.dataset.slot ?? element.tagName.toLowerCase()
          problems.push(`${name} spans ${box.left}-${box.right}px, the card ${edge.left}-${edge.right}px`)
        }
      }
      const area = card.querySelector('[data-slot="color-picker-area"]').getBoundingClientRect()
      if (area.width < 1 || area.height < 1) problems.push(`the colour area is ${area.width}x${area.height}px`)
      for (const swatch of card.querySelectorAll('[data-slot="color-picker-swatch"]')) {
        if (getComputedStyle(swatch).backgroundColor === "rgba(0, 0, 0, 0)") problems.push("a swatch has no fill")
      }
      return problems.slice(0, 5)
    })
    for (const problem of layout) failures.push(`${scope}: ${problem}`)

    if (width === 1440) {
      const read = () =>
        page.evaluate(() => ({
          primary: getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
          card: getComputedStyle(document.querySelector('[data-slot="theme-editor-card"]')).backgroundColor,
        }))
      const start = await read()
      const area = await page.locator('[data-slot="color-picker-area"]').first().boundingBox()
      await page.mouse.click(area.x + area.width * 0.6, area.y + area.height * 0.4)
      const dragged = await read()
      if (dragged.primary === start.primary)
        failures.push(`${scope}: the colour area leaves --primary at ${start.primary}`)
      const input = page.getByRole("textbox", { name: "Brand colour in OKLCH" })
      await input.fill("oklch(0.5 0.2 150)")
      await input.press("Enter")
      const typed = await read()
      if (typed.primary === dragged.primary)
        failures.push(`${scope}: typing a brand leaves --primary at ${typed.primary}`)
      const linkColour = () =>
        page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--link").trim())
      const linkBefore = await linkColour()
      await page.getByRole("slider", { name: "Link hue" }).focus()
      for (let step = 0; step < 20; step++) await page.keyboard.press("ArrowRight")
      if ((await linkColour()) === linkBefore) failures.push(`${scope}: the link hue leaves --link at ${linkBefore}`)
      await page.getByRole("slider", { name: "Neutral tint" }).focus()
      for (let step = 0; step < 10; step++) await page.keyboard.press("ArrowRight")
      const tinted = await read()
      if (tinted.card === typed.card) failures.push(`${scope}: the neutral tint leaves the card at ${typed.card}`)
      // The choices follow the reader to another page from the sidebar, and come back after a reload.
      const brandOf = () =>
        page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--brand").trim())
      const edited = await brandOf()
      await page.getByRole("link", { name: "Installation", exact: true }).first().click()
      await page.waitForURL(/\/docs\/installation\/?$/)
      if ((await brandOf()) !== edited) failures.push(`${scope}: leaving Theming drops the brand ${edited}`)
      await page.reload()
      await page.waitForLoadState("networkidle")
      if ((await brandOf()) !== edited) failures.push(`${scope}: a reload drops the brand ${edited}`)
      await page.goto(`${origin}docs/theming/`)
      await page.waitForLoadState("networkidle")
      await page.getByRole("button", { name: "Reset", exact: true }).click()
      if ((await read()).primary !== start.primary) failures.push(`${scope}: reset doesn't restore --primary`)
    }
    await context.close()
  }
  console.log("theme editor: layout at 4 widths, area, swatches and recolouring checked")
}

// "?" as each layout sends it: the produced key with the modifiers that layout needs (CDP: Alt 1, Ctrl 2, Shift 8).
const questionMarks = [
  { layout: "US Shift+/", code: "Slash", modifiers: 8, keyCode: 191 },
  { layout: "Spanish Shift+'", code: "Minus", modifiers: 8, keyCode: 219 },
  { layout: "AltGr", code: "KeyQ", modifiers: 3, keyCode: 81 },
]

async function shortcutsDialogLists(page, label) {
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" })
  const opened = await dialog.waitFor({ timeout: 3000 }).then(
    () => true,
    () => false,
  )
  if (!opened) return failures.push(`shortcuts dialog, ${label}: no dialog`)
  const text = await dialog.textContent()
  for (const name of ["Mark read", "Pin"]) {
    if (!text.includes(name)) failures.push(`shortcuts dialog, ${label}: "${name}" isn't listed`)
  }
  console.log(`shortcuts dialog, ${label}: opens`)
}

async function checkShortcutsDialog(browser, origin) {
  const url = `${origin}docs/components/shortcuts-dialog/`
  for (const press of questionMarks) {
    const { page, context } = await openPage(browser, url)
    await page.getByRole("button", { name: "Mark read" }).focus()
    const cdp = await context.newCDPSession(page)
    const key = { key: "?", code: press.code, modifiers: press.modifiers, windowsVirtualKeyCode: press.keyCode }
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", ...key, text: "?" })
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...key })
    await shortcutsDialogLists(page, `? (${press.layout})`)
    await context.close()
  }
  for (const [name, options] of [
    ["mouse", { viewport: { width: 1440, height: 900 } }],
    ["touch", phone],
  ]) {
    const context = await browser.newContext(options)
    const page = await context.newPage()
    await page.goto(url)
    await page.waitForLoadState("networkidle")
    const trigger = page.getByRole("button", { name: "Keyboard shortcuts" })
    if (options.hasTouch) await trigger.tap()
    else await trigger.click()
    await shortcutsDialogLists(page, `Keyboard shortcuts button (${name})`)
    await context.close()
  }
}

await withSite(async ({ browser, origin }) => {
  for (const path of pages) {
    for (const viewport of viewports) {
      for (const colorScheme of schemes) {
        const scope = `/${path} ${viewport.width}px ${colorScheme}`
        const { page, context, errors } = await openPage(browser, origin + path, { ...viewport, colorScheme })
        await page.locator("main#main").waitFor()
        await page.waitForLoadState("networkidle")
        await settle(page)

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        if (overflow > 0) failures.push(`${scope}: scrolls ${overflow}px horizontally`)

        await page.addScriptTag({ path: axePath })
        const result = await page.evaluate(() =>
          window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] }),
        )
        for (const violation of result.violations) {
          const targets = violation.nodes.slice(0, 3).map((node) => node.target.join(" "))
          failures.push(`${scope}: axe ${violation.id} (${violation.nodes.length}) ${targets.join(" | ")}`)
        }
        for (const error of errors) failures.push(`${scope}: console ${error}`)
        console.log(
          `${scope}: ${result.violations.length} axe violations, ${errors.length} errors, overflow ${overflow}`,
        )
        await context.close()
      }
    }
  }
  await checkShell(browser, origin)
  await checkThemeEditor(browser, origin)
  await checkPhone(browser, origin)
  await checkBreadcrumbs(browser, origin)
  await checkShortcutsDialog(browser, origin)
})

if (failures.length > 0) {
  console.error(`\n${failures.length} problems:\n${failures.join("\n")}`)
  process.exit(1)
}
console.log("Site check passed.")
