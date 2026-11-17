import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { buildMockup, type BuildOutcome, type BuildSettings } from "./build"
import { importRule, sourceProblems, type Problem } from "./checks"
import { displayPath, EnvironmentError, mockupDirectory, type MockupProject } from "./project"

export type ValidateOutcome = {
  build: BuildOutcome
  problems: Problem[]
  warnings: string[]
}

type ElementFactory = (type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]) => unknown

const TYPE_ERROR = /^(.+)\((\d+),(\d+)\): error (TS\d+): (.*)$/
const BROWSER_GLOBAL =
  /\b(window|document|navigator|localStorage|sessionStorage|matchMedia|ResizeObserver|IntersectionObserver|MutationObserver)\b/

export function parseTypeErrors(output: string, project: MockupProject, cwd: string): Problem[] {
  const problems: Problem[] = []
  for (const line of output.split(/\r?\n/)) {
    const match = TYPE_ERROR.exec(line)
    if (match !== null) {
      problems.push({
        file: displayPath(resolve(project.root, match[1] ?? ""), cwd),
        line: Number(match[2]),
        column: Number(match[3]),
        rule: "type",
        message: `${match[4] ?? "error"}: ${match[5] ?? ""}`.trimEnd(),
      })
      continue
    }
    const previous = problems.at(-1)
    if (previous !== undefined && /^\s{2}\S/.test(line)) previous.message = `${previous.message} ${line.trim()}`
  }
  return problems
}

function sourceFiles(mockup: string): string[] {
  return readdirSync(mockup)
    .filter((name) => /\.(ts|tsx)$/.test(name) && !name.startsWith("."))
    .map((name) => join(mockup, name))
}

function typecheck(project: MockupProject, screen: string): Problem[] {
  const result = spawnSync(
    process.execPath,
    ["check", "-p", project.tsconfig, "--no-pretty", displayPath(screen, project.root)],
    { cwd: project.root, encoding: "utf8" },
  )
  if (result.status === 0) return []
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
  const problems = parseTypeErrors(output, project, process.cwd())
  if (problems.length === 0) {
    throw new EnvironmentError(
      `bun check could not read ${displayPath(project.tsconfig, process.cwd())}:\n${output.trim()}`,
    )
  }
  return problems
}

async function importModule(path: string): Promise<Record<string, unknown>> {
  return (await import(pathToFileURL(path).href)) as Record<string, unknown>
}

async function smokeRender(
  project: MockupProject,
  screen: string,
  cwd: string,
): Promise<{ problems: Problem[]; warnings: string[] }> {
  const located = (rule: string, message: string): Problem[] => [
    { file: displayPath(screen, cwd), line: 1, column: 1, rule, message },
  ]
  try {
    // React chooses its development or production build when a module first imports it, and the smoke render
    // must load the same production build the page ships.
    process.env.NODE_ENV = "production"
    const react = await importModule(project.runtime.react)
    const createElement =
      (react["createElement"] as ElementFactory | undefined) ??
      (react["default"] as { createElement: ElementFactory } | undefined)?.createElement
    if (createElement === undefined) throw new EnvironmentError(`react has no createElement: ${project.runtime.react}`)
    const server = await importModule(project.runtime.reactServer)
    const renderToString =
      (server["renderToString"] as ((element: unknown) => string) | undefined) ??
      (server["default"] as { renderToString: (element: unknown) => string } | undefined)?.renderToString
    if (renderToString === undefined) throw new EnvironmentError(`react-dom/server has no renderToString`)

    const module = await importModule(screen)
    const component = module["default"]
    if (typeof component !== "function") {
      return { problems: located("render", "screen.tsx must default-export the screen component"), warnings: [] }
    }
    let element = createElement(component, {})
    const wrapper = join(project.root, ".mockups", "wrapper.tsx")
    if (existsSync(wrapper)) {
      const wrapperModule = await importModule(wrapper)
      const provider = wrapperModule["default"]
      if (typeof provider !== "function") {
        return {
          problems: located("render", "wrapper.tsx must default-export a component taking { children }"),
          warnings: [],
        }
      }
      element = createElement(provider, null, element)
    }
    const html = renderToString(element)
    return typeof html === "string" && html.trim() !== ""
      ? { problems: [], warnings: [] }
      : { problems: [], warnings: [`${displayPath(screen, cwd)} renders no markup without props`] }
  } catch (error) {
    if (error instanceof EnvironmentError) throw error
    const message = error instanceof Error ? error.message : String(error)
    if (BROWSER_GLOBAL.test(message)) {
      return { problems: [], warnings: [`the server render needs a browser (${message}); skipped`] }
    }
    return { problems: located("render", message), warnings: [] }
  }
}

export async function validateMockup(project: MockupProject, settings: BuildSettings): Promise<ValidateOutcome> {
  const build = await buildMockup(project, settings)
  const mockup = mockupDirectory(project, settings.name)
  const problems: Problem[] = [...build.problems]
  const allowed = importRule(project.pathPrefixes, project.dependencies)
  for (const file of sourceFiles(mockup)) {
    problems.push(...sourceProblems(displayPath(file, settings.cwd), readFileSync(file, "utf8"), allowed))
  }
  const screen = join(mockup, "screen.tsx")
  problems.push(...typecheck(project, screen))
  const rendered = await smokeRender(project, screen, settings.cwd)
  problems.push(...rendered.problems)
  const sorted = problems.toSorted(
    (left, right) => left.file.localeCompare(right.file) || left.line - right.line || left.column - right.column,
  )
  return { build, problems: sorted, warnings: [...build.warnings, ...rendered.warnings] }
}
