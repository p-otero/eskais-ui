import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterAll, expect, test } from "vitest"

const dir = mkdtempSync(join(tmpdir(), "eskais-icon-button-rule-"))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

writeFileSync(
  join(dir, ".oxlintrc.json"),
  JSON.stringify({
    plugins: [],
    jsPlugins: [resolve("registry/rules/eskais-oxlint-plugin.js").replaceAll("\\", "/")],
    categories: { correctness: "off" },
    rules: { "eskais/icon-button-needs-label": "error" },
  }),
)

function flagged(source: string) {
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
    diagnostics: { message: string; labels: { span: { line: number } }[] }[]
  }
  return diagnostics.map((diagnostic) => [
    diagnostic.labels[0]?.span.line,
    diagnostic.message.includes("without a name") ? "name" : "size",
  ])
}

test("flags an icon-only Button or Toggle with no name", () => {
  expect(
    flagged(`import { XIcon } from "lucide-react"
export const a = <Button><XIcon /></Button>
export const b = <Toggle size="icon"><BoldIcon /></Toggle>
export const c = (
  <ui.Button variant="ghost">
    <Icon icon={XIcon} label="Close" />
  </ui.Button>
)`),
  ).toEqual([
    [2, "name"],
    [3, "name"],
    [5, "name"],
  ])
})

test("flags a named icon-only Button without the icon size, which would show no tooltip", () => {
  expect(flagged(`export const a = <Button aria-label="Close"><XIcon /></Button>`)).toEqual([[1, "size"]])
  expect(
    flagged(`export const a = (
  <Button aria-label="Copy" className="size-6">
    {copied ? <CheckIcon /> : <CopyIcon />}
  </Button>
)`),
  ).toEqual([[2, "size"]])
})

test("allows icon buttons with size and label, text buttons, and opt-outs", () => {
  expect(
    flagged(`export const ok = (
  <>
    <Button size="icon" aria-label="Close"><XIcon /></Button>
    <Toggle size="icon" aria-label="Bold"><BoldIcon /></Toggle>
    <Button size={size} aria-label="Copy"><CopyIcon /></Button>
    <Button aria-label="Archive" tooltip={false}><ArchiveIcon /></Button>
    <Button><PlusIcon /> Add</Button>
    <Button>{label}</Button>
    <Button {...props}><XIcon /></Button>
    <Button size="icon" aria-labelledby="title"><XIcon /></Button>
    <Button size="icon" aria-label="Close" tooltip="Closes the panel"><XIcon /></Button>
  </>
)`),
  ).toEqual([])
})

test("allows a control that already sits in a tooltip", () => {
  expect(
    flagged(`export const ok = (
  <>
    <ControlTooltip label="Next"><Button aria-label="Next"><ChevronRightIcon /></Button></ControlTooltip>
    <TooltipTrigger render={<Button aria-label="Copy"><CopyIcon /></Button>} />
  </>
)`),
  ).toEqual([])
})

test("accepts a disable comment with a reason", () => {
  expect(
    flagged(`export const a = (
  // oxlint-disable-next-line eskais/icon-button-needs-label -- the visible label sits beside it
  <Button aria-label="Close"><XIcon /></Button>
)`),
  ).toEqual([])
})

test("ships in the consumers' lint-rules config, and the repo enables it", () => {
  const consumer = JSON.parse(readFileSync("registry/rules/eskais-ui.oxlintrc.json", "utf8")) as {
    jsPlugins: string[]
    rules: Record<string, unknown>
  }
  expect(consumer.jsPlugins).toContain("./eskais-oxlint-plugin.js")
  expect(consumer.rules["eskais/icon-button-needs-label"]).toBe("error")
  const registry = JSON.parse(readFileSync("registry.json", "utf8")) as {
    items: { name: string; files: { path: string; target?: string }[] }[]
  }
  const item = registry.items.find((entry) => entry.name === "lint-rules")
  expect(item?.files).toContainEqual({
    path: "registry/rules/eskais-oxlint-plugin.js",
    type: "registry:file",
    target: "~/eskais-oxlint-plugin.js",
  })
  const repo = JSON.parse(readFileSync(".oxlintrc.json", "utf8")) as { rules: Record<string, unknown> }
  expect(repo.rules["eskais/icon-button-needs-label"]).toBe("error")
})
