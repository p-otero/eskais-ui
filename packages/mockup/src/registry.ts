import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { importsOf } from "./checks"
import {
  displayPath,
  EnvironmentError,
  projectSourceFiles,
  readTsconfigPaths,
  sourceBasenames,
  toPosix,
  type MockupProject,
} from "./project"

export type RegistryItemFile = {
  path: string
  type?: string
  content?: string
}

export type RegistryItem = {
  name: string
  type?: string
  description?: string
  dependencies?: string[]
  registryDependencies?: string[]
  files?: RegistryItemFile[]
}

export type RegistryIndex = {
  items: RegistryItem[]
}

export type RegistrySource = {
  key: string
  template: string
  ref: string
  dir: string
  index: RegistryIndex
}

export type InstallEntry = {
  item: string
  command: string
}

type LoadedItem = {
  item: RegistryItem
  source: RegistrySource
  files: Map<string, string>
}

type RegistryLoad = {
  sources: RegistrySource[]
  items: Map<string, LoadedItem>
  cache: Map<string, LoadedItem>
}

export type PreparedRegistry = {
  install: InstallEntry[]
  cacheDirs: string[]
}

const FETCH_TIMEOUT = 20_000
const SOURCE_FILE = /\.(tsx|ts)$/

function parseDocument(text: string, label: string): unknown {
  try {
    return JSON.parse(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new EnvironmentError(`${label} is not JSON: ${message}`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asItem(value: unknown, label: string): RegistryItem {
  if (!isRecord(value) || typeof value["name"] !== "string") {
    throw new EnvironmentError(`${label} does not describe a registry item`)
  }
  return value as RegistryItem
}

function asIndex(value: unknown, label: string): RegistryIndex {
  if (!isRecord(value) || !Array.isArray(value["items"])) {
    throw new EnvironmentError(`${label} does not describe a registry index`)
  }
  return { items: value["items"].map((item) => asItem(item, label)) }
}

function registryRef(template: string): string {
  const commit = /\/([0-9a-f]{40})\//.exec(template)?.[1]
  return commit ?? createHash("sha1").update(template).digest("hex").slice(0, 12)
}

async function readRegistryText(project: MockupProject, template: string, name: string): Promise<string> {
  const href = template.replaceAll("{name}", name)
  if (/^https?:\/\//.test(href)) {
    let response: Response
    try {
      response = await fetch(href, { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new EnvironmentError(
        `could not reach the registry at ${href} (${message}); the cache under .mockups/.registry is reused when this succeeds once`,
      )
    }
    if (!response.ok) throw new EnvironmentError(`the registry at ${href} answered ${response.status}`)
    return await response.text()
  }
  const path = href.startsWith("file:") ? fileURLToPath(href) : isAbsolute(href) ? href : resolve(project.root, href)
  if (!existsSync(path)) throw new EnvironmentError(`the registry file ${path} does not exist`)
  return readFileSync(path, "utf8")
}

async function loadSource(project: MockupProject, key: string, template: string): Promise<RegistrySource> {
  if (!template.includes("{name}")) {
    throw new EnvironmentError(`the ${key} registry URL needs a {name} placeholder: ${template}`)
  }
  const ref = registryRef(template)
  const dir = join(project.root, ".mockups", ".registry", ref)
  const cached = join(dir, "registry.json")
  let text: string
  if (existsSync(cached)) {
    text = readFileSync(cached, "utf8")
  } else {
    text = await readRegistryText(project, template, "registry")
    mkdirSync(dir, { recursive: true })
    writeFileSync(cached, text)
  }
  return { key, template, ref, dir, index: asIndex(parseDocument(text, cached), cached) }
}

async function loadSources(project: MockupProject): Promise<RegistrySource[]> {
  const entries = Object.entries(project.registries)
  if (entries.length === 0) {
    throw new EnvironmentError(
      'components.json has no registries entry; add one, for example "registries": { "@eskais": "https://raw.githubusercontent.com/p-otero/eskais-ui/<ref>/public/r/{name}.json" }',
    )
  }
  return Promise.all(entries.map(([key, template]) => loadSource(project, key, template)))
}

function sourceBase(path: string): string {
  return basename(path).replace(/\.(tsx|ts)$/, "")
}

async function loadItem(project: MockupProject, load: RegistryLoad, name: string): Promise<LoadedItem> {
  const cached = load.cache.get(name)
  if (cached !== undefined) return cached
  const source = load.sources.find((candidate) => candidate.index.items.some((item) => item.name === name))
  if (source === undefined) {
    const known = load.sources.flatMap((candidate) => candidate.index.items.map((item) => item.name)).toSorted()
    throw new EnvironmentError(
      `no configured registry has the item "${name}"; available: ${known.slice(0, 12).join(", ")}${known.length > 12 ? ", …" : ""}`,
    )
  }
  const path = join(source.dir, "items", `${name}.json`)
  let text: string
  if (existsSync(path)) {
    text = readFileSync(path, "utf8")
  } else {
    text = await readRegistryText(project, source.template, name)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text)
  }
  const item = asItem(parseDocument(text, path), path)
  if (item.name !== name) throw new EnvironmentError(`${path} describes the item "${item.name}", not "${name}"`)
  const files = new Map<string, string>()
  for (const file of item.files ?? []) {
    if (typeof file.content !== "string") continue
    files.set(sourceBase(file.path), file.path)
  }
  const loaded: LoadedItem = { item, source, files }
  load.cache.set(name, loaded)
  return loaded
}

function dependencyName(specifier: string): string {
  return specifier.split("/").at(-1) ?? specifier
}

async function ensureItem(
  project: MockupProject,
  load: RegistryLoad,
  name: string,
  installed: Set<string>,
  visiting: Set<string>,
  force: boolean,
): Promise<void> {
  if (load.items.has(name) || (!force && installed.has(name)) || visiting.has(name)) return
  visiting.add(name)
  const loaded = await loadItem(project, load, name)
  if (loaded.files.size === 0) {
    visiting.delete(name)
    return
  }
  for (const dependency of loaded.item.registryDependencies ?? []) {
    // oxlint-disable-next-line no-await-in-loop -- the recursion shares one cache and visiting set
    await ensureItem(project, load, dependencyName(dependency), installed, visiting, false)
  }
  visiting.delete(name)
  load.items.set(name, loaded)
}

function writeFiles(load: RegistryLoad): Map<string, string> {
  const owners = new Map<string, string>()
  for (const { item, source } of load.items.values()) {
    mkdirSync(join(source.dir, "files"), { recursive: true })
    for (const file of item.files ?? []) {
      if (typeof file.content !== "string") continue
      const base = sourceBase(file.path)
      const owner = owners.get(base)
      if (owner !== undefined) {
        throw new EnvironmentError(
          `the items ${owner} and ${item.name} both ship ${base}; one registry file name per cache`,
        )
      }
      owners.set(base, item.name)
      writeFileSync(join(source.dir, "files", basename(file.path)), file.content)
    }
  }
  const files = new Map<string, string>()
  for (const { source, files: shipped } of load.items.values()) {
    for (const base of shipped.keys()) files.set(base, join(source.dir, "files", basename(shipped.get(base) ?? "")))
  }
  return files
}

function rewriteCachedImports(files: Map<string, string>, installed: Set<string>) {
  for (const file of files.values()) {
    const source = readFileSync(file, "utf8")
    const rewritten = source.replaceAll(/(["'])@\/([^"'\n]+)\1/g, (match: string, quote: string, path: string) => {
      const base = basename(path).replace(/\.(tsx|ts)$/, "")
      if (base === "" || installed.has(base)) return match
      const target = files.get(base)
      if (target === undefined) return match
      const shown = toPosix(relative(dirname(file), target)).replace(/\.(tsx|ts)$/, "")
      return `${quote}${shown.startsWith(".") ? shown : `./${shown}`}${quote}`
    })
    if (rewritten !== source) writeFileSync(file, rewritten)
  }
}

function packageName(specifier: string): string {
  if (specifier.startsWith("@")) {
    const [scope = "", rest = ""] = specifier.split("/")
    return `${scope}/${rest.split("@")[0] ?? ""}`
  }
  return specifier.split("@")[0] ?? specifier
}

function missingDependencies(project: MockupProject, load: RegistryLoad): string[] {
  const missing = new Set<string>()
  for (const { item } of load.items.values()) {
    for (const dependency of item.dependencies ?? []) {
      const name = packageName(dependency)
      if (!project.dependencies.has(name)) missing.add(name)
    }
  }
  return [...missing].toSorted()
}

function relativeFrom(from: string, path: string): string {
  const shown = toPosix(relative(from, path))
  return shown.startsWith(".") ? shown : `./${shown}`
}

export function mockupTsconfigPath(mockup: string): string {
  return join(mockup, "tsconfig.json")
}

function writeMockupTsconfig(project: MockupProject, mockup: string, cacheDirs: string[]) {
  const target = mockupTsconfigPath(mockup)
  if (cacheDirs.length === 0) {
    rmSync(target, { force: true })
    return
  }
  const paths = readTsconfigPaths(project.tsconfig)
  const from = dirname(target)
  const mapped: Record<string, string[]> = {}
  for (const entry of paths.entries) {
    const absolute = resolve(paths.base, entry.target)
    mapped[entry.pattern] ??= []
    mapped[entry.pattern]?.push(relativeFrom(from, absolute))
  }
  mapped["@registry/*"] = cacheDirs.map((dir) => relativeFrom(from, join(dir, "*")))
  const document = {
    extends: relativeFrom(from, project.tsconfig),
    compilerOptions: { paths: mapped },
  }
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`)
}

export async function prepareRegistry(
  project: MockupProject,
  mockup: string,
  files: string[],
): Promise<PreparedRegistry> {
  const wanted = new Set(
    files.flatMap((file) =>
      importsOf(readFileSync(file, "utf8"))
        .map(({ specifier }) => specifier)
        .filter((specifier) => specifier.startsWith("@registry/"))
        .map((specifier) => specifier.slice("@registry/".length)),
    ),
  )
  if (wanted.size === 0) {
    writeMockupTsconfig(project, mockup, [])
    return { install: [], cacheDirs: [] }
  }
  const sources = await loadSources(project)
  const load: RegistryLoad = { sources, items: new Map(), cache: new Map() }
  const installed = sourceBasenames(projectSourceFiles(project))
  // oxlint-disable-next-line no-await-in-loop -- each fetch fills the same cache and dependency chain
  for (const name of [...wanted].toSorted()) await ensureItem(project, load, name, installed, new Set(), true)
  const filesByBase = writeFiles(load)
  rewriteCachedImports(filesByBase, installed)
  const missing = missingDependencies(project, load)
  if (missing.length > 0) {
    throw new EnvironmentError(
      `the fetched registry items need npm packages the project does not declare: ${missing.join(", ")}\ninstall them in ${project.root} (bun add ${missing.join(" ")} or npm install ${missing.join(" ")}) and build again`,
    )
  }
  const install = [...load.items.values()]
    .map(({ item, source }) => ({
      item: item.name,
      command: `npx shadcn@latest add ${source.key}/${item.name}`,
    }))
    .toSorted((left, right) => left.item.localeCompare(right.item))
  const cacheDirs = [...new Set([...load.items.values()].map(({ source }) => join(source.dir, "files")))].toSorted()
  writeMockupTsconfig(project, mockup, cacheDirs)
  return { install, cacheDirs }
}

function componentItem(item: RegistryItem): boolean {
  return (item.files ?? []).some((file) => SOURCE_FILE.test(file.path))
}

function installedItem(item: RegistryItem, basenames: Set<string>): boolean {
  const shipped = (item.files ?? []).filter((file) => SOURCE_FILE.test(file.path))
  return shipped.every((file) => basenames.has(basename(file.path).replace(SOURCE_FILE, "")))
}

function oneLine(description: string | undefined): string {
  if (description === undefined) return ""
  const text = description.replaceAll(/\s+/g, " ").trim()
  const sentence = /^(.+?[.!?])(\s|$)/.exec(text)?.[1] ?? text
  return sentence.length > 110 ? `${sentence.slice(0, 109)}…` : sentence
}

export async function registryMissing(
  project: MockupProject,
): Promise<{ source: RegistrySource; items: RegistryItem[]; total: number }[]> {
  const sources = await loadSources(project)
  const basenames = sourceBasenames(projectSourceFiles(project))
  return sources.map((source) => {
    const components = source.index.items.filter(componentItem)
    return {
      source,
      total: components.length,
      items: components
        .filter((item) => !installedItem(item, basenames))
        .toSorted((a, b) => a.name.localeCompare(b.name)),
    }
  })
}

export async function registryListText(project: MockupProject, cwd: string): Promise<string> {
  const missing = await registryMissing(project)
  const lines: string[] = []
  for (const { source, items, total } of missing) {
    lines.push(
      `${source.key} ${source.ref}  ${items.length} of ${total} component items not installed  (${displayPath(source.dir, cwd)})`,
    )
    for (const item of items) lines.push(`  ${item.name.padEnd(24)} ${oneLine(item.description)}`.trimEnd())
  }
  return lines.join("\n")
}

export async function registryListJson(project: MockupProject, cwd: string) {
  const missing = await registryMissing(project)
  return missing.map(({ source, items, total }) => ({
    registry: source.key,
    ref: source.ref,
    cache: displayPath(source.dir, cwd),
    total,
    items: items.map((item) => ({
      name: item.name,
      type: item.type ?? null,
      description: oneLine(item.description),
    })),
  }))
}
