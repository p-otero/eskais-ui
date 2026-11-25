import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"

import { withShowcase } from "./showcase-browser.mjs"

const failures = []
const shotsArg = process.argv.find((arg) => arg.startsWith("--screenshots="))
const shots = shotsArg ? resolve(shotsArg.slice("--screenshots=".length)) : undefined
if (shots) mkdirSync(shots, { recursive: true })

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

async function shot(locator, file) {
  if (!shots) return
  await locator.screenshot({ path: join(shots, file), animations: "disabled" })
  console.log(`     ${join(shots, file)}`)
}

function days(page, id) {
  return page.getByTestId(`calendar-${id}`).evaluate((root) =>
    [...root.querySelectorAll("[data-slot=calendar-day]")].map((day) => {
      const box = day.getBoundingClientRect()
      const before = getComputedStyle(day, "::before")
      const after = getComputedStyle(day, "::after")
      return {
        date: day.getAttribute("data-value"),
        row: day.parentElement.rowIndex,
        left: box.left,
        right: box.right,
        start: day.hasAttribute("data-range-start"),
        end: day.hasAttribute("data-range-end"),
        middle: day.hasAttribute("data-range-middle"),
        preview: day.hasAttribute("data-preview"),
        fill: getComputedStyle(day).backgroundColor,
        circle: before.backgroundColor,
        half: after.content === "none" ? "none" : after.backgroundColor,
        halfLeft: after.content === "none" ? 0 : Number.parseFloat(after.left),
        halfRight: after.content === "none" ? 0 : Number.parseFloat(after.right),
        color: getComputedStyle(day).color,
      }
    }),
  )
}

const transparent = "rgba(0, 0, 0, 0)"
const filled = (color) => color !== transparent

function band(list, label, rtl) {
  const inRange = list.filter((day) => day.start || day.middle || day.end)
  const [first] = inRange
  const last = inRange.at(-1)
  if (!first) return check(`${label}: has a range`, false)
  const oneDay = first === last
  check(`${label}: the ends are filled circles`, filled(first.circle) && filled(last.circle))
  if (oneDay) {
    check(`${label}: one day is only its circle`, !filled(first.fill) && first.half === "none")
    return
  }
  const middles = inRange.filter((day) => day.middle)
  check(
    `${label}: the middle days are one fill, with no circle`,
    middles.every((day) => filled(day.fill) && day.fill === middles[0].fill && !filled(day.circle)),
  )
  const bandFill = middles[0]?.fill ?? first.half
  check(
    `${label}: the band runs under the inner half of each end`,
    first.half === bandFill && last.half === bandFill && !filled(first.fill) && !filled(last.fill),
    `${first.half} ${last.half} ${bandFill}`,
  )
  const [startOffset, startFlush] = rtl ? [first.halfRight, first.halfLeft] : [first.halfLeft, first.halfRight]
  const [endOffset, endFlush] = rtl ? [last.halfLeft, last.halfRight] : [last.halfRight, last.halfLeft]
  check(
    `${label}: each half band sits on the side the range continues`,
    startOffset > 0 && startFlush === 0 && endOffset > 0 && endFlush === 0,
    `start ${first.halfLeft}/${first.halfRight}, end ${last.halfLeft}/${last.halfRight}`,
  )
  const gaps = []
  for (let index = 1; index < inRange.length; index++) {
    const [previous, day] = [inRange[index - 1], inRange[index]]
    if (previous.row !== day.row) continue
    const gap = rtl ? previous.left - day.right : day.left - previous.right
    if (Math.abs(gap) > 0.5) gaps.push(`${previous.date}→${day.date} ${gap.toFixed(2)}px`)
  }
  check(`${label}: no gap between days in a week`, gaps.length === 0, gaps.join(", "))
}

