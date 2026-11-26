import { spawnSync } from "node:child_process"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join, matchesGlob, resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { afterAll, expect, test } from "vitest"

import registry from "../registry.json"

type RuleSetting = string | [string, ...unknown[]]
type LintConfig = {
  extends?: string[]
  plugins?: string[]
  jsPlugins?: string[]
  rules?: Record<string, RuleSetting>
  overrides?: { files: string[]; rules: Record<string, RuleSetting> }[]
}
type Directive = { file: string; installedAt: string; line: number; rule: string }

const presetPath = "registry/rules/eskais-ui.oxlintrc.json"
const installedDirectory: Record<string, string> = {
  "registry:ui": "src/components/ui",
  "registry:lib": "src/lib",
  "registry:hook": "src/hooks",
  "registry:component": "src/components",
}
const oxlintDefaultPlugins = ["unicorn", "typescript", "oxc"]

const shippedFiles = (registry.items as { files?: { path: string; type: string }[] }[])
  .flatMap((item) => item.files ?? [])
  .filter((file) => file.type in installedDirectory)
  .map((file) => ({ path: file.path, installedAt: `${installedDirectory[file.type]}/${basename(file.path)}` }))

const directivePattern = /oxlint-disable(?:-next-line|-line)?\s+(.+?)(?:\s+--|\s*\*\/|$)/

function directivesIn(file: { path: string; installedAt: string }): Directive[] {
  return readFileSync(file.path, "utf8")
    .split("\n")
    .flatMap((text, index) => {
      const rules = directivePattern.exec(text)?.[1]
      if (!rules) return []
      return rules.split(",").map((rule) => ({ ...file, file: file.path, line: index + 1, rule: rule.trim() }))
    })
}

const directives = shippedFiles.flatMap(directivesIn)

function readConfig(path: string): LintConfig {
  return JSON.parse(readFileSync(path, "utf8")) as LintConfig
}

const preset = readConfig(presetPath)
const extended = (preset.extends ?? []).map((path) => readConfig(path))

function severity(setting: RuleSetting | undefined) {
  return Array.isArray(setting) ? setting[0] : setting
}

function settingAt(rule: string, installedAt: string) {
  let setting: RuleSetting | undefined
  for (const config of [...extended, preset]) setting = config.rules?.[rule] ?? setting
  for (const override of preset.overrides ?? []) {
    if (override.files.some((glob) => matchesGlob(installedAt, glob))) setting = override.rules[rule] ?? setting
  }
  return severity(setting)
}

async function jsPluginRules() {
  const sources: Record<string, string> = {
    eskais: pathToFileURL(resolve("registry/rules/eskais-oxlint-plugin.js")).href,
    "p-otero": pathToFileURL(resolve("node_modules/@p-otero/oxlint-rules/dist/plugin.js")).href,
    shadcn: "@shadcn/lint",
  }
  const rules = new Map<string, Set<string>>()
  for (const [prefix, source] of Object.entries(sources)) {
    const plugin = (await import(source)) as { default: { rules: Record<string, unknown> } }
    rules.set(prefix, new Set(Object.keys(plugin.default.rules)))
  }
  return rules
}

const consumer = mkdtempSync(join(tmpdir(), "eskais-lint-directives-"))
afterAll(() => {
  const linkedNodeModules = join(consumer, "node_modules")
  if (existsSync(linkedNodeModules)) unlinkSync(linkedNodeModules)
  rmSync(consumer, { recursive: true, force: true })
})

function installLikeShadcn() {
  for (const file of shippedFiles) {
    mkdirSync(dirname(join(consumer, file.installedAt)), { recursive: true })
    copyFileSync(file.path, join(consumer, file.installedAt))
  }
  symlinkSync(resolve("node_modules"), join(consumer, "node_modules"), "junction")
  copyFileSync(presetPath, join(consumer, "eskais-ui.oxlintrc.json"))
  copyFileSync("registry/rules/eskais-oxlint-plugin.js", join(consumer, "eskais-oxlint-plugin.js"))
  writeFileSync(join(consumer, "package.json"), JSON.stringify({ type: "module" }))
  writeFileSync(
    join(consumer, "components.json"),
    JSON.stringify({
      tailwind: { config: "", css: "src/index.css", cssVariables: true },
      aliases: { components: "@/components", ui: "@/components/ui", utils: "@/lib/utils", lib: "@/lib" },
    }),
  )
  writeFileSync(
    join(consumer, "src/index.css"),
    `@import "tailwindcss";\n${readFileSync("registry/styles/theme.css", "utf8")}`,
  )
  writeFileSync(
    join(consumer, ".oxlintrc.json"),
    JSON.stringify({ extends: ["./eskais-ui.oxlintrc.json"], options: { reportUnusedDisableDirectives: "error" } }),
  )
}

test("every rule a shipped file suppresses comes from a plugin the consumer preset loads, and is on where the file lands", async () => {
  expect(directives.length).toBeGreaterThan(0)
  const plugins = new Set([
    ...oxlintDefaultPlugins,
    ...extended.flatMap((c) => c.plugins ?? []),
    ...(preset.plugins ?? []),
  ])
  const jsRules = await jsPluginRules()
  const missing = directives.flatMap(({ file, line, rule, installedAt }) => {
    const prefix = rule.includes("/") ? rule.slice(0, rule.indexOf("/")) : undefined
    const where = `${file}:${String(line)} ${rule}`
    if (prefix === undefined) return []
    const fromJsPlugin = jsRules.get(prefix)
    if (!fromJsPlugin) return plugins.has(prefix) ? [] : [`${where}: the preset doesn't load the ${prefix} plugin`]
    if (!fromJsPlugin.has(rule.slice(prefix.length + 1))) return [`${where}: the ${prefix} plugin has no such rule`]
    const on = settingAt(rule, installedAt)
    return on === undefined || on === "off" ? [`${where}: off in ${presetPath} at ${installedAt}`] : []
  })
  expect(missing).toEqual([])
})

test("linting the installed files with the consumer preset reports no error and no unused disable directive", () => {
  installLikeShadcn()
  const { stdout, stderr } = spawnSync(
    process.execPath,
    [resolve("node_modules/oxlint/bin/oxlint"), "--format", "default", "src"],
    {
      cwd: consumer,
      encoding: "utf8",
    },
  )
  const output = stdout + stderr
  const lintedFiles = Number(/Finished in .* on (\d+) files/.exec(output)?.[1] ?? 0)
  expect(lintedFiles, output).toBeGreaterThanOrEqual(shippedFiles.length)
  const unused = output.split("Unused oxlint-disable directive").length - 1
  expect(unused, output).toBe(0)
  const errors = /Found \d+ warnings? and (\d+) errors?/.exec(output)?.[1]
  expect(errors, output).toBe("0")
}, 60_000)
