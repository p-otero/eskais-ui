import { readdirSync, readFileSync } from "node:fs"
import { expect, test } from "vitest"

import { cn } from "@/lib/utils"

const theme = readFileSync("registry/styles/theme.css", "utf8")
const compact = readFileSync("registry/styles/theme-compact.css", "utf8")

const typeSteps = ["meta", "caption", "body-sm", "body", "title-sm", "title", "display-sm", "display"]

test("every type step has a size and line height, and compact tightens all but meta", () => {
  for (const step of typeSteps) {
    expect(theme).toContain(`--text-${step}: var(--type-${step}-size);`)
    expect(theme).toContain(`--text-${step}--line-height: var(--type-${step}-leading);`)
    expect(theme).toMatch(new RegExp(`--type-${step}-size: [\\d.]+rem;`))
  }
  for (const step of typeSteps.slice(1)) expect(compact).toContain(`--type-${step}-size:`)
  expect(theme).toContain("--tracking-meta: 0.12em;")
  expect(theme).toContain("--tracking-tight: -0.012em;")
  expect(theme).toContain('--font-mono: "Geist Mono Variable"')
})

// Body text inherits its weight, so <strong>, <b> and <th> stay bold; labels, titles and display text set one.
test.each(["caption", "body-sm", "body"])("text-%s sets no font weight", (step) => {
  expect(theme).not.toContain(`--text-${step}--font-weight`)
})

test.each(["meta", "title-sm", "title", "display-sm", "display"])("text-%s sets a font weight", (step) => {
  expect(theme).toMatch(new RegExp(`--text-${step}--font-weight: \\d+;`))
})

test("the theme item brings the cn that knows its utilities", () => {
  const registry = JSON.parse(readFileSync("registry.json", "utf8")) as {
    items: { name: string; registryDependencies?: string[] }[]
  }
  expect(registry.items.find((item) => item.name === "theme")?.registryDependencies).toContain("@eskais/utils")
  expect(cn("text-meta", "text-muted-foreground")).toBe("text-meta text-muted-foreground")
  expect(cn("gap-items", "gap-4")).toBe("gap-4")
  expect(cn("rounded-surface", "rounded-none")).toBe("rounded-none")
  expect(cn("rounded-control", "rounded-md")).toBe("rounded-md")
  expect(cn("shadow-floating", "shadow-lg")).toBe("shadow-lg")
  expect(cn("shadow-surface", "shadow-none")).toBe("shadow-none")
})

test("a type step merges as a font size, not a colour", () => {
  expect(cn("text-title text-muted-foreground")).toBe("text-title text-muted-foreground")
  expect(cn("text-title", "text-lg")).toBe("text-lg")
  expect(cn("tracking-meta", "tracking-wide")).toBe("tracking-wide")
})

test("links have their own text colours, and nothing uses the accent surface as text", () => {
  expect(theme).toContain("--color-link: var(--link);")
  expect(theme).toContain("--color-link-soft: var(--link-soft);")
  expect(readFileSync("registry/ui/button.tsx", "utf8")).toContain('link: "text-link ')
  const sources = readdirSync("registry/ui").map((file) => readFileSync(`registry/ui/${file}`, "utf8"))
  for (const source of sources) expect(source).not.toMatch(/text-accent(?!-foreground)/)
})

test("the accent surface is never a stroke", () => {
  const files = ["ui", "lib"].flatMap((folder) =>
    readdirSync(`registry/${folder}`).map((file) => readFileSync(`registry/${folder}/${file}`, "utf8")),
  )
  for (const source of files) {
    expect(source).not.toMatch(/\b(border|ring|outline|stroke|fill|decoration|divide|caret)(-[a-z]{1,2})?-accent\b/)
    expect(source).not.toMatch(/(border|outline|stroke|fill)[\w-]*:\s*var\(--accent\)/)
  }
})

