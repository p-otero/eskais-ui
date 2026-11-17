import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, posix } from "node:path"

import { describe, expect, it } from "vitest"

import registry from "../registry.json"

const repo = join(import.meta.dirname, "..")

type SkillFile = { path: string; type: string; target?: string }

const skillItems = {
  "eskais-ui-skill": "eskais-ui",
  "eskais-mockup-skill": "eskais-mockup",
  "eskais-perf-skill": "eskais-perf",
} as const

const items = registry.items as { name: string; type: string; files?: SkillFile[] }[]

function itemFor(name: string) {
  const item = items.find((candidate) => candidate.name === name)
  if (!item) throw new Error(`registry.json has no ${name}`)
  return { ...item, files: item.files ?? [] }
}

function skillRoot(item: { files: SkillFile[] }) {
  const entry = item.files.find((file) => file.path.endsWith("/SKILL.md"))
  if (!entry) throw new Error("the item ships no SKILL.md")
  return dirname(entry.path)
}

function markdownFiles(dir: string): string[] {
  return readdirSync(join(repo, dir), { recursive: true, encoding: "utf8" })
    .filter((relative) => relative.endsWith(".md"))
    .map((relative) => posix.join(dir, relative.replaceAll("\\", "/")))
    .toSorted()
}

// `references/forms.md`, `scripts/check.ts` or a relative Markdown link: a file the skill tells the agent to open.
function referencedFiles(markdown: string): string[] {
  const named = [...markdown.matchAll(/`((?:references|scripts|assets)\/[\w./-]+)`/g)].map((match) => match[1] ?? "")
  const linked = [...markdown.matchAll(/\]\((?!https?:|#|mailto:)([^)\s]+)\)/g)].map((match) => match[1] ?? "")
  return [...new Set([...named, ...linked])]
}

describe.each(Object.entries(skillItems))("%s", (itemName, skill) => {
  const item = itemFor(itemName)
  const root = skillRoot(item)

  it("is a registry:file item whose files land in .agents/skills/<skill>/", () => {
    expect(item.type).toBe("registry:file")
    for (const file of item.files) {
      expect(file.type).toBe("registry:file")
      expect(file.target).toBe(`~/.agents/skills/${skill}/${posix.relative(root, file.path)}`)
    }
  })

  it("ships every Markdown file of the skill, and only files that exist", () => {
    const shipped = item.files.map((file) => file.path).toSorted()
    for (const path of shipped) expect(existsSync(join(repo, path)), path).toBe(true)
    expect(shipped).toEqual(markdownFiles(root))
  })

  it("names itself in its frontmatter and describes when to use it", () => {
    const text = readFileSync(join(repo, root, "SKILL.md"), "utf8")
    const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? ""
    expect(frontmatter).toMatch(new RegExp(`^name: ${skill}$`, "m"))
    expect(frontmatter).toMatch(/^description: .*\bUse when\b/m)
  })

  it("references only files it ships", () => {
    const shipped = new Set(item.files.map((file) => posix.relative(root, file.path)))
    for (const file of item.files) {
      const text = readFileSync(join(repo, file.path), "utf8")
      const from = posix.dirname(posix.relative(root, file.path))
      for (const reference of referencedFiles(text)) {
        const resolved = reference.startsWith("references/") ? reference : posix.normalize(posix.join(from, reference))
        expect(shipped.has(resolved), `${file.path} refers to ${reference}`).toBe(true)
      }
    }
  })

  it("is written for a consumer project, not for this repository", () => {
    for (const file of item.files) {
      const text = readFileSync(join(repo, file.path), "utf8")
      expect(text, file.path).not.toMatch(/\btooling\/|registry\.json|bun run (verify|registry:build)|build:showcase/)
    }
  })

  it("is built into public/r with the current files", () => {
    const built = JSON.parse(readFileSync(join(repo, "public", "r", `${itemName}.json`), "utf8")) as {
      files: (SkillFile & { content: string })[]
    }
    expect(built.files.map(({ path, target }) => ({ path, target }))).toEqual(
      item.files.map(({ path, target }) => ({ path, target })),
    )
    for (const file of built.files) {
      expect(file.content, file.path).toBe(readFileSync(join(repo, file.path), "utf8"))
    }
  })
})
