import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterAll, expect, test } from "vitest"

const dir = mkdtempSync(join(tmpdir(), "eskais-spacing-rule-"))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

writeFileSync(
  join(dir, ".oxlintrc.json"),
  JSON.stringify({
    plugins: [],
    jsPlugins: [resolve("tooling/oxlint-plugin-eskais/index.js").replaceAll("\\", "/")],
    categories: { correctness: "off" },
    rules: { "eskais/spacing-tokens": "error" },
  }),
)

function flagged(source: string) {
  writeFileSync(join(dir, "fixture.tsx"), source)
  let output: string
  try {
    output = execFileSync(
      process.execPath,
      [resolve("node_modules/oxlint/bin/oxlint"), "--format", "json", "fixture.tsx"],
      {
        cwd: dir,
        encoding: "utf8",
      },
    )
  } catch (error) {
    output = (error as { stdout: string }).stdout
  }
  const { diagnostics } = JSON.parse(output) as { diagnostics: { message: string }[] }
  return diagnostics.map(({ message }) => /^"([^"]+)"/.exec(message)?.[1])
}

test("flags numeric spacing in strings, cn and cva arguments, and template literals", () => {
  expect(
    flagged(`
      import { cva } from "class-variance-authority"
      import { cn } from "@/lib/utils"
      const button = cva("flex gap-2", { variants: { size: { sm: "py-1.5" } } })
      const merged = cn("mt-4", true && "-mx-1")
      const template = \`\${merged} space-y-3 inset-x-2\`
      export const A = () => <div className="p-3 top-5 scroll-py-1">{button()}{template}</div>
    `),
  ).toEqual(["gap-2", "py-1.5", "mt-4", "-mx-1", "space-y-3", "inset-x-2", "p-3", "top-5", "scroll-py-1"])
})

test("flags variant-prefixed and important utilities", () => {
  expect(
    flagged(`export const c = "md:gap-2 data-[state=open]:px-1 group-data-collapsed/x:pb-2 [&>svg~*]:ps-7 !p-2 p-3!"`),
  ).toEqual(["md:gap-2", "data-[state=open]:px-1", "group-data-collapsed/x:pb-2", "[&>svg~*]:ps-7", "!p-2", "p-3!"])
})

test("allows role tokens, zero, px, sizes, fractions and variables", () => {
  expect(
    flagged(
      `export const c = "gap-items md:gap-inline px-inset-chip p-inset-surface p-0 m-0 -mt-px gap-px size-4 h-2 w-0.5 top-1/2 translate-y-0.5 start-(--item-padding-x) -mx-(--item-padding-x)"`,
    ),
  ).toEqual([])
})

test("ignores import sources and accepts a disable comment with a reason", () => {
  expect(
    flagged(`
      import "./p-2"
      // oxlint-disable-next-line eskais/spacing-tokens -- half the arrow's size, so it overlaps the edge
      export const arrow = "data-[side=top]:-bottom-1.5"
    `),
  ).toEqual([])
})
