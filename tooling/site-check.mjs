// Smoke test for the built docs site (`bun run test:site`): serves apps/site/dist from a sub-path and checks
// a few pages in the system Chrome for axe violations, console errors and horizontal scroll at phone width.
// On an emulated 390px phone it also checks that nothing fixed or sticky covers a docs page's first heading,
// that search is a centred icon button ⌘K still opens, and that breadcrumb crumbs route on the client.
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
  await checkPhone(browser, origin)
  await checkBreadcrumbs(browser, origin)
})

if (failures.length > 0) {
  console.error(`\n${failures.length} problems:\n${failures.join("\n")}`)
  process.exit(1)
}
console.log("Site check passed.")
