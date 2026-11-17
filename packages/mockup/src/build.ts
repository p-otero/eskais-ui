import { createHash } from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, extname, join, relative, resolve } from "node:path"
import { pathToFileURL, fileURLToPath } from "node:url"

import { pageProblems, reactDevBanner, type Problem } from "./checks"
import { readMockupParts, type Gap, type MockupParts, type ProposedPart, type SdkPart } from "./parts"
import { displayPath, EnvironmentError, mockupDirectory, specifierOf, type MockupProject } from "./project"
import { prepareRegistry, type InstallEntry } from "./registry"

export type Scheme = "light" | "dark" | "system"

export type BuildSettings = {
  name: string
  scheme: Scheme
  cwd: string
  theme?: string | undefined
  out?: string | undefined
}

export type BuildOutcome = {
  outPath: string
  manifestPath: string
  total: number
  js: number
  css: number
  fonts: number
  problems: Problem[]
  warnings: string[]
  manifest: MockupManifest
  parts: MockupParts
}

export type MockupManifest = {
  name: string
  date: string
  theme: string | null
  scheme: Scheme
  hashes: { screen: string | null; fixtures: string | null }
  components: string[]
  install: InstallEntry[]
  proposed: ProposedPart[]
  sdkParts: SdkPart[]
  gaps: Gap[]
  size: { total: number; js: number; css: number; fonts: number }
}

type CompileOptions = {
  base: string
  from: string
  onDependency: (path: string) => void
  shouldRewriteUrls: boolean
}

type TailwindCompiler = {
  build(candidates: string[]): string
}

type TailwindModule = {
  compile(css: string, options: CompileOptions): Promise<TailwindCompiler>
  Scanner: new (options: { sources: { base: string; pattern: string; negated: boolean }[] }) => { scan(): string[] }
}

const SIZE_WARNING = 3 * 1024 * 1024

const DATA_URL_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".otf": "font/otf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

const FONT_EXTENSIONS = new Set([".woff", ".woff2", ".ttf", ".otf"])

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function loadTailwind(project: MockupProject): Promise<TailwindModule> {
  const node = (await import(pathToFileURL(project.runtime.tailwindNode).href)) as {
    compile: TailwindModule["compile"]
  }
  const oxide = (await import(pathToFileURL(project.runtime.tailwindOxide).href)) as {
    Scanner: TailwindModule["Scanner"]
  }
  return { compile: node.compile, Scanner: oxide.Scanner }
}

