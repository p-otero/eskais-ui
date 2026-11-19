import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterAll, expect, test } from "vitest"

const dir = mkdtempSync(join(tmpdir(), "eskais-scroll-area-rule-"))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

writeFileSync(
  join(dir, ".oxlintrc.json"),
  JSON.stringify({
    plugins: [],
    jsPlugins: [resolve("tooling/oxlint-plugin-eskais/index.js").replaceAll("\\", "/")],
    categories: { correctness: "off" },
    rules: { "eskais/scroll-area": "error" },
  }),
)

function flaggedLines(source: string) {
  writeFileSync(join(dir, "fixture.tsx"), source)
  let output: string
  try {
    output = execFileSync(
      process.execPath,
      [resolve("node_modules/oxlint/bin/oxlint"), "--format", "json", "fixture.tsx"],
      { cwd: dir, encoding: "utf8" },
    )
  } catch (error) {
    output = (error as { stdout: string }).stdout
  }
  const { diagnostics } = JSON.parse(output) as {
    diagnostics: { code: string; labels: { span: { line: number } }[] }[]
  }
  return diagnostics.map((diagnostic) => diagnostic.labels[0]?.span.line)
}

test("flags every overflow that scrolls, in a className, cn() and cnState() arguments and a template literal", () => {
  expect(
    flaggedLines(`import { cn, cnState } from "@/lib/utils"
export const A = () => <div className="min-h-0 overflow-auto" />
export const B = ({ wide }: { wide: boolean }) => <div className={cn("flex", wide && "overflow-x-auto")} />
export const C = ({ className }: { className?: string }) => <div className={cnState("overflow-y-auto", className)} />
export const D = ({ x }: { x: string }) => <div className={\`\${x} overflow-scroll p-inline\`} />
export const E = () => <div className="overflow-x-scroll" />
export const F = () => <div className="max-h-80 overflow-y-scroll!" />`),
  ).toEqual([2, 3, 4, 5, 6, 7])
})

test("flags a class list kept outside the JSX, in a const, an array or cva()", () => {
  expect(
    flaggedLines(`import { cva } from "class-variance-authority"
const listClassName = "max-h-80 overflow-y-auto"
const parts = ["flex", "md:overflow-auto"]
const look = cva(["fixed overflow-y-auto"], { variants: {} })
export { listClassName, parts, look }`),
  ).toEqual([2, 3, 4])
})

test("leaves overflow that doesn't scroll and other classes alone", () => {
  expect(
    flaggedLines(`export const A = () => <div className="overflow-hidden overflow-x-clip overflow-visible scroll-py-inline" />
export const B = () => <p>Content can overflow-auto here</p>
export const message = "an overflow-autofill is not a class"`),
  ).toEqual([])
})

test("accepts a disable comment with a reason, in code and in JSX children", () => {
  expect(
    flaggedLines(`// oxlint-disable-next-line eskais/scroll-area -- a floating list UI SDK caps
const listClassName = "overflow-y-auto"
export function Panel() {
  return (
    <section>
      {/* oxlint-disable-next-line eskais/scroll-area -- the page-level column scrolls like the window */}
      <main className="overflow-auto" />
    </section>
  )
}
export { listClassName }`),
  ).toEqual([])
})

test("the repo runs it on the registry except scroll-area.tsx, and consumers get it as a warning", () => {
  const config = JSON.parse(readFileSync(".oxlintrc.json", "utf8")) as {
    overrides: { files: string[]; rules: Record<string, unknown> }[]
  }
  const on = config.overrides.filter((override) => override.rules["eskais/scroll-area"] === "error")
  expect(on.flatMap((override) => override.files)).toContain("registry/**")
  const off = config.overrides.filter((override) => override.rules["eskais/scroll-area"] === "off")
  expect(off.flatMap((override) => override.files)).toEqual(["registry/ui/scroll-area.tsx"])
  const consumer = JSON.parse(readFileSync("registry/rules/eskais-ui.oxlintrc.json", "utf8")) as {
    rules: Record<string, unknown>
  }
  expect(consumer.rules["eskais/scroll-area"]).toBe("warn")
})
