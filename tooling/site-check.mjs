// Smoke test for the built docs site (`bun run test:site`): serves apps/site/dist from a sub-path and checks
// a few pages in the system Chrome for axe violations, console errors and horizontal scroll at phone width.
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
})

if (failures.length > 0) {
  console.error(`\n${failures.length} problems:\n${failures.join("\n")}`)
  process.exit(1)
}
console.log("Site check passed.")
