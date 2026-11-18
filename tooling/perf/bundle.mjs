// Gzip size of each registry item with everything it imports (other items, UI SDK, lucide, CodeMirror…),
// React excluded since every app has it: the initial chunk, the lazily imported chunks, and the UI SDK share
// (a second build with @ui-sdk/* external).
import { createRequire } from "node:module"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { gzipSync } from "node:zlib"

const root = resolve(import.meta.dirname, "..", "..")
const require = createRequire(resolve(root, "apps", "showcase", "package.json"))
const { build } = await import(pathToFileURL(require.resolve("vite")).href)

const react = /^(react|react-dom)(\/.*)?$/
const uiSdk = /^@ui-sdk\//
const entryDir = resolve(import.meta.dirname, ".builds", "entries")

async function bundle(name, files, external) {
  await mkdir(entryDir, { recursive: true })
  const entry = resolve(entryDir, `${name}.ts`)
  const source = files.map((file) => `export * from ${JSON.stringify(resolve(root, file).replaceAll("\\", "/"))}`)
  await writeFile(entry, source.join("\n"))
  const output = await build({
    configFile: false,
    logLevel: "silent",
    root,
    resolve: {
      alias: [
        { find: /^@\/components\/ui\/(.*)$/, replacement: `${resolve(root, "registry", "ui")}/$1` },
        { find: /^@\/lib\/(.*)$/, replacement: `${resolve(root, "registry", "lib")}/$1` },
      ],
    },
    build: {
      write: false,
      minify: true,
      emptyOutDir: false,
      lib: { entry, formats: ["es"], fileName: "entry" },
      rolldownOptions: { external: (id) => react.test(id) || (external && uiSdk.test(id)) },
    },
  })
  const chunks = (Array.isArray(output) ? output[0] : output).output.filter((chunk) => chunk.type === "chunk")
  const initial = new Set([chunks.find((chunk) => chunk.isEntry).fileName])
  for (let added = true; added;) {
    added = false
    for (const chunk of chunks) {
      if (!initial.has(chunk.fileName)) continue
      for (const imported of chunk.imports) {
        if (!initial.has(imported) && chunks.some((other) => other.fileName === imported)) {
          initial.add(imported)
          added = true
        }
      }
    }
  }
  let initialBytes = 0
  let lazyBytes = 0
  for (const chunk of chunks) {
    if (initial.has(chunk.fileName)) initialBytes += gzip(chunk)
    else lazyBytes += gzip(chunk)
  }
  return { initialBytes, lazyBytes }
}

const gzip = (chunk) => gzipSync(chunk.code, { level: 9 }).length
const kb = (bytes) => Math.round(bytes / 102.4) / 10

/** `uiSdkShare: false` skips the second build per item, for CI, which checks only the total. */
async function measureBundles({ items: names, uiSdkShare = true } = {}) {
  const registry = JSON.parse(await readFile(resolve(root, "registry.json"), "utf8"))
  const items = registry.items
    .filter((item) => ["registry:ui", "registry:lib", "registry:block"].includes(item.type))
    .filter((item) => !names || names.includes(item.name))
    .map((item) => ({ name: item.name, files: item.files.map((file) => file.path).filter((p) => /\.tsx?$/.test(p)) }))
    .filter((item) => item.files.length > 0 && !item.files.some((file) => file.endsWith("test-utils.ts")))
  const rows = []
  for (const item of items) {
    try {
      const full = await bundle(item.name, item.files, false)
      if (!uiSdkShare) {
        rows.push({ item: item.name, gzipKB: kb(full.initialBytes), lazyKB: kb(full.lazyBytes) })
        continue
      }
      const own = await bundle(item.name, item.files, true)
      rows.push({
        item: item.name,
        gzipKB: kb(full.initialBytes),
        lazyKB: kb(full.lazyBytes),
        uiSdkKB: kb(full.initialBytes - own.initialBytes),
        uiSdkShare: `${String(Math.round(((full.initialBytes - own.initialBytes) / full.initialBytes) * 100))}%`,
      })
    } catch (error) {
      if (!uiSdkShare) throw error
      rows.push({ item: item.name, error: String(error.message ?? error).slice(0, 120) })
    }
  }
  return rows.toSorted((a, b) => (b.gzipKB ?? 0) - (a.gzipKB ?? 0))
}

export { measureBundles }

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const only = process.argv.slice(2)
  console.table(await measureBundles(only.length > 0 ? { items: only } : {}))
}
