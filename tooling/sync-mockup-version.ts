import { readFileSync, writeFileSync } from "node:fs"

// The mockup CLI ships as files (the eskais-mockup-cli item), with no package.json of its own beside it in a
// consumer, so `--version` reads the release from a module that registry:build keeps equal to package.json.
const path = "packages/mockup/src/version.ts"
const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string }
const source = `// The Eskais UI release this CLI came from, written by the registry build.
export const version = ${JSON.stringify(version)}
`
if (readFileSync(path, "utf8") !== source) writeFileSync(path, source)
