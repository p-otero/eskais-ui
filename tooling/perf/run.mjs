// Navigation and keyboard benchmarks in Chrome; usage and options in tooling/perf/README.md. Builds the showcase
// (normal and React Compiler) unless --no-build, prints tables and writes tooling/perf/results/<name>.json.
import { spawnSync } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import { launch, serve } from "./browser.mjs"
import { measureBundles } from "./bundle.mjs"
import { measureHeld, measureKeys, measureMount, measureOverlays } from "./interactions.mjs"
import { keyScenarios, mountScenarios, overlays } from "./scenarios.mjs"
import { measureSite } from "./site.mjs"

const root = resolve(import.meta.dirname, "..", "..")
const here = import.meta.dirname

function option(name, fallback) {
  const flag = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return flag ? flag.slice(name.length + 3) : fallback
}
const has = (name) => process.argv.includes(`--${name}`)
const list = (name, fallback) => option(name, fallback).split(",").filter(Boolean)

const builds = list("builds", "normal,compiler")
const cpus = list("cpu", "1,4").map(Number)
const only = list("only", "")
const skip = new Set(list("skip", ""))
const trace = !has("no-trace")
const repeat = Number(option("repeat", "1"))
const experiments = has("experiments")
const name = option("name", "latest")

function build(variant) {
  console.log(`Building the showcase (${variant})…`)
  const result = spawnSync("npx", ["vite", "build", "--logLevel", "error"], {
    cwd: resolve(root, "apps", "showcase"),
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      SHOWCASE_OUT_DIR: resolve(here, ".builds", variant),
      SHOWCASE_KEEP_NAMES: "1",
      REACT_COMPILER: variant.startsWith("compiler") ? "1" : "",
    },
  })
  if (result.status !== 0) throw new Error(`The ${variant} build failed`)
}

const wanted = (id) => only.length === 0 || only.includes(id)

// One measurement: a failure is recorded on its row and the run goes on; the results so far are saved after each.
async function step(results, rows, tag, measure) {
  try {
    const measured = await measure()
    for (const row of Array.isArray(measured) ? measured : [measured]) rows.push({ ...tag, ...row })
  } catch (error) {
    const message = String(error.message ?? error).split("\n")[0]
    rows.push({ ...tag, error: message })
    console.log(` failed: ${message}`)
  }
  await save(results)
}

async function measureBuild(browser, variant, results) {
  const server = await serve(resolve(here, ".builds", variant))
  try {
    for (const cpu of cpus) {
      const tag = { build: variant, cpu: `${String(cpu)}×`, ...(repeat > 1 ? { rep: results.rep } : {}) }
      for (const definition of keyScenarios.filter((entry) => wanted(entry.id) && !!entry.experiment === experiments)) {
        const label = definition.phase ? `${definition.id}:${definition.phase}` : definition.id
        process.stdout.write(`  ${variant} ${tag.cpu} ${label}…`)
        await step(results, results.keys, { ...tag, scenario: label, label: definition.label }, async () => {
          const { trace: buffer, ...keys } = await measureKeys(browser, server.origin, definition, {
            cpu,
            trace: trace && cpu === 1,
          })
          if (buffer) {
            const file = resolve(here, "results", "traces", `${name}-${variant}-${label.replace(":", "-")}.json`)
            await writeFile(file, buffer)
            keys.traceFile = file
          }
          console.log(` p95 ${String(keys.paintP95)}ms, ${String(keys.rendersMedian)} renders/press`)
          return keys
        })
        if (definition.held && !skip.has("held")) {
          await step(results, results.held, { ...tag, scenario: label, key: definition.held }, () =>
            measureHeld(browser, server.origin, definition, { cpu }),
          )
        }
      }
      if (!skip.has("overlays") && wanted("overlays")) {
        await step(results, results.overlays, tag, () => measureOverlays(browser, server.origin, overlays, { cpu }))
      }
      if (!skip.has("mount")) {
        for (const scenario of mountScenarios.filter((id) => id === "empty" || wanted(id))) {
          await step(results, results.mount, tag, () => measureMount(browser, server.origin, scenario, { cpu }))
        }
      }
    }
  } finally {
    await server.close()
  }
}

