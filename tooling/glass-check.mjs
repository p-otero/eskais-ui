/* oxlint-disable no-await-in-loop -- each theme and mode is set, measured and reset on one page in turn */
import { setAppearance, withShowcase } from "./showcase-browser.mjs"

const failures = []
const scale = 2
const margin = 4

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

const controls = [
  ["outline button", (page) => page.getByRole("button", { name: "Outline", exact: true })],
  ["secondary button", (page) => page.getByRole("button", { name: "Secondary", exact: true })],
  ["secondary icon button", (page) => page.getByRole("button", { name: "Share", exact: true })],
  ["outline toggle", (page) => page.getByRole("button", { name: "Italic", exact: true })],
  ["pressed toggle", (page) => page.getByRole("button", { name: "Bold", exact: true })],
  ["segmented track", (page) => page.getByRole("radiogroup", { name: "Range", exact: true })],
  ["tab list", (page) => page.getByRole("tablist", { name: "Views", exact: true })],
]

async function settle(page) {
  await page.waitForTimeout(250)
  await page.evaluate(() => {
    for (const element of document.querySelectorAll("*")) void getComputedStyle(element).backgroundColor
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSTransition) animation.finish()
    }
  })
}

async function pixels(page, png) {
  return page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob())
    const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext("2d")
    context.drawImage(bitmap, 0, 0)
    return { width: bitmap.width, data: [...context.getImageData(0, 0, bitmap.width, bitmap.height).data] }
  }, png.toString("base64"))
}

async function edgeContrast(page, locator) {
  const box = await locator.boundingBox()
  const clip = { x: box.x - margin, y: box.y - margin, width: box.width + 2 * margin, height: box.height + 2 * margin }
  const { width, data } = await pixels(page, await page.screenshot({ clip, animations: "disabled" }))
  const at = (x, y) => {
    const index = (Math.round(y) * width + Math.round(x)) * 4
    return [data[index], data[index + 1], data[index + 2]]
  }
  const start = margin * scale
  const right = start + Math.round(box.width * scale) - 1
  const bottom = start + Math.round(box.height * scale) - 1
  const gap = 2 * scale
  const band = 2 * scale
  const samples = []
  const side = ([x, y], [dx, dy]) => {
    const outside = at(x - dx * gap, y - dy * gap)
    const edge = Array.from({ length: band }, (_, step) => at(x + dx * step, y + dy * step))
    samples.push(Math.max(...edge.map((pixel) => ratio(pixel, outside))))
  }
  const cornerRadius = await locator.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).borderTopLeftRadius),
  )
  const radius = Math.min(box.height / 2, cornerRadius)
  const straight = box.width - 2 * radius
  for (const fraction of straight > 4 ? [0.2, 0.5, 0.8] : [0.5]) {
    const x = start + (radius + straight * fraction) * scale
    side([x, start], [0, 1])
    side([x, bottom], [0, -1])
  }
  const middle = start + (box.height * scale) / 2
  side([start, middle], [1, 0])
  side([right, middle], [-1, 0])
  return Math.min(...samples)
}

function alphaOf(page, selector, property) {
  return page.evaluate(
    ([target, name]) => {
      const element = document.querySelector(target)
      if (!element) return null
      const context = new OffscreenCanvas(1, 1).getContext("2d")
      context.fillStyle = getComputedStyle(element)[name]
      context.fillRect(0, 0, 1, 1)
      return context.getImageData(0, 0, 1, 1).data[3] / 255
    },
    [selector, property],
  )
}

function backdropOf(page, selector) {
  return page.evaluate((target) => getComputedStyle(document.querySelector(target)).backdropFilter, selector)
}

const secondary = '[data-slot="button"][data-variant="secondary"]'

async function opaque(page, scope, { cards }) {
  const checks = [
    ["menu fill", await alphaOf(page, '[role="menu"]', "backgroundColor"), 1],
    ["menu backdrop", await backdropOf(page, '[role="menu"]'), "none"],
    ["toast fill", await alphaOf(page, '[data-slot="toast"]', "backgroundColor"), 1],
    ["secondary button fill", await alphaOf(page, secondary, "backgroundColor"), 1],
  ]
  if (cards) {
    checks.push(
      ["card fill", await alphaOf(page, '[data-slot="card"]', "backgroundColor"), 1],
      ["card backdrop", await backdropOf(page, '[data-slot="card"]'), "none"],
    )
  }
  for (const [name, actual, expected] of checks) {
    if (actual !== expected) failures.push(`${scope}: ${name} is ${String(actual)}, expected ${String(expected)}`)
  }
}

await withShowcase(async (page) => {
  await page.goto(`${page.url()}?demo=liquid-glass`)
  await page.locator("#root > *").first().waitFor({ state: "attached" })
  await page.evaluate(() => document.fonts.ready)
  const cdp = await page.context().newCDPSession(page)
  if (!(await page.locator(secondary).count())) throw new Error(`No ${secondary} on the liquid-glass demo`)
  for (const theme of ["glass", "liquid"]) {
    for (const mode of ["light", "dark"]) {
      const scope = `${theme}/${mode}`
      await setAppearance(page, theme, mode)
      await page.mouse.move(0, 0)
      await settle(page)
      if (theme === "liquid") {
        for (const [name, locate] of controls) {
          const contrast = await edgeContrast(page, locate(page))
          console.log(`${scope} ${name}: edge ${contrast.toFixed(2)}:1`)
          if (contrast < 3) failures.push(`${scope} ${name}: edge contrast ${contrast.toFixed(2)} < 3`)
        }
      }
      await page.getByRole("button", { name: "Show toast" }).click()
      await page.locator('[data-slot="toast"]').first().waitFor()
      await page.getByRole("button", { name: "Project actions" }).click()
      await page.getByRole("menu").waitFor()
      if (theme === "liquid" && (await page.locator("#eskais-liquid-lens").count())) {
        const backdrop = await backdropOf(page, '[role="menu"]')
        if (!backdrop.startsWith('url("#eskais-liquid-lens")'))
          failures.push(`${scope}: the menu has no lens: ${backdrop}`)
      }
      await page.evaluate(() => document.documentElement.setAttribute("data-elevation", "flat"))
      await settle(page)
      await opaque(page, `${scope} flat`, { cards: false })
      await page.evaluate(() => document.documentElement.removeAttribute("data-elevation"))
      await cdp.send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
      })
      await settle(page)
      await opaque(page, `${scope} reduced transparency`, { cards: true })
      await cdp.send("Emulation.setEmulatedMedia", { features: [] })
      await page.keyboard.press("Escape")
      await page.getByRole("menu").waitFor({ state: "hidden" })
      await page.evaluate(() => {
        for (const close of document.querySelectorAll('[data-slot="toast"] [aria-label="Dismiss"]')) close.click()
      })
      await page.locator('[data-slot="toast"]').first().waitFor({ state: "detached" })
      console.log(`${scope}: opaque under flat elevation and reduced transparency`)
    }
  }
})

if (failures.length > 0) {
  console.error(failures.join("\n"))
  process.exitCode = 1
}
