// The performance budgets CI holds: React renders and forced layouts per key press, the board's composited
// layers, and each registry item's gzip size, checked against tooling/perf/budgets.json. Counts are exact, so any
// runner can check them. Usage: bun run perf:ci [--dir=<built showcase>] [--update]; see tooling/perf/README.md.
import { spawnSync } from "node:child_process"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { resolve } from "node:path"

import { countLayers, launch, openPage, serve } from "./browser.mjs"
import { measureBundles } from "./bundle.mjs"
import { measureCounts } from "./interactions.mjs"
import { keyScenarios } from "./scenarios.mjs"
import { measure as measureVitals, showcaseTargets, summarize } from "./vitals-core.mjs"

const here = import.meta.dirname
const root = resolve(here, "..", "..")
const budgetFile = resolve(here, "budgets.json")
const update = process.argv.includes("--update")
const dirArg = process.argv.find((arg) => arg.startsWith("--dir="))
const build = dirArg ? resolve(root, dirArg.slice(6)) : resolve(here, ".builds", "ci")

const labelOf = (definition) => (definition.phase ? `${definition.id}:${definition.phase}` : definition.id)

if (!dirArg) {
  console.log("Building the showcase…")
  const result = spawnSync("npx", ["vite", "build", "--logLevel", "error"], {
    cwd: resolve(root, "apps", "showcase"),
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, SHOWCASE_OUT_DIR: build, SHOWCASE_KEEP_NAMES: "1", REACT_COMPILER: "" },
  })
  if (result.status !== 0) throw new Error("The showcase build failed")
}

const budgets = JSON.parse(await readFile(budgetFile, "utf8"))
const measured = { keys: {}, layers: {}, vitals: {}, bundles: {} }
// Cold loads per fixture: CLS and LCP are their medians.
const vitalsRuns = 3
const server = await serve(build)
const browser = await launch()
try {
  for (const label of Object.keys(budgets.keys)) {
    const definition = keyScenarios.find((entry) => labelOf(entry) === label)
    if (!definition) throw new Error(`budgets.json names an unknown scenario: ${label}`)
    process.stdout.write(`  ${label}…`)
    measured.keys[label] = await measureCounts(browser, server.origin, definition)
    console.log(
      ` ${String(measured.keys[label].rendersMax)} renders, ${String(measured.keys[label].forcedLayoutsPerPress)} forced`,
    )
  }
  for (const scenario of Object.keys(budgets.layers)) {
    const { page, context, cdp } = await openPage(browser)
    try {
      await page.goto(`${server.origin}?demo=perf&scenario=${scenario}`)
      await page.waitForFunction(() => globalThis.perfFixture?.mounted !== undefined, undefined, { timeout: 60_000 })
      // Long enough for a pulse that runs a few times when a status starts to finish.
      await page.waitForTimeout(budgets.layersSettleMs ?? 4000)
      measured.layers[scenario] = (await countLayers(page, cdp)).count
    } finally {
      await context.close()
    }
  }
  // Load-time vitals on the slow 4G profile, where LCP is mostly the transfer, so it varies less between machines.
  for (const id of Object.keys(budgets.vitals ?? {})) {
    const target = showcaseTargets.find((entry) => entry.id === id)
    if (!target) throw new Error(`budgets.json names an unknown vitals target: ${id}`)
    process.stdout.write(`  vitals ${id}…`)
    const runs = []
    for (let run = 0; run < vitalsRuns; run += 1) {
      runs.push(await measureVitals(browser, `${server.origin}${target.query}`, target, { cpu: 1, network: "4g" }))
    }
    const { cls, lcp } = summarize(runs)
    measured.vitals[id] = { cls, lcp }
    console.log(` CLS ${String(cls)}, LCP ${String(lcp)} ms`)
  }
} finally {
  await browser.close()
  await server.close()
}
console.log("Measuring bundles…")
for (const row of await measureBundles({ uiSdkShare: false })) measured.bundles[row.item] = row.gzipKB