const pick = (rows, keys) => rows.map((row) => Object.fromEntries(keys.map((key) => [key, row[key]])))

function printTables(results) {
  console.log("\nKey to next paint, one press at a time (ms), and React components rendered per press")
  console.table(
    pick(results.keys, [
      "build",
      "cpu",
      "scenario",
      "paintP50",
      "paintP95",
      "paintMax",
      "over16",
      "rendersMedian",
      "rendersMax",
      "longTasks",
    ]),
  )
  const traced = results.keys.filter((row) => row.perPress)
  if (traced.length > 0) {
    console.log("Main thread per press at 1× (ms): self time by kind, and forced layouts")
    console.table(
      traced.map((row) => ({
        build: row.build,
        scenario: row.scenario,
        ...row.perPress,
        forced: row.forcedLayoutsPerPress,
        forcedMs: row.forcedLayoutMsPerPress,
      })),
    )
  }
  if (results.held.length > 0) {
    console.log("Held key, 30 Hz autorepeat for 2 s")
    console.table(
      pick(results.held, ["build", "cpu", "scenario", "keys", "paintP95", "paintMax", "droppedFrames", "longTasks"]),
    )
  }
  if (results.overlays.length > 0) {
    console.log("Overlays: key press to first frame with content, and to the animation's end (ms, median of 5)")
    console.table(results.overlays)
  }
  if (results.mount.length > 0) {
    console.log("Mount: first render to first paint (ms), JS heap after GC (MB), components rendered")
    console.table(results.mount)
  }
  if (results.site.length > 0) {
    console.log("Site navigation: link press to new content painted (ms, median)")
    console.table(results.site)
  }
  if (results.bundles.length > 0) {
    console.log("Bundle: gzip KB per registry item with its dependencies (React excluded), and the UI SDK share")
    console.table(results.bundles.slice(0, 25))
  }
}

const resultFile = resolve(here, "results", `${name}.json`)
const save = (results) => writeFile(resultFile, JSON.stringify(results, null, 2))

const results = {
  date: new Date().toISOString(),
  chrome: undefined,
  options: { builds, cpus, only, skip: [...skip], trace, repeat },
  keys: [],
  held: [],
  overlays: [],
  mount: [],
  site: [],
  bundles: [],
}

await mkdir(resolve(here, "results", "traces"), { recursive: true })
if (!has("no-build")) for (const variant of builds) build(variant)

// A fresh browser per build and repeat: state a long run accumulates (heap, GPU memory) must not favour the
// build measured first. Repeats alternate the builds, so a slow spell on the machine hits each of them alike.
for (let rep = 1; rep <= repeat; rep += 1) {
  results.rep = rep
  const order = rep % 2 === 0 ? builds.toReversed() : builds
  for (const variant of order) {
    console.log(`Measuring the ${variant} build${repeat > 1 ? ` (run ${String(rep)} of ${String(repeat)})` : ""}`)
    const browser = await launch()
    results.chrome = browser.version()
    try {
      await measureBuild(browser, variant, results)
    } finally {
      await browser.close()
    }
  }
}
if (!skip.has("site") && wanted("site")) {
  console.log("Measuring site navigation")
  const browser = await launch()
  try {
    const dist = option("site-dist", "")
    await step(results, results.site, {}, () =>
      measureSite(browser, { build: !has("no-build") && !dist, ...(dist ? { dist: resolve(root, dist) } : {}) }),
    )
  } finally {
    await browser.close()
  }
}
if (!skip.has("bundle") && wanted("bundle")) {
  console.log("Measuring bundles")
  await step(results, results.bundles, {}, () => measureBundles())
}

printTables(results)
await save(results)
console.log(`\nSaved ${resultFile}`)
