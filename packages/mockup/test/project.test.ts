import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, test } from "vitest"

import { EnvironmentError, findProject, parseJsonc, readTsconfigPaths } from "../src/project"

const repo = process.cwd()
const consumer = join(repo, "apps", "showcase")
const made: string[] = []

function createProject(components: unknown | null, base = consumer) {
  const root = mkdtempSync(join(base, ".mockup-project-"))
  made.push(root)
  mkdirSync(join(root, "src"), { recursive: true })
  for (const dir of ["ui", "blocks", "lib"]) mkdirSync(join(root, "src", dir), { recursive: true })
  writeFileSync(join(root, "src", "index.css"), '@import "tailwindcss";\n')
  writeFileSync(join(root, "src", "main.tsx"), "export default function App() {\n  return null\n}\n")
  writeFileSync(
    join(root, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@/components/ui/*": ["./src/ui/*"],
            "@/components/*": ["./src/blocks/*"],
            "@/lib/*": ["./src/lib/*"],
          },
        },
      },
      null,
      2,
    ),
  )
  if (components !== null) writeFileSync(join(root, "components.json"), JSON.stringify(components, null, 2))
  return root
}

afterAll(() => {
  for (const root of made) rmSync(root, { recursive: true, force: true })
})

describe("findProject", () => {
  test("walks up from the working directory to components.json", () => {
    const root = createProject({
      tailwind: { css: "src/index.css" },
      aliases: { components: "@/components", ui: "@/components/ui", lib: "@/lib" },
    })
    const project = findProject({ cwd: join(root, "src", "ui") })
    expect(project.root).toBe(root)
    expect(project.css).toBe(join(root, "src", "index.css"))
    expect(project.tsconfig).toBe(join(root, "tsconfig.json"))
    expect(project.entry).toBe(join(root, "src", "main.tsx"))
    expect(project.aliases).toEqual([
      { name: "components", specifier: "@/components", dir: join(root, "src", "blocks") },
      { name: "ui", specifier: "@/components/ui", dir: join(root, "src", "ui") },
      { name: "lib", specifier: "@/lib", dir: join(root, "src", "lib") },
    ])
    expect(project.runtime.reactVersion).toMatch(/^\d+\./)
    expect(project.runtime.tailwindVersion).toMatch(/^\d+\./)
  })

  test("falls back to --css without components.json", () => {
    const root = createProject(null)
    const project = findProject({ cwd: root, project: root, css: "src/index.css" })
    expect(project.root).toBe(root)
    expect(project.css).toBe(join(root, "src", "index.css"))
    expect(project.aliases.map((alias) => alias.dir)).toEqual([
      join(root, "src", "ui"),
      join(root, "src", "blocks"),
      join(root, "src", "lib"),
    ])
  })

  test("a missing stylesheet is an environment error", () => {
    const root = createProject({ tailwind: { css: "src/missing.css" } }, tmpdir())
    expect(() => findProject({ cwd: root })).toThrowError(EnvironmentError)
    expect(() => findProject({ cwd: root, css: "src/missing.css" })).toThrowError(/does not exist/)
  })

  test("no components.json and no --css is an environment error that names both ways", () => {
    const root = mkdtempSync(join(tmpdir(), "mockup-project-"))
    made.push(root)
    expect(() => findProject({ cwd: root })).toThrowError(/--project <dir> or --css <stylesheet>/)
  })
})

describe("parseJsonc", () => {
  test("reads comments and trailing commas", () => {
    const document = parseJsonc('{\n  // a line comment\n  "a": "http://x//y",\n  /* a block */\n  "b": [1, 2,],\n}\n')
    expect(document).toEqual({ a: "http://x//y", b: [1, 2] })
  })
})

describe("readTsconfigPaths", () => {
  test("reads the paths next to their base", () => {
    const root = createProject(null)
    const paths = readTsconfigPaths(join(root, "tsconfig.json"))
    expect(paths.base).toBe(root)
    expect(paths.entries).toContainEqual({ pattern: "@/components/ui/*", target: "./src/ui/*" })
  })
})
