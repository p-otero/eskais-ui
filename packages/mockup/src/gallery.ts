import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, join, relative, sep } from "node:path"

import { displayPath, EnvironmentError } from "./project"

export const GALLERY_FILE = "gallery.html"

export type Screenshot = {
  screen: string
  state: string
  theme: string
  png: string
  html: string | null
  width: number | null
  height: number | null
}

export type GalleryScan = {
  dir: string
  screenshots: Screenshot[]
  pagesWithoutScreenshot: string[]
}

const SCHEMES = new Set(["light", "dark", "system"])
const THEME_ORDER = ["light", "dark", "system"]
export const DEFAULT_STATE = "default"
export const DEFAULT_THEME = "system"

export function parseVariant(file: string): { state: string; theme: string } {
  const stem = basename(file).replace(/\.(png|html)$/i, "")
  const rest = stem.replace(/^out(?:-|$)/, "")
  const segments = rest === "" ? [] : rest.split("-")
  if (segments.length === 0) return { state: DEFAULT_STATE, theme: DEFAULT_THEME }
  if (segments.length === 1) {
    const only = segments[0] ?? ""
    return SCHEMES.has(only) ? { state: DEFAULT_STATE, theme: only } : { state: only, theme: DEFAULT_THEME }
  }
  return { state: segments.slice(0, -1).join("-"), theme: segments.at(-1) ?? DEFAULT_THEME }
}

function pngSize(file: string): { width: number | null; height: number | null } {
  const bytes = readFileSync(file)
  const signature = bytes.subarray(1, 4).toString("latin1")
  if (bytes.length < 24 || signature !== "PNG") return { width: null, height: null }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

function walk(dir: string, found: { png: string[]; html: string[] }) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(path, found)
      continue
    }
    if (!/^out[-.]/i.test(entry.name)) continue
    if (/\.png$/i.test(entry.name)) found.png.push(path)
    else if (/\.html$/i.test(entry.name)) found.html.push(path)
  }
}

function rank(order: string[], value: string): number {
  const index = order.indexOf(value)
  return index === -1 ? order.length : index
}

function compareScreenshots(left: Screenshot, right: Screenshot): number {
  return (
    left.screen.localeCompare(right.screen) ||
    rank([DEFAULT_STATE], left.state) - rank([DEFAULT_STATE], right.state) ||
    left.state.localeCompare(right.state) ||
    rank(THEME_ORDER, left.theme) - rank(THEME_ORDER, right.theme) ||
    left.theme.localeCompare(right.theme)
  )
}

export function scanScreenshots(dir: string): GalleryScan {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new EnvironmentError(`gallery needs a folder: ${dir} is not one`)
  }
  const found = { png: [] as string[], html: [] as string[] }
  walk(dir, found)
  const pages = new Set(found.html)
  const screenshots = found.png.map((png): Screenshot => {
    const html = png.replace(/\.png$/i, ".html")
    const folder = dirname(png)
    const screen = folder === dir ? basename(dir) : relative(dir, folder).split(sep).join("/")
    return { screen, ...parseVariant(png), png, html: pages.has(html) ? html : null, ...pngSize(png) }
  })
  const shot = new Set(screenshots.map((entry) => entry.html))
  const pagesWithoutScreenshot = found.html.filter((page) => !shot.has(page)).toSorted()
  return { dir, screenshots: screenshots.toSorted(compareScreenshots), pagesWithoutScreenshot }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function href(from: string, file: string): string {
  return relative(from, file).split(sep).map(encodeURIComponent).join("/")
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-|-$/g, "") || "screen"
  )
}

