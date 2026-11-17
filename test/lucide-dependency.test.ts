import { readFileSync } from "node:fs"
import { join } from "node:path"

import { expect, test } from "vitest"

import registry from "../registry.json"

const root = join(import.meta.dirname, "..")
const lucide = /^lucide-react@\d+\.\d+\.\d+$/
const dependenciesOf = (item: { dependencies?: string[] }) => item.dependencies ?? []

test("every item whose files import lucide-react depends on it at an exact version", () => {
  const missing = registry.items
    .filter((item) =>
      (item.files ?? []).some(
        (file) =>
          /\.[jt]sx?$/.test(file.path) && readFileSync(join(root, file.path), "utf8").includes('from "lucide-react"'),
      ),
    )
    .filter((item) => !dependenciesOf(item).some((dependency) => lucide.test(dependency)))
    .map((item) => item.name)
  expect(missing).toEqual([])
})

test("one lucide-react version across the registry and the repo", () => {
  const versions = new Set(
    registry.items.flatMap((item) => dependenciesOf(item).filter((dependency) => lucide.test(dependency))),
  )
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { dependencies: Record<string, string> }
  expect([...versions]).toEqual([`lucide-react@${pkg.dependencies["lucide-react"]}`])
})
