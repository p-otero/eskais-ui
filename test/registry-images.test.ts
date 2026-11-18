import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { expect, test } from "vitest"

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : entry.name.endsWith(".tsx") ? [join(dir, entry.name)] : [],
  )
}

// An image reserves its box before it loads when it has a width and a height (CSS keeps `height: auto`) or an
// `aspect-*` class; one that passes its props through leaves that to the caller, whose `width`/`height` it forwards.
const reserves = (tag: string) =>
  (/\bwidth=/.test(tag) && /\bheight=/.test(tag)) || /\baspect-/.test(tag) || /\{\.\.\.props\}/.test(tag)

test("every <img> in the registry reserves its space before it loads", () => {
  const offenders: string[] = []
  for (const file of files("registry")) {
    const source = readFileSync(file, "utf8")
    for (const match of source.matchAll(/<img\b[^>]*?\/?>/gs)) {
      if (reserves(match[0])) continue
      const line = source.slice(0, match.index).split("\n").length
      offenders.push(`${file}:${String(line)}`)
    }
  }
  expect(offenders).toEqual([])
})

test("the check catches an image without a size", () => {
  expect(reserves('<img src={src} alt="" />')).toBe(false)
  expect(reserves('<img src={src} alt="" width={64} height={64} />')).toBe(true)
  expect(reserves('<img src={src} className="aspect-video w-full" />')).toBe(true)
})
