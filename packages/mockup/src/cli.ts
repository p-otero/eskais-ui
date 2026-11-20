#!/usr/bin/env bun
import { existsSync, rmSync } from "node:fs"
import { join, resolve } from "node:path"

import { buildMockup, summary, type BuildOutcome, type Scheme } from "./build"
import { DEFAULT_MAX_PROBLEMS, formatProblems } from "./checks"
import { galleryHeadline, galleryJson, galleryLines, screenshotSummary, writeGallery } from "./gallery"
import { componentDetail, detailJson, detailText, indexJson, indexText } from "./inspect"
import { displayPath, EnvironmentError, findProject, mockupDirectory, type MockupProject } from "./project"
import { registryListJson, registryListText } from "./registry"
import { sdkDetail, sdkDetailJson, sdkDetailText, sdkIndexJson, sdkIndexText } from "./sdk"
import { readStates, selectStates } from "./states"
import { outFor, partsSummary, validateMockup } from "./validate"
import { version } from "./version"

const COMMANDS = new Set(["inspect", "build", "validate", "gallery", "clean"])
const VALUE_FLAGS = new Set([
  "--project",
  "--css",
  "--tsconfig",
  "--tailwind",
  "--theme",
  "--scheme",
  "--out",
  "--max",
  "--state",
])

const USAGE = `eskais-mockup ${version}: offline HTML mockups of a project's own components

  bun .agents/tools/eskais-mockup/cli.ts inspect [Names…] [--registry | --sdk] [--json]
  bun .agents/tools/eskais-mockup/cli.ts build <name> [--state <name>|all] [--theme <name>] [--scheme light|dark|system] [--out <file>] [--gallery]
  bun .agents/tools/eskais-mockup/cli.ts validate <name> [--state <name>|all] [--gallery]
  bun .agents/tools/eskais-mockup/cli.ts gallery [dir] [--json]
  bun .agents/tools/eskais-mockup/cli.ts clean [name]
  bun .agents/tools/eskais-mockup/cli.ts --version

Every command takes --project <dir>, --css <file> (the stylesheet), --tsconfig <file> and --tailwind <dir>
(a folder whose packages resolve Tailwind, in a workspace where only an app installs it).
inspect lists the project's components; --registry lists the registry items it has not installed,
--sdk the @ui-sdk subpaths it installs, and --sdk <name> one primitive's parts and props.
A mockup lives in <project>/.mockups/<name>/ with screen.tsx, fixtures.ts, parts/ and an optional
../wrapper.tsx. fixtures.ts may export states = { empty: {…}, error: {…} }, the screen's props in each named
state: --state <name> builds out-<name>-<theme>.html, --state all one page per state. Build each state and theme as out-<state>-<theme>.html, capture each as a PNG with the
same name, and gallery writes <dir>/gallery.html (default .mockups) with every screenshot. Exit codes: 0 ok, 1 problems to fix, 2 environment or usage error.`

type Options = {
  command: "inspect" | "build" | "validate" | "gallery" | "clean"
  names: string[]
  json: boolean
  gallery: boolean
  registry: boolean
  sdk: boolean
  max: number
  scheme: Scheme
  project?: string | undefined
  css?: string | undefined
  tsconfig?: string | undefined
  tailwind?: string | undefined
  theme?: string | undefined
  out?: string | undefined
  state?: string | undefined
}

