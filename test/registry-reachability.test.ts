import { readFileSync } from "node:fs"
import { basename, join } from "node:path"

import { expect, test } from "vitest"

import registry from "../registry.json"

type Item = {
  name: string
  registryDependencies?: string[]
  files?: { path: string }[]
  meta?: { adapterOf?: string }
}

const items: Item[] = registry.items
const root = join(import.meta.dirname, "..")

const publicEntries: Record<string, string[]> = {
  "voice-input": ["microphone.ts"],
  "retro-tv": ["tv-power-off.tsx"],
  "page-source": ["array-source.ts"],
  "server-data": ["use-server-query.ts"],
  "code-block": ["code-tabs.tsx"],
  conversation: ["conversation-composer.tsx"],
}

function moduleOf(path: string) {
  const match = /^registry\/(ui|lib|blocks)\/(.+)\.(?:tsx?|js)$/.exec(path)
  if (!match) return undefined
  const folder = { ui: "@/components/ui", lib: "@/lib", blocks: "@/components" }[match[1] ?? ""]
  return `${folder ?? ""}/${match[2] ?? ""}`
}

const codeFiles = (item: Item) => (item.files ?? []).map((file) => file.path).filter((path) => moduleOf(path))

const owners = new Map<string, { item: string; path: string }>()
for (const item of items)
  for (const path of codeFiles(item)) owners.set(moduleOf(path) ?? "", { item: item.name, path })

function importsOf(path: string) {
  const source = readFileSync(join(root, path), "utf8")
  const folder = (moduleOf(path) ?? "").replace(/\/[^/]+$/, "")
  const aliased = [...source.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)"(@\/[^"]+)"/g)].map((match) => match[1])
  const relative = [...source.matchAll(/(?:from\s+|new URL\(\s*|import\s+)"\.\/([^"]+)"/g)].map(
    (match) => `${folder}/${(match[1] ?? "").replace(/\.(?:js|tsx?)$/, "")}`,
  )
  return [...aliased, ...relative].flatMap((specifier) => {
    const owner = owners.get(specifier ?? "")
    return owner ? [owner] : []
  })
}

const importedFromOtherItems = new Set(
  items.flatMap((item) =>
    codeFiles(item).flatMap((path) =>
      importsOf(path)
        .filter((owner) => owner.item !== item.name)
        .map((owner) => owner.path),
    ),
  ),
)

function namedEntries(item: Item) {
  return codeFiles(item).filter((path) => basename(path).replace(/\.\w+$/, "") === item.name)
}

function reached(item: Item, roots: string[]) {
  const seen = new Set<string>()
  const visit = (path: string) => {
    if (seen.has(path)) return
    seen.add(path)
    for (const owner of importsOf(path)) if (owner.item === item.name) visit(owner.path)
  }
  roots.forEach(visit)
  return seen
}

test("every file an item ships is reached from its entry, an item that depends on it or a listed public entry", () => {
  const unreached = items.flatMap((item) => {
    const listed = (publicEntries[item.name] ?? []).map((file) =>
      codeFiles(item).find((path) => basename(path) === file),
    )
    const roots = [
      ...namedEntries(item),
      ...codeFiles(item).filter((path) => importedFromOtherItems.has(path)),
      ...listed.filter((path) => path !== undefined),
    ]
    const seen = reached(item, roots)
    return codeFiles(item)
      .filter((path) => !seen.has(path))
      .map((path) => `${item.name}: ${basename(path)}`)
  })
  expect(unreached).toEqual([])
})

test("a listed public entry is shipped by its item and reached by nothing else", () => {
  const stale = Object.entries(publicEntries).flatMap(([name, files]) => {
    const item = items.find((candidate) => candidate.name === name)
    if (!item) return [`${name}: not an item`]
    const roots = [...namedEntries(item), ...codeFiles(item).filter((path) => importedFromOtherItems.has(path))]
    const seen = reached(item, roots)
    return files.flatMap((file) => {
      const path = codeFiles(item).find((candidate) => basename(candidate) === file)
      if (!path) return [`${name}: ships no ${file}`]
      return seen.has(path) ? [`${name}: ${file} is already reached`] : []
    })
  })
  expect(stale).toEqual([])
})

const adapters = items.filter((item) => item.meta?.adapterOf !== undefined)

test("an adapter ships its one module and depends on its core", () => {
  expect(adapters.length).toBeGreaterThan(0)
  for (const adapter of adapters) {
    expect(codeFiles(adapter).map((path) => basename(path).replace(/\.\w+$/, ""))).toEqual([adapter.name])
    expect(adapter.registryDependencies).toContain(`@eskais/${adapter.meta?.adapterOf ?? ""}`)
  }
})

test("a core never imports its adapters", () => {
  const offenders = adapters.flatMap((adapter) => {
    const core = items.find((item) => item.name === adapter.meta?.adapterOf)
    if (!core) return [`${adapter.name}: no core ${adapter.meta?.adapterOf ?? ""}`]
    return codeFiles(core)
      .filter((path) => importsOf(path).some((owner) => owner.item === adapter.name))
      .map((path) => `${basename(path)} → ${adapter.name}`)
  })
  expect(offenders).toEqual([])
})
