import { readFileSync } from "node:fs"
import { join } from "node:path"

import { expect, test } from "vitest"

import packageJson from "../package.json"

const readme = readFileSync(join(import.meta.dirname, "..", "README.md"), "utf8")

test("the README pins the current release through refs/tags/", () => {
  const pins = [...readme.matchAll(/eskais-ui\/(refs\/tags\/[^/]+|[^/]+)\/public\/r\//g)].map((match) => match[1])
  expect(pins).toEqual([`refs/tags/v${packageJson.version}`])
})
