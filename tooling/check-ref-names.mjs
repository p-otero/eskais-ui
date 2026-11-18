#!/usr/bin/env node
// raw.githubusercontent.com resolves `<ref>` in a registry URL to a branch before a tag of the same name,
// so a branch called like a release tag silently serves consumers different registry files.
import { execFileSync } from "node:child_process"

const remote = process.argv[2] ?? "origin"
const lines = execFileSync("git", ["ls-remote", "--heads", "--tags", remote], { encoding: "utf8" }).split("\n")

const branches = new Set()
const tags = new Set()
for (const line of lines) {
  const ref = line.split("\t")[1]
  if (ref?.startsWith("refs/heads/")) branches.add(ref.slice("refs/heads/".length))
  else if (ref?.startsWith("refs/tags/")) tags.add(ref.slice("refs/tags/".length).replace(/\^\{\}$/, ""))
}

const clashes = [...branches].filter((name) => tags.has(name))
if (clashes.length > 0) {
  console.error(`Branches named like tags (rename or delete them): ${clashes.join(", ")}`)
  process.exit(1)
}
console.log(`No branch shares a name with any of ${String(tags.size)} tags.`)