export function altText(entry: Pick<Screenshot, "screen" | "state" | "theme">): string {
  return `${entry.screen}, ${entry.state} state, ${entry.theme} theme`
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`
}

function groupBy<T>(items: T[], key: (item: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const name = key(item)
    const group = groups.get(name)
    if (group === undefined) groups.set(name, [item])
    else group.push(item)
  }
  return [...groups]
}

export function countSummary(scan: GalleryScan): string {
  const screens = new Set(scan.screenshots.map((entry) => entry.screen)).size
  const states = new Set(scan.screenshots.map((entry) => `${entry.screen}\0${entry.state}`)).size
  const themes = new Set(scan.screenshots.map((entry) => entry.theme)).size
  return `${plural(scan.screenshots.length, "screenshot")}: ${plural(screens, "screen")}, ${plural(states, "state")}, ${plural(themes, "theme")}`
}

const STYLE = `
:root { color-scheme: light dark; font-family: system-ui, sans-serif; line-height: 1.5; }
body { margin: 0; background: Canvas; color: CanvasText; }
main { max-width: 80rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
h1 { font-size: 1.75rem; margin: 0 0 0.25rem; }
h2 { font-size: 1.375rem; margin: 2.5rem 0 0.5rem; border-bottom: 1px solid color-mix(in srgb, CanvasText 20%, transparent); padding-bottom: 0.25rem; }
h3 { font-size: 1.0625rem; margin: 1.5rem 0 0.5rem; }
nav ul { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; padding: 0; list-style: none; }
ul.shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(22rem, 100%), 1fr)); gap: 1rem; padding: 0; margin: 0; list-style: none; }
figure { margin: 0; }
figure img { display: block; width: 100%; height: auto; border: 1px solid color-mix(in srgb, CanvasText 25%, transparent); border-radius: 0.5rem; background: color-mix(in srgb, CanvasText 6%, Canvas); }
figcaption { font-size: 0.875rem; margin-top: 0.375rem; overflow-wrap: anywhere; }
code { font-family: ui-monospace, monospace; font-size: 0.8125rem; }
a { color: LinkText; }
a:focus-visible { outline: 3px solid Highlight; outline-offset: 3px; border-radius: 0.5rem; }
.missing { color: color-mix(in srgb, CanvasText 70%, Canvas); }
`

function figure(scan: GalleryScan, entry: Screenshot): string {
  const size = entry.width === null || entry.height === null ? "" : ` width="${entry.width}" height="${entry.height}"`
  const image = `<img src="${href(scan.dir, entry.png)}" alt="${escapeHtml(altText(entry))}" loading="lazy" decoding="async"${size}>`
  const page =
    entry.html === null
      ? `<span class="missing">no page beside it</span>`
      : `<code>${escapeHtml(relative(scan.dir, entry.html).split(sep).join("/"))}</code>`
  const body = entry.html === null ? image : `<a href="${href(scan.dir, entry.html)}">${image}</a>`
  return `<li><figure>${body}<figcaption>${escapeHtml(entry.theme)} theme · ${page}</figcaption></figure></li>`
}

export function galleryHtml(scan: GalleryScan, title = "Mockups"): string {
  const screens = groupBy(scan.screenshots, (entry) => entry.screen)
  const ids = new Map<string, string>()
  for (const [screen] of screens) {
    let id = `screen-${slug(screen)}`
    while ([...ids.values()].includes(id)) id = `${id}-x`
    ids.set(screen, id)
  }
  const nav = screens
    .map(
      ([screen, shots]) => `<li><a href="#${ids.get(screen) ?? ""}">${escapeHtml(screen)} (${shots.length})</a></li>`,
    )
    .join("")
  const sections = screens
    .map(([screen, shots]) => {
      const id = ids.get(screen) ?? ""
      const states = groupBy(shots, (entry) => entry.state)
        .map(
          ([state, entries]) =>
            `<section aria-label="${escapeHtml(`${screen}, ${state} state`)}"><h3>${escapeHtml(state)} state</h3><ul class="shots">${entries.map((entry) => figure(scan, entry)).join("")}</ul></section>`,
        )
        .join("")
      return `<section aria-labelledby="${id}"><h2 id="${id}">${escapeHtml(screen)}</h2>${states}</section>`
    })
    .join("\n")
  const missing =
    scan.pagesWithoutScreenshot.length === 0
      ? ""
      : `<section aria-labelledby="missing"><h2 id="missing">Pages without a screenshot</h2><ul>${scan.pagesWithoutScreenshot
          .map(
            (page) =>
              `<li><a href="${href(scan.dir, page)}"><code>${escapeHtml(relative(scan.dir, page).split(sep).join("/"))}</code></a></li>`,
          )
          .join("")}</ul></section>`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
<p data-gallery-count="${scan.screenshots.length}">${escapeHtml(countSummary(scan))}</p>
<nav aria-label="Screens"><ul>${nav}</ul></nav>
${sections}
${missing}
</main>
</body>
</html>
`
}

export type GalleryOutcome = { path: string | null; scan: GalleryScan }

export function writeGallery(dir: string): GalleryOutcome {
  const scan = scanScreenshots(dir)
  if (scan.screenshots.length === 0) return { path: null, scan }
  const path = join(dir, GALLERY_FILE)
  writeFileSync(path, galleryHtml(scan))
  return { path, scan }
}

export function galleryHeadline(outcome: GalleryOutcome, cwd: string): string {
  if (outcome.path === null) {
    return `no screenshots in ${displayPath(outcome.scan.dir, cwd)}: capture each out*.html as a PNG with the same name beside it (out-empty-dark.html → out-empty-dark.png), then run gallery again`
  }
  return `gallery ${displayPath(outcome.path, cwd)}  ${countSummary(outcome.scan)}`
}

export function galleryLines(outcome: GalleryOutcome, cwd: string): string[] {
  const { scan } = outcome
  const missing = scan.pagesWithoutScreenshot.map(
    (page) => `no screenshot: ${displayPath(page, cwd)} (capture it as ${basename(page).replace(/\.html$/i, ".png")})`,
  )
  const shots = scan.screenshots.map(
    (entry) =>
      `${entry.screen}  ${entry.state}  ${entry.theme}  ${displayPath(entry.png, cwd)}  ${entry.html === null ? "(no page)" : displayPath(entry.html, cwd)}`,
  )
  return outcome.path === null
    ? [galleryHeadline(outcome, cwd), ...missing]
    : [...shots, ...missing, galleryHeadline(outcome, cwd)]
}

export function galleryJson(outcome: GalleryOutcome, cwd: string) {
  return {
    gallery: outcome.path === null ? null : displayPath(outcome.path, cwd),
    count: outcome.scan.screenshots.length,
    screenshots: outcome.scan.screenshots.map((entry) => ({
      screen: entry.screen,
      state: entry.state,
      theme: entry.theme,
      png: displayPath(entry.png, cwd),
      html: entry.html === null ? null : displayPath(entry.html, cwd),
    })),
    pagesWithoutScreenshot: outcome.scan.pagesWithoutScreenshot.map((page) => displayPath(page, cwd)),
  }
}

export function screenshotSummary(dir: string): string {
  const scan = scanScreenshots(dir)
  const pages = scan.screenshots.filter((entry) => entry.html !== null).length + scan.pagesWithoutScreenshot.length
  const missing =
    scan.pagesWithoutScreenshot.length === 0
      ? ""
      : `; no screenshot: ${scan.pagesWithoutScreenshot.map((page) => basename(page)).join(", ")}`
  return `screenshots ${scan.screenshots.length} (${plural(pages, "page")}${missing})`
}
