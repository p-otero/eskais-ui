import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "@/lib": root("./registry/lib"),
      "@/components/ui": root("./registry/ui"),
      "@/components": root("./registry/blocks"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}", "packages/*/test/**/*.test.{ts,tsx}"],
    css: false,
  },
})
