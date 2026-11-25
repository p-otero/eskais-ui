import { readFileSync, writeFileSync } from "node:fs"

const versionModule = "packages/mockup/src/version.ts"
const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string }
const source = `export const version = ${JSON.stringify(version)}
`
if (readFileSync(versionModule, "utf8") !== source) writeFileSync(versionModule, source)
