/* oxlint-disable no-await-in-loop -- each phosphor and each step waits for the frame the one before painted */
import { withShowcase } from "./showcase-browser.mjs"

const failures = []
const minimumTextContrast = 4.5

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

await withShowcase(async (page) => {
  await retroTv(page)
  await pillDialog(page)
})

if (failures.length > 0) {
  console.error(`retro-check: ${String(failures.length)} failed`)
  process.exitCode = 1
} else {
  console.log("retro-check: ok")
}
