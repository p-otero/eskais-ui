// Runs axe in a real browser for every theme and color mode, then measures the contrast axe can't:
// text over gradients and glass, by rendering the background with the text hidden and checking its worst pixel.
// Usage: node tooling/contrast-check.mjs [themes, default "default,compact"] [glass-opacity-percent] [--palettes=blue,green]
// Glass is checked by hand (`bun run test:browser:glass`): blur without a GPU is too slow for CI.
import { createRequire } from "node:module"

import { setAppearance, withShowcase } from "./showcase-browser.mjs"

const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js")
const palettesFlag = process.argv.find((arg) => arg.startsWith("--palettes="))
const [themesArg, glassOpacity] = process.argv.slice(2).filter((arg) => arg !== palettesFlag)
const themes = (themesArg ?? "default,compact").split(",")
const palettes = palettesFlag ? palettesFlag.slice("--palettes=".length).split(",") : [undefined]
const failures = []

// page.evaluate has no timeout of its own; a stalled render would hang the job until CI kills it.
async function within(label, promise, ms = 60_000) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms: ${label}`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

function channel(value) {
  const c = value / 255
  return c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance([r, g, b]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function ratio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].toSorted((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

async function measure(page, selector) {
  const text = await page.evaluate((target) => {
    const element = document.querySelector(target)
    if (!element || !element.textContent?.trim()) return null
    element.scrollIntoView({ block: "center" })
    const range = document.createRange()
    range.selectNodeContents(element)
    // Truncated text reports its full range width; clip to the element so a neighbor's pixels don't count.
    // Text that wraps is measured line by line: the box around both lines takes in the words beside it.
    const own = element.getBoundingClientRect()
    const boxes = [...range.getClientRects()]
      .map((line) => {
        const left = Math.max(line.left, own.left)
        const top = Math.max(line.top, own.top)
        const width = Math.min(line.right, own.right) - left
        const height = Math.min(line.bottom, own.bottom) - top
        return { x: left, y: top, width, height }
      })
      .filter((line) => line.width >= 1 && line.height >= 1)
    const style = getComputedStyle(element)
    // SVG text (chart axes) is painted with fill, which text-fill-color neither sets nor hides.
    const paint = element instanceof SVGElement ? "fill" : "-webkit-text-fill-color"
    const canvas = new OffscreenCanvas(1, 1).getContext("2d")
    canvas.fillStyle = element instanceof SVGElement ? style.fill : style.color
    canvas.fillRect(0, 0, 1, 1)
    const color = [...canvas.getImageData(0, 0, 1, 1).data]
    element.style.setProperty(paint, "transparent")
    // Marks drawn beside or under the text (a status dot, an icon, a checkbox, a bullet, an underline) aren't
    // what the text sits on; sampled as background they pair the text with its own colour. An underline is
    // painted in the colour of the element that declares it, which may be an ancestor. Only glyph-sized marks
    // are hidden, so a highlight or fill behind the text still counts.
    for (let node = element; node; node = node.parentElement) node.dataset.contrastMeasure = ""
    const line = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.5
    for (const mark of element.querySelectorAll("*")) {
      const rect = mark.getBoundingClientRect()
      const replaced = mark.matches("svg, img, input, canvas, [aria-hidden='true']")
      if ((replaced || !mark.textContent?.trim()) && rect.width <= line * 1.5 && rect.height <= line * 1.5) {
        mark.dataset.contrastMark = ""
      }
    }
    const size = Number.parseFloat(style.fontSize)
    const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700)
    return { boxes, color, large }
  }, selector)
  if (!text || text.boxes.length === 0) return null
  const pngs = []
  for (const box of text.boxes) pngs.push(await page.screenshot({ clip: box, animations: "disabled" }))
  await page.evaluate((target) => {
    const element = document.querySelector(target)
    element?.style.removeProperty("-webkit-text-fill-color")
    element?.style.removeProperty("fill")
    for (const node of document.querySelectorAll("[data-contrast-measure]")) delete node.dataset.contrastMeasure
    if (!element) return
    for (const mark of element.querySelectorAll("[data-contrast-mark]")) delete mark.dataset.contrastMark
  }, selector)
  const pixels = []
  for (const png of pngs) {
    const lineData = await page.evaluate(async (base64) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob())
      const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext("2d")
      context.drawImage(bitmap, 0, 0)
      return [...context.getImageData(0, 0, bitmap.width, bitmap.height).data]
    }, png.toString("base64"))
    for (const value of lineData) pixels.push(value)
  }
  const [r, g, b, alpha] = text.color
  const ratios = []
  for (let index = 0; index < pixels.length; index += 4) {
    const background = [pixels[index], pixels[index + 1], pixels[index + 2]]
    const blend = (front, back) => (front * alpha) / 255 + (back * (255 - alpha)) / 255
    ratios.push(ratio([blend(r, background[0]), blend(g, background[1]), blend(b, background[2])], background))
  }
  ratios.sort((x, y) => x - y)
  // The 2nd percentile, so a few antialiased edge pixels of a neighbor don't decide the result.
  return { contrast: ratios[Math.floor(ratios.length * 0.02)], required: text.large ? 3 : 4.5 }
}

async function check(page, scope, context) {
  const result = await within(
    `${scope} axe`,
    page.evaluate(
      (include) => window.axe.run(include, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }),
      context,
    ),
  )
  for (const violation of result.violations) {
    for (const node of violation.nodes)
      failures.push(`${scope} ${violation.id} ${node.target.join(" ")}: ${node.failureSummary}`)
  }
  const unresolved = result.incomplete.filter((rule) => rule.id === "color-contrast").flatMap((rule) => rule.nodes)
  let measured = 0
  for (const node of unresolved) {
    const selector = node.target.join(" ")
    const found = await within(`${scope} measure ${selector}`, measure(page, selector))
    if (!found) continue
    measured++
    if (found.contrast < found.required) {
      failures.push(`${scope} measured contrast ${found.contrast.toFixed(2)} < ${found.required} at ${selector}`)
    }
  }
  console.log(`${scope}: ${result.violations.length} axe violations, ${measured} measured in pixels`)
}

// Pairs axe may not meet on the page: [foreground, background, required ratio].
const tokenPairs = [
  ["primary-foreground", "primary", 4.5],
  ["primary", "background", 4.5],
  ["primary", "card", 3],
  ["ring", "background", 3],
  ["foreground", "background", 4.5],
  ["muted-foreground", "muted", 4.5],
  ["muted-foreground", "background", 4.5],
  ["accent-foreground", "accent", 4.5],
  ["secondary-foreground", "secondary", 4.5],
  ["input-strong", "background", 3],
  ["link", "background", 4.5],
  ["link", "card", 4.5],
  ["link", "muted", 4.5],
  ["link-soft", "background", 4.5],
  ["link-soft", "card", 4.5],
  ["link-soft", "muted", 4.5],
  ...["positive", "negative", "target", "remaining"].flatMap((series) => [
    [`series-${series}`, "background", 3],
    [`series-${series}`, "card", 3],
  ]),
  // Soft tones: text on the tinted fill; the fill and its edge visible against the page and a card.
  ...["neutral", "info", "success", "warning", "destructive", "violet"].flatMap((tone) => [
    [`${tone}-soft-foreground`, `${tone}-soft`, 4.5],
    [`${tone}-soft`, "card", 1.1],
    [`${tone}-border`, "background", 1.4],
    [`${tone}-border`, "card", 1.4],
  ]),
  // Toast tone icons, drawn in the solid tone over the popover fill.
  ...["info", "success", "warning", "destructive"].map((tone) => [tone, "popover", 3]),
  ["violet-foreground", "violet", 4.5],
  ["violet", "background", 4.5],
  ["violet", "card", 4.5],
  ["skeleton", "background", 1.15],
  ["skeleton", "card", 1.15],
]

// A translucent token (the skeleton) shows the surface under it, so it's measured composited over that surface.
function over([r, g, b, alpha], back) {
  return [r, g, b].map((value, index) => (value * alpha + back[index] * (255 - alpha)) / 255)
}

async function checkTokens(page, scope) {
  const colors = await page.evaluate(
    (names) => {
      const probe = document.createElement("span")
      document.body.append(probe)
      const context = new OffscreenCanvas(1, 1).getContext("2d")
      const rgb = Object.fromEntries(
        names.map((name) => {
          probe.style.color = `var(--${name})`
          context.clearRect(0, 0, 1, 1)
          context.fillStyle = getComputedStyle(probe).color
          context.fillRect(0, 0, 1, 1)
          return [name, [...context.getImageData(0, 0, 1, 1).data]]
        }),
      )
      probe.remove()
      return rgb
    },
    [...new Set(tokenPairs.flatMap(([a, b]) => [a, b]))],
  )
  for (const [foreground, background, required] of tokenPairs) {
    const value = ratio(over(colors[foreground], colors[background]), colors[background])
    if (value < required)
      failures.push(`${scope} --${foreground} on --${background}: ${value.toFixed(2)} < ${required}`)
  }
}

// Popups render only while open, so open each kind once and check it in place.
const popups = [
  { name: "dialog", open: (page) => page.getByRole("button", { name: "Rename project" }), selector: '[role="dialog"]' },
  {
    name: "listbox",
    open: (page) => page.getByRole("combobox", { name: "Model", exact: true }).first(),
    selector: '[role="listbox"]',
  },
  {
    name: "menu",
    open: (page) => page.getByRole("button", { name: "Actions for Index the docs" }),
    selector: '[role="menu"]',
  },
  {
    name: "command palette",
    open: (page) => page.getByRole("button", { name: "Search commands" }),
    selector: '[data-slot="dialog-content"]:has([data-slot="command"])',
  },
  {
    name: "menubar menu",
    open: (page) => page.getByRole("menuitem", { name: "File", exact: true }),
    selector: '[role="menu"]',
  },
  {
    name: "task detail dialog",
    open: (page) => page.getByRole("button", { name: "Open T-014 Index the docs for search" }),
    selector: '[data-task-detail="dialog"]',
  },
  {
    name: "lightbox",
    open: (page) => page.getByRole("button", { name: "View import-error.png" }),
    selector: '[data-slot="lightbox"]',
  },
]

await withShowcase(async (page) => {
  await page.addScriptTag({ path: axePath })
  await page.addStyleTag({
    content:
      "[data-contrast-measure] { text-decoration-color: transparent !important }\n" +
      "[data-contrast-measure] [data-contrast-mark] { visibility: hidden !important }",
  })
  for (const palette of palettes) {
    for (const theme of themes) {
      for (const mode of ["light", "dark"]) {
        await setAppearance(page, theme, mode, palette)
        if (theme === "glass" && glassOpacity) {
          await page.evaluate(
            (value) => document.documentElement.style.setProperty("--glass-opacity", `${value}%`),
            glassOpacity,
          )
        }
        const scope = palette ? `${palette} ${theme}/${mode}` : `${theme}/${mode}`
        await checkTokens(page, scope)
        await check(page, scope, "body")
        await page.getByRole("button", { name: "Show toast types" }).click()
        await page.locator('[data-slot="toast"][data-type="error"]').waitFor()
        await page.waitForTimeout(250)
        await check(page, `${scope} toasts`, '[data-slot="toast-region"]')
        // All at once: a toast that starts closing moves the others, so one-by-one clicks race the layout.
        await page.evaluate(() => {
          for (const close of document.querySelectorAll('[data-slot="toast"] [aria-label="Dismiss"]')) close.click()
        })
        await page.locator('[data-slot="toast"]').first().waitFor({ state: "detached" })
        for (const popup of popups) {
          await popup.open(page).click()
          await page.locator(popup.selector).first().waitFor()
          await page.waitForTimeout(250)
          await check(page, `${scope} ${popup.name}`, popup.selector)
          await page.keyboard.press("Escape")
          await page.locator(popup.selector).first().waitFor({ state: "hidden" })
        }
      }
    }
  }
})

if (failures.length > 0) {
  console.error(failures.join("\n"))
  process.exitCode = 1
}
