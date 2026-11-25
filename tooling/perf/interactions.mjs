import { heapUsed, openPage } from "./browser.mjs"
import { summarizeTrace } from "./trace.mjs"

const traceCategories = [
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.frame",
  "toplevel",
  "v8.execute",
  "blink.user_timing",
]

const round = (value, digits = 1) =>
  value === undefined || Number.isNaN(value) ? null : Math.round(value * 10 ** digits) / 10 ** digits

function percentile(values, p) {
  if (values.length === 0) return Number.NaN
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]
}

const keyCodes = {
  ArrowDown: 40,
  ArrowUp: 38,
  ArrowLeft: 37,
  ArrowRight: 39,
  Tab: 9,
}

async function gotoFixture(page, origin, scenario) {
  await page.goto(`${origin}?demo=perf&scenario=${scenario}`, { timeout: 120_000 })
  await page.waitForFunction(() => globalThis.perfFixture?.mounted !== undefined, undefined, { timeout: 120_000 })
  await page.evaluate(() => document.fonts.ready)
  return page.evaluate(() => globalThis.perfFixture.mounted)
}

async function focusStart(page, definition) {
  if (definition.settle) await page.waitForTimeout(definition.settle)
  if (definition.setup) await definition.setup(page)
  if (!definition.focus) return
  const target = page.locator(definition.focus).first()
  await target.waitFor()
  await target.evaluate((element) => element.focus())
  if (definition.caretToEnd) await page.keyboard.press("Control+End")
  await page.waitForTimeout(150)
}

async function pressTimed(page, keys) {
  for (const key of keys) {
    await page.keyboard.press(key)
    await page.waitForFunction(() => globalThis.__perf.pending() === 0, undefined, { polling: 16 })
  }
}

function summarizeInputs(taken, count) {
  const keydowns = taken.inputs.filter((input) => input.type === "keydown" && input.paint !== undefined)
  const paints = keydowns.map((input) => input.paint)
  const renders = keydowns.map((input) => input.renders)
  const top = Object.entries(taken.byName)
    .slice(0, 6)
    .map(([name, total]) => `${name}×${String(round(total / count, 1))}`)
  return {
    presses: keydowns.length,
    paintP50: round(percentile(paints, 50)),
    paintP95: round(percentile(paints, 95)),
    paintMax: round(Math.max(...paints)),
    over8: keydowns.filter((input) => input.paint > 8).length,
    over16: keydowns.filter((input) => input.paint > 16).length,
    rendersMedian: percentile(renders, 50),
    rendersMax: Math.max(...renders),
    commitsPerPress: round(taken.commits / count, 2),
    topComponents: top,
    eventTimingMax: round(Math.max(0, ...taken.events.map((event) => event.duration))),
    longTasks: taken.longTasks.length,
    longTaskMs: round(taken.longTasks.reduce((sum, task) => sum + task.duration, 0)),
    loafForcedMs: round(taken.frames.reduce((sum, frame) => sum + frame.forcedStyleAndLayout, 0)),
  }
}

async function measureKeys(browser, origin, definition, { cpu, trace }) {
  const { page, context, errors } = await openPage(browser, { cpu })
  try {
    await gotoFixture(page, origin, definition.id)
    await focusStart(page, definition)
    await page.evaluate(() => globalThis.__perf.reset())
    await pressTimed(page, definition.keys)
    const taken = await page.evaluate(() => globalThis.__perf.take())
    const result = summarizeInputs(taken, definition.keys.length)
    result.renderNames = taken.byName

    if (trace) {
      const sample = definition.keys.slice(0, 20)
      await page.reload()
      await page.waitForFunction(() => globalThis.perfFixture?.mounted !== undefined)
      await focusStart(page, definition)
      await browser.startTracing(page, { categories: traceCategories })
      await pressTimed(page, sample)
      const buffer = await browser.stopTracing()
      const summary = summarizeTrace(JSON.parse(buffer.toString("utf8")))
      result.perPress = Object.fromEntries(
        Object.entries(summary.totals).map(([kind, ms]) => [kind, round(ms / sample.length, 2)]),
      )
      result.forcedLayoutsPerPress = round(summary.forced.count / sample.length, 2)
      result.forcedLayoutMsPerPress = round(summary.forced.ms / sample.length, 2)
      result.trace = buffer
    }
    result.errors = errors
    return result
  } finally {
    await context.close()
  }
}

