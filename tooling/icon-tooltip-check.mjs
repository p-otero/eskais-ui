import { mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"

import { withShowcase } from "./showcase-browser.mjs"

const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js")
const screenshots = process.argv.find((arg) => arg.startsWith("--screenshots="))?.slice("--screenshots=".length)
const failures = []

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

function openTooltip(page) {
  return page.evaluate(() => {
    const open = [...document.querySelectorAll("[data-slot=tooltip-content][data-open]")]
    if (open.length === 0) return null
    const tip = open.at(-1)
    const box = tip.getBoundingClientRect()
    const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    return {
      text: tip.firstChild?.textContent ?? "",
      shortcut: tip.querySelector("[data-slot=tooltip-shortcut]")?.textContent ?? "",
      count: open.length,
      onTop: tip.contains(top),
      visible: box.width > 0 && getComputedStyle(tip).opacity !== "0",
    }
  })
}

async function waitForTooltip(page, timeout = 1500) {
  await page
    .waitForFunction(
      () => document.querySelector("[data-slot=tooltip-content][data-open]:not([data-starting-style])"),
      null,
      {
        timeout,
      },
    )
    .catch(() => {})
  await page.waitForTimeout(200)
  return openTooltip(page)
}

async function axe(page) {
  await page.addScriptTag({ path: axePath })
  const result = await page.evaluate(() =>
    window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }),
  )
  return result.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.html).join(", ")}`)
}

const fixture = (page) => `${new URL(page.url()).origin}/?demo=icon-tooltip-check`

await withShowcase(async (page) => {
  await page.goto(fixture(page))
  const toolbar = page.getByTestId("toolbar")
  await toolbar.waitFor()

  const archive = toolbar.getByRole("button", { name: "Archive", exact: true })
  check("the name stays the aria-label", (await archive.getAttribute("aria-label")) === "Archive")
  const snapshotName = await archive.evaluate((element) => {
    const id = element.getAttribute("aria-labelledby")
    return id
      ? (document.getElementById(id)?.getAttribute("aria-label") ?? document.getElementById(id)?.textContent)
      : null
  })
  check("the tooltip labels the button with the same text", snapshotName === "Archive", String(snapshotName))

  const cdp = await page.context().newCDPSession(page)
  const { nodes } = await cdp.send("Accessibility.getFullAXTree")
  const names = nodes.filter((node) => node.role?.value === "button").map((node) => node.name?.value)
  check(
    "Chrome names the buttons by their labels only",
    ["Bold", "Italic", "Copy link", "Archive", "Delete", "More actions"].every((label) => names.includes(label)),
    names.join(", "),
  )
  const description = nodes.find((node) => node.name?.value === "Delete")?.description?.value
  check("Chrome describes Delete by its tooltip", description === "Moves the draft to the trash", String(description))
  await cdp.detach()

  await archive.hover()
  let tip = await waitForTooltip(page)
  check("hover opens the tooltip with the label", tip?.text === "Archive" && tip.visible, JSON.stringify(tip))

  await toolbar.getByRole("button", { name: "Copy link" }).hover()
  tip = await waitForTooltip(page, 400)
  check(
    "moving along the toolbar opens the next one at once, with its shortcut",
    tip?.text === "Copy link" && tip.count === 1 && tip.shortcut.replace(/\W+$/u, "").endsWith("C"),
    JSON.stringify(tip),
  )

  const name = await toolbar.getByRole("link", { name: "Open preview" }).count()
  check("an icon link keeps its name", name === 1)

  await page.mouse.move(1000, 800)
  await page.waitForTimeout(800)
  await page.evaluate(() => document.body.focus())
  await page.keyboard.press("Tab")
  tip = await waitForTooltip(page)
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))
  check("keyboard focus opens the tooltip", tip?.text === focused && focused === "Bold", JSON.stringify(tip))
  await page.keyboard.press("Tab")
  tip = await waitForTooltip(page)
  check("Tab moves it to the next button", tip?.text === "Italic", JSON.stringify(tip))

  if (screenshots) {
    mkdirSync(screenshots, { recursive: true })
    await toolbar.getByRole("button", { name: "Copy link" }).focus()
    await waitForTooltip(page)
    const clip = await toolbar.boundingBox()
    const area = { x: clip.x - 24, y: clip.y - 64, width: clip.width + 48, height: clip.height + 88 }
    await page.screenshot({ path: join(screenshots, "icon-tooltips-light.png"), clip: area })
    await page.evaluate(() => document.documentElement.classList.add("dark"))
    await page.waitForTimeout(300)
    await page.screenshot({ path: join(screenshots, "icon-tooltips-dark.png"), clip: area })
    await page.evaluate(() => document.documentElement.classList.remove("dark"))
    console.log(`screenshots in ${screenshots}`)
  }

  await toolbar.getByRole("button", { name: "Delete" }).focus()
  tip = await waitForTooltip(page)
  check("tooltip text other than the name describes the button", tip?.text === "Moves the draft to the trash")
  const violations = await axe(page)
  check("0 axe violations with a tooltip open", violations.length === 0, violations.join("\n"))
  await page.keyboard.press("Escape")

  await page.mouse.move(1000, 800)
  await page.waitForTimeout(800)
  await page.getByRole("button", { name: "Close the banner" }).hover()
  await page.waitForTimeout(1000)
  check("tooltip={false}: no tooltip", (await openTooltip(page)) === null)

  await page.getByRole("button", { name: "Open settings" }).click()
  await page.getByRole("dialog", { name: "Settings" }).waitFor()
  await page.waitForTimeout(300)
  await page.getByRole("button", { name: "Close settings" }).hover()
  tip = await waitForTooltip(page)
  check("inside a dialog the tooltip shows above it", tip?.text === "Close settings" && tip.onTop, JSON.stringify(tip))
  await page.getByRole("button", { name: "Close settings" }).click()
  await page.getByRole("dialog", { name: "Settings" }).waitFor({ state: "hidden" })
  check(
    "pressing the close button closes the dialog and returns focus",
    (await page.evaluate(() => document.activeElement?.textContent)) === "Open settings",
  )

  await page.mouse.move(1000, 800)
  await page.waitForTimeout(800)
  await toolbar.getByRole("button", { name: "More actions" }).hover()
  tip = await waitForTooltip(page)
  check("a menu trigger shows its tooltip", tip?.text === "More actions", JSON.stringify(tip))
  await toolbar.getByRole("button", { name: "More actions" }).click()
  await page.getByRole("menu").waitFor()
  check("pressing it opens the menu and closes the tooltip", (await openTooltip(page)) === null)
  await page.keyboard.press("Escape")

  const browser = page.context().browser()
  const touch = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 800 } })
  try {
    const phone = await touch.newPage()
    await phone.goto(fixture(page))
    await phone.getByTestId("toolbar").waitFor()
    await phone.evaluate(() => {
      window.tooltipsOpened = 0
      new MutationObserver(() => {
        if (document.querySelector("[data-slot=tooltip-content][data-open]")) window.tooltipsOpened++
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-open"] })
    })
    const bold = phone.getByRole("button", { name: "Bold" })
    await bold.tap()
    await phone.waitForTimeout(1000)
    check(
      "touch: a tap presses the toggle and opens no tooltip",
      (await bold.getAttribute("aria-pressed")) === "true" && (await phone.evaluate(() => window.tooltipsOpened)) === 0,
    )
    const box = await phone.getByRole("button", { name: "Archive", exact: true }).boundingBox()
    const touchInput = await touch.newCDPSession(phone)
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    await touchInput.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] })
    await phone.waitForTimeout(1200)
    await touchInput.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    await phone.waitForTimeout(800)
    check("touch: a long press opens no tooltip", (await phone.evaluate(() => window.tooltipsOpened)) === 0)
  } finally {
    await touch.close()
  }
})

if (failures.length > 0) {
  console.error(`\n${failures.length} icon tooltip check(s) failed`)
  process.exit(1)
}
