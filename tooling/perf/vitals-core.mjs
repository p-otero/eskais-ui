// Measures one cold page load's Web Vitals in Chrome; bun run perf:vitals (vitals.mjs) and perf:ci (ci.mjs) use it.
import { openPage } from "./browser.mjs"
import { percentile } from "./interactions.mjs"

const networks = {
  none: undefined,
  "4g": { latency: 150, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 },
}

// `ready` is what the page shows once it has loaded; the server fixtures wait out their simulated latency.
const siteTargets = [
  { id: "site:landing", path: "", ready: "main h1" },
  { id: "site:data-table", path: "docs/components/data-table/", ready: "main h1" },
  { id: "site:server-data", path: "docs/server-data/", ready: "main h1" },
]
const showcaseTargets = [
  { id: "shell", query: "?demo=shell-block", ready: "main" },
  { id: "dashboard-grid", query: "?demo=dashboard-grid", ready: "main" },
  { id: "settings-page", query: "?demo=settings-page", ready: "main" },
  { id: "document-workspace", query: "?demo=document-workspace", ready: ".cm-content, [data-slot=markdown-view]" },
  { id: "master-detail", query: "?demo=master-detail", ready: "main" },
  {
    id: "server-data-table",
    query: "?demo=perf&scenario=server-data-table&delay=800",
    ready: 'tbody tr[tabindex="0"]',
  },
  {
    id: "server-list",
    query: "?demo=perf&scenario=server-list&delay=800",
    ready: '[data-slot="list-item"] [tabindex="0"]',
  },
]

// Runs in the page before its scripts. CLS is the largest session window of shifts not caused by input (gaps under
// 1 s, at most 5 s long), as web-vitals computes it; INP the longest interaction.
const observe = () => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the page through addInitScript, which serializes this function alone
  const describe = (node) => {
    if (!(node instanceof Element)) return node?.nodeName ?? ""
    const slot = node.getAttribute("data-slot")
    return `${node.tagName.toLowerCase()}${slot ? `[${slot}]` : ""}${node.id ? `#${node.id}` : ""}`
  }
  const vitals = { fcp: null, lcp: null, lcpElement: "", cls: 0, shifts: [], inp: 0 }
  globalThis.__vitals = vitals
  let session = 0
  let sessionStart = 0
  let previous = 0
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- serialized with `observe`, like `describe`
  const watch = (type, onEntry, extra = {}) => {
    try {
      new PerformanceObserver((entries) => entries.getEntries().forEach(onEntry)).observe({
        type,
        buffered: true,
        ...extra,
      })
    } catch {
      // An entry type this browser doesn't report.
    }
  }
  watch("paint", (entry) => {
    if (entry.name === "first-contentful-paint") vitals.fcp = entry.startTime
  })
  watch("largest-contentful-paint", (entry) => {
    vitals.lcp = entry.startTime
    vitals.lcpElement = describe(entry.element)
  })
  watch("layout-shift", (entry) => {
    if (entry.hadRecentInput) return
    if (entry.startTime - previous > 1000 || entry.startTime - sessionStart > 5000) {
      session = 0
      sessionStart = entry.startTime
    }
    session += entry.value
    previous = entry.startTime
    vitals.cls = Math.max(vitals.cls, session)
    vitals.shifts.push({
      at: Math.round(entry.startTime),
      value: Math.round(entry.value * 10_000) / 10_000,
      sources: entry.sources.map((source) => describe(source.node)),
    })
  })
  watch(
    "event",
    (entry) => {
      if (entry.interactionId) vitals.inp = Math.max(vitals.inp, entry.duration)
    },
    { durationThreshold: 16 },
  )
}

async function measure(browser, url, target, { cpu, network }) {
  const { page, context } = await openPage(browser, { cpu, network: networks[network] })
  try {
    await page.addInitScript(observe)
    await page.goto(url, { waitUntil: "load", timeout: 120_000 })
    await page.locator(target.ready).first().waitFor({ timeout: 60_000 })
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(1500)
    // An interaction for INP that changes nothing: focus moving through the page's first controls.
    for (let press = 0; press < 4; press += 1) await page.keyboard.press("Tab")
    await page.waitForTimeout(300)
    return await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0]
      const vitals = globalThis.__vitals
      return { ttfb: navigation?.responseStart ?? null, ...vitals }
    })
  } finally {
    await context.close()
  }
}

const round = (value, digits = 1) =>
  value === null || Number.isNaN(value) ? null : Math.round(value * 10 ** digits) / 10 ** digits

function summarize(runs) {
  const median = (key) =>
    percentile(
      runs.map((run) => run[key] ?? Number.NaN).filter((v) => !Number.isNaN(v)),
      50,
    )
  return {
    runs: runs.length,
    ttfb: round(median("ttfb")),
    fcp: round(median("fcp")),
    lcp: round(median("lcp")),
    cls: round(median("cls"), 4),
    clsMax: round(Math.max(...runs.map((run) => run.cls)), 4),
    inp: round(median("inp")),
    lcpElement: runs.at(-1)?.lcpElement,
    shifts: runs.toSorted((a, b) => b.cls - a.cls)[0]?.shifts.slice(0, 8),
  }
}

export { measure, networks, round, showcaseTargets, siteTargets, summarize }
