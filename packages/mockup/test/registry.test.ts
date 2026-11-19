import { describe, expect, test } from "vitest"

import { EnvironmentError } from "../src/project"
import { shippedFiles, type RegistryItem } from "../src/registry"

const hook = "export function useTrailRows() {\n  return []\n}\n"

function item(name: string, files: { path: string; content: string }[]): { item: RegistryItem; dir: string } {
  return { item: { name, files: files.map((file) => ({ ...file, type: "registry:hook" })) }, dir: "/cache" }
}

function differingCopies() {
  return shippedFiles([
    item("commit-history", [{ path: "registry/ui/use-trail-rows.ts", content: hook }]),
    item("git-tree", [
      {
        path: "registry/ui/use-trail-rows.ts",
        content: `${hook}// newer
`,
      },
    ]),
  ])
}

describe("shippedFiles", () => {
  test("keeps one copy of a file that two items ship byte for byte", () => {
    const shipped = shippedFiles([
      item("commit-history", [
        { path: "registry/ui/commit-history.tsx", content: "export {}\n" },
        { path: "registry/ui/use-trail-rows.ts", content: hook },
      ]),
      item("git-tree", [
        { path: "registry/ui/git-tree.tsx", content: "export {}\n" },
        { path: "registry/ui/use-trail-rows.ts", content: hook },
      ]),
    ])
    expect([...shipped.keys()].toSorted()).toEqual(["commit-history", "git-tree", "use-trail-rows"])
    expect(shipped.get("use-trail-rows")).toEqual({
      item: "commit-history",
      path: "registry/ui/use-trail-rows.ts",
      content: hook,
      dir: "/cache",
    })
  })

  test("names the file and both items when the copies differ", () => {
    expect(differingCopies).toThrow(EnvironmentError)
    expect(differingCopies).toThrow(/commit-history and git-tree both ship use-trail-rows .*different contents/)
  })

  test("does not normalise line endings", () => {
    expect(() =>
      shippedFiles([
        item("a", [{ path: "registry/ui/use-trail-rows.ts", content: hook }]),
        item("b", [{ path: "registry/ui/use-trail-rows.ts", content: hook.replaceAll("\n", "\r\n") }]),
      ]),
    ).toThrow(/a and b both ship use-trail-rows/)
  })

  test("skips index entries without content", () => {
    const shipped = shippedFiles([{ item: { name: "a", files: [{ path: "registry/ui/a.tsx" }] }, dir: "/cache" }])
    expect(shipped.size).toBe(0)
  })
})