function inlineAssets(css: string, base: string): { css: string; fonts: number } {
  let fonts = 0
  const inlined = css.replaceAll(/url\(\s*(["']?)([^)"']+)\1\s*\)/g, (match: string, _quote: string, href: string) => {
    if (href.startsWith("data:") || href.startsWith("#")) return match
    const file = resolve(base, href)
    if (!existsSync(file)) return match
    const bytes = readFileSync(file)
    const extension = extname(file).toLowerCase()
    if (FONT_EXTENSIONS.has(extension)) fonts += bytes.length
    const type = DATA_URL_TYPES[extension] ?? "application/octet-stream"
    return `url("data:${type};base64,${bytes.toString("base64")}")`
  })
  return { css: inlined, fonts }
}

async function compileCss(project: MockupProject, files: string[]): Promise<{ css: string; fonts: number }> {
  const tailwind = await loadTailwind(project)
  const from = project.css
  const compiler = await tailwind.compile(readFileSync(from, "utf8"), {
    base: dirname(from),
    from,
    onDependency: () => {},
    shouldRewriteUrls: true,
  })
  const sources = files.map((file) => ({ base: dirname(file), pattern: basename(file), negated: false }))
  const candidates = new tailwind.Scanner({ sources }).scan()
  return inlineAssets(compiler.build(candidates), dirname(from))
}

function entrySource(hasWrapper: boolean): string {
  return [
    `import { createRoot } from "react-dom/client"`,
    `import Screen from "./screen"`,
    ...(hasWrapper ? [`import Wrapper from "../wrapper"`] : []),
    ``,
    `const root = document.getElementById("root")`,
    `if (root === null) throw new Error("the mockup page has no #root element")`,
    hasWrapper ? `createRoot(root).render(<Wrapper><Screen /></Wrapper>)` : `createRoot(root).render(<Screen />)`,
    ``,
  ].join("\n")
}

function writeEntry(mockup: string): string {
  const entry = join(mockup, ".entry.tsx")
  writeFileSync(entry, entrySource(existsSync(join(dirname(mockup), "wrapper.tsx"))))
  return entry
}

const remoteImports = {
  name: "mockup-remote-imports",
  setup(build: {
    onResolve(
      options: { filter: RegExp },
      callback: (args: { path: string }) => { errors: { message: string }[] } | { path: string } | undefined,
    ): void
  }) {
    build.onResolve({ filter: /^(?:https?:)?\/\// }, (args) => ({
      errors: [{ message: `a mockup cannot import ${args.path}: the page loads nothing from the network` }],
    }))
  },
}

function cachedImports(cacheDirs: string[]) {
  return {
    name: "mockup-cached-imports",
    setup(build: {
      onResolve(
        options: { filter: RegExp },
        callback: (args: { path: string }) => { errors: { message: string }[] } | { path: string } | undefined,
      ): void
    }) {
      build.onResolve({ filter: /^@registry\// }, (args) => {
        const name = args.path.slice("@registry/".length)
        for (const dir of cacheDirs) {
          for (const extension of [".tsx", ".ts"]) {
            const file = join(dir, `${name}${extension}`)
            if (existsSync(file)) return { path: file }
          }
        }
        return {
          errors: [
            { message: `@registry/${name} is not in the registry cache; inspect --registry lists the item names` },
          ],
        }
      })
    },
  }
}

async function bundle(entry: string, outdir: string, cacheDirs: string[]): Promise<{ js: string; map: string | null }> {
  const result = await Bun.build({
    entrypoints: [entry],
    outdir,
    target: "browser",
    format: "esm",
    minify: true,
    sourcemap: "external",
    define: { "process.env.NODE_ENV": '"production"' },
    loader: {
      ".png": "dataurl",
      ".jpg": "dataurl",
      ".jpeg": "dataurl",
      ".gif": "dataurl",
      ".svg": "dataurl",
      ".webp": "dataurl",
      ".avif": "dataurl",
    },
    plugins: [remoteImports, ...(cacheDirs.length === 0 ? [] : [cachedImports(cacheDirs)])],
  })
  if (!result.success) {
    const logs = result.logs.map((log) => `${log.level}: ${log.message}`).join("\n")
    throw new EnvironmentError(`the mockup bundle failed:\n${logs}`)
  }
  const js = result.outputs.find((output) => output.kind === "entry-point")
  const map = result.outputs.find((output) => output.kind === "sourcemap")
  if (js === undefined) throw new EnvironmentError("the mockup bundle produced no JavaScript")
  return {
    js: readFileSync(js.path, "utf8"),
    map: map === undefined ? null : readFileSync(map.path, "utf8"),
  }
}

function bundledFiles(map: string | null, mapDir: string): string[] {
  if (map === null) return []
  const parsed = JSON.parse(map) as { sources?: string[] }
  return (parsed.sources ?? [])
    .map((source) => resolve(mapDir, source))
    .filter((source) => !source.includes("\0") && existsSync(source) && statSync(source).isFile())
}

function inlineScript(js: string): string {
  return js.replaceAll(/<\/script/gi, "<\\/script")
}

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")
}

function htmlAttributes(settings: BuildSettings): string {
  const attributes = [`data-color-scheme="${settings.scheme}"`]
  if (settings.theme !== undefined) attributes.unshift(`data-theme="${escapeAttribute(settings.theme)}"`)
  if (settings.scheme !== "system") attributes.push(`class="${settings.scheme}"`)
  return attributes.join(" ")
}

function assemble(settings: BuildSettings, css: string, js: string): string {
  const template = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "template.html"), "utf8")
  return template
    .replace("data-mockup-attributes", () => htmlAttributes(settings))
    .replace("{{title}}", () => escapeAttribute(settings.name))
    .replace("<!--mockup-style-->", () => `<style>${css}</style>`)
    .replace("<!--mockup-script-->", () => `<script type="module">${inlineScript(js)}</script>`)
}

function hashFile(path: string): string | null {
  return existsSync(path) ? createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 16) : null
}

function projectComponents(project: MockupProject, files: string[], mockup: string): string[] {
  const root = resolve(project.root)
  const owned = (file: string) => {
    const shown = relative(root, file)
    return !shown.startsWith("..") && !file.startsWith(mockup)
  }
  return [
    ...new Set(
      files
        .filter((file) => owned(file) && !/[\\/]node_modules[\\/]/.test(file))
        .map((file) => specifierOf(project, file))
        .filter((specifier): specifier is string => specifier !== null),
    ),
  ].toSorted()
}

