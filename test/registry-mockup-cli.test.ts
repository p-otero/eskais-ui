import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import packageJson from "../package.json"
import registry from "../registry.json"

const repo = join(import.meta.dirname, "..")
const source = "packages/mockup/src"
const target = "~/.agents/tools/eskais-mockup"

type File = { path: string; type: string; target?: string }
type BuiltFile = File & { content: string }

const item = (registry.items as { name: string; type: string; files?: File[]; dependencies?: string[] }[]).find(
  (candidate) => candidate.name === "eskais-mockup-cli",
)
if (!item) throw new Error("registry.json has no eskais-mockup-cli")
const files = item.files ?? []
const built = JSON.parse(readFileSync(join(repo, "public", "r", "eskais-mockup-cli.json"), "utf8")) as {
  files: BuiltFile[]
}

// Static imports and re-exports at the start of a line. The CLI also writes import lines inside template strings,
// which start with a backtick and aren't matched.
const staticImport =
  /^(?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+(?:\s*,\s*\{[^}]*\})?)\s+from\s+"([^"]+)"|^import\s+"([^"]+)"/gm

function specifiers(code: string): string[] {
  return [...code.matchAll(staticImport)].map((match) => match[1] ?? match[2] ?? "")
}

describe("eskais-mockup-cli", () => {
  it("ships every file of the CLI's source into .agents/tools/eskais-mockup", () => {
    expect(item.type).toBe("registry:file")
    expect(item.dependencies ?? []).toEqual([])
    for (const file of files) {
      expect(file.type).toBe("registry:file")
      expect(file.path.startsWith(`${source}/`), file.path).toBe(true)
      expect(file.target).toBe(`${target}/${basename(file.path)}`)
    }
    expect(files.map((file) => basename(file.path)).toSorted()).toEqual(readdirSync(join(repo, source)).toSorted())
  })

  it("imports only node:* modules and its own files, by relative path", () => {
    const shipped = new Set(files.map((file) => basename(file.path)))
    for (const file of files.filter((entry) => entry.path.endsWith(".ts"))) {
      for (const specifier of specifiers(readFileSync(join(repo, file.path), "utf8"))) {
        if (specifier.startsWith("node:")) continue
        expect(specifier, `${file.path} imports ${specifier}`).toMatch(/^\.\/[\w.-]+$/)
        expect(shipped.has(`${specifier.slice(2)}.ts`), `${file.path} imports ${specifier}`).toBe(true)
      }
    }
  })

  it("reports the release in package.json", () => {
    expect(readFileSync(join(repo, source, "version.ts"), "utf8")).toContain(
      `export const version = ${JSON.stringify(packageJson.version)}`,
    )
  })

  it("is built into public/r with the current files", () => {
    expect(built.files.map(({ path, target: to }) => ({ path, target: to }))).toEqual(
      files.map(({ path, target: to }) => ({ path, target: to })),
    )
    for (const file of built.files) {
      expect(file.content, file.path).toBe(readFileSync(join(repo, file.path), "utf8"))
    }
  })
})

describe("the installed copy", () => {
  const consumer = mkdtempSync(join(tmpdir(), "eskais-mockup-cli-"))
  const cli = join(consumer, ".agents", "tools", "eskais-mockup", "cli.ts")
  const mockup = join(repo, ".mockups", "zz-test-installed")

  beforeAll(() => {
    for (const file of built.files) {
      const path = join(consumer, (file.target ?? "").slice(2))
      mkdirSync(join(path, ".."), { recursive: true })
      writeFileSync(path, file.content)
    }
    mkdirSync(mockup, { recursive: true })
    writeFileSync(
      join(mockup, "screen.tsx"),
      `import { Button } from "@/components/ui/button"\n\nexport default function Installed() {\n  return <Button>Open</Button>\n}\n`,
    )
  })

  afterAll(() => {
    rmSync(consumer, { recursive: true, force: true })
    rmSync(mockup, { recursive: true, force: true })
  })

  function run(args: string[]) {
    const result = spawnSync("bun", [cli, ...args], { cwd: repo, encoding: "utf8" })
    return { code: result.status ?? -1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" }
  }

  it("prints its release", () => {
    const result = run(["--version"])
    expect(result.stdout.trim()).toBe(`eskais-mockup ${packageJson.version}`)
    expect(result.code).toBe(0)
  })

  it("reads the project and builds a page from its own template", { timeout: 120_000 }, () => {
    const inspect = run(["inspect", "Button"])
    expect(inspect.stdout).toContain("import { Button")
    expect(inspect.code).toBe(0)
    const build = run(["build", "zz-test-installed"])
    expect(build.stderr).toBe("")
    expect(build.code).toBe(0)
    expect(existsSync(join(mockup, "out.html"))).toBe(true)
    expect(readFileSync(join(mockup, "out.html"), "utf8")).toContain('<div id="root"></div>')
  })
})
