import { execFileSync } from "node:child_process"

import { expect, test } from "vitest"

import { formatRemovedFiles, installedTarget, itemsAt, removedFiles } from "../tooling/removed-files.mjs"

const ui = (name: string) => ({ path: `registry/ui/${name}`, type: "registry:ui" })
const lib = (name: string) => ({ path: `registry/lib/${name}`, type: "registry:lib" })

test("maps each file to where shadcn writes it under the default aliases, or to its target", () => {
  expect(installedTarget(ui("dialog.tsx"))).toBe("components/ui/dialog.tsx")
  expect(installedTarget(lib("utils.ts"))).toBe("lib/utils.ts")
  expect(installedTarget({ path: "registry/hooks/use-x.ts", type: "registry:hook" })).toBe("hooks/use-x.ts")
  expect(installedTarget({ path: "registry/blocks/inbox.tsx", type: "registry:component" })).toBe(
    "components/inbox.tsx",
  )
  expect(
    installedTarget({ path: "skills/a/SKILL.md", type: "registry:file", target: "~/.agents/skills/a/SKILL.md" }),
  ).toBe("~/.agents/skills/a/SKILL.md")
})

test("a file no item ships any more is deleted; one another item ships is moved, naming it", () => {
  const before = [
    { name: "approval", files: [ui("approval.tsx"), ui("use-approval-expiry.ts")] },
    { name: "page-source", files: [lib("page-source.ts"), lib("page-source-rest.ts")] },
  ]
  const after = [
    { name: "approval", files: [ui("approval.tsx")], registryDependencies: ["@eskais/expiry"] },
    { name: "expiry", files: [ui("use-expiry.ts")] },
    { name: "page-source", files: [lib("page-source.ts")] },
    { name: "page-source-rest", files: [lib("page-source-rest.ts")], registryDependencies: ["@eskais/page-source"] },
  ]
  expect(removedFiles(before, after)).toEqual([
    { item: "approval", itemRemoved: false, files: [{ target: "components/ui/use-approval-expiry.ts", movedTo: [] }] },
    {
      item: "page-source",
      itemRemoved: false,
      files: [{ target: "lib/page-source-rest.ts", movedTo: ["page-source-rest"] }],
    },
  ])
})

test("a file that moved into a dependency of the item is still installed, so it isn't listed", () => {
  const before = [{ name: "approval", files: [ui("approval.tsx"), ui("countdown.tsx")] }]
  const after = [
    { name: "approval", files: [ui("approval.tsx")], registryDependencies: ["@eskais/countdown"] },
    { name: "countdown", files: [ui("countdown.tsx")], registryDependencies: ["https://example.test/r/approval.json"] },
  ]
  expect(removedFiles(before, after)).toEqual([])
})

test("an item gone from the registry lists every file it installed", () => {
  const before = [
    { name: "old", files: [ui("old.tsx"), lib("shared.ts")] },
    { name: "keeper", files: [lib("shared.ts")] },
  ]
  const after = [{ name: "keeper", files: [lib("shared.ts")] }]
  expect(removedFiles(before, after)).toEqual([
    {
      item: "old",
      itemRemoved: true,
      files: [
        { target: "components/ui/old.tsx", movedTo: [] },
        { target: "lib/shared.ts", movedTo: ["keeper"] },
      ],
    },
  ])
})

test("writes a Removed files section for the CHANGELOG, and nothing when no file went away", () => {
  const markdown = formatRemovedFiles([
    {
      item: "page-source",
      itemRemoved: false,
      files: [
        { target: "lib/page-source-rest.ts", movedTo: ["page-source-rest"] },
        { target: "lib/gone.ts", movedTo: [] },
      ],
    },
  ])
  expect(markdown).toMatch(/^### Removed files\n/)
  expect(markdown).toContain("`page-source`:\n\n")
  expect(markdown).toContain(
    "- `lib/page-source-rest.ts`: moved to `page-source-rest`. Add `@eskais/page-source-rest` if you use it, otherwise delete it.",
  )
  expect(markdown).toContain("- `lib/gone.ts`: no item ships it any more; delete it.")
  expect(formatRemovedFiles([])).toBe("")
})

test("reads every item of public/r at a git ref", () => {
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  const items = itemsAt(head)
  expect(items.length).toBeGreaterThan(100)
  expect(items.find((item) => item.name === "dialog")?.files?.map(installedTarget)).toContain(
    "components/ui/dialog.tsx",
  )
  expect(removedFiles(items, items)).toEqual([])
})
