// Drives ?demo=document-workspace in Chrome: the columns collapse and come back, Ctrl+P opens quick open, the
// outline moves the caret or focus, a mode switch keeps the reading position, menus and drawers give focus back
// to the document, and on a phone the explorer and the aside are drawers that close when a note opens.
// Usage: node tooling/document-workspace-check.mjs [--screenshots=<dir>] (after `bun run build:showcase`)
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

async function shot(page, file) {
  if (!shots) return
  await page.waitForTimeout(450)
  await page.screenshot({ path: join(shots, file), animations: "disabled" })
  console.log(`     ${join(shots, file)}`)
}

async function open(page, width, scheme = "light") {
  await page.setViewportSize({ width, height: 900 })
  await page.goto(`${new URL(page.url()).origin}/?demo=document-workspace`)
  await page.evaluate((dark) => {
    localStorage.clear()
    document.documentElement.classList.toggle("dark", dark)
    document.documentElement.dataset.colorScheme = dark ? "dark" : "light"
  }, scheme === "dark")
  await page.getByRole("region", { name: "Document" }).waitFor()
  await page.locator(".cm-content").waitFor()
  await page.evaluate(() => document.fonts.ready)
}

const editorHasFocus = (page) => page.evaluate(() => document.activeElement?.closest(".cm-content") !== null)

// The text of the line the editor shows at the top of its scroller.
const topLine = (page) =>
  page.evaluate(() => {
    const scroller = document.querySelector(".cm-scroller")
    const top = scroller.getBoundingClientRect().top
    const lines = [...document.querySelectorAll(".cm-line")]
    return lines.find((line) => line.getBoundingClientRect().bottom > top + 2)?.textContent ?? ""
  })

async function wide(page) {
  await open(page, 1440)
  const files = page.getByRole("button", { name: "Files", exact: true })
  const nav = page.getByRole("navigation", { name: "Files" })
  check("wide: the explorer is a named navigation column", await nav.isVisible())
  check(
    "wide: the aside is a named complementary column",
    await page.getByRole("complementary", { name: "Details" }).isVisible(),
  )
  const status = page.locator("[data-slot=document-workspace-status] output")
  check("wide: the save status is a status", (await status.textContent()) === "Saved")

  await files.click()
  await page.waitForTimeout(300)
  const collapsed = await page
    .locator("[data-slot=resizable-panel]")
    .first()
    .evaluate((panel) => panel.getBoundingClientRect().width)
  check(
    "wide: the Files toggle collapses the column",
    (await files.getAttribute("aria-expanded")) === "false" && collapsed < 1,
    `${collapsed}px`,
  )
  await files.click()
  await page.waitForTimeout(300)
  check("wide: and brings it back", (await nav.isVisible()) && (await files.getAttribute("aria-expanded")) === "true")

  await page.locator(".cm-content").click()
  await page.keyboard.press("Control+p")
  const quick = page.getByRole("dialog", { name: "Quick open" })
  check("Ctrl+P opens quick open from inside the editor", await quick.isVisible())
  await page.keyboard.type("risk")
  await page.keyboard.press("Enter")
  await page.waitForTimeout(800)
  check(
    "quick open: Enter opens the note",
    (await page.getByRole("tab", { name: "Risks" }).getAttribute("aria-selected")) === "true",
  )
  check(
    "quick open: focus goes back to the editor",
    await editorHasFocus(page),
    await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120)),
  )

  await page.getByRole("tab", { name: "Launch plan" }).click()
  const outline = page.getByRole("navigation", { name: "Outline" })
  await outline.getByRole("button", { name: "Open questions" }).click()
  await page.waitForTimeout(300)
  check("outline, edit mode: focus goes to the editor", await editorHasFocus(page))
  const caretLine = await page.evaluate(
    () =>
      document.querySelector(".cm-activeLine")?.textContent ??
      getSelection()?.anchorNode?.parentElement?.closest(".cm-line")?.textContent,
  )
  check("outline, edit mode: the caret is on the heading", caretLine?.includes("Open questions"), caretLine)
  check(
    "outline, edit mode: the heading is scrolled to the top",
    (await topLine(page)).includes("Open questions"),
    await topLine(page),
  )

  await page.getByRole("radio", { name: "Read" }).click()
  await page.waitForTimeout(400)
  const region = page.getByRole("region", { name: "Document" })
  const offset = await page.evaluate(() => {
    const container = document.querySelector("[data-slot=document-workspace-document]")
    const heading = [...container.querySelectorAll("h2")].find((node) => node.textContent === "Open questions")
    return Math.round(heading.getBoundingClientRect().top - container.getBoundingClientRect().top)
  })
  check("mode switch to read keeps the heading at the top", Math.abs(offset) < 40, `${offset}px`)
  await outline.getByRole("button", { name: "Milestones" }).click()
  await page.waitForTimeout(200)
  const focused = await page.evaluate(() => document.activeElement?.textContent)
  check("outline, read mode: focus moves to the heading", focused === "Milestones", focused)
  await region.evaluate((node) => (node.scrollTop = 0))
  await outline.getByRole("button", { name: "Rollout" }).click()
  await page.waitForTimeout(200)
  // The heading at the top of the read view, or the last one above it when the view can't scroll that far.
  const reading = await page.evaluate(() => {
    const container = document.querySelector("[data-slot=document-workspace-document]")
    const top = container.getBoundingClientRect().top + 4
    return [...container.querySelectorAll("h1, h2")].findLast((node) => node.getBoundingClientRect().top <= top)
      ?.textContent
  })
  await page.getByRole("radio", { name: "Edit" }).click()
  await page.waitForTimeout(600)
  check(
    "mode switch to edit keeps the heading at the top",
    reading !== undefined && (await topLine(page)).includes(reading),
    `${reading} → ${await topLine(page)}`,
  )

  await page.locator(".cm-content").click()
  await page.getByRole("button", { name: "Insert" }).click()
  await page.getByRole("menuitem", { name: "Wikilink" }).click()
  await page.waitForTimeout(300)
  check("a toolbar menu gives focus back to the editor", await editorHasFocus(page))

  await page.getByRole("button", { name: "Insert" }).click()
  await page.getByRole("menuitem", { name: "Link to a note…" }).click()
  const suggestions = page.locator("[data-slot=trigger-menu-content][data-open]").getByRole("option")
  await suggestions
    .first()
    .waitFor({ timeout: 2000 })
    .catch(() => {})
  check(
    "Link to a note opens the wikilink suggestions from the handle",
    (await suggestions.count()) === 3 && (await editorHasFocus(page)),
    `${String(await suggestions.count())} options`,
  )
  await page.keyboard.press("Escape")

  await page.getByRole("radio", { name: "Conflicts" }).click()
  await page.locator(".cm-content").click()
  await page.keyboard.type(" edited")
  await page.waitForTimeout(1500)
  check(
    "a save conflict shows in the alert region",
    ((await page.getByRole("alert").textContent()) ?? "").includes("Changed on another device"),
  )
  check("and the status says the save failed", (await status.textContent()) === "Couldn't save")
}

