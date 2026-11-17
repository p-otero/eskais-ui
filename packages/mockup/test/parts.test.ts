import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, test } from "vitest"

import { partStyleProblems, sdkImportProblems } from "../src/checks"
import { extractType } from "../src/inspect"
import { readMockupParts, sdkDuplicateWarnings } from "../src/parts"

const root = mkdtempSync(join(tmpdir(), "mockup-parts-"))
const mockup = join(root, "screen")
const broken = join(root, "broken")

function write(directory: string, relative: string, content: string) {
  const path = join(directory, relative)
  mkdirSync(join(path, ".."), { recursive: true })
  writeFileSync(path, content)
}

write(
  mockup,
  "parts/status-card.tsx",
  [
    "// sdk-reason: the tooltip explains a shortened count, which Eskais has no part for",
    'import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-sdk/react/tooltip"',
    "",
    "type StatusCardProps = {",
    "  title: string",
    "  tone?: Tone",
    "}",
    "",
    "export function StatusCard({ title }: StatusCardProps) {",
    "  return <Tooltip>{title}</Tooltip>",
    "}",
    "",
  ].join("\n"),
)
write(
  mockup,
  "parts/raw-tile.tsx",
  [
    "type RawTileProps = { label: string }",
    "",
    "export function RawTile({ label }: RawTileProps) {",
    '  return <div className="bg-white text-[#123456] w-[12px] max-h-[calc(100%-2rem)] p-4">{label}</div>',
    "}",
    "",
  ].join("\n"),
)
write(
  broken,
  "parts/hint.tsx",
  'import { Tooltip } from "@ui-sdk/react/tooltip"\n\ntype HintProps = { label: string }\n\nexport function Hint({ label }: HintProps) {\n  return <Tooltip>{label}</Tooltip>\n}\n',
)

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe("sdkImportProblems", () => {
  test("allows a public subpath and rejects a bare package or an internal path", () => {
    const source = [
      'import { Dialog } from "@ui-sdk/react"',
      'import { x } from "@ui-sdk/react/internal/x"',
      'import { Tooltip } from "@ui-sdk/react/tooltip"',
    ].join("\n")
    const problems = sdkImportProblems("screen.tsx", source, new Set(["@ui-sdk/react/tooltip"]))
    expect(problems.map((problem) => problem.rule)).toEqual(["sdk-subpath", "sdk-subpath"])
    expect(problems[0]?.message).toContain("public subpath")
    expect(problems[1]?.message).toContain("@ui-sdk/react/internal/x")
  })
})

describe("partStyleProblems", () => {
  test("flags raw colours and arbitrary sizes but keeps tokens and the allowed calc values", () => {
    const source =
      '<div className="bg-white text-[#123456] w-[12px] max-h-[calc(100%-2rem)] p-4 text-muted-foreground" />'
    const problems = partStyleProblems("parts/raw-tile.tsx", source)
    expect(problems.map((problem) => problem.rule)).toEqual([
      "shadcn/no-raw-colors",
      "shadcn/no-raw-colors",
      "shadcn/no-arbitrary-values",
    ])
    expect(problems[2]?.message).toContain("w-[12px]")
  })
})

describe("readMockupParts", () => {
  test("records the proposed components, their props, the SDK parts and the gaps", async () => {
    const parts = await readMockupParts(mockup, root)
    expect(parts.proposed).toEqual([
      { name: "RawTile", file: "parts/raw-tile.tsx", props: ["label: string"] },
      { name: "StatusCard", file: "parts/status-card.tsx", props: ["title: string", "tone?: Tone"] },
    ])
    expect(parts.sdkParts).toEqual([
      {
        part: "StatusCard",
        primitive: "@ui-sdk/react/tooltip",
        reason: "the tooltip explains a shortened count, which Eskais has no part for",
      },
    ])
    expect(parts.gaps).toEqual([])
    expect(parts.problems).toEqual([])
  })

  test("a part that uses a UI SDK primitive without a reason is a problem", async () => {
    const parts = await readMockupParts(broken, root)
    expect(parts.sdkParts).toEqual([])
    expect(parts.problems.map((problem) => problem.rule)).toEqual(["sdk-reason"])
    expect(parts.problems[0]?.message).toContain("sdk-reason")
  })
})

describe("sdkDuplicateWarnings", () => {
  test("warns when the project already installs a part with the primitive's name", () => {
    const warnings = sdkDuplicateWarnings(
      [
        { part: "TaskHint", primitive: "@ui-sdk/react/dialog", reason: "focus trap" },
        { part: "LabelField", primitive: "@ui-sdk/react/token-input", reason: "tokens" },
      ],
      new Set(["dialog"]),
    )
    expect(warnings).toEqual([
      "TaskHint uses @ui-sdk/react/dialog, but the project already installs a dialog component; use it first",
    ])
  })
})

describe("extractType", () => {
  test("skips a type name that only appears in an import", () => {
    const source = [
      'import { type TooltipProps } from "@ui-sdk/core/tooltip"',
      "type TooltipProps = {",
      "  delay: number",
      "}",
    ].join("\n")
    expect(extractType(source, "TooltipProps")).toBe("type TooltipProps = {\n  delay: number\n}")
  })
})
