import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { resolve } from "node:path"

import { openPage, serve } from "./browser.mjs"
import { percentile, round } from "./interactions.mjs"

const root = resolve(import.meta.dirname, "..", "..")
const start = "docs/components/button/"
const targets = ["data-table", "dialog", "calendar", "command", "markdown-editor", "list-item"]
const networks = {
  none: undefined,
  "4g": { latency: 150, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 },
}
const pressMs = 90
const hoverMs = 150

async function heading(page) {
  return page.locator("main h1").first().textContent()
}

async function goToStart(page, origin) {
  await page.goto(origin + start)
  await page.locator("main h1").first().waitFor()
  await page.waitForLoadState("networkidle")
}

async function pressLink(page, target, { dwell = 0 } = {}) {
  const link = page.locator(`nav[aria-label="Documentation"] a[href$="/docs/components/${target}/"]`).first()
  await link.scrollIntoViewIfNeeded()
  const box = await link.boundingBox()
  const before = await heading(page)
  await page.evaluate((previous) => {
    globalThis.__perfNav = new Promise((done) => {
      let startedAt = null
      let headingPainted
      addEventListener("pointerdown", (event) => (startedAt ??= event.timeStamp), { capture: true, once: true })
      // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the page through page.evaluate, which serializes this function alone
      const loading = () =>
        [...document.querySelectorAll('main [data-slot="spinner-status"]')].some((status) =>
          ["Loading example", "Loading page"].includes(status.textContent?.trim() ?? ""),
        )
      setTimeout(() => done({ heading: Number.NaN, complete: Number.NaN }), 15_000)
      const tick = () => {
        const text = document.querySelector("main h1")?.textContent
        if (startedAt !== null && text && text !== previous) {
          headingPainted ??= globalThis.__perf.afterPaint().then(() => performance.now() - startedAt)
          if (!loading()) {
            globalThis.__perf
              .afterPaint()
              .then(async () => done({ heading: await headingPainted, complete: performance.now() - startedAt }))
            return
          }
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  }, before)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  if (dwell) await page.waitForTimeout(dwell)
  await page.mouse.down()
  await page.waitForTimeout(pressMs)
  await page.mouse.up()
  const ms = await page.evaluate(() => globalThis.__perfNav)
  await page.goBack()
  await page.waitForFunction((previous) => document.querySelector("main h1")?.textContent === previous, before)
  return ms
}

async function measureSite(browser, { build = true, dist = resolve(root, "apps", "site", "dist") } = {}) {
  if (build || !existsSync(resolve(dist, "index.html"))) {
    console.log("Building the site…")
    const result = spawnSync("npx", ["vite", "build", "--logLevel", "error"], {
      cwd: resolve(root, "apps", "site"),
      stdio: "inherit",
      shell: process.platform === "win32",
    })
    if (result.status !== 0) throw new Error("The site build failed")
  }
  const server = await serve(dist, { base: "/eskais-ui/", spa: false })
  const rows = []
  try {
    for (const [network, conditions] of Object.entries(networks)) {
      for (const fast of [true, false]) {
        for (const route of ["cold", "cold, 150 ms hover first", "warm (visited before)"]) {
          const warm = route.startsWith("warm")
          const dwell = route.includes("hover") ? hoverMs : 0
          const { page, context } = await openPage(browser, {
            network: conditions,
            viewport: { width: 1440, height: 900 },
          })
          try {
            await goToStart(page, server.origin)
            if (!fast) await page.evaluate(() => document.body.setAttribute("data-no-fast-link", ""))
            if (warm) for (const target of targets) await pressLink(page, target)
            const times = []
            for (const target of targets) times.push(await pressLink(page, target, { dwell }))
            const headings = times.map((time) => time.heading)
            const completes = times.map((time) => time.complete)
            rows.push({
              network,
              fastLink: fast ? "on" : "off",
              route,
              headingP50: round(percentile(headings, 50)),
              completeP50: round(percentile(completes, 50)),
              completeMax: round(Math.max(...completes)),
            })
          } finally {
            await context.close()
          }
        }
      }
    }
  } finally {
    await server.close()
  }
  return rows
}

export { measureSite }
