import { expect, test } from "vitest"

import registry from "../registry.json"
import {
  findYoungDependencies,
  parseDependency,
  registryDependencies,
  youngDependencyExceptions,
} from "../tooling/check-dependency-age.mjs"

const now = Date.parse("2026-11-17T12:00:00Z")
const published = new Map([
  ["lucide-react@1.68.0", "2026-11-04T06:10:53.831Z"],
  ["lucide-react@1.73.0", "2026-11-14T06:15:14.805Z"],
  ["@ui-sdk/react@0.1.0-beta.5", "2026-11-15T09:55:59.850Z"],
])

test("reads scoped and unscoped pins", () => {
  expect(parseDependency("lucide-react@1.68.0")).toEqual({ name: "lucide-react", version: "1.68.0" })
  expect(parseDependency("@ui-sdk/react@0.1.0-beta.5")).toEqual({ name: "@ui-sdk/react", version: "0.1.0-beta.5" })
  expect(parseDependency("@scope/name")).toEqual({ name: "@scope/name", version: undefined })
})

test("a release younger than 7 days fails, an older one passes", () => {
  const { problems } = findYoungDependencies(["lucide-react@1.68.0", "lucide-react@1.73.0"], published, now, {
    exceptions: {},
  })
  expect(problems.map((problem) => problem.spec)).toEqual(["lucide-react@1.73.0"])
  expect(problems[0]?.reason).toMatch(/published 2026-11-14, 3\.2 days ago \(minimum 7\)/)
})

test("ranges, missing versions and stale exceptions fail; non-npm sources are skipped", () => {
  const { problems } = findYoungDependencies(
    ["lucide-react", "@ui-sdk/react@^0.1.0-beta.5", "lucide-react@9.9.9", "tool@github:owner/tool#0123abc"],
    published,
    now,
    { exceptions: { "gone@1.0.0": "no longer used" } },
  )
  expect(problems.map((problem) => problem.spec)).toEqual([
    "gone@1.0.0",
    "lucide-react",
    "@ui-sdk/react@^0.1.0-beta.5",
    "lucide-react@9.9.9",
  ])
})

test("lucide-react alone may be a caret range, whose floor must be 7 days old", () => {
  const specs = ["lucide-react@^1.68.0", "lucide-react@^1.73.0", "lucide-react@~1.68.0", "lucide-react@^1"]
  const { problems } = findYoungDependencies(specs, published, now, { exceptions: {} })
  expect(problems.map((problem) => [problem.spec, problem.reason.split(",")[0]])).toEqual([
    ["lucide-react@^1.73.0", "published 2026-11-14"],
    ["lucide-react@~1.68.0", "not pinned to an exact version"],
    ["lucide-react@^1", "not pinned to an exact version"],
  ])
  const exact = findYoungDependencies(["lucide-react@^1.68.0"], published, now, { exceptions: {}, ranges: [] })
  expect(exact.problems.map((problem) => problem.spec)).toEqual(["lucide-react@^1.68.0"])
})

test("an exception allows that exact young pin, and is reported once it is old enough", () => {
  const exceptions = { "@ui-sdk/react@0.1.0-beta.5": "no older release" }
  expect(findYoungDependencies(["@ui-sdk/react@0.1.0-beta.5"], published, now, { exceptions })).toEqual({
    problems: [],
    matured: [],
  })
  const later = Date.parse("2026-11-23T00:00:00Z")
  expect(findYoungDependencies(["@ui-sdk/react@0.1.0-beta.5"], published, later, { exceptions }).matured).toEqual([
    "@ui-sdk/react@0.1.0-beta.5",
  ])
})

test("every npm dependency in registry.json is pinned to an exact version, lucide-react to a caret range", () => {
  const { problems } = findYoungDependencies(registryDependencies(registry), new Map(), now, { exceptions: {} })
  expect(problems.filter((problem) => problem.reason.startsWith("not pinned"))).toEqual([])
})

test("every exception names a dependency the registry pins", () => {
  expect(
    Object.keys(youngDependencyExceptions).filter((spec) => !registryDependencies(registry).includes(spec)),
  ).toEqual([])
})
