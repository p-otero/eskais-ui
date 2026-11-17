import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterAll, expect, test } from "vitest"

const dir = mkdtempSync(join(tmpdir(), "eskais-icons-rule-"))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

writeFileSync(
  join(dir, ".oxlintrc.json"),
  JSON.stringify({
    plugins: [],
    jsPlugins: [resolve("tooling/oxlint-plugin-eskais/index.js").replaceAll("\\", "/")],
    categories: { correctness: "off" },
    rules: { "eskais/no-inline-icons": "error" },
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

test("flags an Icon component that draws its own <svg>", () => {
  expect(
    flaggedLines(`export function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}`),
  ).toEqual([3])
})

test("flags an <svg> under any name, in a helper, inline JSX or a map", () => {
  expect(
    flaggedLines(`const icon = (d: string) => <svg viewBox="0 0 24 24"><path d={d} /></svg>
export function Chevron() {
  return <svg viewBox="0 0 24 24" />
}
export const glyphs = { bold: <svg viewBox="0 0 24 24" /> }
export const Button = () => <button type="button">{icon("m6 9 6 6 6-6")}<svg /></button>`),
  ).toEqual([1, 3, 5, 6])
})

test("allows lucide icons and other elements", () => {
  expect(
    flaggedLines(`import { CheckIcon } from "lucide-react"
export function Done() {
  return <span><CheckIcon className="size-4" /></span>
}`),
  ).toEqual([])
})

test("accepts a disable comment with a reason, in code and in JSX children", () => {
  expect(
    flaggedLines(`export function Spinner() {
  return (
    // oxlint-disable-next-line eskais/no-inline-icons -- an animated progress arc
    <svg viewBox="0 0 24 24" />
  )
}
export function Grip() {
  return (
    <span>
      {/* oxlint-disable-next-line eskais/no-inline-icons -- filled grip dots sized to the handle */}
      <svg viewBox="0 0 6 14" />
    </span>
  )
}`),
  ).toEqual([])
})

test("the repo's config runs it on the registry and on the apps", () => {
  const config = JSON.parse(readFileSync(".oxlintrc.json", "utf8")) as {
    overrides: { files: string[]; rules: Record<string, unknown> }[]
  }
  const covered = config.overrides
    .filter((override) => override.rules["eskais/no-inline-icons"] === "error")
    .flatMap((override) => override.files)
  expect(covered).toEqual(expect.arrayContaining(["registry/**", "apps/**"]))
})
