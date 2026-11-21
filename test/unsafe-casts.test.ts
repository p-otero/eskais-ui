import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

import { expect, test } from "vitest"

import typeAware from "../tooling/oxlint-type-aware.json"

const root = join(import.meta.dirname, "..")
const helpers = "registry/lib/narrow.ts"

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    return /\.(ts|tsx|js)$/.test(entry.name) ? [path] : []
  })
}

const files = sources(join(root, "registry"))
  .map((path) => ({ path: relative(root, path).replaceAll("\\", "/"), lines: readFileSync(path, "utf8").split("\n") }))
  .filter(({ path }) => path !== helpers)

const where = (path: string, index: number) => `${path}:${String(index + 1)}`
const withoutComment = (line: string) => (/^\s*(\/\*|\*)/.test(line) ? "" : line.replace(/\/\/.*$/, ""))

// `bun run lint` runs the type-aware config on registry/**, so CI fails on a new `as` that narrows a type.
test("the type-aware lint forbids unsafe type assertions in registry code", () => {
  expect(typeAware.rules["typescript/no-unsafe-type-assertion"]).toBe("error")
})

// The rule doesn't look through `any`, so a cast laundered through it would pass the lint unnoticed: lib/narrow's
// helpers are the one place that does it.
test("no registry file disables no-unsafe-type-assertion or uses any, except lib/narrow", () => {
  const found = files.flatMap(({ path, lines }) =>
    lines.flatMap((line, index) =>
      /oxlint-disable.*no-unsafe-type-assertion/.test(line) || /(?:[:<,(|]|\bas)\s*any\b/.test(withoutComment(line))
        ? [where(path, index)]
        : [],
    ),
  )
  expect(found).toEqual([])
})

// Each `assumeType` call is a cast TypeScript can't check. Lowering the count is welcome; raising it needs a reason.
const assumeTypeBudget = 57

test("every assumeType call says why, and the count stays within its budget", () => {
  const calls = files.flatMap(({ path, lines }) =>
    lines.flatMap((line, index) =>
      /\bassumeType\s*[<(]/.test(withoutComment(line))
        ? [{ at: where(path, index), context: lines.slice(Math.max(0, index - 3), index + 1) }]
        : [],
    ),
  )
  const unexplained = calls.filter(({ context }) => !context.some((line) => line.includes("//"))).map(({ at }) => at)
  expect(unexplained).toEqual([])
  expect(calls.length).toBeLessThanOrEqual(assumeTypeBudget)
})
