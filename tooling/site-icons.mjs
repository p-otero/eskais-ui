// Generates the docs site's favicons from the Eskais symbol (`node tooling/site-icons.mjs`), into apps/site/public:
// an SVG favicon that follows the system colour scheme, a 32px PNG fallback and a 180px apple-touch-icon.
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import { chromium } from "playwright"

const site = resolve(import.meta.dirname, "..", "apps", "site")
const out = resolve(site, "public")
const symbol = await readFile(resolve(site, "src", "brand", "eskais-symbol.svg"), "utf8")

const [, , width, height] = /viewBox="([^"]+)"/.exec(symbol)[1].split(" ").map(Number)
const path = / d="([^"]+)"/.exec(symbol)[1]

// A square canvas with the symbol centred, `padding` of the side left free around its longer edge.
function square({ padding, background, color, style = "" }) {
  const side = Math.round(width / (1 - 2 * padding))
  const x = Math.round((side - width) / 2)
  const y = Math.round((side - height) / 2)
  const fill = background ? `<rect width="${side}" height="${side}" fill="${background}"/>` : ""
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}">`,
    style,
    fill,
    `<path transform="translate(${x} ${y})" d="${path}" fill="${color}" stroke="${color}" stroke-width="40" stroke-linejoin="round"/>`,
    `</svg>`,
  ].join("")
}

// Favicons get no currentColor, so the SVG switches itself between black and white with the browser's scheme.
const favicon = square({
  padding: 0.04,
  color: "#000",
  style: "<style>path{fill:#000;stroke:#000}@media(prefers-color-scheme:dark){path{fill:#fff;stroke:#fff}}</style>",
})

async function rasterize(page, svg, size) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}img{display:block}</style><img src="data:image/svg+xml,${encodeURIComponent(svg)}" width="${size}" height="${size}">`,
  )
  await page.locator("img").evaluate((image) => image.decode())
  return page.screenshot({ omitBackground: true })
}

await mkdir(out, { recursive: true })
await writeFile(resolve(out, "favicon.svg"), `${favicon}\n`)

const browser = await chromium.launch({ channel: "chrome" })
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  await writeFile(resolve(out, "favicon-32.png"), await rasterize(page, square({ padding: 0.04, color: "#000" }), 32))
  // iOS fills a transparent touch icon with black and rounds the corners itself, so it gets an opaque tile.
  await writeFile(
    resolve(out, "apple-touch-icon.png"),
    await rasterize(page, square({ padding: 0.18, background: "#fff", color: "#000" }), 180),
  )
} finally {
  await browser.close()
}
console.log(`Wrote favicon.svg, favicon-32.png and apple-touch-icon.png to ${out}`)