function parseArgs(argv: string[]): Options | "help" | "version" {
  const [command, ...rest] = argv
  if (command === undefined || command === "help" || command === "--help" || command === "-h") return "help"
  if (command === "version" || command === "--version" || command === "-v") return "version"
  if (!COMMANDS.has(command)) {
    throw new EnvironmentError(`unknown command "${command}"; use inspect, build, validate, gallery or clean`)
  }
  const options: Options = {
    command: command as Options["command"],
    names: [],
    json: false,
    gallery: false,
    registry: false,
    sdk: false,
    max: DEFAULT_MAX_PROBLEMS,
    scheme: "system",
  }
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index] ?? ""
    const separator = argument.indexOf("=")
    const flag = separator === -1 ? argument : argument.slice(0, separator)
    const inline = separator === -1 ? undefined : argument.slice(separator + 1)
    if (flag === "--json") {
      options.json = true
      continue
    }
    if (flag === "--gallery") {
      options.gallery = true
      continue
    }
    if (flag === "--registry" || flag === "--sdk") {
      options[flag === "--registry" ? "registry" : "sdk"] = true
      if (inline !== undefined) options.names.push(inline)
      continue
    }
    if (flag === "--help" || flag === "-h") return "help"
    if (flag === "--version") return "version"
    if (VALUE_FLAGS.has(flag)) {
      const value = inline ?? rest[index + 1]
      if (value === undefined) throw new EnvironmentError(`${flag} needs a value`)
      if (inline === undefined) index += 1
      applyValue(options, flag, value)
      continue
    }
    if (flag.startsWith("-")) throw new EnvironmentError(`unknown option "${flag}"`)
    options.names.push(argument)
  }
  return options
}

function applyValue(options: Options, flag: string, value: string) {
  if (flag === "--max") {
    const max = Number(value)
    if (!Number.isInteger(max) || max < 1) throw new EnvironmentError(`--max needs a positive whole number`)
    options.max = max
    return
  }
  if (flag === "--scheme") {
    if (value !== "light" && value !== "dark" && value !== "system") {
      throw new EnvironmentError(`--scheme must be light, dark or system`)
    }
    options.scheme = value
    return
  }
  if (flag === "--state" && !/^[\w-]+$/.test(value)) throw new EnvironmentError(`"${value}" is not a state name`)
  if (flag === "--project") options.project = value
  if (flag === "--css") options.css = value
  if (flag === "--tsconfig") options.tsconfig = value
  if (flag === "--tailwind") options.tailwind = value
  if (flag === "--state") options.state = value
  if (flag === "--theme") options.theme = value
  if (flag === "--out") options.out = value
}

function mockupName(options: Options): string {
  const name = options.names[0]
  if (name === undefined) throw new EnvironmentError(`${options.command} needs a mockup name`)
  if (!/^[\w.-]+$/.test(name)) throw new EnvironmentError(`"${name}" is not a mockup name`)
  return name
}

function runGallery(options: Options, cwd: string): number {
  if (options.names.length > 1) throw new EnvironmentError("gallery takes one folder")
  const named = options.names[0]
  const dir =
    named === undefined ? join(findProject(projectOptions(options, cwd)).root, ".mockups") : resolve(cwd, named)
  const outcome = writeGallery(dir)
  if (options.json) console.log(JSON.stringify(galleryJson(outcome, cwd), null, 2))
  else for (const line of galleryLines(outcome, cwd)) console.log(line)
  return outcome.path === null ? 1 : 0
}

function printGallery(project: MockupProject, cwd: string) {
  const outcome = writeGallery(join(project.root, ".mockups"))
  console.log(galleryHeadline(outcome, cwd))
}

function projectOptions(options: Options, cwd: string) {
  return { cwd, project: options.project, css: options.css, tsconfig: options.tsconfig, tailwind: options.tailwind }
}

function statesLine(mockup: string): string[] {
  try {
    const states = readStates(mockup)
    return states === null || states.length === 0 ? [] : [`states ${states.length}: ${states.join(", ")}`]
  } catch {
    return []
  }
}