async function measureHeld(browser, origin, definition, { cpu }) {
  const { page, context, cdp } = await openPage(browser, { cpu })
  try {
    await gotoFixture(page, origin, definition.id)
    await focusStart(page, definition)
    await page.evaluate(() => {
      globalThis.__perf.reset()
      globalThis.__perf.startFrames()
    })
    const code = keyCodes[definition.held]
    const event = {
      key: definition.held,
      code: definition.held,
      windowsVirtualKeyCode: code,
      nativeVirtualKeyCode: code,
    }
    const sends = []
    const started = Date.now()
    for (let index = 0; Date.now() - started < 2000; index += 1) {
      sends.push(cdp.send("Input.dispatchKeyEvent", { type: "keyDown", autoRepeat: index > 0, ...event }))
      await new Promise((tick) => setTimeout(tick, 33))
    }
    sends.push(cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...event }))
    const sentAt = Date.now() - started
    await Promise.all(sends)
    await page.waitForFunction(() => globalThis.__perf.pending() === 0, undefined, { timeout: 30_000 })
    const handledAt = Date.now() - started
    const frames = await page.evaluate(() => globalThis.__perf.stopFrames())
    const taken = await page.evaluate(() => globalThis.__perf.take())
    const paints = taken.inputs.filter((input) => input.type === "keydown").map((input) => input.paint)
    const elapsed = handledAt
    const expectedFrames = Math.round(elapsed / (1000 / 60))
    return {
      keys: paints.length,
      paintP95: round(percentile(paints, 95)),
      paintMax: round(Math.max(...paints)),
      droppedFrames: Math.max(0, expectedFrames - frames),
      frames,
      expectedFrames,
      backlogMs: Math.max(0, handledAt - sentAt),
      longTasks: taken.longTasks.length,
      longTaskMs: round(taken.longTasks.reduce((sum, task) => sum + task.duration, 0)),
    }
  } finally {
    await context.close()
  }
}

async function measureOverlays(browser, origin, overlays, { cpu, rounds = 5 }) {
  const results = []
  for (const scenario of new Set(overlays.map((overlay) => overlay.scenario ?? "overlays"))) {
    const { page, context } = await openPage(browser, { cpu })
    try {
      await gotoFixture(page, origin, scenario)
      for (const overlay of overlays.filter((entry) => (entry.scenario ?? "overlays") === scenario)) {
        const open = []
        const close = []
        for (let index = 0; index < rounds; index += 1) {
          if (overlay.trigger) {
            const trigger = page.getByRole("button", { name: overlay.trigger, exact: true }).first()
            await trigger.evaluate((element) => element.focus())
          }
          await page.evaluate((selector) => {
            globalThis.__perfWatch = globalThis.__perf.watch(selector, true)
          }, overlay.content)
          await page.keyboard.press(overlay.shortcut ?? "Enter")
          open.push(await page.evaluate(() => globalThis.__perfWatch))
          await page.waitForTimeout(150)
          await page.evaluate((selector) => {
            globalThis.__perfWatch = globalThis.__perf.watch(selector, false)
          }, overlay.content)
          await page.keyboard.press("Escape")
          close.push(await page.evaluate(() => globalThis.__perfWatch))
          await page.waitForTimeout(300)
        }
        const median = (list, key) =>
          round(
            percentile(
              list.map((entry) => entry[key]),
              50,
            ),
          )
        results.push({
          overlay: overlay.name,
          openFirstFrame: median(open, "firstFrame"),
          openSettled: median(open, "settled"),
          closeFirstFrame: median(close, "firstFrame"),
          closeSettled: median(close, "settled"),
          timeouts: [...open, ...close].filter((entry) => entry.timeout).length,
        })
      }
    } finally {
      await context.close()
    }
  }
  return results
}

async function measureMount(browser, origin, scenario, { cpu, rounds = 3 }) {
  const times = []
  let heap = 0
  let renders = 0
  for (let index = 0; index < rounds; index += 1) {
    const { page, context, cdp } = await openPage(browser, { cpu })
    try {
      times.push(await gotoFixture(page, origin, scenario))
      renders = await page.evaluate(() => globalThis.__perf.take().renders)
      heap = Math.max(heap, await heapUsed(cdp))
    } finally {
      await context.close()
    }
  }
  return { scenario, mountMs: round(percentile(times, 50)), heapMB: round(heap / 1024 / 1024, 2), renders }
}

async function measureCounts(browser, origin, definition, { presses = 20 } = {}) {
  const { page, context, errors } = await openPage(browser, { cpu: 1 })
  try {
    await gotoFixture(page, origin, definition.id)
    await focusStart(page, definition)
    await page.evaluate(() => globalThis.__perf.reset())
    await browser.startTracing(page, { categories: traceCategories })
    await pressTimed(page, definition.keys.slice(0, presses))
    const summary = summarizeTrace(JSON.parse((await browser.stopTracing()).toString("utf8")))
    const taken = await page.evaluate(() => globalThis.__perf.take())
    const keydowns = taken.inputs.filter((input) => input.type === "keydown" && input.paint !== undefined)
    const count = Math.max(1, keydowns.length)
    return {
      presses: keydowns.length,
      rendersMax: Math.max(0, ...keydowns.map((input) => input.renders)),
      paintP95: round(
        percentile(
          keydowns.map((input) => input.paint),
          95,
        ),
      ),
      forcedLayoutsPerPress: round(summary.forced.count / count, 2),
      mainThreadPerPress: round(Object.values(summary.totals).reduce((sum, ms) => sum + ms, 0) / count, 2),
      errors,
    }
  } finally {
    await context.close()
  }
}

export { measureCounts, measureHeld, measureKeys, measureMount, measureOverlays, percentile, round }
