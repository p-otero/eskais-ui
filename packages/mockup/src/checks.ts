export type Problem = {
  file: string
  line: number
  column: number
  rule: string
  message: string
}

export const DEFAULT_MAX_PROBLEMS = 20

const VIEWPORT_HEIGHT_UNIT = /\b\d+(\.\d+)?[dls]?vh\b|\b(min-|max-)?h-(screen|[dls]?vh)\b/
const VIEWPORT_HEIGHT_UNITS = new RegExp(VIEWPORT_HEIGHT_UNIT.source, "g")
const REACT_DEV_BANNER = /Download the React DevTools[^"`]{0,40}/
const TEMPLATE_PLACEHOLDER = /data-mockup-attributes|<!--mockup-(style|script)-->|\{\{title\}\}/

const BARE_CONTROLS = /<(button|input|select|textarea)\b/g
const NETWORK_CALL = /\bfetch\s*\(|\b(?:XMLHttpRequest|WebSocket|EventSource)\b/g
const IMPORT_SPECIFIER =
  /\bimport\s+(?:type\s+)?(?:[^"'`;]*?\bfrom\s*)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']/g
const RAWS =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|divide|shadow|accent|caret|placeholder)-(?:white|black)\b|\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|divide|shadow|accent|caret|placeholder)-\[[^\]\n]*?(?:#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|oklch\(|color\()|\b(?:color|background|backgroundColor|borderColor|fill|stroke)\s*:\s*["'](?:#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|oklch\()/g
const ARBITRARY_VALUES =
  /\b(?:w|h|size|min-w|min-h|max-w|max-h|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y|inset|top|right|bottom|left|start|end|text|leading|tracking|rounded|basis|grid-cols|grid-rows|translate-x|translate-y)-\[[^\]\n]+\]/g
const ALLOWED_ARBITRARY = new Set(["max-h-[calc(100%-2rem)]", "w-[calc(100%-2rem)]"])

export type ImportedSpecifier = { specifier: string; line: number; column: number }

export function importsOf(source: string): ImportedSpecifier[] {
  return [...source.matchAll(IMPORT_SPECIFIER)].map((match) => ({
    specifier: match[1] ?? match[2] ?? "",
    ...position(source, match.index),
  }))
}

export function viewportHeightUnit(page: string): string | undefined {
  return page.match(VIEWPORT_HEIGHT_UNIT)?.[0]
}

export function reactDevBanner(bundle: string): string | undefined {
  return bundle.match(REACT_DEV_BANNER)?.[0]
}

export function pageProblems(page: string): string[] {
  const markup = page
    .replaceAll(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi, "")
    .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
  const styles = [...page.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]).join("\n")
  const problems: string[] = []
  if (/<script[^>]+src=/i.test(markup)) problems.push("still loads an external script")
  if (/<link[^>]+rel="?(stylesheet|preload|modulepreload)/i.test(markup)) {
    problems.push("still loads an external stylesheet")
  }
  if (/<img[^>]+src="?(?!data:)/i.test(markup)) problems.push("still loads an external image")
  if (/@import\b/i.test(styles)) problems.push("still imports a stylesheet")
  if (/url\((?!\s*["']?data:)/i.test(styles)) problems.push("still loads an asset that is not inlined")
  if (TEMPLATE_PLACEHOLDER.test(page)) problems.push("still has a template placeholder")
  return problems
}

export function position(source: string, index: number): { line: number; column: number } {
  const before = source.slice(0, Math.max(0, index))
  return { line: before.split("\n").length, column: index - before.lastIndexOf("\n") }
}

function matches(
  source: string,
  pattern: RegExp,
  build: (match: RegExpExecArray) => { rule: string; message: string } | null,
): Omit<Problem, "file">[] {
  const found: { at: number; problem: Omit<Problem, "file"> }[] = []
  for (const match of source.matchAll(pattern)) {
    const built = build(match)
    if (built === null) continue
    found.push({ at: match.index, problem: { ...built, ...position(source, match.index) } })
  }
  return found.toSorted((left, right) => left.at - right.at).map((entry) => entry.problem)
}

function importName(specifier: string): string {
  return specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : (specifier.split("/")[0] ?? "")
}

export function importRule(prefixes: string[], dependencies: Set<string>): (specifier: string) => boolean {
  return (specifier) => {
    if (specifier.startsWith(".")) return true
    if (prefixes.some((prefix) => specifier.startsWith(prefix))) return true
    return dependencies.has(importName(specifier))
  }
}

export function sourceProblems(file: string, source: string, allowed: (specifier: string) => boolean): Problem[] {
  const problems = [
    ...matches(source, NETWORK_CALL, (match) => ({
      rule: "no-network",
      message: `${match[0].replace(/\s+$/, "")} calls the network; a mockup is one offline file`,
    })),
    ...matches(source, BARE_CONTROLS, (match) => ({
      rule: "bare-control",
      message: `a bare <${match[1] ?? "button"}> is invisible to agents and unstyled; use the project's own control part`,
    })),
    ...matches(source, IMPORT_SPECIFIER, (match) => {
      const specifier = match[1] ?? match[2] ?? ""
      return allowed(specifier)
        ? null
        : {
            rule: "import-specifier",
            message: `"${specifier}" is not the project's: import through an alias, a relative path or a dependency`,
          }
    }),
  ]
  return problems
    .map((problem) => ({ ...problem, file }))
    .toSorted((left, right) => left.line - right.line || left.column - right.column)
}

export function sdkImportProblems(file: string, source: string, publicSpecifiers: Set<string>): Problem[] {
  const problems = importsOf(source)
    .filter(({ specifier }) => specifier.startsWith("@ui-sdk/"))
    .flatMap(({ specifier, line, column }) => {
      if (publicSpecifiers.has(specifier)) return []
      const bare = !specifier.slice("@ui-sdk/".length).includes("/")
      return [
        {
          file,
          line,
          column,
          rule: "sdk-subpath",
          message: bare
            ? `import @ui-sdk from a public subpath, like "${specifier}/dialog"`
            : `"${specifier}" is not a public @ui-sdk subpath of an installed package`,
        },
      ]
    })
  return problems
}

/**
 * Only the mockup's own files: an installed block may size itself to the viewport (Shell sets
 * --shell-height: 100dvh), and the bundle and stylesheet carry every installed component.
 */
export function viewportProblems(file: string, source: string): Problem[] {
  return matches(source, VIEWPORT_HEIGHT_UNITS, (match) => ({
    rule: "viewport-unit",
    message: `${match[0]} is a viewport height unit; size the screen from its container (h-full, min-h-full)`,
  })).map((problem) => ({ ...problem, file }))
}

export function partStyleProblems(file: string, source: string): Problem[] {
  const problems = [
    ...matches(source, RAWS, (match) => ({
      rule: "shadcn/no-raw-colors",
      message: `${match[0]} is a raw colour; use a theme token (bg-card, text-muted-foreground, border-input)`,
    })),
    ...matches(source, ARBITRARY_VALUES, (match) =>
      ALLOWED_ARBITRARY.has(match[0]) || /#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|oklch\(|color\(/.test(match[0])
        ? null
        : {
            rule: "shadcn/no-arbitrary-values",
            message: `${match[0]} is an arbitrary size; use the Tailwind scale or a theme token`,
          },
    ),
  ]
  return problems
    .map((problem) => ({ ...problem, file }))
    .toSorted((left, right) => left.line - right.line || left.column - right.column)
}

export function formatProblem(problem: Problem): string {
  return `${problem.file}:${problem.line}:${problem.column} ${problem.rule} ${problem.message}`
}

export function formatProblems(problems: Problem[], max: number): string[] {
  const shown = problems.slice(0, max).map(formatProblem)
  if (problems.length > max) shown.push(`… ${problems.length - max} more problems (raise --max to see them)`)
  return shown
}
