import { readFileSync } from "node:fs"
import { expect, test } from "vitest"

const compactCss = readFileSync("registry/styles/theme-compact.css", "utf8").replaceAll(/\/\*[\s\S]*?\*\//g, "")
const themeCss = readFileSync("registry/styles/theme.css", "utf8").replaceAll(/\/\*[\s\S]*?\*\//g, "")

function tokens(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`no ${selector} rule`)
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start))
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value]))
}

const radiusTokens = ["--radius", "--control-radius", "--choice-radius", "--surface-radius", "--floating-radius"]
const compact = tokens(compactCss, '[data-density="compact"],\n[data-theme="compact"]:not([data-density])')
const root = tokens(themeCss, ":where(:root)")

test("compact density sets no radius, and data-theme=compact adds the md radius unless data-radius is set", () => {
  for (const name of radiusTokens) expect(compact).not.toHaveProperty(name)
  expect(tokens(compactCss, '[data-theme="compact"]:not([data-radius])')).toEqual(
    tokens(themeCss, '[data-radius="md"]'),
  )
  expect(tokens(compactCss, '[data-theme="compact"]')).toEqual({
    "--surface-shadow": "0 1px 2px oklch(0 0 0 / 0.05)",
  })
})

test("data-density=default restores exactly the theme's defaults for every token compact density changes", () => {
  const defaults = tokens(compactCss, '[data-density="default"]')
  expect(Object.keys(defaults).toSorted()).toEqual(Object.keys(compact).toSorted())
  for (const name of Object.keys(defaults)) expect(defaults[name], name).toBe(root[name])
})

test("every radius step sets the whole radius scale, and lg is the theme's own derivation", () => {
  for (const step of ["none", "sm", "md", "lg", "full"]) {
    expect(Object.keys(tokens(themeCss, `[data-radius="${step}"]`)).toSorted()).toEqual(radiusTokens.toSorted())
  }
  const lg = tokens(themeCss, '[data-radius="lg"]')
  expect(lg["--radius"]).toBe(tokens(themeCss, ":root")["--radius"])
  for (const name of radiusTokens.slice(1)) expect(lg[name], name).toBe(root[name])
})

test("board density uses compact spacing and controls with narrower columns, no type scale, shadow or radius", () => {
  const board = { ...compact, "--board-column-min-width": "13rem", "--board-column-max-width": "15rem" }
  for (const name of Object.keys(board)) if (name.startsWith("--type-")) delete board[name]
  expect(tokens(compactCss, '[data-board-density="compact"]')).toEqual(board)
  expect(tokens(compactCss, '  [data-board-density="auto"]')).toEqual(board)
})
