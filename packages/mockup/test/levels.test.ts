import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { afterAll, beforeAll, describe, expect, test } from "vitest"

import { pageProblems } from "../src/checks"

const repo = resolve(import.meta.dirname, "../../..")
const cli = join(repo, "packages", "mockup", "src", "cli.ts")

type ItemFile = { path: string; content: string; type?: string }

type ItemInput = {
  name: string
  description: string
  dependencies?: string[]
  registryDependencies?: string[]
  files: ItemFile[]
}

let project = ""

function write(relative: string, content: string) {
  const path = join(project, relative)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function itemDocument(input: ItemInput) {
  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: input.name,
    type: "registry:ui",
    title: input.name,
    description: input.description,
    dependencies: input.dependencies ?? [],
    registryDependencies: input.registryDependencies ?? [],
    files: input.files.map((file) => ({
      path: file.path,
      type: file.type ?? "registry:ui",
      content: file.content,
    })),
  }
}

const items: ItemInput[] = [
  {
    name: "utils",
    description: "clsx and tailwind-merge.",
    files: [
      {
        path: "registry/lib/utils.ts",
        type: "registry:lib",
        content:
          'export { default as clsx } from "clsx"\nexport const cn = (...classes: string[]) => classes.join(" ")\n',
      },
    ],
  },
  {
    name: "card",
    description: "An installed surface.",
    registryDependencies: ["@local/utils"],
    files: [
      {
        path: "registry/ui/card.tsx",
        content:
          'import type { ReactNode } from "react"\n\ntype CardProps = { className?: string; children?: ReactNode }\n\nexport function Card({ className, children }: CardProps) {\n  return <section className={className}>{children}</section>\n}\n',
      },
    ],
  },
  {
    name: "gauge",
    description: "A live gauge that the project has not installed.",
    registryDependencies: ["@local/utils", "@local/gauge-face"],
    files: [
      {
        path: "registry/ui/gauge.tsx",
        content:
          'import { Card } from "@/components/ui/card"\nimport { cn } from "@/lib/utils"\n\nimport { GaugeFace } from "@/components/ui/gauge-face"\n\ntype GaugeProps = { value: number; label: string }\n\nexport function Gauge({ value, label }: GaugeProps) {\n  return (\n    <Card>\n      <GaugeFace value={value} />\n      <p className={cn("text-sm")}>{label}</p>\n    </Card>\n  )\n}\n',
      },
    ],
  },
  {
    name: "gauge-face",
    description: "The bar inside the gauge, fetched as a registry dependency.",
    registryDependencies: ["@local/utils"],
    files: [
      {
        path: "registry/ui/gauge-face.tsx",
        content:
          'import { cn } from "@/lib/utils"\n\ntype GaugeFaceProps = { value: number }\n\nexport function GaugeFace({ value }: GaugeFaceProps) {\n  return <div className={cn("h-2 rounded")} style={{ width: `${value}%` }} />\n}\n',
      },
    ],
  },
  {
    name: "fancy-gauge",
    description: "A gauge that needs an npm package the project lacks.",
    dependencies: ["missing-pkg@9.9.9"],
    files: [
      {
        path: "registry/ui/fancy-gauge.tsx",
        content:
          'import { Card } from "@/components/ui/card"\n\nexport function FancyGauge() {\n  return <Card>fancy</Card>\n}\n',
      },
    ],
  },
]

function writeRegistry() {
  for (const input of items) write(`registry/${input.name}.json`, JSON.stringify(itemDocument(input), null, 2))
  const index = {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: "local",
    items: items.map((input) => ({
      name: input.name,
      type: "registry:ui",
      description: input.description,
      files: input.files.map((file) => ({ path: file.path, type: file.type ?? "registry:ui" })),
    })),
  }
  write("registry/registry.json", JSON.stringify(index, null, 2))
}