const failures = []
const rows = []
// A forced layout is an average over 20 presses: one stray layout moves it by 0.05, so it gets that much slack twice.
// A virtualized list measures the rows a scroll brings in when its scroll event lands, which varies by a frame from
// run to run: such a scenario declares its own `forcedSlack`. A large render count gets 5% for the same reason; a
// small one, like the two rows of a roving move, stays exact.
const slack = {
  "forced layouts per press": (_budget, name) => budgets.keys[name]?.forcedSlack ?? 0.1,
  "renders per press": (budget) => (budget > 20 ? Math.floor(budget * 0.05) : 0),
}
const check = (kind, name, value, budget) => {
  // The epsilon keeps a value exactly at the limit from failing on floating-point rounding (4.85 + 0.1 < 4.95).
  const ok = budget === undefined ? null : value <= budget + (slack[kind]?.(budget, name) ?? 0) + 1e-9
  rows.push({ kind, name, value, budget: budget ?? "none", ok: ok === null ? "new" : ok ? "ok" : "OVER" })
  if (ok === false) failures.push(`${kind} ${name}: ${String(value)} over the budget of ${String(budget)}`)
}
for (const [label, counts] of Object.entries(measured.keys)) {
  check("renders per press", label, counts.rendersMax, budgets.keys[label].renders)
  check("forced layouts per press", label, counts.forcedLayoutsPerPress, budgets.keys[label].forcedLayouts)
}
for (const [scenario, count] of Object.entries(measured.layers))
  check("layers", scenario, count, budgets.layers[scenario])
for (const [id, { cls, lcp }] of Object.entries(measured.vitals)) {
  check("CLS", id, cls, budgets.vitals[id].cls)
  check("LCP ms, slow 4G", id, lcp, budgets.vitals[id].lcp)
}
for (const [item, kb] of Object.entries(measured.bundles)) check("gzip KB", item, kb, budgets.bundles[item])
for (const item of Object.keys(budgets.bundles)) {
  if (!(item in measured.bundles)) failures.push(`gzip KB ${item}: in budgets.json but no longer a registry item`)
}
console.table(rows.filter((row) => row.kind !== "gzip KB" || row.ok !== "ok"))
console.log(`${String(rows.filter((row) => row.kind === "gzip KB" && row.ok === "ok").length)} bundles within budget`)

await mkdir(resolve(here, "results"), { recursive: true })
await writeFile(resolve(here, "results", "ci.json"), JSON.stringify(measured, null, 2))

if (update) {
  // Counts become the budget as measured; sizes get 5% headroom, so a small fix doesn't fail the next change.
  for (const [label, counts] of Object.entries(measured.keys)) {
    const { forcedSlack } = budgets.keys[label] ?? {}
    budgets.keys[label] = { renders: counts.rendersMax, forcedLayouts: counts.forcedLayoutsPerPress, forcedSlack }
  }
  for (const [scenario, count] of Object.entries(measured.layers)) budgets.layers[scenario] = count
  // CLS stays at its ceiling; LCP gets 15% over today's, rounded up to 100 ms.
  for (const [id, { lcp }] of Object.entries(measured.vitals)) {
    budgets.vitals[id] = { cls: 0.01, lcp: Math.ceil((lcp * 1.15) / 100) * 100 }
  }
  budgets.bundles = Object.fromEntries(
    Object.entries(measured.bundles)
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([item, kb]) => [item, Math.ceil(kb * 1.05 * 10) / 10]),
  )
  await writeFile(budgetFile, `${JSON.stringify(budgets, null, 2)}\n`)
  console.log(`Wrote ${budgetFile}`)
} else if (failures.length > 0) {
  console.error(`\nOver budget:\n${failures.join("\n")}`)
  console.error("Make it fit, or raise the budget in tooling/perf/budgets.json and say why in the commit.")
  process.exitCode = 1
} else if (rows.some((row) => row.ok === "new")) {
  console.error("\nNew items have no budget: run `bun run perf:ci --update` and commit tooling/perf/budgets.json.")
  process.exitCode = 1
}
