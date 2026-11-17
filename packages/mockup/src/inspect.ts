import { existsSync, readFileSync, readdirSync } from "node:fs"
import { basename, dirname, join, relative, resolve } from "node:path"

import { displayPath, EnvironmentError, type MockupProject, type ProjectAlias } from "./project"

export type ExportKind = "value" | "type"

export type ExportedName = {
  name: string
  kind: ExportKind
}

export type AliasFile = {
  alias: string
  path: string
  shown: string
  specifier: string
  exports: ExportedName[]
}

export type ComponentDetail = {
  name: string
  kind: ExportKind
  specifier: string
  file: string
  importLine: string
  propsImport: string | null
  props: string | null
  variants: string[]
}

const DECLARATIONS: { pattern: RegExp; kind: ExportKind }[] = [
  { pattern: /export\s+(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g, kind: "value" },
  { pattern: /export\s+(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g, kind: "value" },
  { pattern: /export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g, kind: "value" },
  { pattern: /export\s+(?:declare\s+)?enum\s+([A-Za-z_$][\w$]*)/g, kind: "value" },
  { pattern: /export\s+type\s+([A-Za-z_$][\w$]*)\s*[=<]/g, kind: "type" },
  { pattern: /export\s+interface\s+([A-Za-z_$][\w$]*)/g, kind: "type" },
]

const RE_EXPORTS = /export\s+(?:type\s+)?\{([^}]*)\}/g

export function readExports(source: string): ExportedName[] {
  const found: ExportedName[] = []
  const add = (name: string, kind: ExportKind) => {
    if (name === "" || name === "default" || found.some((entry) => entry.name === name)) return
    found.push({ name, kind })
  }
  const positions: { at: number; name: string; kind: ExportKind }[] = []
  for (const { pattern, kind } of DECLARATIONS) {
    for (const match of source.matchAll(pattern)) {
      const name = match[1]
      if (name !== undefined) positions.push({ at: match.index, name, kind })
    }
  }
  for (const match of source.matchAll(RE_EXPORTS)) {
    const body = match[1] ?? ""
    const typeOnly = /^export\s+type\s*\{/.test(match[0])
    let offset = match.index + match[0].indexOf("{") + 1
    for (const part of body.split(",")) {
      const cleaned = part.replace(/^\s*type\s+/, "").trim()
      const name =
        cleaned
          .split(/\s+as\s+/)
          .at(-1)
          ?.trim() ?? ""
      if (name !== "")
        positions.push({ at: offset, name, kind: typeOnly || /^\s*type\s/.test(part) ? "type" : "value" })
      offset += part.length + 1
    }
  }
  for (const entry of positions.toSorted((left, right) => left.at - right.at)) add(entry.name, entry.kind)
  return found
}

function blockEnd(source: string, openIndex: number): number {
  const open = source[openIndex]
  const close = open === "(" ? ")" : open === "{" ? "}" : "]"
  let depth = 0
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index]
    if (char === open) depth += 1
    if (char === close) {
      depth -= 1
      if (depth === 0) return index + 1
    }
  }
  return source.length
}

function declarationEnd(source: string, from: number): number {
  let depth = 0
  for (let index = from; index < source.length; index += 1) {
    const char = source[index]
    if (char === "{" || char === "(" || char === "[") depth += 1
    if (char === "}" || char === ")" || char === "]") {
      if (depth === 0) return index
      depth -= 1
    }
    if (char !== "\n" || depth > 0) continue
    const tail = source.slice(from, index).trimEnd()
    const next = source.slice(index + 1).match(/^\s*(\S)/)?.[1]
    if (next === undefined) return index
    if (!/[&|,=(:<]$/.test(tail) && !/^[&|)]/.test(next)) return index
  }
  return source.length
}

