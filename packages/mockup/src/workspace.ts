import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return null
  }
}

function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory()
}

export function packageRootOf(path: string): string | null {
  let current = isDirectory(path) ? resolve(path) : dirname(resolve(path))
  for (;;) {
    if (existsSync(join(current, "package.json"))) return current
    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}

/** The `packages:` list of a pnpm-workspace.yaml, without a YAML parser: one `- glob` per line. */
export function pnpmWorkspaceGlobs(text: string): string[] {
  const globs: string[] = []
  let inPackages = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "")
    if (/^packages\s*:/.test(line)) {
      inPackages = true
      const inline = /\[(.*)\]/.exec(line)?.[1]
      if (inline !== undefined) {
        globs.push(...inline.split(",").map((entry) => entry.trim().replaceAll(/^["']|["']$/g, "")))
        inPackages = false
      }
      continue
    }
    if (!inPackages) continue
    if (/^\S/.test(line)) {
      inPackages = false
      continue
    }
    const item = /^\s*-\s*(.+?)\s*$/.exec(line)?.[1]
    if (item !== undefined) globs.push(item.replaceAll(/^["']|["']$/g, ""))
  }
  return globs.filter((glob) => glob !== "")
}

function workspaceGlobs(dir: string): string[] | null {
  const pnpm = join(dir, "pnpm-workspace.yaml")
  if (existsSync(pnpm)) return pnpmWorkspaceGlobs(readFileSync(pnpm, "utf8"))
  const manifest = readJson(join(dir, "package.json"))
  if (!isRecord(manifest)) return null
  const workspaces = manifest["workspaces"]
  if (Array.isArray(workspaces)) return workspaces.filter((entry): entry is string => typeof entry === "string")
  if (isRecord(workspaces) && Array.isArray(workspaces["packages"])) {
    return workspaces["packages"].filter((entry): entry is string => typeof entry === "string")
  }
  return null
}

export type Workspace = { root: string; packages: string[] }

/**
 * The nearest folder above `start` that declares workspaces (npm, Yarn and Bun's package.json `workspaces`,
 * or pnpm-workspace.yaml), with the folder of every package it lists.
 */
export function findWorkspace(start: string): Workspace | null {
  let current = resolve(start)
  for (;;) {
    const globs = workspaceGlobs(current)
    if (globs !== null) return { root: current, packages: expandGlobs(current, globs) }
    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}

const SKIPPED = new Set(["node_modules", ".git", "dist", "build", ".mockups"])

function expandSegments(base: string, segments: string[], found: Set<string>, depth: number) {
  if (depth > 8) return
  if (segments.length === 0) {
    if (existsSync(join(base, "package.json"))) found.add(base)
    return
  }
  const [segment = "", ...rest] = segments
  if (segment === "**") {
    expandSegments(base, rest, found, depth + 1)
    for (const child of childDirectories(base)) expandSegments(child, segments, found, depth + 1)
    return
  }
  if (!segment.includes("*")) {
    const next = join(base, segment)
    if (isDirectory(next)) expandSegments(next, rest, found, depth + 1)
    return
  }
  const pattern = new RegExp(`^${segment.replaceAll(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*")}$`)
  for (const child of childDirectories(base)) {
    if (pattern.test(child.slice(base.length + 1))) expandSegments(child, rest, found, depth + 1)
  }
}

function childDirectories(dir: string): string[] {
  if (!isDirectory(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !SKIPPED.has(entry.name))
    .map((entry) => join(dir, entry.name))
}

export function expandGlobs(root: string, globs: string[]): string[] {
  const found = new Set<string>()
  const excluded = new Set<string>()
  for (const glob of globs) {
    const negated = glob.startsWith("!")
    const segments = glob
      .replace(/^!/, "")
      .replace(/^\.\//, "")
      .split("/")
      .filter((segment) => segment !== "" && segment !== ".")
    expandSegments(root, segments, negated ? excluded : found, 0)
  }
  return [...found].filter((dir) => !excluded.has(dir)).toSorted()
}

function versionParts(version: string): number[] {
  return version.split(/[.-]/).map((part) => Number.parseInt(part, 10))
}

function compareVersions(left: string, right: string): number {
  const [a, b] = [versionParts(left), versionParts(right)]
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (Number.isNaN(difference)) continue
    if (difference !== 0) return difference
  }
  return 0
}

export type StoreEntry = { dir: string; from: string; version: string }

/**
 * A package that only another workspace package depends on, in pnpm's store (node_modules/.pnpm) or Bun's
 * isolated one (node_modules/.bun): `<store>/<name with + for />@<version>[_peers|+hash]/node_modules/<name>`.
 * `from` is a folder that resolves the package and its own dependencies, the newest version first.
 */
export function storePackages(root: string, name: string): StoreEntry[] {
  const encoded = name.replace("/", "+")
  const found: StoreEntry[] = []
  for (const store of [".pnpm", ".bun"]) {
    const dir = join(root, "node_modules", store)
    if (!isDirectory(dir)) continue
    for (const entry of readdirSync(dir)) {
      if (!entry.startsWith(`${encoded}@`)) continue
      const candidate = join(dir, entry, "node_modules", name)
      if (!existsSync(join(candidate, "package.json"))) continue
      const version = entry.slice(encoded.length + 1).split(/[_+(]/)[0] ?? ""
      found.push({ dir: realpathSync(candidate), from: join(dir, entry), version })
    }
  }
  return found.toSorted((left, right) => compareVersions(right.version, left.version))
}