test("links derive from their own seed, which each palette sets", () => {
  expect(theme).toContain("--link-brand: oklch(0.55 0.2 260);")
  expect(theme).not.toMatch(/--link(-soft)?: oklch\(from var\(--brand\)/)
  expect(theme.match(/--link: oklch\(from var\(--link-brand\)/g)).toHaveLength(3)
  const palettes = readFileSync("registry/styles/palettes.css", "utf8")
  for (const palette of ["neutral", "blue", "violet", "green", "orange"]) {
    expect(palettes).toMatch(new RegExp(`\\[data-palette="${palette}"\\] \\{[^}]*--link-brand: oklch`))
  }
})

test("layers and motion come from tokens, with toasts and popovers above dialogs", () => {
  const z = (name: string) => Number(theme.match(new RegExp(`--z-index-${name}: (\\d+);`))?.[1])
  expect(z("sticky")).toBeLessThan(z("overlay"))
  expect(z("overlay")).toBeLessThan(z("popover"))
  expect(z("popover")).toBeLessThan(z("toast"))
  expect(theme).toContain("--transition-duration-micro: 140ms;")
  expect(theme).toContain("--transition-duration-panel: 180ms;")
  expect(theme).toContain("--transition-duration-dialog: 200ms;")
  expect(theme).toContain("--ease-standard:")
  const sources = readdirSync("registry/ui").map((file) => readFileSync(`registry/ui/${file}`, "utf8"))
  for (const source of sources) expect(source).not.toMatch(/\b(z-(30|40|50)|duration-\d+|ease-(in|out|in-out))\b/)
  expect(cn("z-overlay", "z-50")).toBe("z-50")
  expect(cn("duration-micro", "duration-300")).toBe("duration-300")
})

test("the narrow and dark variants ship with the theme item", () => {
  expect(theme).toContain("@custom-variant narrow (@media (width <= 47.5rem));")
  const registry = JSON.parse(readFileSync("registry.json", "utf8")) as {
    items: { name: string; css?: Record<string, unknown> }[]
  }
  const css = registry.items.find((item) => item.name === "theme")?.css ?? {}
  expect(Object.keys(css)).toContain("@custom-variant narrow (@media (width <= 47.5rem))")
  const optedOut = ':root:not(.light, [data-color-scheme="light"])'
  expect(css["@custom-variant dark"]).toEqual({
    "&:where(.dark, .dark *)": { "@slot": {} },
    "@media (prefers-color-scheme: dark)": {
      [`&:where(${optedOut})`]: { "@slot": {} },
      [`&:where(${optedOut} *)`]: { "@slot": {} },
    },
  })
})

// shadcn merges a rule into the stylesheet by its exact selector or at-rule params. Prettier, Biome and oxfmt put each
// selector of a list on its own line and wrap anything past 80 columns, so such a key never matches after formatting.
test("every rule in the theme items keeps its key through a formatter", () => {
  const registry = JSON.parse(readFileSync("registry.json", "utf8")) as {
    items: { name: string; css?: Record<string, unknown> }[]
  }
  const unstable: string[] = []
  const walk = (node: Record<string, unknown>, depth: number) => {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value !== "object" || value === null) continue
      const outsideParens = key.replaceAll(/\((?:[^()]|\([^()]*\))*\)|\[[^\]]*\]/g, "")
      // Four-space indentation, the widest common setting, with " {" after the key.
      if (depth * 4 + key.length + 2 > 80 || (!key.startsWith("@") && outsideParens.includes(","))) unstable.push(key)
      walk(value as Record<string, unknown>, depth + 1)
    }
  }
  for (const item of registry.items) if (item.css) walk(item.css, 0)
  expect(unstable).toEqual([])
})

test("the theme item gives shadcn nothing to mirror into @theme inline as a self-reference", () => {
  const registry = JSON.parse(readFileSync("registry.json", "utf8")) as {
    items: {
      name: string
      cssVars?: Record<"theme" | "light" | "dark", Record<string, string>>
      css?: Record<string, unknown>
    }[]
  }
  const item = registry.items.find((entry) => entry.name === "theme")!
  const { theme: inline, light, dark } = item.cssVars!
  // shadcn adds `--color-x: var(--x)` for a value starting with hsl, rgb, # or oklch, and `--x: var(--x)` otherwise.
  for (const [name, value] of [...Object.entries(light), ...Object.entries(dark)]) {
    expect(value).toMatch(/^(hsl|rgb|#|oklch)/)
    expect(inline).toHaveProperty(`color-${name}`)
  }
  expect(item.css?.[":root"]).toMatchObject({ "--brand": "oklch(0.205 0 0)", "--radius": "1rem" })
  expect(item.css?.[".dark"]).toHaveProperty("--floating-shadow")
  for (const step of ["sm", "md", "lg", "xl", "2xl", "3xl", "4xl"]) expect(inline).toHaveProperty(`radius-${step}`)
  expect(item.css?.["@layer base"]).toMatchObject({
    "*": { "@apply border-border outline-ring/50": {} },
    body: { "@apply bg-background text-foreground": {} },
  })
})

test("chart series with a meaning have tokens in light, dark and the no-JS dark fallback, and Tailwind colours", () => {
  for (const series of ["positive", "negative", "target", "remaining"]) {
    expect(theme.match(new RegExp(`--series-${series}: `, "g"))).toHaveLength(3)
    expect(theme).toContain(`--color-series-${series}: var(--series-${series});`)
  }
})

test("small controls get a touch hit area on coarse pointers", () => {
  expect(theme).toContain("--control-height-touch: 2.75rem;")
  expect(theme).toMatch(/@media \(pointer: coarse\) \{\s+\.touch-target \{/)
  for (const file of ["button", "toggle", "tabs", "segmented-control", "checkbox", "radio-group", "switch"]) {
    expect(readFileSync(`registry/ui/${file}.tsx`, "utf8")).toContain('"touch-target ')
  }
  for (const file of ["sidebar-items", "label", "field"]) {
    expect(readFileSync(`registry/ui/${file}.tsx`, "utf8")).toContain("pointer-coarse:")
  }
})

function declarations(css: string, opening: string) {
  const start = css.indexOf(opening)
  const body = css.slice(start + opening.length, css.indexOf("\n}\n", start))
  return [...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(
    ([, name, value]) => `${name}: ${value!.replaceAll(/\s+/g, " ")}`,
  )
}

test("the no-JS dark fallback declares exactly what .dark does, unless <html> opted into light", () => {
  const dark = [
    ...declarations(theme, "\n.dark {"),
    ...declarations(theme, "\n.dark,\n.dark [data-palette],\n[data-palette].dark {"),
  ]
  const fallback = declarations(theme, "\n@media (prefers-color-scheme: dark) {")
  expect(fallback.toSorted()).toEqual(dark.toSorted())
  expect(theme).toContain(':root:where(:not(.light, [data-color-scheme="light"])) [data-palette]')
})
