import { withShowcase } from "./showcase-browser.mjs"

const commits = Number(process.argv[2] ?? 50_000)
const files = Number(process.argv[3] ?? 100_000)
const presses = 150

function percentile(values, p) {
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

const round = (value) => Math.round(value * 10) / 10

async function installProbe(page) {
  await page.evaluate(() => {
    globalThis.keyTimes = []
    addEventListener(
      "keydown",
      (event) => {
        requestAnimationFrame(() => {
          const channel = new MessageChannel()
          channel.port1.addEventListener("message", () => globalThis.keyTimes.push(performance.now() - event.timeStamp))
          channel.port1.start()
          channel.port2.postMessage(null)
        })
      },
      { capture: true },
    )
  })
}

async function holdArrow(page, key) {
  await page.evaluate(() => {
    globalThis.keyTimes = []
  })
  for (let index = 0; index < presses; index += 1) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- each press waits for the previous one's paint
    await page.keyboard.press(key)
    // oxlint-disable-next-line eslint/no-await-in-loop -- each press waits for the previous one's paint
    await page.waitForFunction((count) => globalThis.keyTimes.length >= count, index + 1)
  }
  return page.evaluate(() => globalThis.keyTimes)
}

async function jump(page, key) {
  await page.evaluate(() => {
    globalThis.keyTimes = []
  })
  await page.keyboard.press(key)
  await page.waitForFunction(() => globalThis.keyTimes.length >= 1)
  return page.evaluate(() => globalThis.keyTimes[0])
}

async function watchLongTasks(page) {
  await page.addInitScript(() => {
    globalThis.longTasks = []
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) globalThis.longTasks.push(entry.duration)
    }).observe({ type: "longtask", buffered: true })
  })
}

async function checkFindable(page, findable) {
  if (!findable) return { layersMs: "off", found: "off" }
  await page.waitForFunction(
    () => document.querySelectorAll("[data-findable-layer] [hidden=until-found] [hidden=until-found]").length > 100,
    undefined,
    { timeout: 30_000 },
  )
  const layersMs = await page.evaluate(() => performance.now() - globalThis.gitBench.start)
  const found = await page.evaluate(async () => {
    const standIns = [...document.querySelectorAll("[data-findable-layer] [hidden=until-found] [hidden=until-found]")]
    const target = standIns.at(-1)
    const text = target?.textContent ?? ""
    target?.dispatchEvent(new Event("beforematch", { bubbles: true }))
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const rows = [...document.querySelectorAll('[role="treeitem"]')]
    const wanted = text.replaceAll(/\s+/g, " ").trim()
    return rows.some(
      (row) => (row.textContent ?? "").replaceAll(/\s+/g, " ").includes(wanted) && row.getBoundingClientRect().top >= 0,
    )
  })
  return { layersMs: round(layersMs), found }
}

async function run(name, query, rate) {
  let result
  await withShowcase(async (page) => {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send("Emulation.setCPUThrottlingRate", { rate })
    await watchLongTasks(page)
    const url = new URL(page.url())
    await page.goto(`${url.origin}/?${query}`)
    await page.waitForFunction(() => globalThis.gitBench?.mounted !== undefined, undefined, { timeout: 60_000 })
    const mounted = await page.evaluate(() => globalThis.gitBench.mounted)
    const rendered = await page.locator('[role="treeitem"]').count()
    await installProbe(page)
    await page.locator('[role="treeitem"]').first().focus()
    const held = await holdArrow(page, "ArrowDown")
    const end = await jump(page, "End")
    const home = await jump(page, "Home")
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("role"))
    const longest = await page.evaluate(() => Math.max(0, ...globalThis.longTasks))
    const find = await checkFindable(page, query.includes("findable=true"))
    result = {
      name,
      cpu: `${String(rate)}×`,
      rendered,
      firstPaintMs: round(mounted),
      arrowP50: round(percentile(held, 50)),
      arrowP95: round(percentile(held, 95)),
      endMs: round(end),
      homeMs: round(home),
      longestTaskMs: round(longest),
      ...find,
      focused,
    }
  })
  return result
}

const pages = [
  [`${String(commits)} commits`, `demo=commit-bench&commits=${String(commits)}`],
  [`${String(commits)} commits, selected, working tree`, `demo=commit-bench&commits=${String(commits)}&select=true`],
  [`${String(commits)} commits, merges open`, `demo=commit-bench&commits=${String(commits)}&expanded=all`],
  [`${String(files)} files`, `demo=git-tree-bench&files=${String(files)}`],
  [`${String(commits)} commits, 200 branches`, `demo=commit-bench&commits=${String(commits)}&branches=200`],
]
const scenarios = pages.flatMap(([name, query]) => [
  [name, query],
  [`${name}, findable`, `${query}&findable=true`],
])
const results = []
// Perf: one after another, so they don't compete for the CPU they measure.
for (const [name, query] of scenarios) {
  // oxlint-disable-next-line eslint/no-await-in-loop -- one run at a time, so they don't compete for the CPU they measure
  for (const rate of [1, 4]) results.push(await run(name, query, rate))
}
console.table(results)
const slow = results.filter(
  (result) => result.cpu === "1×" && !result.name.endsWith("findable") && result.arrowP95 >= 16,
)
for (const result of slow)
  console.error(`${result.name}: p95 arrow-to-paint ${String(result.arrowP95)}ms at 1×, over 16ms`)
if (slow.length > 0) process.exitCode = 1