export function extractType(source: string, name: string): string | null {
  const match = new RegExp(`\\b(type|interface)\\s+${name}\\b`).exec(source)
  if (match === null) return null
  const start = match.index
  if (match[1] === "interface") {
    const open = source.indexOf("{", start)
    if (open === -1) return null
    return source.slice(start, blockEnd(source, open)).trimEnd()
  }
  const equal = source.indexOf("=", start)
  if (equal === -1) return null
  return source.slice(start, declarationEnd(source, equal + 1)).trimEnd()
}

export function extractCva(source: string): { name: string; text: string }[] {
  const found: { name: string; text: string }[] = []
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*cva\s*\(/g)) {
    const open = match.index + match[0].length - 1
    found.push({ name: match[1] ?? "", text: source.slice(match.index, blockEnd(source, open)).trimEnd() })
  }
  return found
}

type DirectoryAlias = ProjectAlias & { dir: string }

function aliasedFiles(project: MockupProject): AliasFile[] {
  const directories = project.aliases.filter((alias): alias is DirectoryAlias => alias.dir !== null)
  const claimed = new Map<string, { alias: DirectoryAlias; path: string }>()
  for (const alias of directories) {
    for (const path of readSourceFiles(alias.dir)) {
      const key = path.toLowerCase()
      const current = claimed.get(key)
      if (current !== undefined && current.alias.dir.length >= alias.dir.length) continue
      claimed.set(key, { alias, path })
    }
  }
  return [...claimed.values()]
    .map(({ alias, path }) => ({
      alias: alias.name,
      path,
      shown: relative(alias.dir, path)
        .replaceAll("\\", "/")
        .replace(/\.(tsx|ts)$/, ""),
      specifier: specifierOfPath(alias.specifier, alias.dir, path),
      exports: readExports(readFileSync(path, "utf8")),
    }))
    .toSorted((left, right) => left.path.localeCompare(right.path))
}

function specifierOfPath(aliasSpecifier: string, aliasDir: string, path: string): string {
  const shown = relative(aliasDir, path)
    .replaceAll("\\", "/")
    .replace(/\.(tsx|ts)$/, "")
  return `${aliasSpecifier}/${shown}`
}

function readSourceFiles(dir: string): string[] {
  const files: string[] = []
  const visit = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        visit(path)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue
      if (/\.(test|spec)\./.test(entry.name) || entry.name.endsWith(".d.ts")) continue
      files.push(path)
    }
  }
  visit(dir)
  return files.toSorted()
}

function providerNames(project: MockupProject): string[] {
  if (project.entry === null) return []
  const source = readFileSync(project.entry, "utf8")
  const names = new Set<string>()
  for (const match of source.matchAll(/\b([A-Z]\w*Provider)\b/g)) names.add(match[1] ?? "")
  return [...names].filter((name) => name !== "").toSorted()
}

