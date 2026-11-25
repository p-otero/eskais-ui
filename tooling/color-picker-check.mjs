/* oxlint-disable no-await-in-loop -- each drag and key starts where the one before left the thumbs */
import { convertColor, parseColor } from "@ui-sdk/core/color"

import { withShowcase } from "./showcase-browser.mjs"

const failures = []

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

const near = (a, b, tolerance = 0.01) => Math.abs(a - b) <= tolerance
const frame = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0))))

function inGamut(value) {
  const color = parseColor(value)
  return (
    !!color &&
    convertColor(color, "srgb").coords.every((channel) => (channel ?? 0) > -1e-3 && (channel ?? 0) < 1 + 1e-3)
  )
}

async function areaPoint(thumb) {
  return thumb.evaluate((element) => ({
    x: Number(element.style.getPropertyValue("--area-x")),
    y: Number(element.style.getPropertyValue("--area-y")),
  }))
}

function paintedDifference(area, value) {
  return area.evaluate((element, color) => {
    const canvas = element.querySelector("canvas")
    const thumb = element.querySelector("[data-slot=color-picker-area-thumb]")
    const x = Number(thumb.style.getPropertyValue("--area-x"))
    const y = Number(thumb.style.getPropertyValue("--area-y"))
    const column = Math.min(canvas.width - 1, Math.round(x * (canvas.width - 1)))
    const row = Math.min(canvas.height - 1, Math.round((1 - y) * (canvas.height - 1)))
    const painted = canvas.getContext("2d").getImageData(column, row, 1, 1).data
    const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
    probe.fillStyle = color.replace(/\s*\/\s*[\d.]+\)$/, ")")
    probe.fillRect(0, 0, 1, 1)
    const expected = probe.getImageData(0, 0, 1, 1).data
    return Math.max(...[0, 1, 2].map((channel) => Math.abs(painted[channel] - expected[channel])))
  }, value)
}

const targets = [
  { name: "right edge", x: 1, y: 0.5 },
  { name: "left edge", x: 0, y: 0.5 },
  { name: "top edge", x: 0.5, y: 1 },
  { name: "bottom edge", x: 0.5, y: 0 },
  { name: "top right corner", x: 1, y: 1 },
  { name: "bottom right corner", x: 1, y: 0 },
  { name: "top left corner", x: 0, y: 1 },
  { name: "bottom left corner", x: 0, y: 0 },
  { name: "right, two thirds up", x: 1, y: 0.66 },
]

async function checkPicker(page, name, mode) {
  const area = page.locator("[data-slot=color-picker-area]", {
    has: page.getByRole("slider", { name: `${name} chroma and lightness` }),
  })
  const thumb = page.getByRole("slider", { name: `${name} chroma and lightness` })
  const input = page.getByRole("textbox", { name: `${name} value` })
  const committed = page.locator(`output[aria-label="${name} committed"]`)
  const label = `${mode}, ${name.toLowerCase()}`

  for (const target of targets) {
    const box = await area.boundingBox()
    const start = await thumb.boundingBox()
    const toX = box.x + (target.x === 1 ? box.width + 24 : target.x === 0 ? -24 : box.width * target.x)
    const toY = box.y + (target.y === 1 ? -24 : target.y === 0 ? box.height + 24 : box.height * (1 - target.y))
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
    await page.mouse.down()
    await page.mouse.move(toX, toY, { steps: 12 })
    const during = await areaPoint(thumb)
    await page.mouse.up()
    await frame(page)
    const after = await areaPoint(thumb)
    const value = await input.inputValue()
    check(
      `${label}: a drag to the ${target.name} leaves the thumb there`,
      near(after.x, target.x) &&
        near(after.y, target.y) &&
        near(after.x, during.x, 1e-6) &&
        near(after.y, during.y, 1e-6),
      `during ${during.x.toFixed(4)},${during.y.toFixed(4)} after ${after.x.toFixed(4)},${after.y.toFixed(4)}`,
    )
    check(`${label}: the ${target.name} value is inside sRGB`, inGamut(value), value)
    check(`${label}: the ${target.name} commits that value`, (await committed.textContent()) === value)
    const difference = await paintedDifference(area, value)
    check(`${label}: the area paints the ${target.name} value under the thumb`, difference <= 10, `Δ ${difference}`)
  }

  await thumb.focus()
  for (const [key, x] of [
    ["End", 1],
    ["Home", 0],
    ["End", 1],
  ]) {
    await page.keyboard.press(key)
    await frame(page)
    const point = await areaPoint(thumb)
    const value = await input.inputValue()
    check(`${label}: ${key} puts the area thumb at x = ${x}`, near(point.x, x, 1e-6), `${point.x}`)
    check(`${label}: after ${key} the value is inside sRGB`, inGamut(value), value)
  }

  for (const channel of ["hue", "alpha"]) {
    const slider = page.locator("[data-slot=color-picker-slider]", {
      has: page.getByRole("slider", { name: `${name} ${channel}` }),
    })
    const sliderThumb = page.getByRole("slider", { name: `${name} ${channel}` })
    for (const [end, fraction] of [
      ["end", 1],
      ["start", 0],
    ]) {
      const box = await slider.boundingBox()
      const start = await sliderThumb.boundingBox()
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
      await page.mouse.down()
      await page.mouse.move(fraction === 1 ? box.x + box.width + 30 : box.x - 30, box.y + box.height / 2, { steps: 10 })
      await page.mouse.up()
      await frame(page)
      const position = await sliderThumb.evaluate((element) =>
        Number.parseFloat(element.style.getPropertyValue("--color-slider-thumb-position")),
      )
      check(`${label}: the ${channel} thumb stays at the ${end}`, near(position, fraction * 100, 0.01), `${position}%`)
      const point = await areaPoint(thumb)
      check(`${label}: the ${channel} drag leaves the area thumb at x = 1`, near(point.x, 1, 1e-6), `${point.x}`)
      check(`${label}: after the ${channel} drag the value is inside sRGB`, inGamut(await input.inputValue()))
    }
  }
}

await withShowcase(async (page) => {
  for (const mode of ["light", "dark"]) {
    await page.goto(`${new URL(page.url()).origin}/?demo=color-picker-check`)
    await page.getByRole("slider", { name: "Controlled chroma and lightness" }).waitFor()
    await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), mode === "dark")
    const dark = await page.evaluate(() => {
      const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
      probe.fillStyle = getComputedStyle(document.body).color
      probe.fillRect(0, 0, 1, 1)
      return probe.getImageData(0, 0, 1, 1).data[0] > 128
    })
    check(`${mode}: the page renders in ${mode} mode`, dark === (mode === "dark"))
    for (const name of ["Default", "Controlled"]) await checkPicker(page, name, mode)
    if (process.env.COLOR_PICKER_SHOTS)
      await page.screenshot({ path: `${process.env.COLOR_PICKER_SHOTS}/color-picker-${mode}.png` })
  }
})

if (failures.length > 0) {
  console.error(`\n${failures.length} color picker check(s) failed`)
  process.exit(1)
}
