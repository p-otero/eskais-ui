import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { expect, test } from "vitest"

const root = join(import.meta.dirname, "..")
const binary = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|pdf|zip|gz)$/i
// Tab, LF and CR are the only control characters a source file needs; any other one makes git treat it as binary.
// oxlint-disable-next-line no-control-regex
const control = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/

function sourceFiles() {
  const listed = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "registry", "apps", "tooling", "test"],
    {
      cwd: root,
      encoding: "utf8",
    },
  )
  return listed.split("\0").filter((file) => file && !binary.test(file))
}

test("source files hold no raw control characters other than tab, LF and CR", () => {
  const files = sourceFiles()
  expect(files.length).toBeGreaterThan(100)
  const found = files.flatMap((file) => {
    const lines = readFileSync(join(root, file), "utf8").split("\n")
    return lines.flatMap((line, index) => {
      const match = control.exec(line)
      if (!match) return []
      const code = match[0].codePointAt(0)!.toString(16).padStart(4, "0")
      return [`${file}:${index + 1}: U+${code}, write it as an escape sequence`]
    })
  })
  expect(found).toEqual([])
})
