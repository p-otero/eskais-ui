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

test("the type-aware lint forbids unsafe type assertions in registry code", () => {
  expect(typeAware.rules["typescript/no-unsafe-type-assertion"]).toBe("error")
})

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
