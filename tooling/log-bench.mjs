import { withShowcase } from "./showcase-browser.mjs"

const args = process.argv.slice(2)
const ci = args.includes("--ci")
const linesPerSecond = Number(args.find((arg) => arg.startsWith("--rate="))?.slice(7) ?? 2000)
const rates = (args.find((arg) => arg.startsWith("--cpu="))?.slice(6) ?? (ci ? "1" : "1,4")).split(",").map(Number)

function percentile(values, p) {
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? Number.NaN
}

const round = (value) => Math.round(value * 10) / 10
const log = '[data-slot="log-viewer-log"]'

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

function burst(page, count) {
  return page.evaluate(
    (lines) =>
      new Promise((resolve) => {
        let longest = 0
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) longest = Math.max(longest, entry.duration)
        })
        observer.observe({ type: "longtask" })
        const start = performance.now()
        globalThis.logBench.burst(lines)
        const appended = performance.now() - start
        // Perf: queued after the store's own frame callback, so it runs once the viewer has rendered the burst; the
        // message after it lands once that frame has painted.
        requestAnimationFrame(() => {
          const channel = new MessageChannel()
          channel.port1.addEventListener("message", () => {
            observer.disconnect()
            resolve({ appended, painted: performance.now() - start, longest })
          })
          channel.port1.start()
          channel.port2.postMessage(null)
        })
      }),
    count,
  )
}

function newestInView(page) {
  return page.evaluate((selector) => {
    const scroller = document.querySelector(selector)
    const { lastId } = globalThis.logBench.store.getSnapshot()
    const row = scroller?.querySelector(`[data-line-id="${String(lastId)}"]`)
    if (!scroller || !row) return false
    const box = scroller.getBoundingClientRect()
    const rect = row.getBoundingClientRect()
    return rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1
  }, log)
}

function streamFrames(page) {
  return page.evaluate(
    (selector) =>
      new Promise((resolve) => {
        const scroller = document.querySelector(selector)
        const intervals = []
        let blank = 0
        let last = performance.now()
        const end = last + 2000
        const step = (now) => {
          intervals.push(now - last)
          last = now
          const box = scroller.getBoundingClientRect()
          const hit = document.elementFromPoint(box.left + 40, box.bottom - 6)
          if (!hit?.closest('[data-slot="log-viewer-line"]')) blank++
          if (now < end) requestAnimationFrame(step)
          else resolve({ intervals, blank })
        }
        requestAnimationFrame(step)
      }),
    log,
  )
}

async function run(rate) {
  let result
  await withShowcase(async (page) => {
    const cdp = await page.context().newCDPSession(page)
    const url = new URL(page.url())
    await page.goto(`${url.origin}/?demo=log-bench&max=10000`)
    await page.waitForFunction(() => globalThis.logBench !== undefined)
    await page.locator(log).waitFor()
    await page.waitForTimeout(300)
    await cdp.send("Emulation.setCPUThrottlingRate", { rate })

    const first = await burst(page, 10_000)
    const rendered = await page.locator('[data-slot="log-viewer-line"]').count()
    const followsBurst = await newestInView(page)
    const second = await burst(page, 10_000)

    await page.evaluate((perSecond) => globalThis.logBench.stream(perSecond), linesPerSecond)
    await page.waitForTimeout(300)
    const frames = await streamFrames(page)
    await page.evaluate(() => globalThis.logBench.stop())
    await page.waitForTimeout(100)
    const followsStream = await newestInView(page)
    await page.evaluate((perSecond) => globalThis.logBench.stream(perSecond), linesPerSecond)

    await installProbe(page)
    await page.locator(log).focus()
    for (let index = 0; index < 30; index += 1) {
      await page.keyboard.press("ArrowUp")
      await page.waitForFunction((count) => globalThis.keyTimes.length >= count, index + 1)
    }
    await page.waitForTimeout(200)
    const letGo = await page.evaluate(() => {
      const root = document.querySelector('[data-slot="log-viewer"]')
      const jump = document.querySelector('[data-slot="log-viewer-jump"]')
      return { following: root?.hasAttribute("data-following"), count: Number(jump?.dataset.count ?? 0) }
    })
    for (let index = 0; index < 20; index += 1) {
      await page.keyboard.press(index % 2 === 0 ? "PageUp" : "ArrowDown")
      await page.waitForFunction((count) => globalThis.keyTimes.length >= count, 31 + index)
    }
    await page.keyboard.press("End")
    await page.waitForTimeout(200)
    await page.evaluate(() => globalThis.logBench.stop())
    await page.waitForTimeout(100)
    const resumed = await page.evaluate(() =>
      document.querySelector('[data-slot="log-viewer"]')?.hasAttribute("data-following"),
    )
    const followsAgain = await newestInView(page)
    const keys = await page.evaluate(() => globalThis.keyTimes)
    const longFrames = frames.intervals.filter((interval) => interval > 34).length

    result = {
      cpu: `${String(rate)}×`,
      burstMs: round(first.painted),
      appendMs: round(first.appended),
      burstLongTaskMs: round(first.longest),
      evictingBurstMs: round(second.painted),
      rendered,
      frameP95: round(percentile(frames.intervals, 95)),
      longFrames,
      blankFrames: frames.blank,
      keyP50: round(percentile(keys, 50)),
      keyP95: round(percentile(keys, 95)),
      keyMax: round(Math.max(...keys)),
      follows: followsBurst && followsStream && followsAgain,
      letGo: letGo.following === false && letGo.count > 0,
      resumed: resumed === true,
    }
  })
  return result
}

const results = []
for (const rate of rates) results.push(await run(rate))
console.table(results)

const failures = []
for (const result of results) {
  if (!result.follows) failures.push(`${result.cpu}: the newest line left the view while following`)
  if (!result.letGo) failures.push(`${result.cpu}: scrolling up didn't stop following or count new lines`)
  if (!result.resumed) failures.push(`${result.cpu}: End didn't follow again`)
  if (result.blankFrames > 0)
    failures.push(`${result.cpu}: ${String(result.blankFrames)} frames showed no line at the end`)
  if (result.rendered > 120)
    failures.push(`${result.cpu}: ${String(result.rendered)} rows rendered, not only the ones in view`)
}
const baseline = results.find((result) => result.cpu === "1×")
if (ci && baseline) {
  if (baseline.burstMs >= 100) failures.push(`a 10,000-line burst took ${String(baseline.burstMs)} ms to paint at 1×`)
  if (baseline.keyP95 >= 25)
    failures.push(`key to paint while streaming has a p95 of ${String(baseline.keyP95)} ms at 1×`)
}
if (failures.length > 0) {
  console.error(failures.join("\n"))
  process.exitCode = 1
}
