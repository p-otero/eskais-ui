import { existsSync, readFileSync, readdirSync } from "node:fs"
import { basename, join, relative } from "node:path"
import { pathToFileURL } from "node:url"

import { importsOf, type Problem } from "./checks"
import { extractType, readExports } from "./inspect"
import { displayPath, EnvironmentError, toPosix } from "./project"

export type ProposedPart = {
  name: string
  file: string
  props: string[]
}

export type SdkPart = {
  part: string
  primitive: string
  reason: string
}

export type Gap = {
  component: string
  missing: string
  reason: string
}

export type MockupParts = {
  files: string[]
  proposed: ProposedPart[]
  sdkParts: SdkPart[]
  gaps: Gap[]
  problems: Problem[]
}

function kebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
}

function partFiles(mockup: string): string[] {
  const root = join(mockup, "parts")
  if (!existsSync(root)) return []
  const found: string[] = []
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue
      const path = join(dir, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (entry.name.endsWith(".tsx") && !/\.(test|spec)\./.test(entry.name)) found.push(path)
    }
  }
  visit(root)
  return found.toSorted()
}

function typeMembers(text: string): string[] {
  const open = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (open === -1 || end <= open) return []
  const body = text.slice(open + 1, end)
  const members: string[] = []
  let current = ""
  let depth = 0
  const flush = () => {
    const member = current.trim().replace(/[,;]$/, "").trim()
    if (member !== "" && !member.startsWith("//") && !member.startsWith("/*")) members.push(member)
    current = ""
  }
  for (const char of body) {
    if ("{[(".includes(char)) depth += 1
    if ("}])".includes(char)) depth -= 1
    if ((char === "\n" || char === ";") && depth === 0) {
      flush()
      continue
    }
    current += char
  }
  flush()
  return members
}

function sdkReason(source: string): string | null {
  const found = [...source.matchAll(/\/\/\s*sdk-reason:[ \t]*(.+)/g)]
  const reason = found.at(-1)?.[1]?.trim() ?? ""
  return reason === "" ? null : reason
}

function primaryPart(source: string, file: string): string | null {
  const values = readExports(source)
    .filter((entry) => entry.kind === "value")
    .map((entry) => entry.name)
    .filter((name) => /^[A-Z]/.test(name))
  if (values.length === 0) return null
  const name = kebab(basename(file).replace(/\.tsx$/, ""))
  return values.find((value) => kebab(value) === name) ?? values[0] ?? null
}

async function readGaps(mockup: string, cwd: string): Promise<Gap[]> {
  const file = join(mockup, "gaps.ts")
  if (!existsSync(file)) return []
  let module: Record<string, unknown>
  try {
    module = (await import(pathToFileURL(file).href)) as Record<string, unknown>
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new EnvironmentError(`${displayPath(file, cwd)} could not be read: ${message}`)
  }
  const exported = module["gaps"] ?? module["default"]
  if (!Array.isArray(exported)) {
    throw new EnvironmentError(`${displayPath(file, cwd)} must export gaps: an array of { component, missing, reason }`)
  }
  return exported.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new EnvironmentError(`${displayPath(file, cwd)}: gap ${index + 1} is not an object`)
    }
    const record = entry as Record<string, unknown>
    const component = record["component"]
    const missing = record["missing"]
    if (typeof component !== "string" || typeof missing !== "string") {
      throw new EnvironmentError(
        `${displayPath(file, cwd)}: gap ${index + 1} needs string component and missing fields`,
      )
    }
    const reason = record["reason"]
    return { component, missing, reason: typeof reason === "string" ? reason : "" }
  })
}

export async function readMockupParts(mockup: string, cwd: string): Promise<MockupParts> {
  const files = partFiles(mockup)
  const proposed: ProposedPart[] = []
  const sdkParts: SdkPart[] = []
  const problems: Problem[] = []
  for (const file of files) {
    const source = readFileSync(file, "utf8")
    const shown = toPosix(relative(mockup, file))
    for (const entry of readExports(source)) {
      if (entry.kind !== "value" || !/^[A-Z]/.test(entry.name)) continue
      const type = extractType(source, `${entry.name}Props`)
      if (type === null && !new RegExp(`\\bexport\\s+function\\s+${entry.name}\\b`).test(source)) continue
      proposed.push({
        name: entry.name,
        file: shown,
        props: type === null ? [] : typeMembers(type),
      })
    }
    const sdkImports = importsOf(source).filter(({ specifier }) => specifier.startsWith("@ui-sdk/"))
    if (sdkImports.length === 0) continue
    const part = primaryPart(source, file)
    const reason = sdkReason(source)
    if (part === null) {
      problems.push({
        file: toPosix(relative(cwd, file)),
        line: 1,
        column: 1,
        rule: "sdk-reason",
        message: "a part that uses a UI SDK primitive must export the component it builds",
      })
      continue
    }
    if (reason === null) {
      const first = sdkImports[0]
      problems.push({
        file: toPosix(relative(cwd, file)),
        line: first?.line ?? 1,
        column: first?.column ?? 1,
        rule: "sdk-reason",
        message: `add a line "// sdk-reason: <why Eskais cannot do this>" above the ${part} component`,
      })
      continue
    }
    for (const specifier of [...new Set(sdkImports.map((entry) => entry.specifier))].toSorted()) {
      sdkParts.push({ part, primitive: specifier, reason })
    }
  }
  return {
    files,
    proposed: proposed.toSorted(
      (left, right) => left.file.localeCompare(right.file) || left.name.localeCompare(right.name),
    ),
    sdkParts: sdkParts.toSorted(
      (left, right) => left.part.localeCompare(right.part) || left.primitive.localeCompare(right.primitive),
    ),
    gaps: await readGaps(mockup, cwd),
    problems,
  }
}

export function sdkDuplicateWarnings(sdkParts: SdkPart[], basenames: Set<string>): string[] {
  const warnings = new Set<string>()
  for (const { part, primitive } of sdkParts) {
    const name = primitive.split("/").at(-1) ?? primitive
    if (!basenames.has(name)) continue
    warnings.add(`${part} uses ${primitive}, but the project already installs a ${name} component; use it first`)
  }
  return [...warnings].toSorted()
}
