import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterAll, describe, expect, test } from "vitest"

import {
  altText,
  countSummary,
  GALLERY_FILE,
  parseVariant,
  scanScreenshots,
  screenshotSummary,
  writeGallery,
  type GalleryScan,
} from "../src/gallery"

const cli = resolve(import.meta.dirname, "../src/cli.ts")
const roots: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "eskais-gallery-"))
  roots.push(dir)
  return dir
}

afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true })
})

function png(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0)
  bytes.writeUInt32BE(13, 8)
  bytes.write("IHDR", 12, "latin1")
  bytes.writeUInt32BE(width, 16)
  bytes.writeUInt32BE(height, 20)
  return bytes
}

const FIXTURE: Record<string, string[]> = {
  team: ["out-light", "out-dark", "out-empty-light", "out-empty-dark"],
  "member detail": ["out", "out-loading-error-compact"],
}

function fixtureOutput(): string {
  const dir = tempDir()
  for (const [screen, variants] of Object.entries(FIXTURE)) {
    mkdirSync(join(dir, screen), { recursive: true })
    for (const variant of variants) {
      writeFileSync(join(dir, screen, `${variant}.html`), "<!doctype html>")
      writeFileSync(join(dir, screen, `${variant}.png`), png(1280, 800))
    }
    writeFileSync(join(dir, screen, "manifest.json"), "{}")
  }
  writeFileSync(join(dir, "team", "out-saving-dark.html"), "<!doctype html>")
  writeFileSync(join(dir, "team", "notes.png"), png(10, 10))
  mkdirSync(join(dir, ".registry"), { recursive: true })
  writeFileSync(join(dir, ".registry", "out-cached.png"), png(10, 10))
  return dir
}

