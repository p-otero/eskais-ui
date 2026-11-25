/* oxlint-disable no-await-in-loop -- each phosphor and each step waits for the frame the one before painted */
import { withShowcase } from "./showcase-browser.mjs"

const failures = []
const minimumTextContrast = 4.5
const minimumHitPx = 44
const maxNeighbourLuminanceJump = 60
const minimumRedShare = 0.9

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

function channel(value) {
  const c = value / 255
  return c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

function ratio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].toSorted((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

const demo = (page, name) => page.goto(page.url().replace(/\/(\?.*)?$/, `/?demo=${name}`))

async function phosphorContrast(page) {
  const texts = await page.evaluate(() => {
    const picture = document.querySelector('[data-slot="retro-tv-picture"]')
    const tube = document.querySelector('[data-slot="retro-tv-tube"]')
    const scanline = Number(getComputedStyle(tube).getPropertyValue("--retro-tv-scanline"))
    const leaves = [...picture.querySelectorAll("span, p, div")].filter(
      (element) => element.childElementCount === 0 && element.textContent.trim() !== "" && !element.closest(".sr-only"),
    )
    picture.dataset.contrastMeasure = ""
    return leaves.map((element, index) => {
      element.dataset.retroText = String(index)
      const canvas = new OffscreenCanvas(1, 1).getContext("2d")
      canvas.fillStyle = getComputedStyle(element).color
      canvas.fillRect(0, 0, 1, 1)
      const rect = element.getBoundingClientRect()
      return {
        index,
        text: element.textContent.trim(),
        color: [...canvas.getImageData(0, 0, 1, 1).data].slice(0, 3),
        box: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        scanline,
      }
    })
  })
  await page.addStyleTag({
    content: "[data-contrast-measure] * { color: transparent !important; text-shadow: none !important; }",
  })
  const results = []
  for (const text of texts) {
    if (text.box.width < 1 || text.box.height < 1) continue
    const png = await page.screenshot({ clip: text.box, animations: "disabled" })
    const pixels = await page.evaluate(async (base64) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob())
      const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext("2d")
      context.drawImage(bitmap, 0, 0)
      return [...context.getImageData(0, 0, bitmap.width, bitmap.height).data]
    }, png.toString("base64"))
    const underScanline = text.color.map((value) => value * (1 - text.scanline))
    const ratios = []
    for (let index = 0; index < pixels.length; index += 4) {
      ratios.push(ratio(underScanline, [pixels[index], pixels[index + 1], pixels[index + 2]]))
    }
    ratios.sort((a, b) => a - b)
    results.push({ text: text.text, contrast: ratios[Math.floor(ratios.length * 0.02)] })
  }
  await page.evaluate(() => {
    for (const style of document.querySelectorAll("style"))
      if (style.textContent.includes("contrast-measure")) style.remove()
    delete document.querySelector('[data-slot="retro-tv-picture"]').dataset.contrastMeasure
  })
  return results
}

