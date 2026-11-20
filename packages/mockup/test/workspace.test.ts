import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterAll, describe, expect, test } from "vitest"

import { workspaceStylesheet } from "../src/build"
import { mappedDirectory, mapPrefixes, matchMap, SOURCE_CONDITIONS } from "../src/package-map"
import { EnvironmentError, findProject, projectSourceFiles, specifierOf } from "../src/project"
import { registryMissing } from "../src/registry"
import { findWorkspace, pnpmWorkspaceGlobs, storePackages } from "../src/workspace"

const made: string[] = []

afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true })
})

function tempDir(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "mockup-workspace-")))
  made.push(dir)
  return dir
}

function write(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function json(path: string, value: unknown) {
  write(path, `${JSON.stringify(value, null, 2)}\n`)
}

const BUILD_PACKAGES = ["tailwindcss", "@tailwindcss/node", "@tailwindcss/oxide", "react", "react-dom"]

// A stand-in for an installed package: enough for the CLI to find it, read its version and resolve its entries.
function fakePackage(dir: string, name: string, version: string) {
  const manifest: Record<string, unknown> = { name, version, main: "index.js" }
  if (name === "tailwindcss") {
    manifest["exports"] = {
      ".": { style: "./index.css", default: "./index.js" },
      "./theme.css": "./theme.css",
      "./package.json": "./package.json",
    }
    write(join(dir, "index.css"), "@layer theme, base, components, utilities;\n")
    write(join(dir, "theme.css"), "@theme {}\n")
  }
  if (name === "react-dom") write(join(dir, "server.js"), "module.exports = {}\n")
  json(join(dir, "package.json"), manifest)
  write(join(dir, "index.js"), "module.exports = {}\n")
}

function link(target: string, path: string) {
  mkdirSync(dirname(path), { recursive: true })
  symlinkSync(target, path, "junction")
}

type Layout = "npm-hoisted" | "npm-nested" | "bun" | "pnpm"

// A workspace whose components.json lives in packages/ui, while only apps/web (and apps/desktop, at another
// version) installs Tailwind and React, laid out the way each package manager writes node_modules.
function monorepo(layout: Layout): string {
  const root = tempDir()
  const globs = ["apps/*", "packages/*"]
  if (layout === "pnpm") {
    json(join(root, "package.json"), { name: "workspace", private: true })
    write(
      join(root, "pnpm-workspace.yaml"),
      "packages:\n  - 'apps/*' # the apps\n  - \"packages/*\"\ncatalog:\n  react: 19.0.0\n",
    )
  } else {
    json(join(root, "package.json"), {
      name: "workspace",
      private: true,
      workspaces: layout === "bun" ? { packages: globs } : globs,
    })
  }
  const ui = join(root, "packages", "ui")
  json(join(ui, "package.json"), { name: "@workspace/ui", peerDependencies: { react: "*" } })
  json(join(ui, "components.json"), {
    tailwind: { css: "src/styles.css" },
    aliases: { components: "@/components", ui: "@/components/ui", lib: "@/lib" },
  })
  json(join(ui, "tsconfig.json"), {
    compilerOptions: { jsx: "react-jsx", baseUrl: ".", paths: { "@/*": ["./src/*"] } },
  })
  write(join(ui, "src", "styles.css"), '@import "tailwindcss";\n')
  write(join(ui, "src", "components", "ui", "button.tsx"), "export function Button() {\n  return null\n}\n")
  for (const app of ["web", "desktop"]) {
    json(join(root, "apps", app, "package.json"), { name: `@workspace/${app}` })
    json(join(root, "apps", app, "tsconfig.json"), { compilerOptions: { types: ["vite/client"] } })
    write(join(root, "apps", app, "src", "styles.css"), '@import "@workspace/ui/styles.css";\n')
  }
  for (const name of BUILD_PACKAGES) {
    if (layout === "npm-hoisted") fakePackage(join(root, "node_modules", name), name, "4.9.0")
    if (layout === "npm-nested") fakePackage(join(root, "apps", "web", "node_modules", name), name, "4.9.0")
    if (layout === "bun" || layout === "pnpm") {
      const entry = join(root, "node_modules", `.${layout}`, `${name.replace("/", "+")}@4.9.0`, "node_modules")
      fakePackage(join(entry, name), name, "4.9.0")
      // @tailwindcss/oxide is a dependency of @tailwindcss/node, linked beside it in the store, not in the app.
      if (name !== "@tailwindcss/oxide") link(join(entry, name), join(root, "apps", "web", "node_modules", name))
    }
  }
  if (layout === "bun" || layout === "pnpm") {
    const store = join(root, "node_modules", `.${layout}`)
    link(
      join(store, "@tailwindcss+oxide@4.9.0", "node_modules", "@tailwindcss", "oxide"),
      join(store, "@tailwindcss+node@4.9.0", "node_modules", "@tailwindcss", "oxide"),
    )
  }
  return root
}

describe("package maps", () => {
  const map = {
    "#components/*": {
      types: "./dist/components/*.d.ts",
      import: "./src/components/*.tsx",
      default: "./src/components/*.tsx",
    },
    "#components/ui/*": ["./src/ui/*.tsx"],
    "#lib/*": "./src/lib/*",
    "#styles/*.css": "./src/styles/*.css",
    "#utils": { node: "./src/utils.node.ts", default: "./src/utils.ts" },
  }

  test("resolves exact keys, conditions in key order, fallback arrays and the longest pattern", () => {
    expect(matchMap(map, "#components/card", SOURCE_CONDITIONS)).toBe("./src/components/card.tsx")
    expect(matchMap(map, "#components/ui/button", SOURCE_CONDITIONS)).toBe("./src/ui/button.tsx")
    expect(matchMap(map, "#lib/utils", SOURCE_CONDITIONS)).toBe("./src/lib/utils")
    expect(matchMap(map, "#styles/theme.css", SOURCE_CONDITIONS)).toBe("./src/styles/theme.css")
    expect(matchMap(map, "#styles/theme.js", SOURCE_CONDITIONS)).toBeNull()
    expect(matchMap(map, "#utils", SOURCE_CONDITIONS)).toBe("./src/utils.node.ts")
    expect(matchMap(map, "#utils", ["types"])).toBeNull()
    expect(matchMap(map, "#missing", SOURCE_CONDITIONS)).toBeNull()
  })

  test("finds the folder an alias stands for, and the prefixes imports go through", () => {
    expect(mappedDirectory(map, "#components", SOURCE_CONDITIONS)).toBe("./src/components")
    expect(mappedDirectory(map, "#components/ui", SOURCE_CONDITIONS)).toBe("./src/ui")
    expect(mappedDirectory(map, "#lib", SOURCE_CONDITIONS)).toBe("./src/lib")
    expect(mappedDirectory({ "#ui": "./src/ui" }, "#ui", SOURCE_CONDITIONS)).toBe("./src/ui")
    expect(mapPrefixes(map)).toEqual(["#components/", "#components/ui/", "#lib/", "#styles/", "#utils"])
  })
})

describe("workspaces", { timeout: 60_000 }, () => {
  test("reads pnpm-workspace.yaml without a YAML parser", () => {
    expect(
      pnpmWorkspaceGlobs("packages:\n  - 'apps/*' # apps\n  - \"packages/**\"\n  - '!**/test/**'\nonly: 1\n"),
    ).toEqual(["apps/*", "packages/**", "!**/test/**"])
    expect(pnpmWorkspaceGlobs("packages: [apps/*, 'tools/cli']\n")).toEqual(["apps/*", "tools/cli"])
  })

  test.each(["npm-hoisted", "bun", "pnpm"] as const)("finds the %s workspace and its packages", (layout) => {
    const root = monorepo(layout)
    expect(findWorkspace(join(root, "packages", "ui"))).toEqual({
      root,
      packages: [join(root, "apps", "desktop"), join(root, "apps", "web"), join(root, "packages", "ui")],
    })
  })

  test("finds a package in pnpm's and Bun's stores, newest first", () => {
    const root = tempDir()
    for (const entry of ["react@18.3.1", "react@19.0.0_scheduler@0.25.0", "react-dom@19.0.0"]) {
      const name = entry.startsWith("react-dom") ? "react-dom" : "react"
      fakePackage(join(root, "node_modules", ".pnpm", entry, "node_modules", name), name, entry.slice(name.length + 1))
    }
    fakePackage(
      join(root, "node_modules", ".bun", "@scope+pkg@1.0.0+abc", "node_modules", "@scope", "pkg"),
      "@scope/pkg",
      "1.0.0",
    )
    expect(storePackages(root, "react").map((entry) => entry.version)).toEqual(["19.0.0", "18.3.1"])
    expect(storePackages(root, "@scope/pkg")[0]?.dir).toBe(
      join(root, "node_modules", ".bun", "@scope+pkg@1.0.0+abc", "node_modules", "@scope", "pkg"),
    )
  })
})

describe("a components package in a workspace", { timeout: 60_000 }, () => {
  test.each(["npm-hoisted", "npm-nested", "bun", "pnpm"] as const)(
    "resolves Tailwind and React that only an app installs (%s)",
    (layout) => {
      const root = monorepo(layout)
      const ui = join(root, "packages", "ui")
      const project = findProject({ cwd: ui })
      expect(project.root).toBe(ui)
      expect(project.runtime.tailwindVersion).toBe("4.9.0")
      expect(project.runtime.reactVersion).toBe("4.9.0")
      expect(project.runtime.tailwindPackage).not.toBeNull()
      // Hoisted, Tailwind's own resolver finds it from the stylesheet; otherwise the workspace's copy stands in.
      const fromWorkspace = (file: string) =>
        layout === "npm-hoisted" ? undefined : join(project.runtime.tailwindPackage ?? "", file)
      expect(workspaceStylesheet(project, "tailwindcss", join(ui, "src"))).toBe(fromWorkspace("index.css"))
      expect(workspaceStylesheet(project, "tailwindcss/theme.css", join(ui, "src"))).toBe(fromWorkspace("theme.css"))
      expect(workspaceStylesheet(project, "./local.css", join(ui, "src"))).toBeUndefined()
    },
  )

  test("--css chooses only the stylesheet: the tsconfig stays the project's", () => {
    const root = monorepo("npm-nested")
    const ui = join(root, "packages", "ui")
    const project = findProject({ cwd: ui, css: join(root, "apps", "web", "src", "styles.css") })
    expect(project.css).toBe(join(root, "apps", "web", "src", "styles.css"))
    expect(project.tsconfig).toBe(join(ui, "tsconfig.json"))
    const chosen = findProject({ cwd: ui, tsconfig: join(root, "apps", "web", "tsconfig.json") })
    expect(chosen.tsconfig).toBe(join(root, "apps", "web", "tsconfig.json"))
    expect(() => findProject({ cwd: ui, tsconfig: "missing.json" })).toThrowError(/--tsconfig .* does not exist/)
  })

  test("--tailwind forces the folder Tailwind resolves from", () => {
    const root = monorepo("npm-nested")
    for (const name of BUILD_PACKAGES.slice(0, 3)) {
      fakePackage(join(root, "apps", "desktop", "node_modules", name), name, "4.8.0")
    }
    const ui = join(root, "packages", "ui")
    expect(findProject({ cwd: ui, tailwind: join(root, "apps", "web") }).runtime.tailwindVersion).toBe("4.9.0")
    expect(
      findProject({ cwd: ui, tailwind: join(root, "apps", "desktop", "node_modules") }).runtime.tailwindVersion,
    ).toBe("4.8.0")
    expect(() => findProject({ cwd: ui, tailwind: ui })).toThrowError(EnvironmentError)
    expect(() => findProject({ cwd: ui, tailwind: ui })).toThrowError(/--tailwind .* do not resolve from it/)
  })

  test("without Tailwind anywhere, the error names --tailwind", () => {
    const root = monorepo("npm-nested")
    rmSync(join(root, "apps", "web", "node_modules", "@tailwindcss"), { recursive: true, force: true })
    expect(() => findProject({ cwd: join(root, "packages", "ui") })).toThrowError(/--tailwind <dir>/)
  })
})

function registryItem(name: string, path: string) {
  return { name, type: "registry:ui", files: [{ path, type: "registry:ui" }] }
}

function importsProject(): string {
  const root = monorepo("npm-hoisted")
  const ui = join(root, "packages", "ui")
  json(join(ui, "package.json"), {
    name: "@workspace/ui",
    imports: {
      "#components/*": {
        types: "./dist/types/components/*.d.ts",
        import: "./src/components/*.tsx",
        default: "./src/components/*.tsx",
      },
      "#lib/*": "./src/lib/*.ts",
      "#hooks/*": ["./src/hooks/*.ts"],
    },
  })
  json(join(ui, "tsconfig.json"), {
    compilerOptions: { jsx: "react-jsx", module: "esnext", moduleResolution: "bundler" },
  })
  json(join(ui, "components.json"), {
    tailwind: { css: "src/styles.css" },
    aliases: {
      components: "#components",
      ui: "#components/ui",
      lib: "#lib",
      utils: "#lib/utils",
      hooks: "#hooks",
    },
    registries: { "@eskais": "./r/{name}.json" },
  })
  write(join(ui, "src", "lib", "utils.ts"), "export const cn = (...names: string[]) => names.join(' ')\n")
  write(join(ui, "src", "hooks", "use-mobile.ts"), "export function useMobile() {\n  return false\n}\n")
  write(join(ui, "src", "components", "ui", "card.tsx"), "export function Card() {\n  return null\n}\n")
  json(join(ui, "r", "registry.json"), {
    items: [
      registryItem("button", "registry/ui/button.tsx"),
      registryItem("card", "registry/ui/card.tsx"),
      registryItem("utils", "registry/lib/utils.ts"),
      registryItem("use-mobile", "registry/hooks/use-mobile.ts"),
      registryItem("badge", "registry/ui/badge.tsx"),
      registryItem("dialog", "registry/ui/dialog.tsx"),
    ],
  })
  return ui
}

describe("aliases through package.json imports", { timeout: 60_000 }, () => {
  test("finds each alias's folder, with conditions and wildcards", () => {
    const ui = importsProject()
    const project = findProject({ cwd: ui })
    expect(project.aliases).toEqual([
      { name: "components", specifier: "#components", dir: join(ui, "src", "components") },
      { name: "ui", specifier: "#components/ui", dir: join(ui, "src", "components", "ui") },
      { name: "lib", specifier: "#lib", dir: join(ui, "src", "lib") },
      { name: "utils", specifier: "#lib/utils", dir: null },
      { name: "hooks", specifier: "#hooks", dir: join(ui, "src", "hooks") },
    ])
    expect(project.pathPrefixes).toEqual(["#components/", "#lib/", "#hooks/"])
    const files = projectSourceFiles(project)
    const button = join(ui, "src", "components", "ui", "button.tsx")
    expect(files).toContain(button)
    expect(files).toContain(join(ui, "src", "hooks", "use-mobile.ts"))
    expect(specifierOf(project, button)).toBe("#components/ui/button")
  })

  test("a project without components.json takes its aliases from the imports", () => {
    const ui = importsProject()
    rmSync(join(ui, "components.json"))
    const project = findProject({ cwd: ui, project: ui, css: "src/styles.css" })
    expect(project.aliases.map((alias) => [alias.specifier, alias.dir])).toEqual([
      ["#components", join(ui, "src", "components")],
      ["#lib", join(ui, "src", "lib")],
      ["#hooks", join(ui, "src", "hooks")],
    ])
  })

  test("counts the installed registry items as installed", async () => {
    const ui = importsProject()
    const [source] = await registryMissing(findProject({ cwd: ui }))
    expect(source?.total).toBe(6)
    expect(source?.items.map((item) => item.name)).toEqual(["badge", "dialog"])
  })
})
