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

const longNote = Array.from({ length: 3000 }, (_, index) =>
  index % 40 === 0
    ? `## Section ${String(index / 40)}`
    : `Line ${String(index)} with **bold** text and a [link](https://example.com).`,
).join("\n")

async function replaceNote(page, text) {
  await page.reload()
  const box = page.getByRole("textbox", { name: editorName }).first()
  await box.click()
  await page.keyboard.press("Control+a")
  await box.evaluate((content, markdown) => {
    const data = new DataTransfer()
    data.setData("text/plain", markdown)
    content.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }))
  }, text)
  await page.waitForTimeout(200)
  return box
}

const viewportOf = (box) =>
  box.evaluate((content) => {
    const viewport = content.closest("[data-slot=markdown-editor-viewport]")
    const scroller = content.closest(".cm-scroller")
    const bounds = viewport.getBoundingClientRect()
    const caret = getSelection()?.getRangeAt(0).getBoundingClientRect()
    const scrollbar = viewport.parentElement.querySelector(
      "[data-slot=scroll-area-scrollbar][data-orientation=vertical]",
    )
    return {
      scrollTop: viewport.scrollTop,
      overflows: viewport.scrollHeight > viewport.clientHeight,
      nativeScrollbar: getComputedStyle(viewport).scrollbarWidth !== "none",
      innerScroller:
        getComputedStyle(scroller).overflowY !== "visible" && scroller.scrollHeight > scroller.clientHeight,
      lines: content.querySelectorAll(".cm-line").length,
      caretVisible: caret !== undefined && caret.top >= bounds.top - 1 && caret.bottom <= bounds.bottom + 1,
      scrollbarShown: scrollbar?.hasAttribute("data-visible") ?? false,
    }
  })

async function scrolling(page) {
  const box = await replaceNote(page, longNote)
  let view = await viewportOf(box)
  check("long note: the editor's ScrollArea viewport scrolls", view.overflows && !view.innerScroller)
  check("long note: no platform scrollbar, ours shows", !view.nativeScrollbar && view.scrollbarShown)
  check("long note: CodeMirror renders only the lines in view", view.lines < 200, `${String(view.lines)} of 3000`)
  check("long note: the pasted end is in view", view.caretVisible && view.scrollTop > 0)

  await page.keyboard.press("Control+Home")
  await page.waitForTimeout(100)
  view = await viewportOf(box)
  check("Ctrl+Home scrolls back to the start", view.caretVisible && view.scrollTop < 40, `${String(view.scrollTop)}px`)
  for (let step = 0; step < 60; step++) await page.keyboard.press("ArrowDown")
  await page.keyboard.type(" typed")
  await page.waitForTimeout(100)
  view = await viewportOf(box)
  check("arrow keys and typing keep the caret in view", view.caretVisible && view.scrollTop > 0)
  await page.keyboard.press("PageDown")
  await page.waitForTimeout(100)
  check("PageDown keeps the caret in view", (await viewportOf(box)).caretVisible)

  const viewport = page.locator("[data-slot=markdown-editor-viewport]").first()
  const bounds = await viewport.boundingBox()
  await page.mouse.move(bounds.x + 60, bounds.y + 40)
  await page.mouse.wheel(0, 3000)
  await page.waitForTimeout(300)
  const line = await viewport.evaluate((element) => {
    const { left, top } = element.getBoundingClientRect()
    return document.elementFromPoint(left + 40, top + 40)?.closest(".cm-line")?.textContent ?? ""
  })
  check("the wheel scrolls to lines CodeMirror then renders", /^Line \d+/.test(line), line)

  const before = await viewport.evaluate((element) => element.scrollTop)
  await page.mouse.move(bounds.x + 60, bounds.y + 40)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 60, bounds.y + bounds.height + 40, { steps: 5 })
  await page.waitForTimeout(500)
  await page.mouse.up()
  const after = await viewport.evaluate((element) => element.scrollTop)
  check("a selection dragged past the bottom scrolls the view", after > before, `${String(before)} → ${String(after)}`)

  await replaceNote(page, "Short")
  await page.locator("body").click({ position: { x: 1, y: 1 } })
  await viewport.scrollIntoViewIfNeeded()
  const empty = await viewport.boundingBox()
  await page.mouse.click(empty.x + empty.width / 2, empty.y + empty.height - 20)
  check(
    "a press below a short note focuses the editor",
    await page.evaluate(() => document.activeElement?.closest(".cm-content") !== null),
  )
}

await withShowcase(async (page) => {
  await scrolling(page)
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
