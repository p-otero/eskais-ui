import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { extractType, readExports } from "./inspect"
import { displayPath, EnvironmentError, packageDirectoryOf, type MockupProject } from "./project"

export type SdkSubpath = {
  name: string
  specifier: string
  types: string
  parts: string[]
  props: { name: string; text: string }[]
}

export type SdkPackage = {
  name: string
  version: string
  dir: string
  subpaths: SdkSubpath[]
}

type PackageDocument = {
  version?: string
  exports?: unknown
}

function packageDocument(dir: string): PackageDocument {
  const path = join(dir, "package.json")
  if (!existsSync(path)) throw new EnvironmentError(`${dir} has no package.json`)
  return JSON.parse(readFileSync(path, "utf8")) as PackageDocument
}

function exportsMap(document: PackageDocument): Record<string, unknown> {
  const exported = document.exports
  if (typeof exported === "string") return { ".": exported }
  return typeof exported === "object" && exported !== null ? (exported as Record<string, unknown>) : {}
}

function typeEntry(entry: unknown): string | null {
  if (typeof entry === "string") return entry
  if (typeof entry !== "object" || entry === null) return null
  const record = entry as Record<string, unknown>
  for (const key of ["types", "default", "import"]) {
    const value = record[key]
    if (typeof value === "string") return value
  }
  return null
}

function propsOf(source: string, parts: string[]): { name: string; text: string }[] {
  const types = readExports(source)
    .filter((entry) => entry.kind === "type" && entry.name.endsWith("Props"))
    .map((entry) => entry.name)
  const preferred = types.toSorted((left, right) => {
    const leftMain = parts.some((part) => `${part}Props` === left) ? 0 : 1
    const rightMain = parts.some((part) => `${part}Props` === right) ? 0 : 1
    return leftMain - rightMain || left.localeCompare(right)
  })
  const found: { name: string; text: string }[] = []
  for (const name of preferred) {
    const text = extractType(source, name)
    if (text !== null) found.push({ name, text })
  }
  return found
}

function readPackage(project: MockupProject, name: string): SdkPackage | null {
  const dir = packageDirectoryOf(project.root, name)
  if (dir === null) return null
  const document = packageDocument(dir)
  const subpaths: SdkSubpath[] = []
  for (const [key, entry] of Object.entries(exportsMap(document))) {
    if (!key.startsWith("./") || key === "./package.json") continue
    const relativeTypes = typeEntry(entry)
    if (relativeTypes === null) continue
    const types = join(dir, relativeTypes)
    if (!existsSync(types)) continue
    const source = readFileSync(types, "utf8")
    const parts = readExports(source)
      .filter((exported) => exported.kind === "value" && /^[A-Z]/.test(exported.name))
      .map((exported) => exported.name)
    subpaths.push({
      name: key.slice(2),
      specifier: `${name}/${key.slice(2)}`,
      types,
      parts,
      props: propsOf(source, parts),
    })
  }
  return {
    name,
    version: typeof document.version === "string" ? document.version : "unknown",
    dir,
    subpaths: subpaths.toSorted((left, right) => left.name.localeCompare(right.name)),
  }
}

export function installedSdkPackages(project: MockupProject): SdkPackage[] {
  return [...project.dependencies]
    .filter((name) => name.startsWith("@ui-sdk/"))
    .toSorted((left, right) =>
      left === "@ui-sdk/react" ? -1 : right === "@ui-sdk/react" ? 1 : left.localeCompare(right),
    )
    .map((name) => readPackage(project, name))
    .filter((entry): entry is SdkPackage => entry !== null && entry.subpaths.length > 0)
}

export function sdkPublicSpecifiers(project: MockupProject): Set<string> {
  return new Set(installedSdkPackages(project).flatMap((entry) => entry.subpaths.map((subpath) => subpath.specifier)))
}

function preview(parts: string[]): string {
  if (parts.length === 0) return ""
  return parts.length > 4 ? `${parts.slice(0, 4).join(", ")}, …` : parts.join(", ")
}

export function sdkIndexText(project: MockupProject, cwd: string): string {
  const packages = installedSdkPackages(project)
  if (packages.length === 0) {
    throw new EnvironmentError(
      `no @ui-sdk package is installed in ${displayPath(project.root, cwd)}; add @ui-sdk/react and @ui-sdk/core`,
    )
  }
  const lines: string[] = []
  for (const entry of packages) {
    if (entry.name !== "@ui-sdk/react") {
      lines.push(`${entry.name} ${entry.version}  ${entry.subpaths.length} public subpaths (behaviour)`)
      continue
    }
    lines.push(`${entry.name} ${entry.version}  ${entry.subpaths.length} public subpaths`)
    for (const subpath of entry.subpaths) {
      lines.push(`  ${subpath.name.padEnd(20)} ${preview(subpath.parts)}`.trimEnd())
    }
  }
  return lines.join("\n")
}

export function sdkIndexJson(project: MockupProject) {
  return installedSdkPackages(project).map((entry) => ({
    package: entry.name,
    version: entry.version,
    subpaths: entry.subpaths.map((subpath) => ({
      name: subpath.name,
      specifier: subpath.specifier,
      parts: subpath.parts,
    })),
  }))
}

export type SdkDetail = SdkSubpath & { package: string; version: string }

export function sdkDetail(project: MockupProject, name: string): SdkDetail {
  const packages = installedSdkPackages(project)
  const packagesInOrder = packages.toSorted((left, right) =>
    left.name === "@ui-sdk/react" ? -1 : right.name === "@ui-sdk/react" ? 1 : left.name.localeCompare(right.name),
  )
  const wanted = name.startsWith("@") ? name : null
  for (const entry of packagesInOrder) {
    const subpath =
      wanted === null
        ? entry.subpaths.find((candidate) => candidate.name === name)
        : entry.subpaths.find((candidate) => candidate.specifier === wanted)
    if (subpath !== undefined) return { ...subpath, package: entry.name, version: entry.version }
  }
  throw new EnvironmentError(`no installed @ui-sdk package exports "${name}"; inspect --sdk lists the public subpaths`)
}

export function sdkDetailText(detail: SdkDetail, cwd: string): string {
  const lines = [
    `${detail.specifier}  (${displayPath(detail.types, cwd)})`,
    `import { ${detail.parts.join(", ")} } from "${detail.specifier}"`,
    `parts ${detail.parts.join(", ")}`,
  ]
  for (const props of detail.props.slice(0, 3)) lines.push(props.text)
  if (detail.props.length > 3) lines.push(`… ${detail.props.length - 3} more props types`)
  return lines.join("\n")
}

export function sdkDetailJson(detail: SdkDetail, cwd: string) {
  return {
    package: detail.package,
    version: detail.version,
    name: detail.name,
    specifier: detail.specifier,
    types: displayPath(detail.types, cwd),
    importLine: `import { ${detail.parts.join(", ")} } from "${detail.specifier}"`,
    parts: detail.parts,
    props: detail.props,
  }
}
