// Load-time Web Vitals in Chrome: TTFB, FCP, LCP, CLS and INP from PerformanceObservers registered before the page
// runs, on a cold cache and a slow 4G profile, at 1× and 4× CPU. Usage and options in tooling/perf/README.md.
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import { launch, serve } from "./browser.mjs"
import { measure, round, showcaseTargets, siteTargets, summarize } from "./vitals-core.mjs"

const here = import.meta.dirname
const root = resolve(here, "..", "..")

function option(name, fallback) {
  const flag = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return flag ? flag.slice(name.length + 3) : fallback
}
const list = (name, fallback) => option(name, fallback).split(",").filter(Boolean)

const builds = list("builds", "normal")
const sites = list("sites", "")
const cpus = list("cpu", "1,4").map(Number)
const network = option("network", "4g")
const repeat = Number(option("repeat", "3"))
const only = list("only", "")
const name = option("name", "vitals")
const wanted = (id) => only.length === 0 || only.some((part) => id === part || id.startsWith(`${part}:`))

// Each source: a showcase build (served from .builds) or a site dist (`label:path`, path from the repository root).
const sources = [
  ...builds.map((build) => ({
    label: build,
    dir: resolve(here, ".builds", build),
    targets: showcaseTargets.filter((target) => wanted(target.id)),
    url: (origin, target) => `${origin}${target.query}`,
  })),
  ...sites.map((entry) => {
    // The label ends at the first colon: a Windows path has one of its own.
    const at = entry.indexOf(":")
    const label = at === -1 ? entry : entry.slice(0, at)
    const dist = at === -1 ? "apps/site/dist" : entry.slice(at + 1)
    return {
      label: `site@${label}`,
      dir: resolve(root, dist),
      base: "/eskais-ui/",
      targets: siteTargets.filter((target) => wanted(target.id)),
      url: (origin, target) => `${origin}${target.path}`,
    }
  }),
].filter((source) => source.targets.length > 0)

const raw = {}
const browser = await launch()
try {
  // Repeats alternate the order of the sources, so a slow spell hits each of them alike.
  for (let rep = 1; rep <= repeat; rep += 1) {
    for (const source of rep % 2 === 0 ? sources.toReversed() : sources) {
      const server = await serve(source.dir, source.base ? { base: source.base, spa: false } : undefined)
      try {
        for (const cpu of cpus) {
          for (const target of source.targets) {
            const key = `${source.label}|${String(cpu)}×|${target.id}`
            process.stdout.write(`  ${key} run ${String(rep)}…`)
            try {
              const run = await measure(browser, source.url(server.origin, target), target, { cpu, network })
              ;(raw[key] ??= []).push(run)
              console.log(` LCP ${String(round(run.lcp))} ms, CLS ${String(round(run.cls, 4))}`)
            } catch (error) {
              console.log(` failed: ${String(error.message ?? error).split("\n")[0]}`)
            }
          }
        }
      } finally {
        await server.close()
      }
    }
  }
} finally {
  await browser.close()
}

const rows = Object.entries(raw).map(([key, runs]) => {
  const [source, cpu, target] = key.split("|")
  return { source, cpu, target, ...summarize(runs) }
})
console.log(`\nWeb Vitals, median of ${String(repeat)} cold loads (ms; CLS unitless), network ${network}`)
console.table(rows.map(({ shifts: _shifts, lcpElement: _element, ...row }) => row))
await mkdir(resolve(here, "results"), { recursive: true })
const file = resolve(here, "results", `${name}.json`)
await writeFile(file, JSON.stringify({ date: new Date().toISOString(), network, repeat, rows, raw }, null, 2))
console.log(`Saved ${file}`)
process.exit(0)
