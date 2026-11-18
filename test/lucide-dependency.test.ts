import { readFileSync } from "node:fs"
import { join } from "node:path"

import { expect, test } from "vitest"

import registry from "../registry.json"
import { unversionedDependencies } from "../tooling/check-dependency-age.mjs"

const root = join(import.meta.dirname, "..")
const dependenciesOf = (item: { dependencies?: string[] }) => item.dependencies ?? []
const readPackage = (path: string) =>
  JSON.parse(readFileSync(join(root, path), "utf8")) as { dependencies: Record<string, string> }

test("every item whose files import lucide-react depends on it", () => {
  const missing = registry.items
    .filter((item) =>
      (item.files ?? []).some(
        (file) =>
          /\.[jt]sx?$/.test(file.path) && readFileSync(join(root, file.path), "utf8").includes('from "lucide-react"'),
      ),
    )
    .filter((item) => !dependenciesOf(item).includes("lucide-react"))
    .map((item) => item.name)
  expect(missing).toEqual([])
})

// shadcn 4.23 skips a versionless dependency the consumer already has; with any version it reinstalls it, rewriting
// the consumer's spec (an exact pin downgraded a newer lucide, npm moves a range to the latest release).
test("items list lucide-react without a version", () => {
  const versioned = registry.items.flatMap((item) =>
    dependenciesOf(item).filter((dependency) => dependency.startsWith("lucide-react@")),
  )
  expect(versioned).toEqual([])
})

test("one exact lucide-react floor across the repo and the apps, which the age check reads", () => {
  const floor = readPackage("package.json").dependencies["lucide-react"]
  expect(floor).toMatch(/^\d+\.\d+\.\d+$/)
  expect(unversionedDependencies["lucide-react"]).toBe(floor)
  for (const app of ["apps/site/package.json", "apps/showcase/package.json"])
    expect(readPackage(app).dependencies["lucide-react"], app).toBe(floor)
})