function run(args: string[], cwd: string) {
  const result = spawnSync("bun", [cli, ...args], { cwd, encoding: "utf8" })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

describe("the skill's Present step", () => {
  const skill = readFileSync(resolve(import.meta.dirname, "../skills/eskais-mockup/SKILL.md"), "utf8")

  test("is a mandatory step that embeds every screenshot and checks the count", () => {
    const present = skill.slice(skill.indexOf("## Present every screen"))
    expect(present).toContain("This step is mandatory")
    expect(present).toMatch(
      /!\[team, empty state, dark theme\]\([^)]+out-empty-dark\.png\)\n\s*`[^`]*out-empty-dark\.html`/,
    )
    expect(present).toContain("must equal the number in the `gallery` line")
    expect(present).toContain("Relaying another agent's mockups")
    expect(present).toContain(".mockups/gallery.html")
  })

  test("quotes the gallery line and alt text the CLI prints", () => {
    expect(skill).toContain(`gallery .mockups/gallery.html  ${countSummary(sampleScan())}`)
    expect(skill).toContain(altText({ screen: "team", state: "empty", theme: "dark" }))
  })
})

function shot(screen: string, state: string, theme: string) {
  return { screen, state, theme, png: "", html: null, width: null, height: null }
}

function sampleScan(): GalleryScan {
  return {
    dir: "",
    pagesWithoutScreenshot: [],
    screenshots: [
      shot("team", "default", "light"),
      shot("team", "default", "dark"),
      shot("team", "empty", "light"),
      shot("team", "empty", "dark"),
      shot("billing", "default", "light"),
      shot("billing", "error", "dark"),
    ],
  }
}

describe("parseVariant", () => {
  test("reads the state and the theme from out-<state>-<theme>", () => {
    expect(parseVariant("out.png")).toEqual({ state: "default", theme: "system" })
    expect(parseVariant("out-dark.html")).toEqual({ state: "default", theme: "dark" })
    expect(parseVariant("out-empty.png")).toEqual({ state: "empty", theme: "system" })
    expect(parseVariant("out-empty-dark.png")).toEqual({ state: "empty", theme: "dark" })
    expect(parseVariant("out-loading-error-compact.png")).toEqual({ state: "loading-error", theme: "compact" })
  })
})

describe("gallery", () => {
  test("includes every screenshot exactly once, labelled and linked to its page", () => {
    const dir = fixtureOutput()
    const outcome = writeGallery(dir)
    expect(outcome.path).toBe(join(dir, GALLERY_FILE))
    const html = readFileSync(join(dir, GALLERY_FILE), "utf8")

    const sources = [...html.matchAll(/<img src="([^"]+)"/g)].map((match) => decodeURIComponent(match[1] ?? ""))
    const expected = Object.entries(FIXTURE).flatMap(([screen, variants]) =>
      variants.map((variant) => `${screen}/${variant}.png`),
    )
    expect(sources.toSorted()).toEqual(expected.toSorted())
    expect(new Set(sources).size).toBe(sources.length)
    expect(html).toContain('data-gallery-count="6"')
    expect(html).toContain("6 screenshots: 2 screens, 4 states, 4 themes")

    expect(html).toContain(
      '<a href="team/out-empty-dark.html"><img src="team/out-empty-dark.png" alt="team, empty state, dark theme"',
    )
    expect(html).toContain(
      '<a href="member%20detail/out-loading-error-compact.html"><img src="member%20detail/out-loading-error-compact.png" alt="member detail, loading-error state, compact theme"',
    )
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('width="1280" height="800"')
    expect(html).toContain('<h2 id="screen-team">team</h2>')
    expect(html).toContain("<h3>empty state</h3>")
    expect(html).toContain("team/out-saving-dark.html")
    expect(html).not.toMatch(/(?:src|href)="(?:https?:|\/\/|\/|[A-Za-z]:)/)
    expect(html).not.toContain("<script")

    const order = sources.filter((source) => source.startsWith("team/"))
    expect(order).toEqual([
      "team/out-light.png",
      "team/out-dark.png",
      "team/out-empty-light.png",
      "team/out-empty-dark.png",
    ])
  })

  test("a mockup folder of its own is one screen", () => {
    const dir = fixtureOutput()
    const scan = scanScreenshots(join(dir, "team"))
    expect(scan.screenshots.map((entry) => entry.screen)).toEqual(["team", "team", "team", "team"])
    expect(screenshotSummary(join(dir, "team"))).toBe("screenshots 4 (5 pages; no screenshot: out-saving-dark.html)")
  })

  test("the CLI lists every screenshot and ends with the gallery and its count", () => {
    const dir = fixtureOutput()
    const result = run(["gallery", "."], dir)
    expect(result.status).toBe(0)
    const lines = result.stdout.trim().split(/\r?\n/)
    expect(lines.at(-1)).toBe("gallery gallery.html  6 screenshots: 2 screens, 4 states, 4 themes")
    expect(
      lines.filter((line) => line.endsWith(".html") && !line.startsWith("gallery") && !line.startsWith("no ")),
    ).toHaveLength(6)
    expect(result.stdout).toContain("no screenshot: team/out-saving-dark.html (capture it as out-saving-dark.png)")

    const json = run(["gallery", ".", "--json"], dir)
    const parsed = JSON.parse(json.stdout) as { count: number; screenshots: { png: string; html: string }[] }
    expect(parsed.count).toBe(6)
    expect(parsed.screenshots[0]).toMatchObject({ png: "member detail/out.png", html: "member detail/out.html" })
  })

  test("an empty folder says so, writes nothing and exits 1", () => {
    const dir = tempDir()
    writeFileSync(join(dir, "out.html"), "<!doctype html>")
    const result = run(["gallery", "."], dir)
    expect(result.status).toBe(1)
    expect(result.stdout).toContain("no screenshots in .: capture each out*.html as a PNG with the same name beside it")
    expect(result.stdout).toContain("no screenshot: out.html (capture it as out.png)")
    expect(existsSync(join(dir, GALLERY_FILE))).toBe(false)
  })

  test("a missing folder is a usage error", () => {
    const dir = tempDir()
    const result = run(["gallery", "nope"], dir)
    expect(result.status).toBe(2)
    expect(result.stderr).toContain("gallery needs a folder")
  })
})