async function run(options: Options, cwd: string): Promise<number> {
  if (options.gallery && options.command !== "build" && options.command !== "validate") {
    throw new EnvironmentError("--gallery works with build and validate; use the gallery command")
  }
  if (options.state !== undefined && options.command !== "build" && options.command !== "validate") {
    throw new EnvironmentError("--state works with build and validate")
  }
  if (options.command === "gallery") return runGallery(options, cwd)
  const project = findProject(projectOptions(options, cwd))
  if (options.command === "inspect") {
    if (options.registry && options.sdk) {
      throw new EnvironmentError("inspect takes --registry or --sdk, not both")
    }
    if (options.registry) {
      if (options.names.length > 0) throw new EnvironmentError("inspect --registry takes no names")
      console.log(
        options.json
          ? JSON.stringify(await registryListJson(project, cwd), null, 2)
          : await registryListText(project, cwd),
      )
      return 0
    }
    if (options.sdk) {
      if (options.names.length === 0) {
        console.log(options.json ? JSON.stringify(sdkIndexJson(project), null, 2) : sdkIndexText(project, cwd))
        return 0
      }
      const details = options.names.map((name) => sdkDetail(project, name))
      console.log(
        options.json
          ? JSON.stringify(
              details.map((detail) => sdkDetailJson(detail, cwd)),
              null,
              2,
            )
          : details.map((detail) => sdkDetailText(detail, cwd)).join("\n\n"),
      )
      return 0
    }
    if (options.names.length === 0) {
      console.log(options.json ? JSON.stringify(indexJson(project, cwd), null, 2) : indexText(project, cwd))
      return 0
    }
    const details = options.names.map((name) => componentDetail(project, name))
    console.log(
      options.json
        ? JSON.stringify(
            details.map((detail) => detailJson(detail, cwd)),
            null,
            2,
          )
        : details.map((detail) => detailText(detail, cwd)).join("\n\n"),
    )
    return 0
  }
  if (options.command === "clean") {
    const target =
      options.names.length === 0 ? join(project.root, ".mockups") : mockupDirectory(project, options.names[0] ?? "")
    const shown = displayPath(target, cwd)
    if (!existsSync(target)) {
      console.log(`nothing to clean: ${shown} does not exist`)
      return 0
    }
    rmSync(target, { recursive: true, force: true })
    console.log(`removed ${shown}`)
    return 0
  }
  const settings = {
    name: mockupName(options),
    scheme: options.scheme,
    cwd,
    theme: options.theme,
    out: options.out,
  }
  const mockup = mockupDirectory(project, settings.name)
  if (!existsSync(join(mockup, "screen.tsx"))) {
    throw new EnvironmentError(
      `no mockup named ${settings.name}: ${displayPath(join(mockup, "screen.tsx"), cwd)} does not exist`,
    )
  }
  const states = selectStates(mockup, options.state)
  if (options.command === "build") {
    const outcomes: BuildOutcome[] = []
    for (const state of states) {
      // oxlint-disable-next-line no-await-in-loop -- each build writes the same entry file and registry cache
      outcomes.push(await buildMockup(project, { ...settings, state, out: outFor(options.out, state, states) }))
    }
    for (const warning of outcomes.flatMap((outcome) => outcome.warnings)) console.error(`warning: ${warning}`)
    const problems = outcomes.flatMap((outcome) => outcome.problems)
    if (problems.length > 0) {
      for (const line of formatProblems(problems, options.max)) console.log(line)
      return 1
    }
    for (const outcome of outcomes) console.log(summary(outcome, cwd))
    if (options.gallery) printGallery(project, cwd)
    return 0
  }
  const outcome = await validateMockup(project, settings, states)
  for (const warning of outcome.warnings) console.error(`warning: ${warning}`)
  const summaryLines = [...partsSummary(outcome.build.manifest), ...statesLine(mockup), screenshotSummary(mockup)]
  if (outcome.problems.length > 0) {
    for (const line of formatProblems(outcome.problems, options.max)) console.log(line)
    for (const line of summaryLines) console.log(line)
    return 1
  }
  for (const built of outcome.builds) console.log(`ok ${summary(built, cwd)}`)
  for (const line of summaryLines) console.log(line)
  if (options.gallery) printGallery(project, cwd)
  return 0
}

try {
  process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason)
    console.error(`warning: the mockup left a promise rejected (${message})`)
  })
  const options = parseArgs(process.argv.slice(2))
  if (options === "help") console.log(USAGE)
  else if (options === "version") console.log(`eskais-mockup ${version}`)
  else process.exitCode = await run(options, process.cwd())
} catch (error) {
  if (!(error instanceof EnvironmentError)) throw error
  console.error(error.message)
  process.exitCode = 2
}
