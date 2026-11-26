import { resolve } from "node:path"

import { chromium } from "playwright"

import { serve } from "./browser.mjs"

const build = resolve(
  import.meta.dirname,
  ".builds",
  process.argv[2]?.startsWith("--") ? "normal" : (process.argv[2] ?? "normal"),
)
const frames = Number(process.argv.find((arg) => arg.startsWith("--frames="))?.slice(9) ?? 240)
const runs = Number(process.argv.find((arg) => arg.startsWith("--runs="))?.slice(7) ?? 3)
const configs = [
  { label: "glass", theme: "glass", lens: false },
  { label: "liquid, no lens", theme: "liquid", lens: false },
  { label: "liquid", theme: "liquid", lens: true },
]
const paths = [
  { label: "GPU", args: [], cpu: 1 },
  { label: "GPU, 4x CPU", args: [], cpu: 4 },
  { label: "software", args: ["--disable-gpu"], cpu: 1 },
  { label: "software, 4x CPU", args: ["--disable-gpu"], cpu: 4 },
]
const threads = {
  CrRendererMain: "main",
  Compositor: "compositor",
  CrGpuMain: "gpu",
  VizCompositorThread: "viz",
}

function busyMs(events) {
  const spans = events.map((event) => [event.ts, event.ts + event.dur]).toSorted((a, b) => a[0] - b[0])
  let total = 0
  let [start, end] = spans[0] ?? [0, 0]
  for (const [from, to] of spans.slice(1)) {
    if (from > end) {
      total += end - start
      ;[start, end] = [from, to]
    } else end = Math.max(end, to)
  }
  return (total + end - start) / 1000
}

function perThread(trace) {
  const names = new Map()
  for (const event of trace.traceEvents) {
    if (event.ph === "M" && event.name === "thread_name" && threads[event.args.name]) {
      names.set(`${String(event.pid)}:${String(event.tid)}`, threads[event.args.name])
    }
  }
  const busy = {}
  for (const role of Object.values(threads)) {
    const events = trace.traceEvents.filter(
      (event) => event.ph === "X" && names.get(`${String(event.pid)}:${String(event.tid)}`) === role,
    )
    busy[role] = busyMs(events)
  }
  return busy
}

async function measure(path, config) {
  const browser = await chromium.launch({ channel: "chrome", args: path.args })
  const server = await serve(build)
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
    const cdp = await page.context().newCDPSession(page)
    await page.goto(`${server.origin}?demo=perf&scenario=board`)
    await page.waitForFunction(() => globalThis.perfFixture?.mounted !== undefined, undefined, { timeout: 60_000 })
    const renderer = await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl")
      const info = gl?.getExtension("WEBGL_debug_renderer_info")
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "none"
    })
    await page.evaluate(({ theme, lens }) => {
      document.documentElement.setAttribute("data-theme", theme)
      if (!lens) document.querySelector('[data-slot="liquid-lens"]')?.remove()
      const menu = document.createElement("div")
      menu.className = "surface-floating p-inline text-sm"
      menu.style.cssText = "position:fixed;left:320px;top:180px;width:240px;height:220px;z-index:50"
      menu.textContent = "Redeploy · Promote to production · Copy deployment URL · Delete project"
      document.body.append(menu)
    }, config)
    const backdrop = await page.evaluate(
      () => getComputedStyle(document.querySelector(".surface-floating")).backdropFilter,
    )
    if (backdrop.includes("eskais-liquid-lens") !== config.lens) {
      throw new Error(`${config.label} on ${path.label}: the panel's backdrop-filter is ${backdrop}`)
    }
    await page.waitForTimeout(2000)
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: path.cpu })
    await browser.startTracing(page, {
      categories: ["toplevel", "cc", "gpu", "viz", "blink", "disabled-by-default-devtools.timeline"],
    })
    const deltas = await page.evaluate(async (count) => {
      const board = document.querySelector("#root > *")
      const frameDeltas = []
      let last = performance.now()
      for (let frame = 0; frame < count; frame++) {
        board.style.translate = `${String(Math.sin(frame / 6) * 40)}px ${String(Math.cos(frame / 9) * 30)}px`
        await new Promise(requestAnimationFrame)
        const now = performance.now()
        frameDeltas.push(now - last)
        last = now
      }
      return frameDeltas.slice(10).toSorted((a, b) => a - b)
    }, frames)
    const trace = JSON.parse((await browser.stopTracing()).toString())
    const busy = perThread(trace)
    return {
      renderer,
      p50: deltas[Math.floor(deltas.length * 0.5)],
      p95: deltas[Math.floor(deltas.length * 0.95)],
      perFrame: Object.fromEntries(Object.entries(busy).map(([role, ms]) => [role, ms / frames])),
    }
  } finally {
    await browser.close()
    await server.close()
  }
}

const median = (values) => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]
const rows = []
for (const path of paths) {
  for (const config of configs) {
    const results = []
    for (let run = 0; run < runs; run++) results.push(await measure(path, config))
    const row = {
      path: path.label,
      config: config.label,
      "frame p50": median(results.map((result) => result.p50)).toFixed(1),
      "frame p95": median(results.map((result) => result.p95)).toFixed(1),
    }
    for (const role of Object.values(threads)) {
      row[`${role} ms/frame`] = median(results.map((result) => result.perFrame[role])).toFixed(2)
    }
    rows.push(row)
    console.log(`${path.label} (${results[0].renderer}) ${config.label}: ${JSON.stringify(row)}`)
  }
}
console.table(rows)
process.exit(0)
