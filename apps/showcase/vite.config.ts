import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

import { reactCompiler } from "./react-compiler"

const fromRoot = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url))

export default defineConfig({
  plugins: [react(), process.env.REACT_COMPILER === "1" && reactCompiler(), tailwindcss()],
  // tooling/perf builds into its own folders, and keeps component names so its render counts can name them.
  build: {
    outDir: process.env.SHOWCASE_OUT_DIR ?? "dist",
    rolldownOptions: { output: { keepNames: process.env.SHOWCASE_KEEP_NAMES === "1" } },
  },
  resolve: {
    alias: [
      { find: /^@\/components\/ui\/(.*)$/, replacement: `${fromRoot("registry/ui")}/$1` },
      { find: /^@\/lib\/(.*)$/, replacement: `${fromRoot("registry/lib")}/$1` },
    ],
  },
})
