/* oxlint-disable no-await-in-loop -- each width, mode and fixture is measured in turn on one page */
import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"

import { mapRegionBox } from "../registry/lib/image-scan-geometry.ts"
import { withShowcase } from "./showcase-browser.mjs"

const failures = []
const shotsArg = process.argv.find((arg) => arg.startsWith("--screenshots="))
const shots = shotsArg ? resolve(shotsArg.slice("--screenshots=".length)) : undefined
if (shots) mkdirSync(shots, { recursive: true })

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

const widths = [320, 390, 1440]
const targetImage = { width: 800, height: 400 }
const targetBoxes = {
  red: { x: 0.1, y: 0.2, width: 0.2, height: 0.5 },
  blue: { x: 0.7, y: 0.1, width: 0.2, height: 0.3 },
}
const targetColours = { red: [255, 0, 0], blue: [0, 0, 255] }
const fits = { natural: "contain", contain: "contain", cover: "cover" }
const settle = (page, ms = 700) => page.waitForTimeout(ms)

async function open(page, { width, mode, reducedMotion = "no-preference", attributes = {} }) {
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion })
  await page.goto(`${new URL(page.url()).origin}/?demo=image-scan-check`)
  await page.evaluate(
    ({ dark, set }) => {
      document.documentElement.classList.toggle("dark", dark)
      for (const [name, value] of Object.entries(set)) document.documentElement.setAttribute(name, value)
    },
    { dark: mode === "dark", set: attributes },
  )
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-slot=image-scan-image]")].every((image) => image.complete),
  )
  await settle(page)
}

async function overflow(page) {
  return page.evaluate(() => {
    const viewport = document.documentElement.clientWidth
    const wide = document.documentElement.scrollWidth > viewport
    const roots = [...document.querySelectorAll("[data-slot=image-scan]")].filter((root) => {
      const rect = root.getBoundingClientRect()
      return root.scrollWidth > root.clientWidth + 1 || rect.right > viewport + 0.5 || rect.left < -0.5
    })
    return { page: wide, roots: roots.map((root) => root.getAttribute("aria-label")) }
  })
}

async function regions(page, testid) {
  const section = page.getByTestId(testid)
  await section.scrollIntoViewIfNeeded()
  const measured = await section.evaluate((element) => {
    const frame = element.querySelector("[data-slot=image-scan-frame]")
    const rect = frame.getBoundingClientRect()
    const left = rect.left + frame.clientLeft
    const top = rect.top + frame.clientTop
    return {
      frame: { width: frame.clientWidth, height: frame.clientHeight, left, top },
      regions: [...element.querySelectorAll("[data-slot=image-scan-region]")].map((region) => {
        const box = region.getBoundingClientRect()
        const visible = {
          left: Math.max(box.left, left),
          top: Math.max(box.top, top),
          right: Math.min(box.right, left + frame.clientWidth),
          bottom: Math.min(box.bottom, top + frame.clientHeight),
        }
        return {
          name: region.textContent.trim(),
          box: { x: box.left - left, y: box.top - top, width: box.width, height: box.height },
          centre: { x: (visible.left + visible.right) / 2, y: (visible.top + visible.bottom) / 2 },
        }
      }),
    }
  })
  for (const region of measured.regions) {
    const png = await page.screenshot({ clip: { x: region.centre.x - 1, y: region.centre.y - 1, width: 2, height: 2 } })
    region.colour = await page.evaluate(async (base64) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob())
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext("2d")
      context.drawImage(bitmap, 0, 0)
      return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3))
    }, png.toString("base64"))
  }
  return measured
}

const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance
const sameColour = (a, b) => a.every((channel, index) => Math.abs(channel - b[index]) <= 12)

async function checkRegions(page, label) {
  for (const testid of Object.keys(fits)) {
    const { frame, regions: found } = await regions(page, testid)
    for (const region of found) {
      const key = region.name.startsWith("Red") ? "red" : "blue"
      const expected = mapRegionBox(targetBoxes[key], { fit: fits[testid], image: targetImage, frame })
      check(
        `${label}, ${testid}: the ${key} box lands where mapRegionBox puts it`,
        near(region.box.x, expected.x) &&
          near(region.box.y, expected.y) &&
          near(region.box.width, expected.width) &&
          near(region.box.height, expected.height),
        `${JSON.stringify(region.box)} vs ${JSON.stringify(expected)}`,
      )
      check(
        `${label}, ${testid}: the ${key} box sits on ${key} pixels`,
        sameColour(region.colour, targetColours[key]),
        region.colour.join(","),
      )
    }
  }
}

async function runningAnimations(page) {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.playState === "running")
      .map((animation) => {
        const target = animation.effect?.target
        const properties = new Set(
          (animation.effect?.getKeyframes() ?? []).flatMap((frame) =>
            Object.keys(frame).filter((key) => !["offset", "computedOffset", "easing", "composite"].includes(key)),
          ),
        )
        return {
          inScan: Boolean(target?.closest?.("[data-slot=image-scan]")),
          slot: target?.closest?.("[data-slot]")?.getAttribute("data-slot"),
          properties: [...properties],
        }
      }),
  )
}