beforeAll(() => {
  project = mkdtempSync(join(repo, "apps", "showcase", ".tmp-levels-"))
  write(
    "package.json",
    JSON.stringify(
      {
        name: "mockup-levels",
        private: true,
        type: "module",
        dependencies: {
          "@ui-sdk/core": "0.1.0-beta.10",
          "@ui-sdk/react": "0.1.0-beta.10",
          "class-variance-authority": "0.7.1",
          clsx: "2.1.1",
          react: "19.3.1",
          "react-dom": "19.3.1",
          "tailwind-merge": "3.7.0",
        },
      },
      null,
      2,
    ),
  )
  write(
    "tsconfig.json",
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2023",
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          lib: ["ES2023", "DOM", "DOM.Iterable"],
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          isolatedModules: true,
          paths: { "@/*": ["./src/*"] },
          types: ["node"],
        },
        include: ["src"],
      },
      null,
      2,
    ),
  )
  write(
    "components.json",
    JSON.stringify(
      {
        style: "new-york",
        tailwind: { css: "src/index.css" },
        aliases: {
          components: "@/components",
          ui: "@/components/ui",
          lib: "@/lib",
          utils: "@/lib/utils",
        },
        registries: { "@local": "./registry/{name}.json" },
      },
      null,
      2,
    ),
  )
  write("src/index.css", '@import "tailwindcss";\n')
  write(
    "src/lib/utils.ts",
    'import { clsx, type ClassValue } from "clsx"\nimport { twMerge } from "tailwind-merge"\n\nexport function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs))\n}\n',
  )
  write(
    "src/components/ui/card.tsx",
    'import type { ReactNode } from "react"\n\nimport { cn } from "@/lib/utils"\n\ntype CardProps = { className?: string; children?: ReactNode }\n\nexport function Card({ className, children }: CardProps) {\n  return <section className={cn("rounded border p-4", className)}>{children}</section>\n}\n',
  )
  writeRegistry()

  write(
    ".mockups/levels/fixtures.ts",
    'export type Sample = { label: string; value: number; note: string }\n\nexport const sample: Sample = { label: "Queue", value: 62, note: "Three tasks wait." }\n',
  )
  write(
    ".mockups/levels/parts/review-summary.tsx",
    'import { Card } from "@/components/ui/card"\n\ntype ReviewSummaryProps = { label: string }\n\nexport function ReviewSummary({ label }: ReviewSummaryProps) {\n  return <Card>{label}</Card>\n}\n',
  )
  write(
    ".mockups/levels/parts/label-token-input.tsx",
    '// sdk-reason: Eskais has no multi-value token field\nimport { TokenInput, TokenInputEditor } from "@ui-sdk/react/token-input"\n\ntype LabelTokenInputProps = { label: string }\n\nexport function LabelTokenInput({ label }: LabelTokenInputProps) {\n  return (\n    <TokenInput aria-label={label}>\n      <TokenInputEditor placeholder="Add a tag" />\n    </TokenInput>\n  )\n}\n',
  )
  write(
    ".mockups/levels/gaps.ts",
    'type Gap = { component: string; missing: string; reason: string }\n\nexport const gaps: Gap[] = [\n  { component: "Gauge", missing: "sparkline", reason: "The screen needs a trend, not just a value." },\n]\n',
  )
  write(
    ".mockups/levels/screen.tsx",
    'import { Card } from "@/components/ui/card"\nimport { Gauge } from "@registry/gauge"\n\nimport { sample } from "./fixtures"\nimport { LabelTokenInput } from "./parts/label-token-input"\nimport { ReviewSummary } from "./parts/review-summary"\n\ntype ScreenProps = { value?: number }\n\nexport default function Screen({ value = sample.value }: ScreenProps) {\n  return (\n    <main className="p-4 font-sans">\n      <ReviewSummary label={sample.label} />\n      <Gauge value={value} label={sample.label} />\n      <LabelTokenInput label="Tags" />\n      <Card>{sample.note}</Card>\n    </main>\n  )\n}\n',
  )

  write(
    ".mockups/levels-fancy/screen.tsx",
    'import { FancyGauge } from "@registry/fancy-gauge"\n\nexport default function Screen() {\n  return <FancyGauge />\n}\n',
  )
  write(".mockups/levels-fancy/fixtures.ts", "export const nothing = null\n")
  write(
    ".mockups/levels-unknown/screen.tsx",
    'import { Missing } from "@registry/not-in-the-registry"\n\nexport default function Screen() {\n  return <Missing />\n}\n',
  )
  write(".mockups/levels-unknown/fixtures.ts", "export const nothing = null\n")

  write(
    ".mockups/levels-rules/screen.tsx",
    'import { Card } from "@/components/ui/card"\n\nexport default function Screen() {\n  return <Card>rules</Card>\n}\n',
  )
  write(".mockups/levels-rules/fixtures.ts", "export const nothing = null\n")
  write(
    ".mockups/levels-gaps/screen.tsx",
    [
      'import { Card } from "@/components/ui/card"',
      "",
      "export default function Screen() {",
      "  return <Card>gaps</Card>",
      "}",
      "",
    ].join("\n"),
  )
  write(".mockups/levels-gaps/fixtures.ts", "export const nothing = null\n")
  write(".mockups/levels-gaps/gaps.ts", "export const gaps = [{ component: 1 }]\n")
  write(
    ".mockups/levels-rules/parts/palette-card.tsx",
    'type PaletteCardProps = { label: string }\n\nexport function PaletteCard({ label }: PaletteCardProps) {\n  return <div className="bg-[#ff00aa] w-[137px] p-[13px]">{label}</div>\n}\n',
  )
  write(
    ".mockups/levels-rules/parts/hint.tsx",
    'import { Tooltip } from "@ui-sdk/react/tooltip"\n\ntype HintProps = { label: string }\n\nexport function Hint({ label }: HintProps) {\n  return <Tooltip>{label}</Tooltip>\n}\n',
  )
})

afterAll(() => {
  if (project !== "") rmSync(project, { recursive: true, force: true })
})

