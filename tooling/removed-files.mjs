import { execFileSync } from "node:child_process"
import { pathToFileURL } from "node:url"

const registryPrefix = "@eskais/"

const consumerFolder = {
  "registry:ui": "components/ui",
  "registry:lib": "lib",
  "registry:hook": "hooks",
  "registry:component": "components",
  "registry:block": "components",
}

export function installedTarget(file) {
  if (file.target) return file.target
  const folder = consumerFolder[file.type]
  if (folder === undefined) return undefined
  const insideTypeFolder = file.path.split("/").slice(2).join("/")
  return `${folder}/${insideTypeFolder}`
}

export function itemName(dependency) {
  const last = dependency.split("/").at(-1) ?? dependency
  return last.replace(/\.json$/, "")
}

function indexItems(items) {
  return new Map(items.map((item) => [item.name, item]))
}

function ownTargets(item) {
  return new Set((item?.files ?? []).map(installedTarget).filter((target) => target !== undefined))
}

function installedWith(name, itemsByName) {
  const targets = new Set()
  const seen = new Set()
  const visit = (current) => {
    if (seen.has(current)) return
    seen.add(current)
    const item = itemsByName.get(current)
    if (item === undefined) return
    for (const target of ownTargets(item)) targets.add(target)
    for (const dependency of item.registryDependencies ?? []) {
      if (dependency.startsWith(registryPrefix)) visit(itemName(dependency))
    }
  }
  visit(name)
  return targets
}

function shippersOf(target, itemsByName) {
  return [...itemsByName.values()]
    .filter((item) => ownTargets(item).has(target))
    .map((item) => item.name)
    .toSorted()
}

export function removedFiles(fromItems, toItems) {
  const before = indexItems(fromItems)
  const after = indexItems(toItems)
  const report = []
  for (const name of [...before.keys()].toSorted()) {
    const stillInstalled = installedWith(name, after)
    const removed = [...ownTargets(before.get(name))].filter((target) => !stillInstalled.has(target)).toSorted()
    if (removed.length === 0) continue
    report.push({
      item: name,
      itemRemoved: !after.has(name),
      files: removed.map((target) => ({ target, movedTo: shippersOf(target, after) })),
    })
  }
  return report
}

function fileLine({ target, movedTo }) {
  if (movedTo.length === 0) return `- \`${target}\`: no item ships it any more; delete it.`
  const items = movedTo.map((name) => `\`${name}\``).join(" or ")
  const adds = movedTo.map((name) => `\`${registryPrefix}${name}\``).join(" or ")
  return `- \`${target}\`: moved to ${items}. Add ${adds} if you use it, otherwise delete it.`
}

export function formatRemovedFiles(report) {
  if (report.length === 0) return ""
  const sections = report.map(({ item, itemRemoved, files }) => {
    const heading = itemRemoved ? `\`${item}\` (no longer in the registry)` : `\`${item}\``
    return [`${heading}:`, "", ...files.map(fileLine)].join("\n")
  })
  return [
    "### Removed files",
    "",
    "shadcn never deletes files, so adding these items again leaves the files below behind: the items no longer install them, or their dependencies. Paths are under the default aliases (`components/ui`, `lib`, `hooks`).",
    "",
    sections.join("\n\n"),
    "",
  ].join("\n")
}

function git(args, input) {
  return execFileSync("git", args, { input, maxBuffer: 256 * 1024 * 1024 })
}

export function itemsAt(ref) {
  const paths = git(["ls-tree", "--name-only", ref, "public/r/"])
    .toString("utf8")
    .split("\n")
    .filter((path) => path.endsWith(".json") && path !== "public/r/registry.json")
  if (paths.length === 0) return []
  const batch = git(["cat-file", "--batch"], paths.map((path) => `${ref}:${path}\n`).join(""))
  const items = []
  let offset = 0
  while (offset < batch.length) {
    const headerEnd = batch.indexOf(0x0a, offset)
    const size = Number(batch.subarray(offset, headerEnd).toString("utf8").split(" ")[2])
    const bodyStart = headerEnd + 1
    items.push(JSON.parse(batch.subarray(bodyStart, bodyStart + size).toString("utf8")))
    offset = bodyStart + size + 1
  }
  return items
}

function main() {
  const [from, to = "HEAD"] = process.argv.slice(2)
  if (from === undefined) {
    process.stderr.write("Usage: node tooling/removed-files.mjs <fromTag> [toTag=HEAD]\n")
    process.exit(2)
  }
  process.stdout.write(formatRemovedFiles(removedFiles(itemsAt(from), itemsAt(to))) || "No removed files.\n")
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main()
