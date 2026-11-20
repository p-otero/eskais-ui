import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

import { buildMockup, mockupSourceFiles, type BuildOutcome, type BuildSettings, type MockupManifest } from "./build"
import { importRule, partStyleProblems, sdkImportProblems, sourceProblems, type Problem } from "./checks"
import {
  checkTsconfig,
  displayPath,
  EnvironmentError,
  mockupDirectory,
  projectSourceFiles,
  sourceBasenames,
  type MockupProject,
} from "./project"
import { sdkDuplicateWarnings } from "./parts"
import { mockupTsconfigPath } from "./registry"
import { sdkPublicSpecifiers } from "./sdk"

export type ValidateOutcome = {
  build: BuildOutcome
  builds: BuildOutcome[]
  problems: Problem[]
  warnings: string[]
}

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
  return mockupSourceFiles(mockup)
}

function typecheck(project: MockupProject, mockup: string): Problem[] {
  const config = existsSync(mockupTsconfigPath(mockup)) ? mockupTsconfigPath(mockup) : checkTsconfig(project.tsconfig)
  const files = sourceFiles(mockup).map((file) => displayPath(file, project.root))
  const result = spawnSync(process.execPath, ["check", "-p", config, "--no-pretty", ...files], {
    cwd: project.root,
    encoding: "utf8",
  })
  if (result.status === 0) return []
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
  const problems = parseTypeErrors(output, project, process.cwd())
  if (problems.length === 0) {
    throw new EnvironmentError(`bun check could not read ${displayPath(config, process.cwd())}:\n${output.trim()}`)
  }
  return problems
}

export function renderRunner(mockup: string, state?: string): string {
  const wrapper = existsSync(join(dirname(mockup), "wrapper.tsx"))
  return [
    'import { createElement } from "react"',
    'import { renderToString } from "react-dom/server"',
    'import Screen from "./screen"',
    ...(state === undefined ? [] : ['import { states } from "./fixtures"']),
    ...(wrapper ? ['import Wrapper from "../wrapper"'] : []),
    "try {",
    `  const screen = createElement(Screen, ${state === undefined ? "{}" : `states[${JSON.stringify(state)}]`})`,
    `  const html = renderToString(${wrapper ? "createElement(Wrapper, null, screen)" : "screen"})`,
    '  console.log(html.trim() === "" ? "MOCKUP_RENDER empty" : "MOCKUP_RENDER ok")',
    "} catch (error) {",
    '  console.error("MOCKUP_RENDER error:", error instanceof Error ? error.message : String(error))',
    "  process.exitCode = 1",
    "}",
    "",
  ].join("\n")
}

function firstLine(output: string): string {
  return output.split(/\r?\n/).find((line) => line.trim() !== "") ?? "the server render failed"
}

function smokeRender(
  mockup: string,
  cwd: string,
  state: string | undefined,
): { problems: Problem[]; warnings: string[] } {
  const screen = join(mockup, "screen.tsx")
  const inState = state === undefined ? "" : ` in the ${state} state`
  const located = (rule: string, message: string): Problem[] => [
    { file: displayPath(screen, cwd), line: 1, column: 1, rule, message: `${message}${inState}` },
  ]
  const runner = join(mockup, ".render-check.tsx")
  writeFileSync(runner, renderRunner(mockup, state))
  let result: ReturnType<typeof spawnSync>
  try {
    result = spawnSync(process.execPath, [".render-check.tsx"], {
      cwd: mockup,
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "production" },
    })
  } finally {
    rmSync(runner, { force: true })
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
  if (output.includes("MOCKUP_RENDER ok")) return { problems: [], warnings: [] }
  if (output.includes("MOCKUP_RENDER empty")) {
    const props = state === undefined ? "without props" : `in the ${state} state`
    return { problems: [], warnings: [`${displayPath(screen, cwd)} renders no markup ${props}`] }
  }
  const reported = output
    .split(/\r?\n/)
    .find((line) => line.startsWith("MOCKUP_RENDER error:"))
    ?.replace("MOCKUP_RENDER error:", "")
    .trim()
  const message =
    reported === undefined || reported === "" ? firstLine(output.replaceAll("MOCKUP_RENDER error:", "")) : reported
  if (BROWSER_GLOBAL.test(message)) {
    return { problems: [], warnings: [`the server render needs a browser (${message}); skipped`] }
  }
  return { problems: located("render", message), warnings: [] }
}

