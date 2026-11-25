import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { expect, test } from "vitest"

const registry = join(import.meta.dirname, "..", "registry")

// Workaround: shadcn 4.23.0 adds the file extension to `import … from` through package.json `imports`, but not to\n`export … from`, so a re-export breaks a consumer that maps `#ui/*` to files.
test("registry files never re-export from another registry file", () => {
  const offenders = readdirSync(registry, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((file) => /^export (type )?\{[^}]*\} from "@\//m.test(readFileSync(file, "utf8")))
  expect(offenders).toEqual([])
})
