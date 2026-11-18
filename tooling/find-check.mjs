// Find in page reaches rows a virtualized List hasn't rendered: a text fragment (`#:~:text=`, which reveals
// `hidden="until-found"` content the way the find bar does) for rows across the 10,000-row fixture must render that
// row, in view. Rows sit in chunks of 100; the targets include a chunk's first row and the list's last.
// Usage: node tooling/find-check.mjs (after `bun run build:showcase`)
import { withShowcase } from "./showcase-browser.mjs"

const targets = [5000, 5101, 200, 10_000]
const failures = []

await withShowcase(async (page) => {
  const origin = new URL(page.url()).origin
  for (const target of targets) {
    await page.goto(`${origin}/?demo=perf&scenario=list-10k`)
    await page.waitForFunction(() => globalThis.perfFixture?.mounted !== undefined)
    // The layers load on first connect; their groups stay hidden until found, so the browser lays none of them out.
    await page.waitForFunction(() => document.querySelectorAll("[data-findable-layer]").length === 2)
    const visibleStandIns = await page.evaluate(
      () => [...document.querySelectorAll("[data-findable-layer] > :not([hidden])")].length,
    )
    if (visibleStandIns > 0) failures.push(`${String(visibleStandIns)} findable groups aren't hidden`)
    await page.evaluate((row) => {
      location.hash = `:~:text=${encodeURIComponent(`Row ${String(row)}:`)}`
    }, target)
    const row = page.locator(`[data-item-id="ROW-${String(target)}"]`)
    try {
      await row.waitFor({ timeout: 5000 })
      const inView = await row.evaluate((element) => {
        const box = element.getBoundingClientRect()
        return box.bottom > 0 && box.top < innerHeight
      })
      if (!inView) failures.push(`row ${String(target)} rendered out of view`)
    } catch {
      failures.push(`finding "Row ${String(target)}:" didn't render its row`)
    }
  }
})

// A long MarkdownView: find in page reaches a heading far down and scrolls it into view.
await withShowcase(async (page) => {
  const origin = new URL(page.url()).origin
  await page.goto(`${origin}/?demo=perf&scenario=markdown-view`)
  await page.waitForFunction(() => globalThis.perfFixture?.mounted !== undefined)
  await page.evaluate(() => {
    location.hash = `:~:text=${encodeURIComponent("Section 280")}`
  })
  const heading = page.getByRole("heading", { name: "Section 280", exact: true })
  try {
    await page.waitForFunction(
      () => {
        const target = [...document.querySelectorAll("h2")].find((h) => h.textContent === "Section 280")
        const box = target?.getBoundingClientRect()
        return box !== undefined && box.bottom > 0 && box.top < innerHeight
      },
      undefined,
      { timeout: 5000 },
    )
    if ((await heading.count()) !== 1) failures.push("MarkdownView: Section 280 isn't one heading")
  } catch {
    failures.push(`finding "Section 280" in a MarkdownView didn't scroll it into view`)
  }
})

if (failures.length > 0) {
  console.error(failures.join("\n"))
  process.exitCode = 1
} else {
  console.log(`find in page: ${String(targets.length)} rows and a MarkdownView heading found, in view`)
}
