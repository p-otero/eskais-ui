// Drives the showcase's Markdown editor with a real keyboard: a line command (toolbar, text style menu, slash menu)
// on an empty line leaves the caret after its marker, and the slash menu stays open on a query that matches nothing.
// Usage: node tooling/markdown-check.mjs (after `bun run build:showcase`)
import { withShowcase } from "./showcase-browser.mjs"

const failures = []

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

const editorName = "Release notes"

async function emptyLineAtEnd(page) {
  await page.reload()
  const box = page.getByRole("textbox", { name: editorName }).first()
  await box.waitFor()
  await box.click()
  await page.keyboard.press("Control+End")
  await page.keyboard.press("Enter")
  return box
}

// The preview beside the editor renders the same Markdown once onChange has sent it (300 ms).
async function previewHas(page, selector, text) {
  const found = page
    .getByLabel("Preview")
    .locator(selector)
    .filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) })
  return found
    .first()
    .waitFor({ timeout: 3000 })
    .then(
      () => true,
      () => false,
    )
}

// Items that don't fit the toolbar move into its More menu.
async function pressFormat(page, name) {
  const toolbar = page.getByRole("toolbar", { name: "Formatting" }).first()
  const button = toolbar.getByRole("button", { name, exact: true })
  if (await button.count()) return button.click()
  await toolbar.getByRole("button", { name: "More formatting" }).click()
  await page.getByRole("menuitem", { name, exact: true }).click()
}

async function lastLineText(page) {
  return page.evaluate((name) => {
    const content = [...document.querySelectorAll(".cm-content")].find((node) => node.ariaLabel === name)
    const lines = content?.querySelectorAll(".cm-line") ?? []
    return lines[lines.length - 1]?.textContent ?? ""
  }, editorName)
}

await withShowcase(async (page) => {
  for (const [button, selector] of [
    ["Quote", "blockquote p, blockquote"],
    ["Bulleted list", "ul li"],
    ["Numbered list", "ol li"],
    ["Task list", "[data-slot=markdown-view-task] span"],
  ]) {
    await emptyLineAtEnd(page)
    await pressFormat(page, button)
    await page.keyboard.type("Hola")
    check(`toolbar ${button} on an empty line: typing lands after the marker`, await previewHas(page, selector, "Hola"))
  }

  await emptyLineAtEnd(page)
  await page.getByRole("button", { name: "Text style" }).first().click()
  await page.getByRole("menuitemradio", { name: "Heading 2" }).click()
  await page.keyboard.type("Hola")
  check("text style Heading 2 on an empty line: typing lands after the #", await previewHas(page, "h2", "Hola"))

  for (const [query, selector] of [
    ["/head", "h1"],
    ["/quote", "blockquote p, blockquote"],
    ["/bullet", "ul li"],
  ]) {
    await emptyLineAtEnd(page)
    await page.keyboard.type(query)
    await page.locator("[data-slot=trigger-menu-content] [role=option]").first().waitFor()
    await page.keyboard.press("Enter")
    await page.keyboard.type("Hola")
    check(`slash ${query} + Enter: typing lands after the marker`, await previewHas(page, selector, "Hola"))
  }

  await emptyLineAtEnd(page)
  await page.keyboard.press("Enter")
  await page.keyboard.press("ArrowUp")
  await pressFormat(page, "Quote")
  await page.keyboard.type("Hola")
  check("a line command mid-document, at the line start", await previewHas(page, "blockquote p, blockquote", "Hola"))

  await emptyLineAtEnd(page)
  const menu = page.locator("[data-slot=trigger-menu-content]")
  for (const char of "/x?y)") {
    await page.keyboard.type(char)
    await page.waitForTimeout(80)
  }
  const empty = page.locator("[data-slot=trigger-menu-empty][data-empty]")
  check("slash menu: open with its empty state on /x?y)", (await menu.isVisible()) && (await empty.isVisible()))
  check("slash menu: the empty state says so", (await empty.textContent()) === "No matches")
  await page.keyboard.press("Escape")
  await page.waitForTimeout(200)
  check(
    "slash menu: Escape closes it and keeps the text",
    !(await menu.isVisible()) && (await lastLineText(page)) === "/x?y)",
  )

  await page.keyboard.type(" /zz")
  await page.waitForTimeout(150)
  check("slash menu: a new / opens it again", await empty.isVisible())
  await page.keyboard.type(" ")
  await page.waitForTimeout(200)
  check("slash menu: a space closes it", !(await menu.isVisible()))
})

if (failures.length > 0) {
  console.error(`\n${failures.length} markdown check(s) failed`)
  process.exit(1)
}
