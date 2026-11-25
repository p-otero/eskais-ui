import { readdirSync, rmSync } from "node:fs"
import { createRequire } from "node:module"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { gzipSync } from "node:zlib"

const here = import.meta.dirname
const root = resolve(here, "../..")
const { build } = await import(
  pathToFileURL(createRequire(join(root, "apps/showcase/package.json")).resolve("vite")).href
)
const out = join(here, ".out")
const entries = readdirSync(here)
  .filter((file) => file.endsWith(".ts"))
  .map((file) => file.slice(0, -3))

const size = (list) => list.reduce((sum, chunk) => sum + Buffer.byteLength(chunk.code), 0)
const gzip = (list) => list.reduce((sum, chunk) => sum + gzipSync(chunk.code, { level: 9 }).length, 0)

const rows = []
for (const name of entries) {
  rmSync(out, { recursive: true, force: true })
  // Perf: one build at a time: they share the output folder and each one is memory-heavy.
  // oxlint-disable-next-line no-await-in-loop
  const result = await build({
    configFile: false,
    logLevel: "silent",
    root,
    resolve: {
      alias: [
        { find: /^@\/components\/ui\/(.*)$/, replacement: `${root}/registry/ui/$1` },
        { find: /^@\/lib\/(.*)$/, replacement: `${root}/registry/lib/$1` },
      ],
    },
    define: { "process.env.NODE_ENV": '"production"' },
    build: {
      outDir: out,
      write: false,
      minify: true,
      lib: { entry: join(here, `${name}.ts`), formats: ["es"], fileName: name },
      rolldownOptions: { external: ["react", "react-dom", "react/jsx-runtime", "react-dom/client"] },
    },
  })
  const chunks = (Array.isArray(result) ? result : [result])
    .flatMap((output) => output.output)
    .filter((chunk) => chunk.type === "chunk")
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))
  const eagerNames = new Set()
  const visit = (chunk) => {
    if (!chunk || eagerNames.has(chunk.fileName)) return
    eagerNames.add(chunk.fileName)
    for (const file of chunk.imports) visit(byName.get(file))
  }
  for (const chunk of chunks) if (chunk.isEntry) visit(chunk)
  const eager = chunks.filter((chunk) => eagerNames.has(chunk.fileName))
  const lazy = chunks.filter((chunk) => !eagerNames.has(chunk.fileName))
  rows.push({ name, min: size(eager), gzip: gzip(eager), lazyChunks: lazy.length, lazyMin: size(lazy) })
}
rmSync(out, { recursive: true, force: true })
const kb = (bytes) => (bytes / 1024).toFixed(1)
console.log("| entry | min KB | gzip KB | lazy chunks | lazy min KB |")
console.log("| --- | ---: | ---: | ---: | ---: |")
for (const row of rows)
  console.log(`| ${row.name} | ${kb(row.min)} | ${kb(row.gzip)} | ${row.lazyChunks} | ${kb(row.lazyMin)} |`)
