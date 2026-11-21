// iOS Safari zooms into a focused field whose text is under 16px. On an emulated phone every text-entry control in the
// showcase, in its dialogs (both densities) and in the site's /debug/viewport/ dialogs (once `bun run build:site` built
// it) renders at 16px or more; on a desktop they keep 14px. Usage: node tooling/touch-check.mjs [--screenshots=<dir>]
// (after `bun run build:showcase`)
import { existsSync, mkdirSync } from "node:fs"
import { join, resolve } from "node:path"

import { rendered, setAppearance, withShowcase, withSite } from "./showcase-browser.mjs"

const failures = []
const shotsArg = process.argv.find((arg) => arg.startsWith("--screenshots="))
const shots = shotsArg ? resolve(shotsArg.slice("--screenshots=".length)) : undefined
if (shots) mkdirSync(shots, { recursive: true })

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }

async function entryFontSizes(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) {
      scrollTo(0, y)
      await new Promise(requestAnimationFrame)
    }
    scrollTo(0, 0)
  })
  return page.evaluate(() => {
    const selector = [
      "input:not([type=hidden], [type=checkbox], [type=radio], [type=range], [type=file], [type=color], [type=button], [type=submit], [type=reset], [type=image])",
      "textarea",
      "select",
      "[contenteditable]:not([contenteditable=false])",
      "[data-slot=select-trigger]",
    ].join(", ")
    return [...document.querySelectorAll(selector)]
      .filter((element) => element.checkVisibility() && !element.closest("[aria-hidden=true], [inert]"))
      .map((element) => ({
        control: `${element.tagName.toLowerCase()}[${element.getAttribute("data-slot") ?? element.className.split(" ")[0]}]`,
        size: Number.parseFloat(getComputedStyle(element).fontSize),
      }))
  })
}

// The text-entry controls of the topmost dialog, at the size they render: a transform (a dialog's scale, a sheet pushed
// back) shrinks the text iOS reads too.
function dialogEntrySizes() {
  const dialog = [...document.querySelectorAll("[role=dialog], [role=alertdialog]")].findLast((d) =>
    d.checkVisibility(),
  )
  if (!dialog) return []
  const selector = [
    "input:not([type=hidden], [type=checkbox], [type=radio], [type=range], [type=file], [type=color], [type=button], [type=submit], [type=reset], [type=image])",
    "textarea",
    "select",
    "[contenteditable]:not([contenteditable=false])",
    "[data-slot=select-trigger]",
  ].join(", ")
  return [...dialog.querySelectorAll(selector)]
    .filter((element) => element.checkVisibility() && element.offsetHeight > 0)
    .map((element) => {
      const scale = element.getBoundingClientRect().height / element.offsetHeight
      return {
        control: `${element.tagName.toLowerCase()}[${element.getAttribute("data-slot") ?? element.className.split(" ")[0]}]`,
        size: Math.round(Number.parseFloat(getComputedStyle(element).fontSize) * scale * 100) / 100,
      }
    })
}

// Opens each dialog from its trigger with a tap, waits for its transition to end, and measures its fields.
async function checkDialogFields(page, where, triggers) {
  for (const density of ["default", "compact"]) {
    await page.evaluate((value) => {
      if (value === "default") document.documentElement.removeAttribute("data-density")
      else document.documentElement.setAttribute("data-density", value)
    }, density)
    for (const name of triggers) {
      const trigger = page.getByRole("button", { name, exact: true }).first()
      await trigger.scrollIntoViewIfNeeded()
      await trigger.tap()
      const dialog = page.locator("[role=dialog]:visible, [role=alertdialog]:visible").last()
      await dialog.waitFor()
      // The site's search loads its input lazily, after the dialog opens.
      await dialog
        .locator("input, textarea")
        .first()
        .waitFor({ timeout: 5000 })
        .catch(() => {})
      await page.waitForFunction(() => !document.querySelector("[data-starting-style]"))
      await page.evaluate(() => {
        for (const animation of document.getAnimations()) {
          if (animation.effect?.getTiming().iterations !== Infinity) animation.finish()
        }
      })
      const controls = await page.evaluate(dialogEntrySizes)
      const small = controls.filter((control) => control.size < 16)
      check(
        `phone ${density}, ${where}, ${name}: ${controls.length} text-entry controls are at least 16px`,
        controls.length > 0 && small.length === 0,
        controls.length === 0 ? "none found" : summary(small),
      )
      await page.keyboard.press("Escape")
      await dialog.waitFor({ state: "hidden" })
    }
  }
  await page.evaluate(() => document.documentElement.removeAttribute("data-density"))
}

