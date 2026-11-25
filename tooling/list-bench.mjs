import { withShowcase } from "./showcase-browser.mjs"

const rows = Number(process.argv[2] ?? 2000)
const presses = 120

function percentile(values, p) {
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

const round = (value) => Math.round(value * 10) / 10

// Perf: React renders a key press's update before the event finishes, so time both the end of its handlers and the
// task after the next frame, which runs after paint.
async function installProbe(page) {
  await page.evaluate(() => {
    globalThis.keyTimes = []
    globalThis.handlerTimes = []
    addEventListener("keydown", (event) => globalThis.handlerTimes.push(performance.now() - event.timeStamp))
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

async function measureKeys(page) {
  await page.evaluate(() => {
    globalThis.keyTimes = []
    globalThis.handlerTimes = []
  })
  await page.locator('[data-slot="list-item"] button').first().focus()
  for (let index = 0; index < presses; index += 1) {
    await page.keyboard.press(index < presses * 0.75 ? "j" : "k")
    await page.waitForFunction((count) => globalThis.keyTimes.length >= count, index + 1)
  }
  const times = await page.evaluate(() => globalThis.keyTimes)
  const handlers = await page.evaluate(() => globalThis.handlerTimes)
  const focused = await page.evaluate(() => document.activeElement?.textContent?.slice(0, 8))
  return {
    handlerP95: round(percentile(handlers, 95)),
    paintP50: round(percentile(times, 50)),
    paintP95: round(percentile(times, 95)),
    paintMax: round(Math.max(...times)),
    focused,
  }
}

async function run(virtualize, rate) {
  let result
  await withShowcase(async (page) => {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send("Emulation.setCPUThrottlingRate", { rate })
    const url = new URL(page.url())
    await page.goto(`${url.origin}/?demo=list-bench&rows=${String(rows)}&virtualize=${String(virtualize)}`)
    await page.waitForFunction(() => globalThis.listBench?.mounted !== undefined)
    const mounted = await page.evaluate(() => globalThis.listBench.mounted)
    const rendered = await page.locator('[data-slot="list-item"]').count()
    await installProbe(page)
    const keys = await measureKeys(page)
    result = { virtualize, cpu: `${String(rate)}×`, rendered, firstPaintMs: round(mounted), ...keys }
  })
  return result
}

const results = []
// Perf: one after another, so they don't compete for the CPU they measure.
for (const virtualize of ["auto", false]) {
  for (const rate of [1, 4]) results.push(await run(virtualize, rate))
}
console.table(results)
const target = results.find((result) => result.virtualize === "auto" && result.cpu === "1×")
if (target && target.paintP95 >= 16) {
  console.error(`p95 keystroke-to-paint at 1× is ${String(target.paintP95)}ms, over the 16ms target`)
  process.exitCode = 1
}
