import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

import { reactCompiler } from "./react-compiler"

const fromRoot = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url))

export default defineConfig({
  plugins: [react(), process.env.REACT_COMPILER === "1" && reactCompiler(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@\/components\/ui\/(.*)$/, replacement: `${fromRoot("registry/ui")}/$1` },
      { find: /^@\/lib\/(.*)$/, replacement: `${fromRoot("registry/lib")}/$1` },
    ],
  },
})
