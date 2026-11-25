import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"

import { withShowcase } from "./showcase-browser.mjs"

const shotsArg = process.argv.find((arg) => arg.startsWith("--screenshots="))
const shots = shotsArg ? resolve(shotsArg.slice(14)) : undefined
const palettes = ["default", "blue", "violet", "green", "orange"]

const ESC = "\u001b"
const sgr = (codes, text) => `${ESC}[${codes}m${text}${ESC}[0m`
const named = Array.from({ length: 8 }, (_, index) => index)
const lines = [
  ...named.map((index) => ({
    text: `${sgr(String(30 + index), `fg ${String(index)}`)} ${sgr(String(90 + index), `bright ${String(index)}`)}`,
  })),
  ...named.map((index) => ({
    text: `${sgr(`7;${String(30 + index)}`, ` inverse ${String(index)} `)} ${sgr(String(40 + index), ` bg ${String(index)} `)}`,
  })),
  ...Array.from({ length: 16 }, (_row, row) => ({
    text: Array.from({ length: 16 }, (_column, column) => sgr(`38;5;${String(row * 16 + column)}`, "▇a")).join(""),
  })),
  {
    text: `${sgr("38;2;255;255;255", "white")} ${sgr("38;2;0;0;0", "black")} ${sgr("38;2;255;255;0", "yellow")} ${sgr("1;2;38;2;0;0;255", "dim blue")}`,
  },
  ...named.map((index) => ({ text: `${sgr(String(30 + index), `error fg ${String(index)}`)}`, level: "error" })),
]

async function measure(page) {
  return page.evaluate(() => {
    const canvas = new OffscreenCanvas(1, 1).getContext("2d")
    const rgba = (css) => {
      canvas.clearRect(0, 0, 1, 1)
      canvas.fillStyle = "#000"
      canvas.fillStyle = css
      canvas.fillRect(0, 0, 1, 1)
      return [...canvas.getImageData(0, 0, 1, 1).data]
    }
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the page, which can't see this module
    const channel = (value) => {
      const c = value / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }
    const luminance = ([r, g, b]) => {
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    }
    const backdrop = (element) => {
      const layers = []
      for (let node = element; node; node = node.parentElement) {
        const fill = rgba(getComputedStyle(node).backgroundColor)
        if (fill[3] > 0) layers.push(fill)
        if (fill[3] === 255) break
      }
      return layers.reduceRight(
        (under, [r, g, b, a]) => [r, g, b].map((value, index) => (value * a + under[index] * (255 - a)) / 255),
        [255, 255, 255],
      )
    }
    const failures = []
    let checked = 0
    let lowest = Number.POSITIVE_INFINITY
    for (const span of document.querySelectorAll('[data-slot="log-viewer-text"] span[style]')) {
      if (span.textContent?.trim() === "") continue
      const text = rgba(getComputedStyle(span).color)
      const back = backdrop(span)
      const [light, dark] = [luminance(text), luminance(back)].toSorted((a, b) => b - a)
      const ratio = (light + 0.05) / (dark + 0.05)
      checked++
      lowest = Math.min(lowest, ratio)
      if (ratio < 4.5) failures.push(`${span.textContent?.trim()} (${span.getAttribute("style")}): ${ratio.toFixed(2)}`)
    }
    return { checked, failures, lowest }
  })
}

const failures = []
await withShowcase(async (page) => {
  const url = new URL(page.url())
  await page.goto(`${url.origin}/?demo=log-bench`)
  await page.waitForFunction(() => globalThis.logBench !== undefined)
  await page.evaluate((input) => globalThis.logBench.store.append(input), lines)
  await page.waitForTimeout(300)
  for (const mode of ["light", "dark"]) {
    for (const palette of palettes) {
      await page.evaluate(
        ([scheme, name]) => {
          const html = document.documentElement
          html.classList.toggle("dark", scheme === "dark")
          html.dataset.colorScheme = scheme
          if (name === "default") delete html.dataset.palette
          else html.dataset.palette = name
        },
        [mode, palette],
      )
      await page.waitForTimeout(150)
      const result = await measure(page)
      console.log(
        `${mode} ${palette}: ${String(result.checked)} coloured runs, lowest ${result.lowest.toFixed(2)}:1, ${String(result.failures.length)} under 4.5:1`,
      )
      if (result.checked < 250)
        failures.push(`${mode} ${palette}: only ${String(result.checked)} coloured runs measured`)
      failures.push(...result.failures.map((failure) => `${mode} ${palette}: ${failure}`))
    }
  }
})

if (shots) {
  await mkdir(shots, { recursive: true })
  for (const [width, height] of [
    [1100, 720],
    [390, 760],
  ]) {
    await withShowcase(
      async (page) => {
        const url = new URL(page.url())
        await page.goto(`${url.origin}/?demo=log-viewer`)
        await page.locator('[data-slot="log-viewer-log"]').waitFor()
        await page.waitForTimeout(1500)
        for (const mode of ["light", "dark"]) {
          await page.evaluate((scheme) => {
            document.documentElement.classList.toggle("dark", scheme === "dark")
            document.documentElement.dataset.colorScheme = scheme
          }, mode)
          await page.getByRole("button", { name: "Pause stream" }).click()
          await page.waitForTimeout(300)
          await page.screenshot({ path: resolve(shots, `log-viewer-${mode}-${String(width)}.png`) })
          await page.getByRole("button", { name: "Resume stream" }).click()
          await page.waitForTimeout(800)
        }
      },
      { viewport: { width, height } },
    )
  }
  console.log(`Screenshots in ${shots}`)
}

if (failures.length > 0) {
  console.error(failures.join("\n"))
  process.exitCode = 1
}
