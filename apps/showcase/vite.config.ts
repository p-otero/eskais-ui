import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const fromRoot = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@\/components\/ui\/(.*)$/, replacement: `${fromRoot("registry/ui")}/$1` },
      { find: /^@\/lib\/(.*)$/, replacement: `${fromRoot("registry/lib")}/$1` },
    ],
  },
})