const matrixTriggers = [
  "Open dialog",
  "Open full dialog",
  "Open form dialog",
  "Open step dialog",
  "Open command palette",
  "Open bottom drawer",
  "Open side drawer",
  "Open side panel",
]

const siteTriggers = [
  "Search docs",
  "Open sheet",
  "Open StepDialog",
  "Open FormDialog",
  "Open bottom Drawer",
  "Open SidePanel sheet",
]

function summary(controls) {
  return [...new Set(controls.map((control) => `${control.control} ${control.size}px`))].join(", ")
}

// The OTP slots were already 16px, and the markdown editor reads at the body size, which compact tightens.
function desktopSize(control, body) {
  if (control.control.includes("otp-input")) return 16
  if (control.control.includes("cm-content")) return body
  return 14
}

const kinds = [
  "input[input]",
  "textarea[textarea]",
  "button[select-trigger]",
  "input[combobox-input]",
  "input[autocomplete-input]",
  "input[password-input-control]",
  "input[number-input-control]",
  "input[otp-input-control]",
  "input[color-picker-input]",
  "input[date-picker-input]",
  "input[time-input-segment]",
  "select[native-select]",
  "div[cm-content]",
]

await withShowcase(async (page) => {
  const browser = page.context().browser()

  for (const [theme, body] of [
    ["default", 14],
    ["compact", 13],
  ]) {
    if (theme === "compact") await setAppearance(page, "compact", "light")
    const changed = (await entryFontSizes(page)).filter((control) => control.size !== desktopSize(control, body))
    check(`desktop ${theme}: text-entry controls keep their size`, changed.length === 0, summary(changed))
  }

  const context = await browser.newContext(phone)
  const touch = await context.newPage()
  await touch.goto(page.url())
  await rendered(touch)
  check(
    "phone: the pointer is coarse",
    await touch.evaluate(() => matchMedia("(pointer: coarse)").matches && navigator.maxTouchPoints > 0),
  )
  if (shots) {
    // A screenshot taller than the viewport resizes it and drops the touch emulation, so keep to the viewport.
    await touch.getByRole("region", { name: "Form", exact: true }).getByRole("textbox").first().scrollIntoViewIfNeeded()
    await touch.evaluate(() => scrollBy(0, -120))
    await touch.screenshot({ path: join(shots, "touch-form-phone.png"), animations: "disabled" })
    console.log(`     ${join(shots, "touch-form-phone.png")}`)
  }
  for (const theme of ["default", "compact"]) {
    if (theme === "compact") await setAppearance(touch, "compact", "light")
    const controls = await entryFontSizes(touch)
    const small = controls.filter((control) => control.size < 16)
    check(
      `phone ${theme}: ${controls.length} text-entry controls are at least 16px`,
      small.length === 0,
      summary(small),
    )
    const missing = kinds.filter((kind) => !controls.some((control) => control.control === kind))
    check(`phone ${theme}: every kind of text-entry control was measured`, missing.length === 0, missing.join(", "))
  }

  await touch.getByRole("button", { name: "Search commands" }).click()
  const commandInput = touch.getByRole("combobox", { name: "Run a command" })
  await commandInput.waitFor()
  const commandSize = await commandInput.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))
  check("phone: the command palette's input is at least 16px", commandSize >= 16, `${commandSize}px`)
  await touch.keyboard.press("Escape")

  await touch.goto(new URL("?demo=dialog-matrix-check&content=short", page.url()).href)
  await rendered(touch)
  await checkDialogFields(touch, "dialogs", matrixTriggers)

  const viewport = await touch.evaluate(() => document.querySelector("meta[name=viewport]")?.getAttribute("content"))
  check(
    "the viewport meta allows pinch-zoom",
    !/maximum-scale|user-scalable\s*=\s*(no|0)/i.test(viewport ?? ""),
    viewport ?? "no viewport meta",
  )
  await context.close()
})

if (existsSync(resolve(import.meta.dirname, "..", "apps", "site", "dist", "debug", "viewport", "index.html"))) {
  await withSite(async (page) => {
    const context = await page.context().browser().newContext(phone)
    const touch = await context.newPage()
    await touch.goto(new URL("debug/viewport/", page.url()).href)
    await rendered(touch)
    const fields = await touch.evaluate(() => document.querySelectorAll("main input, main textarea").length)
    check("site /debug/viewport/: the page itself has no field outside its dialogs", fields === 0, String(fields))
    await checkDialogFields(touch, "site /debug/viewport/", siteTriggers)
    await context.close()
  })
} else {
  console.log("skip the site's /debug/viewport/ page: run `bun run build:site` first")
}

if (failures.length > 0) {
  console.error(`\n${failures.length} touch check(s) failed`)
  process.exit(1)
}
