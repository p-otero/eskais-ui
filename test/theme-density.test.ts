import { readFileSync } from "node:fs"
import { expect, test } from "vitest"

const css = readFileSync("registry/styles/theme-compact.css", "utf8")

function tokens(selector: string) {
  const start = css.indexOf(`${selector} {`)
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start))
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value]))
}

test("board density uses the compact theme's shape and spacing, with narrower columns, no flat shadow and the default type scale", () => {
  const compact = {
    ...tokens('[data-theme="compact"]'),
    "--board-column-min-width": "13rem",
    "--board-column-max-width": "15rem",
  }
  delete compact["--surface-shadow"]
  for (const name of Object.keys(compact)) if (name.startsWith("--type-")) delete compact[name]
  expect(tokens('[data-density="compact"]')).toEqual(compact)
  expect(tokens('  [data-density="auto"]')).toEqual(compact)
})
