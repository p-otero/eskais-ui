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
    rolldownOptions: {
      preserveEntrySignatures: false,
      output: {
        keepNames: process.env.SHOWCASE_KEEP_NAMES === "1",
        // Each ?demo= page loads apart; the chunks pages share would cut one into 50 to 140 requests, each paying the
        // vitals' 150 ms of 4G latency over HTTP/1.1 (about 1 s of LCP). Shared chunks under 60 KB go into their users
        // instead: 10 to 25 files, about 10% more bytes. Each copy registers with a shared runtime, so it runs once.
        codeSplitting: { experimentalInlineCommonChunks: { maxSize: 60_000, exclude: /\.css/ } },
      },
    },
  },
  resolve: {
    alias: [
      { find: /^@\/components\/ui\/(.*)$/, replacement: `${fromRoot("registry/ui")}/$1` },
      { find: /^@\/lib\/(.*)$/, replacement: `${fromRoot("registry/lib")}/$1` },
    ],
  },
})
