import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const name = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "latest"
const markdown = process.argv.includes("--markdown")
const file = name.endsWith(".json") ? resolve(name) : resolve(import.meta.dirname, "results", `${name}.json`)
const results = JSON.parse(await readFile(file, "utf8"))

function median(values) {
  const sorted = values.filter((value) => typeof value === "number" && !Number.isNaN(value)).toSorted((a, b) => a - b)
  if (sorted.length === 0) return undefined
  const middle = (sorted.length - 1) / 2
  return Math.round(((sorted[Math.floor(middle)] + sorted[Math.ceil(middle)]) / 2) * 10) / 10
}

const mainThread = (row) => (row.perPress ? Object.values(row.perPress).reduce((sum, ms) => sum + ms, 0) : undefined)
const builds = results.options.builds
const [before, after] = builds
const keyOf = (row) => `${row.cpu} ${row.scenario}`
const groups = new Map()
for (const row of results.keys.filter((entry) => !entry.error)) {
  const key = keyOf(row)
  if (!groups.has(key)) groups.set(key, { keys: {}, held: {} })
  ;(groups.get(key).keys[row.build] ??= []).push(row)
}
for (const row of results.held.filter((entry) => !entry.error)) {
  const key = keyOf(row)
  if (!groups.has(key)) groups.set(key, { keys: {}, held: {} })
  ;(groups.get(key).held[row.build] ??= []).push(row)
}

const pair = (rows, pick) => {
  const a = median((rows[before] ?? []).map(pick))
  const b = median((rows[after] ?? []).map(pick))
  if (a === undefined && b === undefined) return ""
  return `${String(a ?? "–")} → ${String(b ?? "–")}`
}

const table = [...groups].map(([key, { keys, held }]) => ({
  scenario: key,
  "p50 ms": pair(keys, (row) => row.paintP50),
  "p95 ms": pair(keys, (row) => row.paintP95),
  renders: pair(keys, (row) => row.rendersMedian),
  "main thread ms": pair(keys, mainThread),
  forced: pair(keys, (row) => row.forcedLayoutsPerPress),
  "held lag ms": pair(held, (row) => row.paintP95),
  "held dropped": pair(held, (row) => row.droppedFrames),
}))

if (markdown) {
  const columns = Object.keys(table[0] ?? {})
  console.log(`| ${columns.join(" | ")} |`)
  console.log(`| ${columns.map(() => "---").join(" | ")} |`)
  for (const row of table) console.log(`| ${columns.map((column) => row[column]).join(" | ")} |`)
} else {
  console.log(`${before} → ${after}, median of ${String(results.options.repeat ?? 1)}`)
  console.table(table)
}