await withShowcase(async (page) => {
  await page.goto(`${new URL(page.url()).origin}/?demo=calendar-check`)
  await page.getByTestId("calendar-ltr-week").waitFor()
  await page.evaluate(() => document.fonts.ready)

  const modes = [
    ["light", () => document.documentElement.classList.remove("dark")],
    ["dark", () => document.documentElement.classList.add("dark")],
  ]
  for (const [theme, attribute] of [
    ["default", null],
    ["compact", "compact"],
  ]) {
    await page.evaluate((value) => {
      if (value) document.documentElement.setAttribute("data-theme", value)
      else document.documentElement.removeAttribute("data-theme")
    }, attribute)
    for (const [mode, apply] of modes) {
      await page.evaluate(apply)
      await page.waitForTimeout(250)
      for (const dir of ["ltr", "rtl"]) {
        for (const range of ["week", "weeks", "one-day", "two-days"]) {
          band(await days(page, `${dir}-${range}`), `${theme} ${mode} ${dir} ${range}`, dir === "rtl")
          if (theme === "default" || (mode === "light" && range === "weeks")) {
            await shot(page.getByTestId(`calendar-${dir}-${range}`), `calendar-${theme}-${mode}-${dir}-${range}.png`)
          }
        }
      }
    }
  }
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark")
    document.documentElement.removeAttribute("data-theme")
  })

  for (const dir of ["ltr", "rtl"]) {
    const calendar = page.getByTestId(`calendar-${dir}-empty`)
    const grid = calendar.getByRole("grid")
    await grid.locator("[data-value='2026-11-10']").click()
    await grid.locator("[data-value='2026-11-19']").hover()
    const preview = await days(page, `${dir}-empty`)
    band(preview, `${dir} preview while picking`, dir === "rtl")
    const committed = await days(page, `${dir}-week`)
    check(
      `${dir} preview: the band matches a picked range`,
      preview.find((day) => day.date === "2026-11-12").fill === committed.find((day) => day.date === "2026-11-11").fill,
    )
    await shot(calendar, `calendar-default-light-${dir}-preview.png`)
    await page.keyboard.press("Escape")
    await page.mouse.move(0, 0)
  }

  const picker = page.getByTestId("date-picker")
  await picker.locator("[data-slot=date-picker-trigger]").click()
  const popup = page.locator("[data-slot=date-picker-content]")
  await popup.getByRole("grid").waitFor()
  await page.waitForTimeout(300)
  const pickerDays = await popup.evaluate((root) =>
    [...root.querySelectorAll("[data-range-middle]")].map((day) => getComputedStyle(day).backgroundColor),
  )
  check(
    "DatePicker's calendar draws the same band",
    pickerDays.length > 0 && pickerDays.every((fill) => fill !== transparent),
  )
  await shot(popup, "date-picker-default-light-range.png")
  await page.keyboard.press("Escape")

  const today = await days(page, "ltr-weeks")
  check(
    "today keeps its underline inside the band",
    await page
      .getByTestId("calendar-ltr-weeks")
      .locator("[data-today]")
      .evaluate((day) => getComputedStyle(day).textDecorationLine.includes("underline")),
  )
  check("the middle text uses the band's foreground", today.find((day) => day.date === "2026-11-17").middle)

  const ringColor = await page.evaluate(() => {
    const probe = document.body.appendChild(document.createElement("div"))
    probe.style.outlineColor = "var(--ring)"
    const color = getComputedStyle(probe).outlineColor
    probe.remove()
    return color
  })
  for (const date of ["2026-11-12", "2026-11-17", "2026-11-24", "2026-11-26"]) {
    const day = page.getByTestId("calendar-ltr-weeks").locator(`[data-value='${date}']`)
    await day.focus()
    await page.keyboard.press("Shift")
    const ring = await day.evaluate(async (element) => {
      await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished))
      const before = getComputedStyle(element, "::before")
      return { width: Number.parseFloat(before.outlineWidth), style: before.outlineStyle, color: before.outlineColor }
    })
    check(
      `focus ring on ${date}`,
      ring.width >= 2 && ring.style !== "none" && ring.color === ringColor,
      JSON.stringify(ring),
    )
    if (date === "2026-11-12" || date === "2026-11-17")
      await shot(page.getByTestId("calendar-ltr-weeks"), `calendar-default-light-ltr-focus-${date}.png`)
  }
})

if (failures.length > 0) {
  console.error(`\n${failures.length} calendar check(s) failed`)
  process.exit(1)
}
