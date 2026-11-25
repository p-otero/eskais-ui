import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

import { routes } from "./src/routes"

const fromRoot = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url))

const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")

function staticRoutes(): Plugin {
  let outDir = ""
  return {
    name: "eskais-static-routes",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const shell = readFileSync(join(outDir, "index.html"), "utf8")
      for (const route of routes) {
        const depth = route.path === "/" ? 0 : route.path.split("/").length - 1
        const prefix = depth === 0 ? "./" : "../".repeat(depth)
        const html = shell
          .replaceAll('"./', `"${prefix}`)
          .replace(/<title>.*<\/title>/, `<title>${escapeHtml(route.title)}</title>`)
          .replace(/(<meta name="description" content=")[^"]*/, `$1${escapeHtml(route.description)}`)
          .replace("</title>", route.noindex ? '</title><meta name="robots" content="noindex" />' : "</title>")
        const file = join(outDir, route.path, "index.html")
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, html)
      }
      writeFileSync(join(outDir, "404.html"), shell)
    },
  }
}

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), staticRoutes()],
  resolve: {
    alias: [
      { find: /^@\/components\/ui\/(.*)$/, replacement: `${fromRoot("registry/ui")}/$1` },
      { find: /^@\/lib\/(.*)$/, replacement: `${fromRoot("registry/lib")}/$1` },
      { find: /^@\/components\/(?!ui\/)(.*)$/, replacement: `${fromRoot("registry/blocks")}/$1` },
    ],
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
})
