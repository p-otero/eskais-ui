import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { afterAll, beforeAll, describe, expect, test } from "vitest"

import { pageProblems } from "../src/checks"

const repo = resolve(import.meta.dirname, "../../..")
const cli = join(repo, "packages", "mockup", "src", "cli.ts")
const mockups = join(repo, ".mockups")
const ok = join(mockups, "zz-test-ok")
const broken = join(mockups, "zz-test-broken")
const custom = join(mockups, "zz-test-custom.html")
const gallery = join(mockups, "gallery.html")

const screen = `import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { sampleAccount, type Account } from "./fixtures"

type AccountCardProps = {
  account?: Account
}

export default function AccountCard({ account = sampleAccount }: AccountCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{account.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-group">
        <Badge tone="success">{account.plan}</Badge>
        <Button>Open</Button>
      </CardContent>
    </Card>
  )
}
`

const fixtures = `export type Account = {
  name: string
  plan: "Starter" | "Team"
}

export const sampleAccount: Account = { name: "Atlas", plan: "Team" }
`

const brokenScreen = `import { Button } from "@/components/ui/button"

export default function Broken() {
  void fetch("/api/accounts")
  return (
    <div>
      <button type="button">Save</button>
      <Button tone="loud">Save</Button>
    </div>
  )
}
`