function run(args: string[]) {
  const result = spawnSync("bun", [cli, ...args, "--project", project], { cwd: repo, encoding: "utf8" })
  return { code: result.status ?? -1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" }
}

function manifest(name: string) {
  return JSON.parse(readFileSync(join(project, ".mockups", name, "manifest.json"), "utf8")) as {
    install: { item: string; command: string }[]
    proposed: { name: string; file: string; props: string[] }[]
    sdkParts: { part: string; primitive: string; reason: string }[]
    gaps: { component: string; missing: string; reason: string }[]
  }
}

describe("five levels", () => {
  test(
    "builds an uninstalled registry item and records install, proposed, sdkParts and gaps",
    { timeout: 180_000 },
    () => {
      const result = run(["validate", "levels"])
      expect(result.stderr).not.toContain("error")
      expect(result.code).toBe(0)
      expect(result.stdout).toContain("ok ")
      expect(result.stdout).toContain("install 2: gauge, gauge-face")
      expect(result.stdout).toContain("proposed 2: LabelTokenInput (1 prop), ReviewSummary (1 prop)")
      expect(result.stdout).toContain("sdkParts 1: LabelTokenInput ← @ui-sdk/react/token-input")
      expect(result.stdout).toContain("gaps 1: Gauge (sparkline)")

      const written = manifest("levels")
      expect(written.install).toEqual([
        { item: "gauge", command: "npx shadcn@latest add @local/gauge" },
        { item: "gauge-face", command: "npx shadcn@latest add @local/gauge-face" },
      ])
      expect(written.proposed).toEqual([
        { name: "LabelTokenInput", file: "parts/label-token-input.tsx", props: ["label: string"] },
        { name: "ReviewSummary", file: "parts/review-summary.tsx", props: ["label: string"] },
      ])
      expect(written.sdkParts).toEqual([
        {
          part: "LabelTokenInput",
          primitive: "@ui-sdk/react/token-input",
          reason: "Eskais has no multi-value token field",
        },
      ])
      expect(written.gaps).toEqual([
        { component: "Gauge", missing: "sparkline", reason: "The screen needs a trend, not just a value." },
      ])
      const page = readFileSync(join(project, ".mockups", "levels", "out.html"), "utf8")
      expect(page).toContain('data-color-scheme="system"')
      expect(pageProblems(page)).toEqual([])
    },
  )

  test("lists the registry items the project has not installed", { timeout: 60_000 }, () => {
    const result = run(["inspect", "--registry"])
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("@local ")
    expect(result.stdout).toContain("gauge")
    expect(result.stdout).toContain("gauge-face")
    expect(result.stdout).toContain("fancy-gauge")
    expect(result.stdout).toContain("A live gauge that the project has not installed.")
    expect(result.stdout).not.toMatch(/\n\s+card\s/)
    expect(result.stdout).not.toMatch(/\n\s+utils\s/)
  })

  test("lists the SDK subpaths and one primitive's parts and props", { timeout: 60_000 }, () => {
    const listed = run(["inspect", "--sdk"])
    expect(listed.code).toBe(0)
    expect(listed.stdout).toContain("@ui-sdk/react")
    expect(listed.stdout).toContain("token-input")
    const detail = run(["inspect", "--sdk", "token-input"])
    expect(detail.code).toBe(0)
    expect(detail.stdout).toContain('from "@ui-sdk/react/token-input"')
    expect(detail.stdout).toContain("parts TokenInput, TokenInputEditor")
    expect(detail.stdout).toContain("type TokenInputProps")
  })
})

describe("missing pieces", () => {
  test("a registry item whose npm package is missing is exit code 2", { timeout: 60_000 }, () => {
    const result = run(["build", "levels-fancy"])
    expect(result.code).toBe(2)
    expect(result.stderr).toContain("missing-pkg")
    expect(result.stderr).toContain("install them in")
    expect(result.stdout).toBe("")
  })

  test("an item no registry has is exit code 2", { timeout: 60_000 }, () => {
    const result = run(["build", "levels-unknown"])
    expect(result.code).toBe(2)
    expect(result.stderr).toContain("not-in-the-registry")
  })

  test("a malformed gaps export is exit code 2", { timeout: 60_000 }, () => {
    const result = run(["build", "levels-gaps"])
    expect(result.code).toBe(2)
    expect(result.stderr).toContain("gap 1 needs string component and missing")
  })

  test("raw styles and a missing sdk reason are exit code 1", { timeout: 120_000 }, () => {
    const result = run(["validate", "levels-rules"])
    expect(result.code).toBe(1)
    expect(result.stdout).toContain(" shadcn/no-raw-colors ")
    expect(result.stdout).toContain(" shadcn/no-arbitrary-values ")
    expect(result.stdout).toContain(" sdk-reason ")
    expect(result.stdout).toContain("sdkParts none")
    expect(existsSync(join(project, ".mockups", "levels-rules", "out.html"))).toBe(true)
  })
})

describe("registry configuration", () => {
  test("a project without registries tells inspect --registry so", { timeout: 60_000 }, () => {
    const result = spawnSync("bun", [cli, "inspect", "--registry"], { cwd: repo, encoding: "utf8" })
    expect(result.status).toBe(2)
    expect(result.stderr).toContain("registries")
    expect(result.stderr).toContain("components.json")
  })
})
