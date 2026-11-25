import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterAll, expect, test } from "vitest"

const dir = mkdtempSync(join(tmpdir(), "eskais-comment-tags-rule-"))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

writeFileSync(
  join(dir, ".oxlintrc.json"),
  JSON.stringify({
    plugins: [],
    jsPlugins: [resolve("tooling/oxlint-plugin-eskais/index.js").replaceAll("\\", "/")],
    categories: { correctness: "off" },
    rules: { "eskais/comment-tags": "error" },
  }),
)

function flaggedLines(source: string) {
  writeFileSync(join(dir, "fixture.tsx"), source)
  let output: string
  try {
    output = execFileSync(
      process.execPath,
      [resolve("node_modules/oxlint/bin/oxlint"), "--format", "json", "fixture.tsx"],
      { cwd: dir, encoding: "utf8" },
    )
  } catch (error) {
    output = (error as { stdout: string }).stdout
  }
  const { diagnostics } = JSON.parse(output) as {
    diagnostics: { code: string; labels: { span: { line: number } }[] }[]
  }
  return diagnostics.map((diagnostic) => diagnostic.labels[0]?.span.line)
}

test("flags narration, section headers and trailing comments", () => {
  expect(
    flaggedLines(`// Buttons
const size = 4 // the size in rem
/* the gap */
const gap = 2
function Row() {
  // render the row
  return <div>{/* the children */}</div>
}
export { Row, size, gap }`),
  ).toEqual([1, 2, 3, 6, 7])
})

test("allows the four tags, in line and block comments, and their continuation lines", () => {
  expect(
    flaggedLines(`// Workaround: WebKit 26 sizes a flex-1 child from its 0% basis, so the row
// sets an explicit min-width.
const a = 1
/* Spec: WAI-ARIA 1.2 gives a listbox option no accessible description. */
const b = 2
const c = 3 // Perf: one layer per blur; 142 → 26 on the glass board
// Security: the href comes from the app, never from a message.
const d = 4
export { a, b, c, d }`),
  ).toEqual([])
})

test("an untagged first line taints its whole block, a tag later in it doesn't count", () => {
  expect(
    flaggedLines(`// The row sets a min-width.
// Workaround: WebKit 26.
const a = 1
// workaround: lowercase
const b = 2
export { a, b }`),
  ).toEqual([1, 4])
})

test("allows suppressions and @ts-expect-error with a reason, flags them without one", () => {
  expect(
    flaggedLines(`// oxlint-disable-next-line no-console -- the CLI prints its report
console.log(1)
// oxlint-disable-next-line no-console
console.log(2)
// @ts-expect-error -- the DOM lib lacks it
document.foo = 1
// @ts-expect-error
document.bar = 2
function List() {
  return (
    <ul>
      {/* oxlint-disable-next-line eskais/no-inline-icons -- a grip, not an icon */}
      <li />
    </ul>
  )
}
export { List }`),
  ).toEqual([3, 7])
})

test("allows tool directives and license headers", () => {
  expect(
    flaggedLines(`/*! (c) Someone, MIT */
/** @license MIT */
/// <reference types="vite/client" />
// prettier-ignore
const matrix = [1,0,0,1]
const lazy = /* @__PURE__ */ Object.freeze({})
const load = () => import(/* @vite-ignore */ "./x.js")
export { matrix, lazy, load }`),
  ).toEqual([])
})

test("allows JSDoc on exported declarations and type members, flags it on private code", () => {
  expect(
    flaggedLines(`/** Pixels per second. */
export const speed = 4
/** Milliseconds before the toast closes, 5000 by default. */
const duration = 5000
type Props = {
  /** Fires after the animation ends. */
  onDone?: () => void
}
interface Options {
  /** 0 to 1. */
  ratio: number
}
/** Clamps a ratio. */
function clamp(value: number) {
  /** the result */
  const result = Math.min(1, Math.max(0, value))
  return result
}
/** Renders the row. */
function Row(props: Props) {
  return <div />
}
/** Private helper. */
function helper() {}
export { duration, Row, clamp }
export type { Props, Options }`),
  ).toEqual([15, 23])
})

test("allows JSDoc on the members of a primitive's api, not on other object literals", () => {
  expect(
    flaggedLines(`const counter = definePrimitive({
  api: (context) => {
    const options = {
      /** private */
      step: 1,
    }
    return {
      /** \`by\` counts from 0. */
      add(by: number) {
        return by + options.step
      },
    }
  },
  agent: { actions: (api) => ({ /** not the api */ add: api.add }) },
})
const short = definePrimitive({ api: () => ({ /** Resolves once saved. */ save: () => Promise.resolve() }) })
const named = definePrimitive({
  api: () => {
    const api = {
      /** Returns \`false\` while disarmed. */
      confirm: () => true,
    }
    return api
  },
})
export { counter, short, named }`),
  ).toEqual([4, 14])
})

test("JSDoc reaches its declaration through a suppression between them", () => {
  expect(
    flaggedLines(`/** Milliseconds, 200 by default. */
// oxlint-disable-next-line no-magic-numbers -- the dialog's duration token
export const delay = 200`),
  ).toEqual([])
})

test("the repo's config runs it as an error", () => {
  const config = JSON.parse(readFileSync(".oxlintrc.json", "utf8")) as {
    overrides: { files: string[]; rules: Record<string, unknown> }[]
  }
  const covered = config.overrides
    .filter((override) => override.rules["eskais/comment-tags"] === "error")
    .flatMap((override) => override.files)
  expect(covered.length).toBeGreaterThan(0)
  expect(covered.some((glob) => glob.startsWith("test/"))).toBe(false)
})
