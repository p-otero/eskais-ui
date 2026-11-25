const scripting = new Set([
  "EventDispatch",
  "FunctionCall",
  "EvaluateScript",
  "v8.compile",
  "v8.compileModule",
  "v8.evaluateModule",
  "v8.callFunction",
  "v8.run",
  "V8.Execute",
  "TimerFire",
  "FireAnimationFrame",
  "FireIdleCallback",
  "RunMicrotasks",
  "XHRReadyStateChange",
  "MessagePort::postMessage",
  "HandlePostMessage",
  "ProfileCall",
  "ParseHTML",
  "v8.produceCache",
  "CompileScript",
  "CompileCode",
  "CompileModule",
])
const style = new Set(["UpdateLayoutTree", "RecalculateStyles", "ParseAuthorStyleSheet", "ScheduleStyleRecalculation"])
const layout = new Set(["Layout", "InvalidateLayout", "IntersectionObserverController::computeIntersections"])
const paint = new Set([
  "Paint",
  "PrePaint",
  "Layerize",
  "UpdateLayer",
  "UpdateLayerTree",
  "CompositeLayers",
  "Commit",
  "PaintImage",
  "Decode Image",
  "Rasterize",
  "Animation",
])
const gc = new Set(["MinorGC", "MajorGC", "V8.GC_SCAVENGER", "BlinkGC.AtomicPhase", "V8.GCFinalizeMC", "GCEvent"])

function kindOf(name) {
  if (scripting.has(name)) return "scripting"
  if (style.has(name)) return "style"
  if (layout.has(name)) return "layout"
  if (paint.has(name)) return "paint"
  if (gc.has(name) || name.includes("GC")) return "gc"
  return undefined
}

function mainThread(events) {
  const names = events.filter((event) => event.ph === "M" && event.name === "thread_name")
  const mains = names.filter((event) => event.args?.name === "CrRendererMain")
  let best
  let bestCount = -1
  for (const main of mains) {
    const count = events.reduce(
      (sum, event) => sum + (event.pid === main.pid && event.tid === main.tid && event.ph === "X" ? 1 : 0),
      0,
    )
    if (count > bestCount) {
      best = main
      bestCount = count
    }
  }
  return best
}

function summarizeTrace(trace, window) {
  const events = Array.isArray(trace) ? trace : trace.traceEvents
  const main = mainThread(events)
  const totals = { scripting: 0, style: 0, layout: 0, paint: 0, gc: 0, other: 0 }
  const forced = { count: 0, ms: 0 }
  const tasks = []
  if (!main) return { totals, forced, tasks, mainFound: false }
  const slices = events
    .filter((event) => event.pid === main.pid && event.tid === main.tid && event.ph === "X" && event.dur !== undefined)
    .filter((event) => !window || (event.ts >= window[0] && event.ts + event.dur <= window[1]))
    .toSorted((a, b) => a.ts - b.ts || b.dur - a.dur)

  const stack = []
  const close = (until) => {
    while (stack.length > 0 && stack.at(-1).end <= until) {
      const done = stack.pop()
      const self = Math.max(0, done.event.dur - done.children)
      totals[done.kind] += self / 1000
      if (stack.length > 0) stack.at(-1).children += done.event.dur
    }
  }
  for (const event of slices) {
    close(event.ts)
    const parent = stack.at(-1)
    const own = kindOf(event.name)
    const kind = own ?? (parent?.kind && parent.kind !== "other" ? parent.kind : "other")
    const inScript = stack.some((frame) => frame.kind === "scripting")
    if ((own === "layout" || own === "style") && inScript && event.name !== "ScheduleStyleRecalculation") {
      forced.count += 1
      forced.ms += event.dur / 1000
    }
    if (stack.length === 0 && (event.name === "RunTask" || event.name === "ThreadControllerImpl::RunTask")) {
      tasks.push({ ts: event.ts, ms: event.dur / 1000 })
    }
    stack.push({ event, kind, end: event.ts + event.dur, children: 0 })
  }
  close(Number.POSITIVE_INFINITY)
  for (const key of Object.keys(totals)) totals[key] = Math.round(totals[key] * 100) / 100
  forced.ms = Math.round(forced.ms * 100) / 100
  return { totals, forced, tasks, mainFound: true }
}

export { summarizeTrace }
