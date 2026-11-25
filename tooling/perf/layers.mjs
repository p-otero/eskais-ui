import { resolve } from "node:path"

import { countLayers, launch, openPage, serve } from "./browser.mjs"

const [scenario = "board", variant = "normal"] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"))
const server = await serve(resolve(import.meta.dirname, ".builds", variant))
const browser = await launch()
try {
  const { page, cdp } = await openPage(browser)
  await page.goto(`${server.origin}?demo=perf&scenario=${scenario}`)
  await page.waitForFunction(() => globalThis.perfFixture?.mounted !== undefined)
  if (process.argv.includes("--glass")) {
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "glass"))
  }
  const css = process.argv.find((arg) => arg.startsWith("--css="))?.slice(6)
  if (css) await page.addStyleTag({ content: css })
  await page.waitForTimeout(Number(process.argv.find((arg) => arg.startsWith("--settle="))?.slice(9) ?? 500))
  const { count, megapixels, reasons } = await countLayers(page, cdp)
  console.log(`${scenario}: ${String(count)} layers, ${String(megapixels)} Mpx`)
  console.table([...reasons].toSorted((a, b) => b[1] - a[1]).map(([reason, layers]) => ({ reason, layers })))
} finally {
  await browser.close()
  await server.close()
}
process.exit(0)