function manifest(
  project: MockupProject,
  settings: BuildSettings,
  files: string[],
  sizes: { total: number; js: number; css: number; fonts: number },
  parts: { proposed: ProposedPart[]; sdkParts: SdkPart[]; gaps: Gap[] },
  install: InstallEntry[],
): MockupManifest {
  const mockup = mockupDirectory(project, settings.name)
  return {
    name: settings.name,
    date: new Date().toISOString(),
    theme: settings.theme ?? null,
    scheme: settings.scheme,
    hashes: {
      screen: hashFile(join(mockup, "screen.tsx")),
      fixtures: hashFile(join(mockup, "fixtures.ts")),
    },
    components: projectComponents(project, files, mockup),
    install,
    proposed: parts.proposed,
    sdkParts: parts.sdkParts,
    gaps: parts.gaps,
    size: { total: sizes.total, js: sizes.js, css: sizes.css, fonts: sizes.fonts },
  }
}

export function mockupSourceFiles(mockup: string): string[] {
  const found: string[] = []
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        visit(path)
        continue
      }
      if (/\.(ts|tsx)$/.test(entry.name)) found.push(path)
    }
  }
  if (existsSync(mockup)) visit(mockup)
  return found.toSorted()
}

export async function buildMockup(project: MockupProject, settings: BuildSettings): Promise<BuildOutcome> {
  const mockup = mockupDirectory(project, settings.name)
  const screen = join(mockup, "screen.tsx")
  if (!existsSync(screen)) {
    throw new EnvironmentError(`no mockup named ${settings.name}: ${displayPath(screen, settings.cwd)} does not exist`)
  }
  mkdirSync(dirname(mockup), { recursive: true })
  writeFileSync(join(project.root, ".mockups", ".gitignore"), "*\n")

  const parts = await readMockupParts(mockup, settings.cwd)
  const registry = await prepareRegistry(project, mockup, mockupSourceFiles(mockup))

  const entry = writeEntry(mockup)
  const outdir = mkdtempSync(join(tmpdir(), "eskais-mockup-"))
  let built: { js: string; map: string | null }
  let files: string[]
  try {
    built = await bundle(entry, outdir, registry.cacheDirs)
    files = bundledFiles(built.map, outdir)
  } finally {
    rmSync(entry, { force: true })
    rmSync(outdir, { recursive: true, force: true })
  }
  const { css, fonts } = await compileCss(project, files)
  const page = assemble(settings, css, built.js)

  const outPath = settings.out === undefined ? join(mockup, "out.html") : resolve(settings.cwd, settings.out)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, page)

  const sizes = {
    total: Buffer.byteLength(page),
    js: Buffer.byteLength(built.js),
    css: Buffer.byteLength(css),
    fonts,
  }
  const problems = pageProblems(page).map((message) => ({
    file: displayPath(outPath, settings.cwd),
    line: 1,
    column: 1,
    rule: "page",
    message,
  }))
  const outcome: BuildOutcome = {
    outPath,
    manifestPath: join(mockup, "manifest.json"),
    ...sizes,
    problems,
    warnings: [],
    manifest: manifest(project, settings, files, sizes, parts, registry.install),
    parts,
  }
  const banner = reactDevBanner(built.js)
  if (banner !== undefined) {
    outcome.problems.push({
      file: displayPath(outPath, settings.cwd),
      line: 1,
      column: 1,
      rule: "page",
      message: `bundles the React development build (${banner})`,
    })
  }
  if (outcome.total > SIZE_WARNING) {
    outcome.warnings.push(
      `${displayPath(outPath, settings.cwd)} is ${formatSize(outcome.total)}: the first paint may stall`,
    )
  }
  writeFileSync(outcome.manifestPath, `${JSON.stringify(outcome.manifest, null, 2)}\n`)
  return outcome
}

export function summary(outcome: BuildOutcome, cwd: string): string {
  const split = `(${formatSize(outcome.js)} js, ${formatSize(outcome.css)} css, ${formatSize(outcome.fonts)} fonts)`
  return `${displayPath(outcome.outPath, cwd)}  ${formatSize(outcome.total)} ${split}`
}