async function narrow(page) {
  await open(page, 390)
  check("narrow: no column is shown", (await page.getByRole("navigation", { name: "Files" }).count()) === 0)
  const files = page.getByRole("button", { name: "Files", exact: true })
  await files.click()
  const drawer = page.getByRole("dialog", { name: "Files" })
  await drawer.waitFor()
  check(
    "narrow: the Files toggle opens a drawer with the explorer",
    await drawer.getByRole("navigation", { name: "Files" }).isVisible(),
  )
  check("narrow: the toggle says it's expanded", (await files.getAttribute("aria-expanded")) === "true")
  await drawer.getByRole("link", { name: "Goals" }).click()
  await page.waitForTimeout(500)
  check("narrow: choosing a note closes the drawer", !(await drawer.isVisible()))
  check(
    "narrow: the note opens",
    (await page.getByRole("tab", { name: "Goals" }).getAttribute("aria-selected")) === "true",
  )
  check("narrow: focus goes back to the editor", await editorHasFocus(page))

  const details = page.getByRole("button", { name: "Details", exact: true })
  await details.click()
  const aside = page.getByRole("dialog", { name: "Details" })
  await aside.waitFor()
  check(
    "narrow: the Details toggle opens the aside",
    await aside.getByRole("complementary", { name: "Details" }).isVisible(),
  )
  await page.keyboard.press("Escape")
  await page.waitForTimeout(500)
  check(
    "narrow: Escape closes it, focus back in the editor",
    !(await aside.isVisible()) && (await editorHasFocus(page)),
  )
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  check("narrow: nothing overflows the page", overflow <= 0, `${overflow}px`)
}

// A tree of buttons, not links: the drawer closes because the workspace's documentId changes.
async function phone(page) {
  await open(page, 320)
  await page.getByRole("button", { name: "Files", exact: true }).click()
  const drawer = page.getByRole("dialog", { name: "Files" })
  await drawer.waitFor()
  await drawer.getByRole("button", { name: "Goals" }).click()
  await page.waitForTimeout(500)
  check("320px: a button in the explorer that opens a note closes the drawer", !(await drawer.isVisible()))
  check(
    "320px: the note opens",
    (await page.getByRole("tab", { name: "Goals" }).getAttribute("aria-selected")) === "true",
  )
  check("320px: focus goes back to the editor", await editorHasFocus(page))
  check(
    "320px: the Files toggle says it's collapsed",
    (await page.getByRole("button", { name: "Files", exact: true }).getAttribute("aria-expanded")) === "false",
  )
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  check("320px: nothing overflows the page", overflow <= 0, `${overflow}px`)
}

async function screenshots(page) {
  for (const scheme of ["light", "dark"]) {
    for (const width of [1440, 900, 390]) {
      const name = (view) => `document-workspace-${String(width)}-${scheme}-${view}.png`
      await open(page, width, scheme)
      await shot(page, name("edit"))
      await page.getByRole("radio", { name: "Read" }).click()
      await shot(page, name("read"))
      await page.getByRole("radio", { name: "Edit" }).click()
      if (width === 390) {
        await page.getByRole("button", { name: "Files", exact: true }).click()
        await page.getByRole("dialog", { name: "Files" }).waitFor()
        await shot(page, name("explorer-drawer"))
        await page.keyboard.press("Escape")
        // UI SDK 0.1.0-beta.10 drops a press on the page while a drawer slides out (see the drawer item docs).
        await page.getByRole("dialog", { name: "Files" }).waitFor({ state: "detached" })
        await page.getByRole("button", { name: "Details", exact: true }).click()
        await page.getByRole("dialog", { name: "Details" }).waitFor()
        await shot(page, name("aside-open"))
        await page.keyboard.press("Escape")
        await page.getByRole("dialog", { name: "Details" }).waitFor({ state: "detached" })
      }
      await page.getByRole("button", { name: "Quick open" }).click()
      await page.getByRole("dialog", { name: "Quick open" }).waitFor()
      await shot(page, name("quick-open"))
      await page.keyboard.press("Escape")
    }
  }
}

await withShowcase(async (page) => {
  await wide(page)
  await narrow(page)
  await phone(page)
  await screenshots(page)
})

if (failures.length > 0) {
  console.error(`\n${failures.length} document workspace check(s) failed`)
  process.exit(1)
}
