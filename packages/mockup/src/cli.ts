#!/usr/bin/env bun
import { existsSync, rmSync } from "node:fs"
import { join } from "node:path"

import { buildMockup, summary, type Scheme } from "./build"
import { DEFAULT_MAX_PROBLEMS, formatProblems } from "./checks"
import { componentDetail, detailJson, detailText, indexJson, indexText } from "./inspect"
import { displayPath, EnvironmentError, findProject, mockupDirectory } from "./project"
import { validateMockup } from "./validate"

const COMMANDS = new Set(["inspect", "build", "validate", "clean"])
const VALUE_FLAGS = new Set(["--project", "--css", "--theme", "--scheme", "--out", "--max"])

const USAGE = `eskais-mockup: offline HTML mockups of a project's own components

  bun <path>/src/cli.ts inspect [Names…] [--json] [--project <dir>] [--css <file>] [--max <n>]
  bun <path>/src/cli.ts build <name> [--theme <name>] [--scheme light|dark|system] [--out <file>]
  bun <path>/src/cli.ts validate <name>
  bun <path>/src/cli.ts clean [name]

A mockup lives in <project>/.mockups/<name>/ with screen.tsx, fixtures.ts and an optional
../wrapper.tsx. Exit codes: 0 ok, 1 problems to fix, 2 environment or usage error.`

type Options = {
  command: "inspect" | "build" | "validate" | "clean"
  names: string[]
  json: boolean
  max: number
  scheme: Scheme
  project?: string | undefined
  css?: string | undefined
  theme?: string | undefined
  out?: string | undefined
}

function parseArgs(argv: string[]): Options | null {
  const [command, ...rest] = argv
  if (command === undefined || command === "help" || command === "--help" || command === "-h") return null
  if (!COMMANDS.has(command)) {
    throw new EnvironmentError(`unknown command "${command}"; use inspect, build, validate or clean`)
  }
  const options: Options = {
    command: command as Options["command"],
    names: [],
    json: false,
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
    if (flag === "--help" || flag === "-h") return null
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
  if (flag === "--project") options.project = value
  if (flag === "--css") options.css = value
  if (flag === "--theme") options.theme = value
  if (flag === "--out") options.out = value
}

function mockupName(options: Options): string {
  const name = options.names[0]
  if (name === undefined) throw new EnvironmentError(`${options.command} needs a mockup name`)
  if (!/^[\w.-]+$/.test(name)) throw new EnvironmentError(`"${name}" is not a mockup name`)
  return name
}

async function run(options: Options, cwd: string): Promise<number> {
  const project = findProject({ cwd, project: options.project, css: options.css })
  if (options.command === "inspect") {
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
  if (options.command === "build") {
    const outcome = await buildMockup(project, settings)
    for (const warning of outcome.warnings) console.error(`warning: ${warning}`)
    if (outcome.problems.length > 0) {
      for (const line of formatProblems(outcome.problems, options.max)) console.log(line)
      return 1
    }
    console.log(summary(outcome, cwd))
    return 0
  }
  const outcome = await validateMockup(project, settings)
  for (const warning of outcome.warnings) console.error(`warning: ${warning}`)
  if (outcome.problems.length > 0) {
    for (const line of formatProblems(outcome.problems, options.max)) console.log(line)
    return 1
  }
  console.log(`ok ${summary(outcome.build, cwd)}`)
  return 0
}

try {
  process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason)
    console.error(`warning: the mockup left a promise rejected (${message})`)
  })
  const options = parseArgs(process.argv.slice(2))
  if (options === null) console.log(USAGE)
  else process.exitCode = await run(options, process.cwd())
} catch (error) {
  if (!(error instanceof EnvironmentError)) throw error
  console.error(error.message)
  process.exitCode = 2
}
