// Draws one key press from a trace as a flame chart of the renderer main thread and saves it as a PNG: from the
// keydown's EventDispatch to the end of the frame that painted it, colored like DevTools (script yellow, style and
// layout purple, paint green, gc orange).
// Usage: node tooling/perf/trace-chart.mjs <trace.json> <out.png> [press index, default 10] [title]
import { readFileSync } from "node:fs"

import { chromium } from "playwright"

const [input, output, pressArg = "10", title = ""] = process.argv.slice(2)
const trace = JSON.parse(readFileSync(input, "utf8"))
const events = trace.traceEvents ?? trace
const mains = events.filter(
  (event) => event.ph === "M" && event.name === "thread_name" && event.args?.name === "CrRendererMain",
)
const main = mains
  .map((thread) => ({
    thread,
    count: events.filter((event) => event.pid === thread.pid && event.tid === thread.tid && event.ph === "X").length,
  }))
  .toSorted((a, b) => b.count - a.count)[0].thread
const slices = events
  .filter((event) => event.pid === main.pid && event.tid === main.tid && event.ph === "X" && event.dur !== undefined)
  .toSorted((a, b) => a.ts - b.ts || b.dur - a.dur)
const keydowns = slices.filter((event) => event.name === "EventDispatch" && event.args?.data?.type === "keydown")
const press = keydowns[Math.min(Number(pressArg), keydowns.length - 1)]
const nextPress = keydowns[keydowns.indexOf(press) + 1]
// The press's frame: everything until the first Commit after it, plus a little margin.
const commit = slices.find((event) => event.ts > press.ts && event.name === "Commit")
const start = press.ts - 2000
const end = Math.min(
  nextPress ? nextPress.ts - 1000 : Number.POSITIVE_INFINITY,
  (commit ? commit.ts + commit.dur : press.ts + 50_000) + 4000,
)
const shown = slices.filter((event) => event.ts + event.dur > start && event.ts < end)

const colors = [
  [/EventDispatch|FunctionCall|v8|V8\.Execute|RunMicrotasks|TimerFire|FireAnimationFrame|Compile|Evaluate/, "#f2c94c"],
  [/UpdateLayoutTree|RecalculateStyles|Layout|ScheduleStyle/, "#9b6bd6"],
  [/Paint|PrePaint|Layerize|Commit|Raster|UpdateLayer|Composite/, "#5cb85c"],
  [/GC/, "#f0883e"],
]
const colorOf = (name) => colors.find(([pattern]) => pattern.test(name))?.[1] ?? "#c8c8c8"

const stack = []
const boxes = []
for (const event of shown) {
  while (stack.length > 0 && stack.at(-1) <= event.ts) stack.pop()
  boxes.push({ event, depth: stack.length })
  stack.push(event.ts + event.dur)
}
const width = 1400
const rowHeight = 18
const depth = Math.max(...boxes.map((box) => box.depth)) + 1
const scale = width / (end - start)
const total = (pattern) =>
  shown.filter((event) => pattern.test(event.name)).reduce((sum, event) => sum + event.dur, 0) / 1000
const rects = boxes
  .map(({ event, depth: level }) => {
    const x = Math.max(0, (event.ts - start) * scale)
    const w = Math.max(1, Math.min(width, (event.ts + event.dur - start) * scale) - x)
    const label = w > 60 ? `${event.name} ${(event.dur / 1000).toFixed(1)}ms` : ""
    return `<g><rect x="${x}" y="${level * rowHeight + 40}" width="${w}" height="${rowHeight - 2}" fill="${colorOf(event.name)}" stroke="#0002"/><text x="${x + 3}" y="${level * rowHeight + 52}" font-size="11" font-family="monospace">${label.replaceAll("<", "&lt;")}</text></g>`
  })
  .join("")
const ticks = Array.from({ length: Math.floor((end - start) / 1000 / 5) + 1 }, (_, index) => {
  const x = index * 5000 * scale
  return `<line x1="${x}" x2="${x}" y1="30" y2="${depth * rowHeight + 44}" stroke="#0001"/><text x="${x + 2}" y="28" font-size="10" font-family="monospace">${String(index * 5)} ms</text>`
}).join("")
const caption = `${title} — one key press, ${((end - start) / 1000).toFixed(1)} ms shown. Layerize ${total(/^Layerize$/).toFixed(1)} ms, Layout ${total(/^Layout$/).toFixed(1)} ms, script ${total(/^(EventDispatch|FunctionCall)$/).toFixed(1)} ms (incl. nested)`
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${depth * rowHeight + 60}"><rect width="100%" height="100%" fill="#fff"/><text x="4" y="14" font-size="12" font-family="sans-serif">${caption.replaceAll("<", "&lt;")}</text>${ticks}${rects}</svg>`

const browser = await chromium.launch({ channel: "chrome" })
const page = await browser.newPage({ viewport: { width, height: depth * rowHeight + 60 } })
await page.setContent(`<body style="margin:0">${svg}</body>`)
await page.screenshot({ path: output })
await browser.close()
console.log(`Saved ${output}: ${caption}`)
