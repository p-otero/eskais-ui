import { withShowcase } from "./showcase-browser.mjs"

const cpuFlag = process.argv.find((arg) => arg.startsWith("--cpu="))
const rates = cpuFlag ? cpuFlag.slice("--cpu=".length).split(",").map(Number) : [1]
const scenarios = [
  { name: "text 20k unified", query: "kind=text&lines=20000" },
  { name: "text 20k split", query: "kind=text&lines=20000&layout=split" },
  { name: "patch 500 files", query: "kind=patch&files=500" },
  { name: "patch 500 files, no find", query: "kind=patch&files=500&findable=false", probe: true },
  { name: "patch 500 files, no tree", query: "kind=patch&files=500&tree=false", probe: true },
]
const ci = process.argv.includes("--ci")
const budgets = ci
  ? { mountMs: 1500, keyP95Ms: 100, wheelP95Ms: 100, scrollP95Ms: Infinity, rows: 150 }
  : { mountMs: 1500, keyP95Ms: 50, wheelP95Ms: 34, scrollP95Ms: 34, rows: 150 }

const percentile = (values, p) => {
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

async function pressKeys(page, presses) {
  await page.evaluate(() => {
    globalThis.keyTimes = []
  })
  for (let index = 0; index < presses; index += 1) {
    await page.keyboard.press(index < presses * 0.75 ? "j" : "k")
    await page.waitForFunction((count) => globalThis.keyTimes.length >= count, index + 1)
  }
  return page.evaluate(() => globalThis.keyTimes)
}

async function holdKey(page, presses) {
  await page.evaluate(() => {
    globalThis.frames = []
    let last = performance.now()
    globalThis.recording = true
    const tick = (now) => {
      globalThis.frames.push(now - last)
      last = now
      if (globalThis.recording) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  for (let index = 0; index < presses; index += 1) {
    await page.keyboard.press("j")
    await page.waitForTimeout(33)
  }
  return page.evaluate(() => {
    globalThis.recording = false
    return globalThis.frames.slice(1)
  })
}

async function scrollFrames(page, step) {
  return page.evaluate(
    (by) =>
      new Promise((done) => {
        const viewport = document.querySelector('[data-slot="diff-view-viewport"]')
        const frames = []
        let last = performance.now()
        let count = 0
        const tick = (now) => {
          frames.push(now - last)
          last = now
          viewport.scrollTop += by ?? viewport.clientHeight
          count += 1
          if (count < 120) requestAnimationFrame(tick)
          else done(frames.slice(1))
        }
        requestAnimationFrame(tick)
      }),
    step,
  )
}

async function run(scenario, rate) {
  let result
  await withShowcase(async (page) => {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send("Emulation.setCPUThrottlingRate", { rate })
    const url = new URL(page.url())
    await page.goto(`${url.origin}/?demo=diff-bench&${scenario.query}`)
    await page.waitForFunction(() => globalThis.diffBench?.ready === true, undefined, { timeout: 60_000 })
    const mounted = await page.evaluate(() => globalThis.diffBench.mounted)
    const rendered = await page.locator('[role="row"]').count()
    const total = await page.evaluate(() => document.querySelectorAll("*").length)
    await page.locator('[role="gridcell"][tabindex="0"]').first().focus()
    await installProbe(page)
    const keys = await pressKeys(page, 60)
    const held = await holdKey(page, 60)
    const wheel = await scrollFrames(page, 40)
    const scroll = await scrollFrames(page)
    result = {
      scenario: scenario.name,
      cpu: `${String(rate)}×`,
      mountMs: round(mounted),
      rows: rendered,
      domNodes: total,
      keyP50: round(percentile(keys, 50)),
      keyP95: round(percentile(keys, 95)),
      heldFrameP95: round(percentile(held, 95)),
      heldFrameMax: round(Math.max(...held)),
      wheelFrameP95: round(percentile(wheel, 95)),
      scrollFrameP95: round(percentile(scroll, 95)),
      scrollFrameMax: round(Math.max(...scroll)),
    }
  })
  return result
}

const onlyFlag = process.argv.find((arg) => arg.startsWith("--only="))
const only = onlyFlag?.slice("--only=".length)
const ciScenarios = new Set(["text 20k unified", "patch 500 files"])
let chosen = scenarios.filter((scenario) => (ci ? ciScenarios.has(scenario.name) : !scenario.probe))
if (only) {
  chosen = scenarios.filter((scenario) =>
    only.endsWith("$") ? scenario.name === only.slice(0, -1) : scenario.name.includes(only),
  )
}
const results = []
for (const rate of rates) for (const scenario of chosen) results.push(await run(scenario, rate))
console.table(results)
for (const result of results.filter((entry) => entry.cpu === "1×")) {
  const over = []
  if (result.mountMs > budgets.mountMs) over.push(`mount ${String(result.mountMs)}ms`)
  if (result.keyP95 > budgets.keyP95Ms) over.push(`key p95 ${String(result.keyP95)}ms`)
  if (result.wheelFrameP95 > budgets.wheelP95Ms) over.push(`wheel frame p95 ${String(result.wheelFrameP95)}ms`)
  if (result.rows > budgets.rows) over.push(`${String(result.rows)} rows rendered: virtualization`)
  if (result.scrollFrameP95 > budgets.scrollP95Ms) over.push(`scroll frame p95 ${String(result.scrollFrameP95)}ms`)
  if (over.length > 0) {
    console.error(`${result.scenario}: over budget: ${over.join(", ")}`)
    process.exitCode = 1
  }
}