async function retroTv(page) {
  await demo(page, "retro-tv")
  await page.waitForSelector('[data-slot="retro-tv-picture"]')
  await page.evaluate(() => document.fonts.ready)
  for (const scheme of ["light", "dark"]) {
    await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), scheme === "dark")
    for (const phosphor of ["green", "amber", "white"]) {
      await page.getByRole("radio", { name: phosphor }).click()
      await page.waitForTimeout(250)
      const results = await phosphorContrast(page)
      const worst = results.toSorted((a, b) => a.contrast - b.contrast)[0]
      check(
        `RetroTv ${phosphor} phosphor text keeps ${String(minimumTextContrast)}:1 under the scanlines (${scheme} page)`,
        results.length > 3 && worst.contrast >= minimumTextContrast,
        `${String(results.length)} texts, worst ${worst.contrast.toFixed(2)}:1 on "${worst.text}"`,
      )
    }
  }
  await page.getByRole("radio", { name: "green" }).click()

  const frames = await page.evaluate(async () => {
    let count = 0
    const original = window.requestAnimationFrame
    window.requestAnimationFrame = (callback) => {
      count++
      return original(callback)
    }
    await new Promise((done) => setTimeout(done, 1500))
    window.requestAnimationFrame = original
    return count
  })
  check("RetroTv asks for no animation frames while idle", frames === 0, `${String(frames)} in 1.5 s`)
  const composited = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.effect?.target?.closest?.('[data-slot="retro-tv"]'))
      .flatMap((animation) => animation.effect.getKeyframes().flatMap((frame) => Object.keys(frame)))
      .filter(
        (property) => !["offset", "easing", "composite", "computedOffset", "opacity", "transform"].includes(property),
      ),
  )
  check("RetroTv's idle animations move only opacity and transform", composited.length === 0, composited.join(", "))

  const power = page.getByRole("button", { name: "Power" })
  await power.click()
  await page.waitForTimeout(250)
  const midway = await page.evaluate(
    () => getComputedStyle(document.querySelector('[data-slot="retro-tv-beam"]')).opacity,
  )
  check("RetroTv draws the beam while it switches off", Number(midway) > 0.3, `beam opacity ${midway}`)
  await page.waitForTimeout(1400)
  const off = await page.evaluate(() => {
    const picture = document.querySelector('[data-slot="retro-tv-picture"]')
    return {
      opacity: getComputedStyle(picture).opacity,
      inert: picture.inert,
      beam: getComputedStyle(document.querySelector('[data-slot="retro-tv-beam"]')).opacity,
    }
  })
  check(
    "RetroTv off: the picture and the dot are gone and the screen is inert",
    off.opacity === "0" && off.inert && Number(off.beam) === 0,
    JSON.stringify(off),
  )
  const stepped = await page.evaluate(() =>
    window.retroProbe.agent.act({ steps: [{ ref: "Sales monitor", action: "powerOn" }] }),
  )
  await page.waitForTimeout(700)
  const on = await page.evaluate(
    () => getComputedStyle(document.querySelector('[data-slot="retro-tv-picture"]')).opacity,
  )
  check("An agent's powerOn brings the picture back", stepped.ok && on === "1", `opacity ${on}`)

  await page.emulateMedia({ reducedMotion: "reduce" })
  await power.click()
  const reduced = await page.evaluate(
    () => getComputedStyle(document.querySelector('[data-slot="retro-tv-picture"]')).animationName,
  )
  check("Under reduced motion the picture fades", reduced === "retro-tv-fade-out", reduced)
  await power.click()
  await page.emulateMedia({ reducedMotion: "no-preference" })

  await page.getByRole("button", { name: "Log out" }).click()
  await page.waitForTimeout(300)
  const overlay = await page.evaluate(() => {
    const element = document.querySelector('[data-slot="tv-power-off"]')
    return element ? { parent: element.parentElement === document.body, z: getComputedStyle(element).zIndex } : null
  })
  check(
    "TvPowerOff covers the page from document.body",
    overlay?.parent === true && Number(overlay.z) > 60,
    JSON.stringify(overlay),
  )
  await page.waitForTimeout(1500)
  check(
    "useTvPowerOff resolves once the screen is black",
    (await page.locator('[data-slot="tv-power-off"]').count()) === 0,
  )
}

