import { readFileSync } from "node:fs"
import { basename, join } from "node:path"

import { expect, test } from "vitest"

import registry from "../registry.json"

type Item = { name: string; registryDependencies?: string[]; files?: { path: string; target?: string }[] }

const items: Item[] = registry.items
const root = join(import.meta.dirname, "..")
const byName = new Map(items.map((item) => [item.name, item]))

function destination(file: { path: string; target?: string }) {
  return file.target ?? file.path
}

// `shadcn add` writes a file that two items ship once per install, so copies drift apart unnoticed until one
// install overwrites the other. A file shared by several items belongs to one item the others depend on.
test("every file is shipped by one item", () => {
  const owners = new Map<string, string[]>()
  for (const item of items) {
    for (const file of item.files ?? [])
      owners.set(destination(file), [...(owners.get(destination(file)) ?? []), item.name])
  }
  const shared = [...owners]
    .filter(([, names]) => names.length > 1)
    .map(([file, names]) => `${file}: ${names.join(", ")}`)
  expect(shared).toEqual([])
})

function installs(name: string, seen = new Set<string>()): Set<string> {
  if (seen.has(name)) return seen
  seen.add(name)
  for (const dependency of byName.get(name)?.registryDependencies ?? []) {
    if (dependency.startsWith("@eskais/")) installs(dependency.slice("@eskais/".length), seen)
  }
  return seen
}

const shippedBy = new Map<string, string>()
for (const item of items) {
  for (const file of item.files ?? []) {
    const match = /^registry\/(ui|lib)\/(.+)\.tsx?$/.exec(file.path)
    if (match) shippedBy.set(`${match[1] === "ui" ? "@/components/ui" : "@/lib"}/${match[2] ?? ""}`, item.name)
  }
}

test("an item's registry imports come from the item or its registry dependencies", () => {
  const missing: string[] = []
  for (const item of items) {
    const reach = installs(item.name)
    for (const file of item.files ?? []) {
      if (!/\.tsx?$/.test(file.path)) continue
      const source = readFileSync(join(root, file.path), "utf8")
      for (const [, specifier = ""] of source.matchAll(/from\s+"(@\/(?:components\/ui|lib)\/[^"]+)"/g)) {
        const owner = shippedBy.get(specifier)
        if (owner !== undefined && !reach.has(owner)) missing.push(`${item.name} (${basename(file.path)}) → ${owner}`)
      }
    }
  }
  expect(missing).toEqual([])
})