// Builds and server-renders each state (one undefined entry: the screen without props); the source rules
// and the type check run once.
export async function validateMockup(
  project: MockupProject,
  settings: BuildSettings,
  states: (string | undefined)[] = [settings.state],
): Promise<ValidateOutcome> {
  const builds: BuildOutcome[] = []
  for (const state of states) {
    // oxlint-disable-next-line no-await-in-loop -- each build writes the same entry file and registry cache
    builds.push(await buildMockup(project, { ...settings, state, out: outFor(settings.out, state, states) }))
  }
  const build = builds[0]
  if (build === undefined) throw new EnvironmentError("validate needs a state to build")
  const mockup = mockupDirectory(project, settings.name)
  const problems: Problem[] = [...dedupe(builds.flatMap((built) => built.problems)), ...build.parts.problems]
  const allowed = importRule([...project.pathPrefixes, "@registry/"], project.dependencies)
  const publicSpecifiers = sdkPublicSpecifiers(project)
  for (const file of sourceFiles(mockup)) {
    const shown = displayPath(file, settings.cwd)
    const source = readFileSync(file, "utf8")
    problems.push(...sourceProblems(shown, source, allowed))
    problems.push(...sdkImportProblems(shown, source, publicSpecifiers))
  }
  for (const file of build.parts.files) {
    problems.push(...partStyleProblems(displayPath(file, settings.cwd), readFileSync(file, "utf8")))
  }
  problems.push(...typecheck(project, mockup))
  const rendered = states.map((state) => smokeRender(mockup, settings.cwd, state))
  problems.push(...rendered.flatMap((render) => render.problems))
  const warnings = [
    ...builds.flatMap((built) => built.warnings),
    ...rendered.flatMap((render) => render.warnings),
    ...sdkDuplicateWarnings(build.parts.sdkParts, sourceBasenames(projectSourceFiles(project))),
  ]
  const sorted = problems.toSorted(
    (left, right) => left.file.localeCompare(right.file) || left.line - right.line || left.column - right.column,
  )
  return { build, builds, problems: sorted, warnings }
}

function dedupe(problems: Problem[]): Problem[] {
  const seen = new Set<string>()
  return problems.filter((problem) => {
    const key = `${problem.file}:${problem.line}:${problem.column}:${problem.rule}:${problem.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// --out with several states names one file per state: its {state} is replaced, and it must have one.
export function outFor(
  out: string | undefined,
  state: string | undefined,
  states: (string | undefined)[],
): string | undefined {
  if (out === undefined || state === undefined) return out
  if (out.includes("{state}")) return out.replaceAll("{state}", state)
  if (states.length > 1) {
    throw new EnvironmentError(`--out needs {state} with --state all, like .mockups/<name>/out-{state}-dark.html`)
  }
  return out
}

export function partsSummary(manifest: MockupManifest): string[] {
  const install =
    manifest.install.length === 0
      ? "install none"
      : `install ${manifest.install.length}: ${manifest.install.map((entry) => entry.item).join(", ")}`
  const proposed =
    manifest.proposed.length === 0
      ? "proposed none"
      : `proposed ${manifest.proposed.length}: ${manifest.proposed
          .map((part) => `${part.name} (${part.props.length} ${part.props.length === 1 ? "prop" : "props"})`)
          .join(", ")}`
  const sdkParts =
    manifest.sdkParts.length === 0
      ? "sdkParts none"
      : `sdkParts ${manifest.sdkParts.length}: ${manifest.sdkParts
          .map((entry) => `${entry.part} ← ${entry.primitive}`)
          .join(", ")}`
  const gaps =
    manifest.gaps.length === 0
      ? "gaps none"
      : `gaps ${manifest.gaps.length}: ${manifest.gaps.map((gap) => `${gap.component} (${gap.missing})`).join(", ")}`
  return [install, proposed, sdkParts, gaps]
}