function run(args: string[]) {
  const result = spawnSync("bun", [cli, ...args], { cwd: repo, encoding: "utf8" })
  return { code: result.status ?? -1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" }
}

function problemLines(stdout: string) {
  return stdout.split("\n").filter((line) => /^.+:\d+:\d+ \S+ /.test(line))
}

beforeAll(() => {
  mkdirSync(ok, { recursive: true })
  mkdirSync(broken, { recursive: true })
  writeFileSync(join(ok, "screen.tsx"), screen)
  writeFileSync(join(ok, "fixtures.ts"), fixtures)
  writeFileSync(join(broken, "screen.tsx"), brokenScreen)
  writeFileSync(join(broken, "fixtures.ts"), "export const nothing = null\n")
})

afterAll(() => {
  for (const path of [ok, broken, custom, gallery]) rmSync(path, { recursive: true, force: true })
  if (existsSync(mockups) && readdirSync(mockups).every((name) => name === ".gitignore")) {
    rmSync(mockups, { recursive: true, force: true })
  }
})

describe("build", () => {
  test("writes one self-contained page and its manifest", { timeout: 120_000 }, () => {
    const result = run(["build", "zz-test-ok"])
    expect(result.stderr).toBe("")
    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toMatch(
      /^\.mockups\/zz-test-ok\/out\.html\s+\d+ kB \(\d+ kB js, \d+ kB css, \d+ kB fonts\)$/,
    )
    const page = readFileSync(join(ok, "out.html"), "utf8")
    expect(pageProblems(page)).toEqual([])
    expect(page).toContain('<div id="root"></div>')
    expect(page).toContain('data-color-scheme="system"')
    expect(page).not.toContain("{{")
    const manifest = JSON.parse(readFileSync(join(ok, "manifest.json"), "utf8")) as {
      name: string
      hashes: { screen: string; fixtures: string }
      components: string[]
      size: { total: number; js: number; css: number; fonts: number }
    }
    expect(manifest.name).toBe("zz-test-ok")
    expect(manifest.hashes.screen).toHaveLength(16)
    expect(manifest.hashes.fixtures).toHaveLength(16)
    expect(manifest.components).toContain("@/components/ui/badge")
    expect(manifest.components).toContain("@/components/ui/card")
    expect(manifest.size.total).toBeGreaterThan(100_000)
    expect(manifest.size.js).toBeGreaterThan(0)
    expect(manifest.size.fonts).toBeGreaterThan(0)
    expect(readFileSync(join(mockups, ".gitignore"), "utf8")).toBe("*\n")
  })

  test("sets the theme and the colour scheme before the first paint", { timeout: 120_000 }, () => {
    const result = run(["build", "zz-test-ok", "--theme", "compact", "--scheme", "dark", "--out", custom])
    expect(result.code).toBe(0)
    const page = readFileSync(custom, "utf8")
    expect(page).toContain('data-theme="compact"')
    expect(page).toContain('class="dark"')
    expect(page).toContain('data-color-scheme="dark"')
    expect(pageProblems(page)).toEqual([])
  })
})

describe("validate", () => {
  test("passes a mockup whose controls come from the project", { timeout: 120_000 }, () => {
    const result = run(["validate", "zz-test-ok"])
    expect(result.stdout).toMatch(/^ok \.mockups\/zz-test-ok\/out\.html/)
    expect(result.stdout).toContain("screenshots 0 (1 page; no screenshot: out.html)")
    expect(result.code).toBe(0)
  })

  test("counts the screenshots and prints the gallery with --gallery", { timeout: 120_000 }, () => {
    writeFileSync(join(ok, "out.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    const result = run(["validate", "zz-test-ok", "--gallery"])
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("screenshots 1 (1 page)")
    expect(result.stdout.trim().split("\n").at(-1)).toMatch(/^gallery \.mockups\/gallery\.html {2}\d+ screenshots?: /)
    expect(readFileSync(gallery, "utf8")).toContain('alt="zz-test-ok, default state, system theme"')
  })

  test("reports every source rule and the type checker with exit code 1", { timeout: 120_000 }, () => {
    const result = run(["validate", "zz-test-broken"])
    expect(result.code).toBe(1)
    const lines = problemLines(result.stdout)
    expect(lines.some((line) => line.includes(" no-network "))).toBe(true)
    expect(lines.some((line) => line.includes(" bare-control "))).toBe(true)
    expect(lines.some((line) => line.includes(" type TS") && line.includes("Property 'tone' does not exist"))).toBe(
      true,
    )
  })

  test("caps the problems it prints", { timeout: 120_000 }, () => {
    const result = run(["validate", "zz-test-broken", "--max", "1"])
    expect(result.code).toBe(1)
    expect(problemLines(result.stdout)).toHaveLength(1)
    expect(result.stdout).toContain("more problems (raise --max to see them)")
  })
})

describe("environment and usage errors", () => {
  test("a missing mockup is exit code 2", { timeout: 120_000 }, () => {
    const result = run(["build", "zz-test-missing"])
    expect(result.code).toBe(2)
    expect(result.stdout).toBe("")
    expect(result.stderr).toContain("does not exist")
  })

  test("an unknown component name is exit code 2", { timeout: 120_000 }, () => {
    const result = run(["inspect", "NotAComponent"])
    expect(result.code).toBe(2)
    expect(result.stderr).toContain("NotAComponent")
  })

  test("an unknown command is exit code 2", () => {
    const result = run(["publish"])
    expect(result.code).toBe(2)
    expect(result.stderr).toContain("publish")
  })
})

describe("inspect", () => {
  test("names a component's import line, props type and variants", { timeout: 120_000 }, () => {
    const result = run(["inspect", "Badge"])
    expect(result.code).toBe(0)
    expect(result.stdout).toContain('import { Badge, badgeVariants } from "@/components/ui/badge"')
    expect(result.stdout).toContain("type BadgeProps")
    expect(result.stdout).toContain("const badgeVariants = cva(")
  })

  test("lists the project, its themes and the exports of every file", { timeout: 120_000 }, () => {
    const result = run(["inspect"])
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("project .")
    expect(result.stdout).toContain("css apps/showcase/src/index.css")
    expect(result.stdout).toContain("themes compact, default, glass")
    expect(result.stdout).toContain("ui (registry/ui)")
    expect(result.stdout).toContain("  button Button, buttonVariants")
  })

  test("prints the compact index as JSON", { timeout: 120_000 }, () => {
    const result = run(["inspect", "--json"])
    expect(result.code).toBe(0)
    const index = JSON.parse(result.stdout) as { aliases: { name: string; files: { file: string }[] }[] }
    const ui = index.aliases.find((alias) => alias.name === "ui")
    expect(ui?.files.some((file) => file.file === "button")).toBe(true)
  })
})
