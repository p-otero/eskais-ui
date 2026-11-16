import { readdirSync, readFileSync } from "node:fs"
import { expect, test } from "vitest"

import { cn } from "@/lib/utils"

const theme = readFileSync("registry/styles/theme.css", "utf8")
const compact = readFileSync("registry/styles/theme-compact.css", "utf8")

const typeSteps = ["meta", "caption", "body-sm", "body", "title-sm", "title", "display-sm", "display"]

test("every type step has a size, line height and weight, and compact tightens all but meta", () => {
  for (const step of typeSteps) {
    expect(theme).toContain(`--text-${step}: var(--type-${step}-size);`)
    expect(theme).toContain(`--text-${step}--line-height: var(--type-${step}-leading);`)
    expect(theme).toMatch(new RegExp(`--text-${step}--font-weight: \\d+;`))
    expect(theme).toMatch(new RegExp(`--type-${step}-size: [\\d.]+rem;`))
  }
  for (const step of typeSteps.slice(1)) expect(compact).toContain(`--type-${step}-size:`)
  expect(theme).toContain("--tracking-meta: 0.12em;")
  expect(theme).toContain("--tracking-tight: -0.012em;")
  expect(theme).toContain('--font-mono: "Geist Mono Variable"')
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

test("the narrow variant ships with the theme item", () => {
  expect(theme).toContain("@custom-variant narrow (@media (width <= 47.5rem));")
  const registry = JSON.parse(readFileSync("registry.json", "utf8")) as {
    items: { name: string; css?: Record<string, unknown> }[]
  }
  const css = registry.items.find((item) => item.name === "theme")?.css ?? {}
  expect(Object.keys(css)).toContain("@custom-variant narrow (@media (width <= 47.5rem))")
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
