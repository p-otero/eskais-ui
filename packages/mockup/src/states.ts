import { spawnSync } from "node:child_process"
import { existsSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { EnvironmentError } from "./project"

export const ALL_STATES = "all"

const STATE_NAME = /^[A-Za-z0-9][\w-]*$/

// fixtures.ts may export `states`: one entry per named state, each the props the screen gets in it.
const LISTER = [
  'import * as fixtures from "./fixtures"',
  "const states = (fixtures as Record<string, unknown>).states",
  "if (states === undefined) console.log('MOCKUP_STATES none')",
  "else if (typeof states !== 'object' || states === null || Array.isArray(states)) console.log('MOCKUP_STATES invalid')",
  "else {",
  "  const entries = Object.entries(states as Record<string, unknown>)",
  "  const bad = entries.filter(([, props]) => typeof props !== 'object' || props === null || Array.isArray(props))",
  "  console.log('MOCKUP_STATES ' + JSON.stringify({ names: entries.map(([name]) => name), bad: bad.map(([name]) => name) }))",
  "}",
  "",
].join("\n")

export function readStates(mockup: string): string[] | null {
  if (!existsSync(join(mockup, "fixtures.ts")) && !existsSync(join(mockup, "fixtures.tsx"))) return null
  const runner = join(mockup, ".states-check.ts")
  writeFileSync(runner, LISTER)
  let result: ReturnType<typeof spawnSync>
  try {
    result = spawnSync(process.execPath, [".states-check.ts"], { cwd: mockup, encoding: "utf8" })
  } finally {
    rmSync(runner, { force: true })
  }
  const output = `${String(result.stdout ?? "")}${String(result.stderr ?? "")}`
  const line = output.split(/\r?\n/).find((entry) => entry.startsWith("MOCKUP_STATES "))
  if (line === undefined) {
    throw new EnvironmentError(`could not read the states of ${join(mockup, "fixtures.ts")}:\n${output.trim()}`)
  }
  const value = line.slice("MOCKUP_STATES ".length)
  if (value === "none") return null
  if (value === "invalid") {
    throw new EnvironmentError(
      `fixtures.ts exports states that are not an object; export const states = { empty: { … }, loading: { … } }`,
    )
  }
  const parsed = JSON.parse(value) as { names: string[]; bad: string[] }
  if (parsed.bad.length > 0) {
    throw new EnvironmentError(
      `every state in fixtures.ts is the screen's props as an object; not: ${parsed.bad.join(", ")}`,
    )
  }
  const invalid = parsed.names.filter((name) => !STATE_NAME.test(name) || name === ALL_STATES)
  if (invalid.length > 0) {
    throw new EnvironmentError(
      `state names are letters, digits, - and _ (and not "all"), as they name the output file; rename: ${invalid.join(", ")}`,
    )
  }
  return parsed.names
}

// The states one run builds: none without --state (the screen with no props), one, or every one with "all".
export function selectStates(mockup: string, requested: string | undefined): (string | undefined)[] {
  if (requested === undefined) return [undefined]
  const states = readStates(mockup)
  if (states === null || states.length === 0) {
    throw new EnvironmentError(
      `--state ${requested}: fixtures.ts exports no states; export const states = { empty: { … }, loading: { … } }`,
    )
  }
  if (requested === ALL_STATES) return states
  if (!states.includes(requested)) {
    throw new EnvironmentError(`fixtures.ts has no state "${requested}"; it has ${states.join(", ")}`)
  }
  return [requested]
}

export function stateOutName(state: string, theme: string): string {
  return `out-${state}-${theme}.html`
}