async function checkMotion(page, label) {
  const running = (await runningAnimations(page)).filter((animation) => animation.inScan)
  check(`${label}: the indeterminate scan animates`, running.length > 0, String(running.length))
  const offCompositor = running.filter((animation) =>
    animation.properties.some(
      (property) => !["transform", "opacity", "rotate", "scale", "translate"].includes(property),
    ),
  )
  check(
    `${label}: every running animation is a transform or opacity`,
    offCompositor.length === 0,
    JSON.stringify(offCompositor),
  )
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Performance.enable")
  const metric = async (name) =>
    (await cdp.send("Performance.getMetrics")).metrics.find((entry) => entry.name === name)?.value ?? 0
  const before = { layout: await metric("LayoutCount"), style: await metric("RecalcStyleCount") }
  await page.waitForTimeout(1500)
  const after = { layout: await metric("LayoutCount"), style: await metric("RecalcStyleCount") }
  await cdp.detach()
  check(
    `${label}: 1.5 s of scanning lays nothing out`,
    after.layout - before.layout === 0,
    `${String(after.layout - before.layout)} layouts, ${String(after.style - before.style)} style recalcs`,
  )

  const line = await page.getByTestId("determinate").evaluate((element) => {
    const layer = element.querySelector("[data-slot=image-scan-layer]").getBoundingClientRect()
    const effect = element.querySelector("[data-slot=image-scan-effect]")
    const [veil, , scanLine] = effect.children
    return {
      layerTop: layer.top,
      layerHeight: layer.height,
      lineBottom: scanLine.getBoundingClientRect().bottom,
      veilHeight: veil.getBoundingClientRect().height,
    }
  })
  check(
    `${label}: the progress line is 60% down the image`,
    near(line.lineBottom, line.layerTop + line.layerHeight * 0.6),
    JSON.stringify(line),
  )
  check(
    `${label}: the veil covers the 40% still to scan`,
    near(line.veilHeight, line.layerHeight * 0.4),
    JSON.stringify(line),
  )
}

async function screenshotStates(page, label) {
  if (!shots) return
  for (const testid of ["uploaded", "indeterminate", "determinate", "result", "error"]) {
    await page.getByTestId(testid).screenshot({ path: join(shots, `image-scan-${label}-${testid}.png`) })
  }
}

await withShowcase(async (page) => {
  for (const width of widths) {
    for (const mode of ["light", "dark"]) {
      const label = `${String(width)} px ${mode}`
      await open(page, { width, mode })
      const { page: pageOverflow, roots } = await overflow(page)
      check(`${label}: nothing overflows`, !pageOverflow && roots.length === 0, roots.join(", "))
      await checkRegions(page, label)
      await checkMotion(page, label)
      await screenshotStates(page, label.replace(/ /g, "-"))
    }
  }

  for (const width of [320, 1440]) {
    await open(page, { width, mode: "light", reducedMotion: "reduce" })
    const label = `${String(width)} px reduced motion`
    const running = await runningAnimations(page)
    check(`${label}: no animation runs`, running.length === 0, JSON.stringify(running))
    const sweep = await page
      .getByTestId("indeterminate")
      .evaluate(
        (element) => getComputedStyle(element.querySelector("[data-slot=image-scan-effect]").children[1]).display,
      )
    check(`${label}: the sweep is gone`, sweep === "none", sweep)
    check(
      `${label}: the progress bar still shows`,
      await page.getByTestId("indeterminate").getByRole("progressbar").isVisible(),
    )
    if (shots)
      await page
        .getByTestId("indeterminate")
        .screenshot({ path: join(shots, `image-scan-${String(width)}-reduced-motion.png`) })
  }

  for (const [name, attributes] of [
    ["right to left", { dir: "rtl" }],
    ["compact density", { "data-density": "compact" }],
    ["glass", { "data-theme": "glass" }],
  ]) {
    await open(page, { width: 320, mode: "light", attributes })
    const { page: pageOverflow, roots } = await overflow(page)
    check(`320 px ${name}: nothing overflows`, !pageOverflow && roots.length === 0, roots.join(", "))
    await checkRegions(page, `320 px ${name}`)
  }

  if (shots) {
    await open(page, { width: 1440, mode: "light" })
    const frame = page.getByTestId("indeterminate").locator("[data-slot=image-scan-frame]")
    for (let index = 0; index < 6; index += 1) {
      await frame.screenshot({
        path: join(shots, `image-scan-sweep-frame-${String(index + 1)}.png`),
        animations: "allow",
      })
      await page.waitForTimeout(300)
    }
  }
})

if (failures.length > 0) {
  console.error(`\n${failures.length} image scan check(s) failed`)
  process.exit(1)
}
