import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

import { expect, test } from "vitest"

const site = join(import.meta.dirname, "..", "apps", "site", "src")

function sources(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) return sources(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

// The site is built from registry items: links are Link, code is CodeBlock, controls are UI SDK parts.
test("the site renders no raw <a>, <button>, <input> or <pre>", () => {
  const found = sources(site).flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => /<(a|button|input|pre)(\s|>|\/|$)/.test(line) && !/^\s*(\/\/|\*|")/.test(line.trim()))
      .map(({ line, index }) => `${relative(site, file)}:${index + 1}: ${line.trim()}`),
  )
  expect(found).toEqual([])
})
