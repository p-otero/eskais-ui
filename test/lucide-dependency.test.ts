import { readFileSync } from "node:fs"
import { join } from "node:path"

import { expect, test } from "vitest"

import registry from "../registry.json"

const root = join(import.meta.dirname, "..")
const lucide = /^lucide-react@\^?\d+\.\d+\.\d+$/
const dependenciesOf = (item: { dependencies?: string[] }) => item.dependencies ?? []

test("every item whose files import lucide-react depends on it", () => {
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

// A caret range, so `shadcn add` doesn't move a consumer on a newer lucide back down; its floor is the repo's pin.
test("one lucide-react range across the registry, from the repo's exact version", () => {
  const versions = new Set(
    registry.items.flatMap((item) => dependenciesOf(item).filter((dependency) => lucide.test(dependency))),
  )
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { dependencies: Record<string, string> }
  expect(pkg.dependencies["lucide-react"]).toMatch(/^\d+\.\d+\.\d+$/)
  expect([...versions]).toEqual([`lucide-react@^${pkg.dependencies["lucide-react"]}`])
})
