import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"

export class EnvironmentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EnvironmentError"
  }
}

export type ProjectAlias = {
  name: string
  specifier: string
  dir: string | null
}

export type ConsumerRuntime = {
  tailwindNode: string
  tailwindOxide: string
  react: string
  reactServer: string
  tailwindVersion: string
  reactVersion: string
}

export type MockupProject = {
  root: string
  css: string
  tsconfig: string
  entry: string | null
  aliases: ProjectAlias[]
  pathPrefixes: string[]
  registries: Record<string, string>
  dependencies: Set<string>
  runtime: ConsumerRuntime
}

export type ProjectOptions = {
  cwd: string
  project?: string | undefined
  css?: string | undefined
}

export type TsconfigPaths = {
  base: string
  entries: { pattern: string; target: string }[]
}

const JSONC = /("(?:\\[\s\S]|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\/|,(\s*[}\]])/g

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export function parseJsonc(text: string): unknown {
  return JSON.parse(text.replace(JSONC, (_match: string, quoted?: string, tail?: string) => quoted ?? tail ?? ""))
}

function readJsonc(path: string): unknown {
  return parseJsonc(readFileSync(path, "utf8"))
}

export function toPosix(path: string): string {
  return path.replaceAll("\\", "/")
}

export function displayPath(path: string, cwd: string): string {
  const shown = relative(cwd, path)
  return toPosix(shown === "" ? "." : shown)
}

function findUp(start: string, name: string): string | null {
  let current = resolve(start)
  for (;;) {
    const candidate = join(current, name)
    if (existsSync(candidate)) return candidate
    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}

function readComponents(path: string): {
  css: string | null
  aliases: Record<string, string>
  registries: Record<string, string>
} {
  const parsed = readJsonc(path)
  const document = isRecord(parsed) ? parsed : {}
  const tailwind = isRecord(document["tailwind"]) ? document["tailwind"] : {}
  const rawAliases = isRecord(document["aliases"]) ? document["aliases"] : {}
  const aliases: Record<string, string> = {}
  for (const [name, value] of Object.entries(rawAliases)) {
    if (typeof value === "string") aliases[name] = value
  }
  const rawRegistries = isRecord(document["registries"]) ? document["registries"] : {}
  const registries: Record<string, string> = {}
  for (const [name, value] of Object.entries(rawRegistries)) {
    if (typeof value === "string") registries[name] = value
  }
  const css = typeof tailwind["css"] === "string" ? tailwind["css"] : null
  return { css, aliases, registries }
}

function extendsOf(path: string): string | null {
  const parsed = readJsonc(path)
  const document = isRecord(parsed) ? parsed : {}
  const extended = document["extends"]
  if (typeof extended !== "string" || !extended.startsWith(".")) return null
  const candidate = resolve(dirname(path), extended)
  if (existsSync(candidate)) return candidate
  return existsSync(`${candidate}.json`) ? `${candidate}.json` : null
}

function setsJsx(tsconfig: string): boolean {
  const parsed = readJsonc(tsconfig)
  const compiler = isRecord(parsed) && isRecord(parsed["compilerOptions"]) ? parsed["compilerOptions"] : {}
  if (typeof compiler["jsx"] === "string") return true
  const parent = extendsOf(tsconfig)
  return parent !== null && setsJsx(parent)
}

// A root tsconfig.json that only lists references (Vite's template keeps the app's options in tsconfig.app.json)
// can't type-check a .tsx file on its own: use the referenced config that sets jsx, as tsc -b would.
export function checkTsconfig(tsconfig: string): string {
  const parsed = readJsonc(tsconfig)
  const references = isRecord(parsed) && Array.isArray(parsed["references"]) ? parsed["references"] : []
  if (references.length === 0 || setsJsx(tsconfig)) return tsconfig
  for (const reference of references) {
    if (!isRecord(reference) || typeof reference["path"] !== "string") continue
    const target = resolve(dirname(tsconfig), reference["path"])
    const file = existsSync(target) && statSync(target).isDirectory() ? join(target, "tsconfig.json") : target
    if (existsSync(file) && setsJsx(file)) return file
  }
  return tsconfig
}

export function readTsconfigPaths(tsconfig: string): TsconfigPaths {
  const parsed = readJsonc(tsconfig)
  const document = isRecord(parsed) ? parsed : {}
  const compiler = isRecord(document["compilerOptions"]) ? document["compilerOptions"] : {}
  const base =
    typeof compiler["baseUrl"] === "string" ? resolve(dirname(tsconfig), compiler["baseUrl"]) : dirname(tsconfig)
  const paths = isRecord(compiler["paths"]) ? compiler["paths"] : {}
  const entries: TsconfigPaths["entries"] = []
  for (const [pattern, targets] of Object.entries(paths)) {
    if (!Array.isArray(targets)) continue
    for (const target of targets) {
      if (typeof target === "string") entries.push({ pattern, target })
    }
  }
  if (entries.length > 0) return { base, entries }
  const parent = extendsOf(tsconfig)
  return parent === null ? { base, entries } : readTsconfigPaths(parent)
}

function aliasDirectory(specifier: string, paths: TsconfigPaths): string | null {
  for (const { pattern, target } of paths.entries) {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -1)
      if (!`${specifier}/`.startsWith(prefix)) continue
      const rest = specifier.slice(prefix.length - 1)
      const dir = resolve(paths.base, `${target.replace(/\/?\*$/, "")}/${rest}`)
      return existsSync(dir) ? dir : null
    }
    if (specifier === pattern) {
      const dir = resolve(paths.base, target)
      return existsSync(dir) ? dir : null
    }
  }
  return null
}