function collectThemes(project: MockupProject): string[] {
  const seen = new Set<string>()
  const names = new Set<string>()
  const visit = (file: string, depth: number) => {
    const key = file.toLowerCase()
    if (depth > 4 || seen.has(key) || !existsSync(file)) return
    seen.add(key)
    const css = readFileSync(file, "utf8")
    for (const match of css.matchAll(/\[data-theme\s*=\s*["']?([\w-]+)/g)) names.add(match[1] ?? "")
    for (const match of css.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/g)) {
      const href = match[1] ?? ""
      if (href.startsWith(".")) visit(resolve(dirname(file), href), depth + 1)
    }
  }
  visit(project.css, 0)
  return ["default", ...names].filter((name, index, all) => all.indexOf(name) === index).toSorted()
}

export function wrapperFile(project: MockupProject): string | null {
  const file = join(project.root, ".mockups", "wrapper.tsx")
  return existsSync(file) ? file : null
}

export function indexText(project: MockupProject, cwd: string): string {
  const wrapper = wrapperFile(project)
  const lines = [
    `project ${displayPath(project.root, cwd)}`,
    `css ${displayPath(project.css, cwd)}`,
    `tailwind ${project.runtime.tailwindVersion}  react ${project.runtime.reactVersion}`,
    `entry ${project.entry === null ? "none" : displayPath(project.entry, cwd)}`,
    `providers ${providerNames(project).join(", ") || "none"}`,
    `themes ${collectThemes(project).join(", ")}`,
    `wrapper ${wrapper === null ? "none" : displayPath(wrapper, cwd)}`,
    "",
  ]
  const files = aliasedFiles(project)
  for (const alias of project.aliases) {
    if (alias.dir === null) continue
    const inAlias = files.filter((file) => file.alias === alias.name)
    lines.push(`${alias.name} (${displayPath(alias.dir, cwd)})`)
    for (const file of inAlias) {
      const names = file.exports.filter((entry) => entry.kind === "value").map((entry) => entry.name)
      if (names.length === 0) continue
      lines.push(`  ${file.shown} ${names.join(", ")}`)
    }
  }
  return lines.join("\n").trimEnd()
}

function kebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
}

export function componentDetail(project: MockupProject, name: string): ComponentDetail {
  const files = aliasedFiles(project)
  const declared = files.filter((file) => file.exports.some((entry) => entry.name === name))
  const byFile = declared.find((file) => basename(file.path).replace(/\.(tsx|ts)$/, "") === kebab(name))
  const file = byFile ?? declared[0]
  if (file === undefined) {
    throw new EnvironmentError(`no file in the project's aliases exports ${name}`)
  }
  const source = readFileSync(file.path, "utf8")
  const entry = file.exports.find((exported) => exported.name === name)
  if (entry === undefined) throw new EnvironmentError(`${name} is not exported by ${file.path}`)
  const variants = extractCva(source)
  const related = variants.filter((variant) => variant.name.toLowerCase().includes(name.toLowerCase().slice(0, 4)))
  const props = entry.kind === "type" ? null : extractType(source, `${name}Props`)
  const importNames = [name, ...related.map((variant) => variant.name)]
  const importLine = `${entry.kind === "type" ? "import type" : "import"} { ${importNames.join(", ")} } from "${file.specifier}"`
  return {
    name,
    kind: entry.kind,
    specifier: file.specifier,
    file: file.path,
    importLine,
    propsImport: props === null ? null : `import type { ${name}Props } from "${file.specifier}"`,
    props,
    variants: related.map((variant) => variant.text),
  }
}

export function detailText(detail: ComponentDetail, cwd: string): string {
  const lines = [`${detail.specifier}  (${displayPath(detail.file, cwd)})`, detail.importLine]
  if (detail.propsImport !== null) lines.push(detail.propsImport)
  if (detail.props !== null) lines.push(detail.props)
  for (const variant of detail.variants) lines.push(variant)
  return lines.join("\n")
}

export function detailJson(detail: ComponentDetail, cwd: string) {
  return {
    name: detail.name,
    kind: detail.kind,
    specifier: detail.specifier,
    file: displayPath(detail.file, cwd),
    importLine: detail.importLine,
    propsImport: detail.propsImport,
    props: detail.props,
    variants: detail.variants,
  }
}

export function indexJson(project: MockupProject, cwd: string) {
  const files = aliasedFiles(project)
  const wrapper = wrapperFile(project)
  return {
    project: displayPath(project.root, cwd),
    css: displayPath(project.css, cwd),
    entry: project.entry === null ? null : displayPath(project.entry, cwd),
    tailwind: project.runtime.tailwindVersion,
    react: project.runtime.reactVersion,
    providers: providerNames(project),
    themes: collectThemes(project),
    wrapper: wrapper === null ? null : displayPath(wrapper, cwd),
    aliases: project.aliases.map((alias) => ({
      name: alias.name,
      specifier: alias.specifier,
      dir: alias.dir === null ? null : displayPath(alias.dir, cwd),
      files: files
        .filter((file) => file.alias === alias.name)
        .map((file) => ({ file: file.shown, specifier: file.specifier, exports: file.exports })),
    })),
  }
}