async function pillDialog(page) {
  await demo(page, "pill-dialog")
  const trigger = page.getByRole("button", { name: "Run migration" })
  await trigger.click()
  const cancel = page.getByRole("button", { name: "Cancel" })
  await cancel.waitFor()
  check("PillDialog focuses the blue pill", await cancel.evaluate((element) => element === document.activeElement))
  const confirm = page.getByRole("button", { name: "Migrate" })
  const shell = confirm.locator('[data-slot="pill-dialog-shell"]')
  const restingTranslate = await shell.evaluate((element) => getComputedStyle(element).translate)
  await confirm.hover()
  await page.waitForTimeout(300)
  const hoverTranslate = await shell.evaluate((element) => getComputedStyle(element).translate)
  check("A pill lifts on hover", restingTranslate !== hoverTranslate, `${restingTranslate} → ${hoverTranslate}`)

  await page.evaluate(() => {
    window.pillChosen = []
    new MutationObserver(() => {
      const chosen = document.querySelector("[data-pill-dialog]")?.getAttribute("data-chosen")
      if (chosen) window.pillChosen.push(chosen)
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-chosen"] })
  })
  await confirm.click()
  await page.waitForSelector('[role="alertdialog"]', { state: "detached", timeout: 5000 })
  const chosen = await page.evaluate(() => window.pillChosen)
  check("The chosen red pill marks the dialog as it closes", chosen.includes("confirm"), chosen.join(", "))
  check("Focus returns to the trigger", await trigger.evaluate((element) => element === document.activeElement))
  await page.keyboard.press("Enter")
  await cancel.waitFor()
  await page.keyboard.press("Escape")
  await page.waitForSelector('[role="alertdialog"]', { state: "detached", timeout: 5000 })
  check("Escape closes the pill dialog", true)
}

async function hitArea(page, locator) {
  const box = await locator.boundingBox()
  const name = await locator.getAttribute("aria-label")
  const hits = await page.evaluate(
    ({ x, y, half, label }) => {
      const at = (dx, dy) => document.elementFromPoint(x + dx, y + dy)?.closest(`[aria-label="${label}"]`) !== null
      return [at(0, 0), at(0, -half), at(0, half), at(-half, 0), at(half, 0)]
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2, half: minimumHitPx / 2 - 1, label: name },
  )
  return hits.every(Boolean)
}

async function ejectorButton(page) {
  await demo(page, "ejector-button")
  const cover = page.getByRole("button", { name: "Safety cover" })
  const release = page.locator('[data-slot="ejector-release"]')
  await cover.waitFor()
  check("The closed cover takes a press over the red button", await hitArea(page, cover))
  await cover.click()
  await page.waitForTimeout(600)
  const transform = await cover.evaluate((element) => getComputedStyle(element).transform)
  check(
    "The cover swings open",
    (await cover.getAttribute("aria-pressed")) === "true" && transform.startsWith("matrix3d"),
  )
  check(`The armed red button keeps a ${String(minimumHitPx)}px hit area`, await hitArea(page, release))
  await release.click()
  check("The red button is busy while onEject runs", (await release.getAttribute("aria-busy")) === "true")
  await page.waitForTimeout(1500)
  check("The cover closes once the eject finishes", (await cover.getAttribute("aria-pressed")) === "false")
  await cover.click()
  await page.keyboard.press("Escape")
  check("Escape closes the cover", (await cover.getAttribute("aria-pressed")) === "false")
}

async function pixelsOf(page, clip) {
  const png = await page.screenshot({ clip, animations: "disabled" })
  return page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob())
    const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext("2d")
    context.drawImage(bitmap, 0, 0)
    return {
      width: bitmap.width,
      height: bitmap.height,
      data: [...context.getImageData(0, 0, bitmap.width, bitmap.height).data],
    }
  }, png.toString("base64"))
}

const level = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b

function scanLine(pixels, along) {
  const { width, height, data } = pixels
  const length = along === "row" ? width : height
  const samples = []
  for (let step = Math.floor(length * 0.2); step < Math.ceil(length * 0.8); step++) {
    const x = along === "row" ? step : Math.floor(width / 2)
    const y = along === "row" ? Math.floor(height / 2) : step
    const index = (y * width + x) * 4
    samples.push([data[index], data[index + 1], data[index + 2]])
  }
  let jump = 0
  for (let index = 1; index < samples.length; index++) {
    jump = Math.max(jump, Math.abs(level(samples[index]) - level(samples[index - 1])))
  }
  const red = samples.filter(([r, g, b]) => r > g + 40 && r > b + 40).length / samples.length
  return { jump, red }
}

async function ejectorOpenPixels(page, compositor) {
  await demo(page, "ejector-button")
  const cover = page.getByRole("button", { name: "Safety cover" })
  await cover.click()
  await page.waitForTimeout(900)
  const box = await page.locator('[data-slot="ejector-release"]').boundingBox()
  const pixels = await pixelsOf(page, box)
  for (const along of ["row", "column"]) {
    const { jump, red } = scanLine(pixels, along)
    check(
      `The open ejector's red button is whole across its centre ${along} (${compositor})`,
      jump <= maxNeighbourLuminanceJump && red >= minimumRedShare,
      `largest step ${jump.toFixed(0)}, red ${(red * 100).toFixed(0)}%`,
    )
  }
}

await withShowcase(async (page) => {
  await retroTv(page)
  await pillDialog(page)
  await ejectorButton(page)
})

await withShowcase(
  async (page) => {
    await ejectorButton(page)
  },
  { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
)

const compositors = {
  gpu: [],
  "software, --disable-gpu": ["--disable-gpu"],
  swiftshader: ["--disable-gpu", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
}
for (const [compositor, args] of Object.entries(compositors)) {
  await withShowcase((page) => ejectorOpenPixels(page, compositor), {}, { args })
}

if (failures.length > 0) {
  console.error(`retro-check: ${String(failures.length)} failed`)
  process.exitCode = 1
} else {
  console.log("retro-check: ok")
}
