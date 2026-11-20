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
const shell = join(mockups, "zz-test-shell")
const viewport = join(mockups, "zz-test-viewport")
const states = join(mockups, "zz-test-states")

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

const shellScreen = `import { InboxIcon } from "lucide-react"

import { Shell, type ShellRoute } from "@/components/ui/shell"

const routes: ShellRoute[] = [{ id: "inbox", label: "Inbox", href: "/inbox", icon: InboxIcon }]

export default function Environments() {
  return (
    <Shell routes={routes} currentHref="/inbox" as="div" brand={<span className="text-title-sm">Local</span>}>
      <p>Environments</p>
    </Shell>
  )
}
`

const viewportScreen = `export default function Tall() {
  return <div className="min-h-screen">Tall</div>
}
`

const statesScreen = `import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { sampleItems, type ScreenProps } from "./fixtures"

export default function Items({ items = sampleItems, error }: ScreenProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{error ?? String(items.length)}</CardTitle>
      </CardHeader>
      <CardContent>{items.map((item) => <p key={item.id}>{item.name}</p>)}</CardContent>
    </Card>
  )
}
`

const statesFixtures = `export type Item = { id: string; name: string }
export type ScreenProps = { items?: Item[]; error?: string }

export const sampleItems: Item[] = [{ id: "a", name: "Alpha" }]

export const states = {
  empty: { items: [] },
  error: { items: [], error: "Could not load the items" },
  "long-list": { items: Array.from({ length: 30 }, (_, index) => ({ id: String(index), name: "Item " + String(index) })) },
} satisfies Record<string, ScreenProps>
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
  const written: [string, Record<string, string>][] = [
    [shell, { "screen.tsx": shellScreen }],
    [viewport, { "screen.tsx": viewportScreen }],
    [states, { "screen.tsx": statesScreen, "fixtures.ts": statesFixtures }],
  ]
  for (const [dir, files] of written) {
    mkdirSync(dir, { recursive: true })
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content)
  }
})

afterAll(() => {
  for (const path of [ok, broken, custom, gallery, shell, viewport, states])
    rmSync(path, { recursive: true, force: true })
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

describe("viewport units", () => {
  test("a Shell mockup builds: the installed Shell's 100dvh is not the mockup's", { timeout: 180_000 }, () => {
    const result = run(["build", "zz-test-shell"])
    expect(result.stdout).not.toContain("viewport")
    expect(result.code).toBe(0)
    expect(readFileSync(join(shell, "out.html"), "utf8")).toContain("100dvh")
  })

  test("a viewport unit in the mockup's own files is reported where it is", { timeout: 180_000 }, () => {
    const result = run(["build", "zz-test-viewport"])
    expect(result.code).toBe(1)
    expect(problemLines(result.stdout)).toEqual([
      ".mockups/zz-test-viewport/screen.tsx:2:26 viewport-unit min-h-screen is a viewport height unit; size the screen from its container (h-full, min-h-full)",
    ])
  })
})

function manifestState() {
  return (JSON.parse(readFileSync(join(states, "manifest.json"), "utf8")) as { state: string | null }).state
}

function firstWords(stdout: string) {
  return stdout
    .trim()
    .split("\n")
    .map((line) => line.split(" ")[0])
}

describe("states", () => {
  test("without --state, builds out.html with no props, as before", { timeout: 180_000 }, () => {
    const result = run(["build", "zz-test-states"])
    expect(result.code).toBe(0)
    expect(firstWords(result.stdout)).toEqual([".mockups/zz-test-states/out.html"])
    expect(manifestState()).toBeNull()
  })

  test("--state builds one state into out-<state>-<theme>.html", { timeout: 180_000 }, () => {
    const result = run(["build", "zz-test-states", "--state", "error", "--scheme", "dark"])
    expect(result.stderr).toBe("")
    expect(result.code).toBe(0)
    expect(firstWords(result.stdout)).toEqual([".mockups/zz-test-states/out-error-dark.html"])
    expect(readFileSync(join(states, "out-error-dark.html"), "utf8")).toContain("Could not load the items")
    expect(manifestState()).toBe("error")
  })

  test("--state all builds one page per state", { timeout: 300_000 }, () => {
    const result = run(["build", "zz-test-states", "--state", "all"])
    expect(result.code).toBe(0)
    expect(firstWords(result.stdout)).toEqual([
      ".mockups/zz-test-states/out-empty-system.html",
      ".mockups/zz-test-states/out-error-system.html",
      ".mockups/zz-test-states/out-long-list-system.html",
    ])
  })

  test("validate renders every state and names them", { timeout: 300_000 }, () => {
    const result = run(["validate", "zz-test-states", "--state", "all"])
    expect(result.stdout.split("\n").filter((line) => line.startsWith("ok "))).toHaveLength(3)
    expect(result.stdout).toContain("states 3: empty, error, long-list")
    expect(result.code).toBe(0)
  })

  test("an unknown state, no states export or --out without {state} is a usage error", { timeout: 180_000 }, () => {
    const unknown = run(["build", "zz-test-states", "--state", "loading"])
    expect(unknown.code).toBe(2)
    expect(unknown.stderr).toContain('fixtures.ts has no state "loading"; it has empty, error, long-list')
    const none = run(["build", "zz-test-ok", "--state", "empty"])
    expect(none.code).toBe(2)
    expect(none.stderr).toContain("exports no states")
    const out = run(["build", "zz-test-states", "--state", "all", "--out", custom])
    expect(out.code).toBe(2)
    expect(out.stderr).toContain("--out needs {state}")
    expect(run(["inspect", "--state", "empty"]).code).toBe(2)
  })
})
