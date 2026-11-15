// Runs axe in a real browser for every theme and color mode, then measures the contrast axe can't:
// text over gradients and glass, by rendering the background with the text hidden and checking its worst pixel.
// Usage: node tooling/contrast-check.mjs [themes, default "default,compact"] [glass-opacity-percent]
// Glass is checked by hand (`bun run test:browser:glass`): blur without a GPU is too slow for CI.
import { createRequire } from "node:module"

import { setAppearance, withShowcase } from "./showcase-browser.mjs"

const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js")
const themes = (process.argv[2] ?? "default,compact").split(",")
const glassOpacity = process.argv[3]
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
    const box = range.getBoundingClientRect()
    const style = getComputedStyle(element)
    const canvas = new OffscreenCanvas(1, 1).getContext("2d")
    canvas.fillStyle = style.color
    canvas.fillRect(0, 0, 1, 1)
    const color = [...canvas.getImageData(0, 0, 1, 1).data]
    element.style.setProperty("-webkit-text-fill-color", "transparent")
    const size = Number.parseFloat(style.fontSize)
    const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700)
    return { box: { x: box.x, y: box.y, width: box.width, height: box.height }, color, large }
  }, selector)
  if (!text || text.box.width < 1 || text.box.height < 1) return null
  const png = await page.screenshot({ clip: text.box, animations: "disabled" })
  await page.evaluate(
    (target) => document.querySelector(target)?.style.removeProperty("-webkit-text-fill-color"),
    selector,
  )
  const pixels = await page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob())
    const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext("2d")
    context.drawImage(bitmap, 0, 0)
    return [...context.getImageData(0, 0, bitmap.width, bitmap.height).data]
  }, png.toString("base64"))
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

// Popups render only while open, so open each kind once and check it in place.
const popups = [
  { name: "dialog", open: (page) => page.getByRole("button", { name: "Rename project" }), selector: '[role="dialog"]' },
  { name: "listbox", open: (page) => page.getByRole("combobox", { name: "Model" }), selector: '[role="listbox"]' },
  {
    name: "menu",
    open: (page) => page.getByRole("button", { name: "Actions for Index the docs" }),
    selector: '[role="menu"]',
  },
]

await withShowcase(async (page) => {
  await page.addScriptTag({ path: axePath })
  for (const theme of themes) {
    for (const mode of ["light", "dark"]) {
      await setAppearance(page, theme, mode)
      if (theme === "glass" && glassOpacity) {
        await page.evaluate(
          (value) => document.documentElement.style.setProperty("--glass-opacity", `${value}%`),
          glassOpacity,
        )
      }
      await check(page, `${theme}/${mode}`, "body")
      for (const popup of popups) {
        await popup.open(page).click()
        await page.locator(popup.selector).first().waitFor()
        await page.waitForTimeout(250)
        await check(page, `${theme}/${mode} ${popup.name}`, popup.selector)
        await page.keyboard.press("Escape")
        await page.locator(popup.selector).first().waitFor({ state: "hidden" })
      }
    }
  }
})

if (failures.length > 0) {
  console.error(failures.join("\n"))
  process.exitCode = 1
}