function aliasesFromPaths(paths: TsconfigPaths): ProjectAlias[] {
  const aliases: ProjectAlias[] = []
  for (const { pattern, target } of paths.entries) {
    if (!pattern.endsWith("/*")) continue
    const specifier = pattern.slice(0, -2)
    if (aliases.some((alias) => alias.specifier === specifier)) continue
    const dir = resolve(paths.base, target.replace(/\/?\*$/, ""))
    aliases.push({ name: specifier, specifier, dir: existsSync(dir) && statSync(dir).isDirectory() ? dir : null })
  }
  return aliases
}

function readAliases(declared: Record<string, string>, paths: TsconfigPaths): ProjectAlias[] {
  const aliases = Object.entries(declared).map(([name, specifier]) => ({
    name,
    specifier,
    dir: aliasDirectory(specifier, paths),
  }))
  for (const alias of aliases) {
    if (alias.dir !== null && !statSync(alias.dir).isDirectory()) alias.dir = null
  }
  return aliases
}

function findEntry(root: string, css: string): string | null {
  const cssDir = dirname(css)
  const candidates = [
    join(cssDir, "main.tsx"),
    join(cssDir, "index.tsx"),
    join(cssDir, "App.tsx"),
    join(cssDir, "app.tsx"),
    join(root, "src", "main.tsx"),
    join(root, "src", "index.tsx"),
    join(root, "src", "App.tsx"),
    join(root, "app", "page.tsx"),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  const html = join(root, "index.html")
  if (existsSync(html)) {
    const script = readFileSync(html, "utf8").match(/<script[^>]+src=["']([^"']+)["']/i)
    if (script?.[1] !== undefined) {
      const resolved = resolve(root, script[1])
      if (existsSync(resolved)) return resolved
    }
  }
  return null
}

function readDependencies(root: string): Set<string> {
  const names = new Set<string>()
  const path = join(root, "package.json")
  if (!existsSync(path)) return names
  const parsed = readJsonc(path)
  const document = isRecord(parsed) ? parsed : {}
  for (const key of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    const field = document[key]
    if (!isRecord(field)) continue
    for (const name of Object.keys(field)) names.add(name)
  }
  return names
}

function packageDirectory(base: string, specifier: string): string | null {
  const require = createRequire(join(base, "package.json"))
  try {
    return dirname(realpathSync(require.resolve(`${specifier}/package.json`)))
  } catch {
    return packageDirectoryOfEntry(require, specifier)
  }
}

// Some packages don't export their package.json, so the entry's directory is walked up to the first manifest.
function packageDirectoryOfEntry(require: NodeRequire, specifier: string): string | null {
  let current: string
  try {
    current = dirname(realpathSync(require.resolve(specifier)))
  } catch {
    return null
  }
  for (;;) {
    if (existsSync(join(current, "package.json"))) return current
    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}

function packageEntry(base: string, specifier: string): string | null {
  const require = createRequire(join(base, "package.json"))
  try {
    return require.resolve(specifier)
  } catch {
    return null
  }
}

function throughTailwindPlugin(base: string, specifier: string): string | null {
  for (const plugin of ["@tailwindcss/vite", "@tailwindcss/postcss"]) {
    const pluginDir = packageDirectory(base, plugin)
    if (pluginDir === null) continue
    const found = packageDirectory(pluginDir, specifier)
    if (found !== null) return found
  }
  return null
}

function firstPresent<T>(bases: string[], find: (base: string) => T | null): T | null {
  for (const base of bases) {
    const found = find(base)
    if (found !== null) return found
  }
  return null
}

function readVersion(directory: string): string {
  const parsed = readJsonc(join(directory, "package.json"))
  const document = isRecord(parsed) ? parsed : {}
  return typeof document["version"] === "string" ? document["version"] : "unknown"
}

function resolveRuntime(bases: string[], root: string): ConsumerRuntime {
  const tailwindNode =
    firstPresent(bases, (base) => packageDirectory(base, "@tailwindcss/node")) ??
    firstPresent(bases, (base) => throughTailwindPlugin(base, "@tailwindcss/node"))
  const tailwindOxide =
    (tailwindNode === null ? null : packageDirectory(tailwindNode, "@tailwindcss/oxide")) ??
    firstPresent(bases, (base) => packageDirectory(base, "@tailwindcss/oxide")) ??
    firstPresent(bases, (base) => throughTailwindPlugin(base, "@tailwindcss/oxide"))
  if (tailwindNode === null || tailwindOxide === null) {
    throw new EnvironmentError(
      `Tailwind is not installed for ${root}: add tailwindcss (with @tailwindcss/node and @tailwindcss/oxide) or @tailwindcss/vite to the project.`,
    )
  }
  const reactDir = firstPresent(bases, (base) => packageDirectory(base, "react"))
  const reactDomDir = firstPresent(bases, (base) => packageDirectory(base, "react-dom"))
  const reactEntry = firstPresent(bases, (base) => packageEntry(base, "react"))
  if (reactDir === null || reactDomDir === null || reactEntry === null) {
    throw new EnvironmentError(`React is not installed for ${root}: add react and react-dom to the project.`)
  }
  const reactServer =
    packageEntry(reactDomDir, "react-dom/server") ??
    firstPresent(bases, (base) => packageEntry(base, "react-dom/server"))
  if (reactServer === null) throw new EnvironmentError(`react-dom/server does not resolve from ${reactDomDir}`)

  const tailwindPackage = firstPresent(bases, (base) => packageDirectory(base, "tailwindcss"))
  return {
    tailwindNode: packageEntry(tailwindNode, "@tailwindcss/node") ?? join(tailwindNode, "dist", "index.mjs"),
    tailwindOxide: packageEntry(tailwindOxide, "@tailwindcss/oxide") ?? join(tailwindOxide, "index.js"),
    react: reactEntry,
    reactServer,
    tailwindVersion: tailwindPackage === null ? readVersion(tailwindNode) : readVersion(tailwindPackage),
    reactVersion: readVersion(reactDir),
  }
}

export function findProject(options: ProjectOptions): MockupProject {
  const start = options.project === undefined ? resolve(options.cwd) : resolve(options.cwd, options.project)
  const componentsFile =
    options.project === undefined
      ? findUp(start, "components.json")
      : existsSync(join(start, "components.json"))
        ? join(start, "components.json")
        : null
  if (componentsFile === null && options.css === undefined) {
    throw new EnvironmentError(`no components.json in ${start} or above it; pass --project <dir> or --css <stylesheet>`)
  }
  const root = componentsFile === null ? start : dirname(componentsFile)
  const components =
    componentsFile === null ? { css: null, aliases: {}, registries: {} } : readComponents(componentsFile)
  const css =
    options.css === undefined
      ? components.css === null
        ? null
        : resolve(root, components.css)
      : resolve(options.cwd, options.css)
  if (css === null) throw new EnvironmentError(`${componentsFile} has no tailwind.css; pass --css <stylesheet>`)
  if (!existsSync(css)) throw new EnvironmentError(`the stylesheet ${css} does not exist`)

  const tsconfig = findUp(dirname(css), "tsconfig.json") ?? findUp(root, "tsconfig.json")
  if (tsconfig === null) {
    throw new EnvironmentError(`no tsconfig.json above ${root}; the mockup reads the project's aliases from it`)
  }
  const paths = readTsconfigPaths(tsconfig)
  const aliases = componentsFile === null ? aliasesFromPaths(paths) : readAliases(components.aliases, paths)
  const pathPrefixes = [
    ...new Set(paths.entries.map(({ pattern }) => (pattern.endsWith("/*") ? pattern.slice(0, -1) : pattern))),
  ]
  const entry = findEntry(root, css)
  const bases = [root, dirname(css)]
  if (entry !== null) bases.push(dirname(entry))
  return {
    root,
    css,
    tsconfig,
    entry,
    aliases,
    pathPrefixes,
    registries: components.registries,
    dependencies: readDependencies(root),
    runtime: resolveRuntime([...new Set(bases)], root),
  }
}

export function mockupDirectory(project: MockupProject, name: string): string {
  return join(project.root, ".mockups", name)
}

export function aliasOf(project: MockupProject, file: string): ProjectAlias | null {
  for (const alias of project.aliases) {
    if (alias.dir === null) continue
    const shown = relative(alias.dir, file)
    if (shown.startsWith("..") || isAbsolute(shown)) continue
    return alias
  }
  return null
}

export function specifierOf(project: MockupProject, file: string): string | null {
  const alias = aliasOf(project, file)
  if (alias === null || alias.dir === null) return null
  const shown = toPosix(relative(alias.dir, file)).replace(/\.(tsx|ts|jsx|js)$/, "")
  return `${alias.specifier}/${shown}`
}

export function packageDirectoryOf(root: string, specifier: string): string | null {
  return packageDirectory(root, specifier)
}

const SKIPPED_DIRECTORIES = new Set(["node_modules", ".mockups", ".git", "dist", "build", "coverage", ".next"])

function pathRoots(project: MockupProject): string[] {
  const paths = readTsconfigPaths(project.tsconfig)
  const roots = new Set<string>()
  for (const { target } of paths.entries) {
    const star = target.indexOf("*")
    const fixed = star === -1 ? target : target.slice(0, star)
    const root = resolve(paths.base, fixed)
    if (existsSync(root)) roots.add(root)
  }
  for (const alias of project.aliases) if (alias.dir !== null) roots.add(alias.dir)
  return [...roots]
}

function sourceFile(path: string): boolean {
  if (!/\.(tsx?|jsx?)$/.test(path)) return false
  if (/\.(test|spec)\./.test(path) || path.endsWith(".d.ts")) return false
  return true
}

function walkSources(root: string, found: Set<string>, depth: number) {
  if (depth > 12 || !existsSync(root)) return
  const stats = statSync(root)
  if (!stats.isDirectory()) {
    if (sourceFile(root)) found.add(root)
    return
  }
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIPPED_DIRECTORIES.has(entry.name)) continue
    const path = join(root, entry.name)
    if (entry.isDirectory()) walkSources(path, found, depth + 1)
    else if (sourceFile(path)) found.add(path)
  }
}

export function projectSourceFiles(project: MockupProject): string[] {
  const found = new Set<string>()
  for (const root of pathRoots(project)) walkSources(root, found, 0)
  return [...found].toSorted()
}

export function sourceBasenames(files: string[]): Set<string> {
  return new Set(
    files.map(
      (file) =>
        toPosix(file)
          .split("/")
          .at(-1)
          ?.replace(/\.(tsx|ts|jsx|js)$/, "") ?? "",
    ),
  )
}
