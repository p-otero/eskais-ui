import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { afterAll, describe, expect, test } from "vitest"

import { findProject, locatePackage } from "../src/project"

const repo = resolve(import.meta.dirname, "../../..")
const cli = join(repo, "packages", "mockup", "src", "cli.ts")
const root = realpathSync(mkdtempSync(join(tmpdir(), "mockup-workspace-build-")))

afterAll(() => rmSync(root, { recursive: true, force: true }))

function write(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

// The layout that needed copied stylesheets and hand-made node_modules links: components.json in packages/ui,
// which installs nothing, and Tailwind and React linked into apps/web only, as pnpm and Bun's isolated installs do.
function workspace() {
  write(
    join(root, "package.json"),
    JSON.stringify({ name: "workspace", private: true, workspaces: ["apps/*", "packages/*"] }),
  )
  const ui = join(root, "packages", "ui")
  write(
    join(ui, "package.json"),
    JSON.stringify({ name: "@workspace/ui", imports: { "#components/*": "./src/components/*" } }),
  )
  write(
    join(ui, "components.json"),
    JSON.stringify({
      tailwind: { css: "src/styles.css" },
      aliases: { components: "#components", ui: "#components/ui" },
    }),
  )
  write(
    join(ui, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { jsx: "react-jsx", module: "esnext", moduleResolution: "bundler", strict: true },
    }),
  )
  write(join(ui, "src", "styles.css"), '@import "tailwindcss";\n')
  write(
    join(ui, "src", "components", "ui", "panel.tsx"),
    'export function Panel({ title }: { title: string }) {\n  return <section className="rounded-lg p-4">{title}</section>\n}\n',
  )
  write(
    join(ui, ".mockups", "environments", "screen.tsx"),
    'import { Panel } from "#components/ui/panel"\n\nexport default function Environments() {\n  return (\n    <div className="flex h-full gap-4">\n      <Panel title="Local environments" />\n    </div>\n  )\n}\n',
  )
  write(join(root, "apps", "web", "package.json"), JSON.stringify({ name: "@workspace/web" }))
  write(join(root, "apps", "web", "tsconfig.json"), JSON.stringify({ compilerOptions: { types: ["vite/client"] } }))
  const repoProject = findProject({ cwd: repo })
  for (const name of ["tailwindcss", "@tailwindcss/node", "@tailwindcss/oxide", "react", "react-dom"]) {
    const located = locatePackage(repoProject.resolution, name)
    if (located === null) throw new Error(`${name} is not installed in the repository`)
    const link = join(root, "apps", "web", "node_modules", name)
    mkdirSync(dirname(link), { recursive: true })
    symlinkSync(located.dir, link, "junction")
  }
  return ui
}

describe("a mockup in a workspace package that installs nothing", () => {
  test("builds with the workspace's Tailwind and React and the package's # imports", { timeout: 300_000 }, () => {
    const ui = workspace()
    const result = spawnSync("bun", [cli, "build", "environments"], { cwd: ui, encoding: "utf8" })
    expect(result.stderr).toBe("")
    expect(result.stdout).toMatch(/^\.mockups\/environments\/out\.html /)
    expect(result.status).toBe(0)
    const page = readFileSync(join(ui, ".mockups", "environments", "out.html"), "utf8")
    expect(page).toContain("Local environments")
    expect(page).toMatch(/\.flex\s*\{\s*display: flex/)
    expect(page).toMatch(/\.rounded-lg\s*\{/)
    const manifest = JSON.parse(readFileSync(join(ui, ".mockups", "environments", "manifest.json"), "utf8")) as {
      components: string[]
    }
    expect(manifest.components).toEqual(["#components/ui/panel"])
  })
})
