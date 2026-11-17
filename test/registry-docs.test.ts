import { readFileSync } from "node:fs"
import { join } from "node:path"

import * as agent from "@ui-sdk/react/agent"
import * as alertDialog from "@ui-sdk/react/alert-dialog"
import * as asyncOptions from "@ui-sdk/react/async-options"
import * as field from "@ui-sdk/react/field"
import * as triggerMenu from "@ui-sdk/react/trigger-menu"
import * as lucide from "lucide-react"
import * as react from "react"
import * as reactHookForm from "react-hook-form"
import { expect, test } from "vitest"

import registry from "../registry.json"

// The docs shipped in each item's JSON (`description`, `docs`) and the skill name components and hooks in code
// spans. A name no registry file exports any more, or one marked @deprecated, tells consumers to use what is gone.
const root = join(import.meta.dirname, "..")
const sources = registry.items.flatMap((item) =>
  (item.files ?? []).map((file) => readFileSync(join(root, file.path), "utf8")),
)

const exported = new Set<string>()
const deprecated = new Set<string>()
for (const source of sources) {
  for (const [, list = ""] of source.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}/g))
    for (const part of list.split(",")) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.replace(/^type\s+/, "")
      if (name) exported.add(name)
    }
  for (const [, name = ""] of source.matchAll(/export\s+(?:async\s+)?(?:function|const|class|type|interface)\s+(\w+)/g))
    exported.add(name)
  for (const [, name = ""] of source.matchAll(/@deprecated[^/]*\*\/\s*(?:export\s+)?(?:function|const|type)\s+(\w+)/g))
    deprecated.add(name)
}

// Names from the libraries the docs build on, checked against those packages rather than listed.
const external = new Set(
  [lucide, react, reactHookForm, agent, alertDialog, asyncOptions, field, triggerMenu].flatMap((module) =>
    Object.keys(module),
  ),
)
// Names a code sample defines itself, and a library named in prose.
const sampleNames = new Set(["AppTopbar", "GlobalSearch", "UserMenu", "ArkType"])

// Components (two capitalised words or more) and hooks or factories; single words are often copy ("Search").
const identifier = /(?<![\w.$-])(?:[A-Z][a-z0-9]+[A-Z]\w*|use[A-Z]\w*|create[A-Z]\w*)\b/g

function namesIn(text: string) {
  return [...text.matchAll(/`([^`]+)`/g)].flatMap(([, span = ""]) =>
    [...span.matchAll(identifier)].map(([name]) => name),
  )
}

const docs = [
  ...registry.items.map((item) => ({
    where: item.name,
    text: `${item.description ?? ""} ${"docs" in item ? String(item.docs) : ""}`,
  })),
  { where: "skills/eskais-ui/SKILL.md", text: readFileSync(join(root, "skills/eskais-ui/SKILL.md"), "utf8") },
]

test("the scan finds the registry's exports and its deprecated ones", () => {
  expect(exported).toContain("GapFindStubs")
  expect(exported).toContain("SidebarTrigger")
  expect(deprecated).toEqual(new Set(["ChevronIcon", "PanelIcon"]))
})

test("item docs and the skill name only exports that exist", () => {
  const missing = docs.flatMap(({ where, text }) =>
    namesIn(text)
      .filter((name) => !exported.has(name) && !external.has(name) && !sampleNames.has(name))
      .map((name) => `${where}: ${name}`),
  )
  expect([...new Set(missing)]).toEqual([])
})

test("item docs and the skill don't recommend deprecated exports", () => {
  const used = docs.flatMap(({ where, text }) =>
    namesIn(text)
      .filter((name) => deprecated.has(name))
      .map((name) => `${where}: ${name}`),
  )
  expect(used).toEqual([])
})

test("SidebarTrigger's docs describe what it does on narrow screens", () => {
  const sidebar = registry.items.find((item) => item.name === "sidebar")
  const text = sidebar && "docs" in sidebar ? String(sidebar.docs) : ""
  expect(text).not.toMatch(/renders nothing/)
  expect(text).toMatch(/On narrow screens it opens the Sidebar's drawer/)
})
