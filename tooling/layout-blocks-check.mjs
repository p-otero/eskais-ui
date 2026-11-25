import { createRequire } from "node:module"

const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js")

const widths = [1440, 768, 390]
const schemes = ["light", "dark"]

async function open(page, demo, width, scheme, query = "", ready = `[data-slot="${demo}"]`) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
  await page.goto(`${new URL(page.url()).origin}/?demo=${demo}${query}`)
  await page.locator(ready).first().waitFor()
  await page.evaluate((dark) => {
    localStorage.clear()
    const html = document.documentElement
    html.classList.toggle("dark", dark)
    html.classList.toggle("light", !dark)
    html.dataset.colorScheme = dark ? "dark" : "light"
  }, scheme === "dark")
  await page.evaluate(() => document.fonts.ready)
  await settle(page)
}

async function settle(page) {
  await page.waitForTimeout(250)
  await page.evaluate(() => {
    for (const element of document.querySelectorAll("*")) void getComputedStyle(element).color
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSTransition) animation.finish()
    }
  })
}

async function axe(page) {
  if (!(await page.evaluate(() => "axe" in window))) await page.addScriptTag({ path: axePath })
  const result = await page.evaluate(() =>
    window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] }),
  )
  return result.violations.map((violation) => `${violation.id} (${violation.nodes.length})`)
}

function layout(page, selector) {
  return page.evaluate((query) => {
    const boxes = [...document.querySelectorAll(query)]
      .filter((element) => element.checkVisibility())
      .map((element) => {
        const box = element.getBoundingClientRect()
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width }
      })
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    return { boxes, overflow }
  }, selector)
}

function overlaps(boxes) {
  for (const [index, a] of boxes.entries()) {
    for (const b of boxes.slice(index + 1)) {
      const x = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (x > 1 && y > 1) return true
    }
  }
  return false
}

const focusedSlot = (page) => page.evaluate(() => document.activeElement?.getAttribute("data-slot"))
const focusedText = (page) => page.evaluate(() => document.activeElement?.textContent?.trim())

async function masterDetail(page, check, shot, width, scheme) {
  const tag = `master-detail ${width}px ${scheme}`
  await open(page, "master-detail", width, scheme)
  const panes = '[data-slot="master-detail-list"], [data-slot="master-detail-detail"]'
  const closed = await layout(page, panes)
  const narrow = width === 390
  check(`${tag}: no sideways scroll`, !closed.overflow)
  check(
    `${tag}: ${narrow ? "only the list shows" : "list and detail side by side"}`,
    closed.boxes.length === (narrow ? 1 : 2) && !overlaps(closed.boxes),
    `${closed.boxes.length} panes`,
  )
  check(`${tag}: axe`, (await axe(page)).length === 0, (await axe(page)).join(", "))
  if (scheme === "light") await shot(page, `master-detail-${width}-closed.png`)

  const row = page.getByRole("button", { name: "Garage door" })
  await row.focus()
  await page.keyboard.press("Enter")
  await page.getByRole("region", { name: "Garage door" }).waitFor()
  if (!narrow) {
    check(`${tag}: followFocus keeps focus on the row`, (await focusedText(page)) === "Garage door")
    await page.keyboard.press("Enter")
  }
  check(`${tag}: Enter moves focus to the detail's heading`, (await focusedSlot(page)) === "master-detail-title")
  const ring = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement)
    return `${style.outlineStyle} ${style.boxShadow}`
  })
  check(`${tag}: the focused heading draws no ring`, ring === "none none", ring)
  const opened = await layout(page, panes)
  check(
    `${tag}: ${narrow ? "only the detail shows" : "both panes still show"}`,
    opened.boxes.length === (narrow ? 1 : 2) && !overlaps(opened.boxes) && !opened.overflow,
  )
  await settle(page)
  const violations = await axe(page)
  check(`${tag} open: axe`, violations.length === 0, violations.join(", "))
  if (scheme === "light") await shot(page, `master-detail-${width}-keyboard.png`)

  await page.getByRole("button", { name: narrow ? "Back" : "Close detail" }).click()
  await page.getByRole("region", { name: "Garage door" }).waitFor({ state: "detached" })
  const hall = page.getByRole("button", { name: "Hall camera" })
  await hall.click()
  await page.getByRole("region", { name: "Hall camera" }).waitFor()
  if (!narrow) await hall.click()
  const clicked = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement)
    return `${document.activeElement?.getAttribute("data-slot")} ${style.outlineStyle} ${style.boxShadow}`
  })
  check(`${tag}: after a click the heading has focus and no ring`, clicked === "master-detail-title none none", clicked)
  await shot(page, `master-detail-${width}-${scheme}.png`)
  await page.getByRole("button", { name: narrow ? "Back" : "Close detail" }).click()
  await page.getByRole("region", { name: "Hall camera" }).waitFor({ state: "detached" })
  await row.focus()
  await page.keyboard.press("Enter")
  if (!narrow) await page.keyboard.press("Enter")
  await page.getByRole("region", { name: "Garage door" }).waitFor()
  await page.getByRole("button", { name: narrow ? "Back" : "Close detail" }).click()
  await page.getByRole("region", { name: "Garage door" }).waitFor({ state: "detached" })
  check(`${tag}: ${narrow ? "Back" : "Close"} returns focus to the row`, (await focusedText(page)) === "Garage door")

  if (narrow) {
    await row.click()
    await page.keyboard.press("Escape")
    await page.getByRole("region", { name: "Garage door" }).waitFor({ state: "detached" })
    check(`${tag}: Escape returns to the list and the row`, (await focusedText(page)) === "Garage door")
  } else if (width === 1440 && scheme === "light") {
    await page.getByRole("button", { name: "Kitchen sensor" }).click()
    await page.getByRole("button", { name: "Collapse detail" }).click()
    const rail = await page.locator('[data-slot="master-detail-detail"]').boundingBox()
    check(`${tag}: the detail collapses to a rail`, rail !== null && rail.width < 80, `${rail?.width}px`)
    await page.getByRole("button", { name: "Expand detail" }).click()
    const back = await page.locator('[data-slot="master-detail-detail"]').boundingBox()
    check(`${tag}: and expands again`, back !== null && back.width > 300, `${back?.width}px`)
  }
}

const focusedAction = (page) =>
  page.evaluate(() => {
    const element = document.activeElement
    return `${element?.closest("[data-item-id]")?.getAttribute("data-item-id")} ${element?.getAttribute("data-row-action") ?? element?.getAttribute("data-slot")}`
  })

async function listRowActions(page, check, shot, width, scheme) {
  const tag = `list-row-actions ${width}px ${scheme}`
  const narrow = width === 390
  await open(page, "list-row-actions", width, scheme, "", '[data-slot="list"][data-row-actions]')
  const grid = page.getByRole("grid", { name: "Worktrees" })
  const view = await layout(page, '[data-slot="list-item"]')
  check(`${tag}: no sideways scroll`, !view.overflow)
  check(`${tag}: rows don't overlap`, view.boxes.length === 5 && !overlaps(view.boxes), `${view.boxes.length} rows`)
  const violations = await axe(page)
  check(`${tag}: axe`, violations.length === 0, violations.join(", "))

  await grid.getByRole("button", { name: "main", exact: true }).focus()
  await page.keyboard.press("ArrowRight")
  check(`${tag}: Right reaches the row's first action`, (await focusedAction(page)) === "main open")
  await page.keyboard.press("ArrowRight")
  await page.keyboard.press("ArrowDown")
  check(`${tag}: Down keeps the column`, (await focusedAction(page)) === "row-actions copy")
  await page.keyboard.press("Enter")
  check(
    `${tag}: Enter on an action opens no row`,
    (await page.getByRole("region", { name: "row-actions" }).count()) === 0 &&
      (await focusedAction(page)) === "row-actions copy",
  )
  await settle(page)
  const shown = await page.evaluate(
    () => getComputedStyle(document.activeElement.closest('[data-slot="list-item-actions"]')).opacity,
  )
  check(`${tag}: a focused row shows its actions`, shown === "1", shown)
  await shot(page, `list-row-actions-${width}-${scheme}.png`)
  await page.keyboard.press("Home")
  check(
    `${tag}: Home goes back to the row's primary cell`,
    (await focusedAction(page)) === "row-actions list-item-primary",
  )

  if (narrow) return
  await grid.getByRole("button", { name: "row-actions", exact: true }).click()
  await page.getByRole("region", { name: "row-actions" }).waitFor()
  const main = page.locator('[data-item-id="main"]')
  await main.hover()
  await main.getByRole("button", { name: "Stop", exact: true }).click()
  await main.getByRole("button", { name: "Start", exact: true }).waitFor()
  check(
    `${tag}: a press on another row's action leaves the detail`,
    (await page.getByRole("region", { name: "row-actions" }).count()) === 1,
  )
  const rest = await page
    .locator('[data-item-id="docs-search"] [data-slot="list-item-actions"]')
    .evaluate((element) => getComputedStyle(element).opacity)
  check(`${tag}: a row at rest hides its actions on a fine pointer`, rest === "0", rest)

  if (width !== 1440 || scheme !== "light") return
  const height = () => main.evaluate((element) => element.getBoundingClientRect().height)
  const comfortable = await height()
  for (const radius of ["none", "full"]) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- one page drives the steps, in order
    await page.evaluate((value) => {
      document.documentElement.dataset.density = "compact"
      document.documentElement.dataset.radius = value
    }, radius)
    // oxlint-disable-next-line eslint/no-await-in-loop -- one page drives the steps, in order
    await settle(page)
    // oxlint-disable-next-line eslint/no-await-in-loop -- one page drives the steps, in order
    const compact = await height()
    check(`${tag} compact ${radius}: rows get shorter`, compact < comfortable, `${compact} < ${comfortable}`)
    // oxlint-disable-next-line eslint/no-await-in-loop -- one page drives the steps, in order
    const after = await layout(page, '[data-slot="list-item"]')
    check(`${tag} compact ${radius}: no sideways scroll or overlap`, !after.overflow && !overlaps(after.boxes))
    // oxlint-disable-next-line eslint/no-await-in-loop -- one page drives the steps, in order
    await main.hover()
    // oxlint-disable-next-line eslint/no-await-in-loop -- one page drives the steps, in order
    await shot(page, `list-row-actions-compact-${radius}.png`)
  }
}

function cardBoxes(page) {
  return page.locator('[data-slot="dashboard-card"], [data-slot="dashboard-stat"]').evaluateAll((cards) =>
    cards.map((card) => {
      const box = card.getBoundingClientRect()
      return {
        slot: card.dataset.slot,
        left: Math.round(box.left),
        right: Math.round(box.right),
        top: Math.round(box.top),
        bottom: Math.round(box.bottom),
        width: Math.round(box.width),
        height: Math.round(box.height),
      }
    }),
  )
}

function clippedCards(page) {
  return page.locator('[data-slot="dashboard-card"]').evaluateAll((all) =>
    all
      .filter((card) => {
        const box = card.getBoundingClientRect()
        const inner = [...card.querySelectorAll("*")].some((node) => {
          const rect = node.getBoundingClientRect()
          return rect.height > 0 && (rect.bottom > box.bottom + 1 || rect.right > box.right + 1)
        })
        const scrolls = [card, ...card.querySelectorAll("*")].some(
          (node) => node.scrollHeight > node.clientHeight + 1 && getComputedStyle(node).overflowY !== "visible",
        )
        return inner || scrolls
      })
      .map((card) => card.querySelector('[data-slot="card-title"]')?.textContent),
  )
}

async function dashboardGrid(page, check, shot, width, scheme) {
  const tag = `dashboard-grid ${width}px ${scheme}`
  await open(page, "dashboard-grid", width, scheme)
  const loaded = await cardBoxes(page)
  const cards = loaded.filter((box) => box.slot === "dashboard-card")
  const { overflow } = await layout(page, '[data-slot="dashboard-card"]')
  check(`${tag}: no sideways scroll`, !overflow)
  check(`${tag}: cards don't overlap`, !overlaps(cards))
  const rows = Map.groupBy(cards, (box) => box.top)
  const ragged = [...rows.values()].filter((row) => new Set(row.map((box) => box.bottom)).size > 1)
  check(`${tag}: cards in a row share their height`, ragged.length === 0)
  if (width === 390) {
    check(`${tag}: one column`, new Set(cards.map((box) => box.left)).size === 1 && rows.size === cards.length)
  } else {
    check(`${tag}: several columns`, rows.size < cards.length, `${rows.size} rows of ${cards.length} cards`)
  }
  const clipped = await clippedCards(page)
  check(`${tag}: no card's content overflows or scrolls inside it`, clipped.length === 0, clipped.join(", "))
  const violations = await axe(page)
  check(`${tag}: axe`, violations.length === 0, violations.join(", "))
  await shot(page, `dashboard-grid-${width}-${scheme}.png`, true)

  await page.getByRole("switch", { name: "Show loading" }).click()
  await page.locator('[data-slot="dashboard-card"][data-status="pending"]').first().waitFor()
  await settle(page)
  const pending = await cardBoxes(page)
  const moved = pending.filter((box, index) => box.height !== loaded[index]?.height || box.top !== loaded[index]?.top)
  check(`${tag}: loading keeps every card and figure in place`, moved.length === 0, `${moved.length} moved`)
  const busy = await axe(page)
  check(`${tag} loading: axe`, busy.length === 0, busy.join(", "))
  if (scheme === "light") await shot(page, `dashboard-grid-${width}-loading.png`, true)

  await page.getByRole("switch", { name: "Show loading" }).click()
  await page.locator('[data-slot="dashboard-card"][data-status="pending"]').first().waitFor({ state: "detached" })
  await page
    .locator('[data-slot="dashboard-grid"]')
    .evaluate((grid) => grid.style.setProperty("--dashboard-row-height", "4rem"))
  const squeezed = await clippedCards(page)
  check(`${tag}: rows shorter than a card's content grow`, squeezed.length === 0, squeezed.join(", "))
}

const box = (locator) => locator.evaluate((element) => element.getBoundingClientRect().toJSON())

async function settingsPage(page, check, shot, width, scheme) {
  const tag = `settings-page ${width}px ${scheme}`
  await open(page, "settings-page", width, scheme)
  const wide = width === 1440
  const { overflow } = await layout(page, '[data-slot="settings-section"]')
  check(`${tag}: no sideways scroll`, !overflow)
  const nav = page.getByRole("navigation", { name: "Settings sections" })
  const picker = page.getByRole("combobox", { name: "Go to section" })
  check(
    `${tag}: ${wide ? "a section nav" : "a section picker"}`,
    wide ? await nav.isVisible() : await picker.isVisible(),
  )
  check(`${tag}: one way to pick a section shows`, wide ? !(await picker.isVisible()) : !(await nav.isVisible()))
  const violations = await axe(page)
  check(`${tag}: axe`, violations.length === 0, violations.join(", "))
  await shot(page, `settings-page-${width}-${scheme}.png`)

  const row = page.locator("[data-settings-row]").filter({ hasText: "Sign out after" })
  const [label, control] = await Promise.all([
    box(row.locator('[data-slot="field-label"], label').first()),
    box(row.getByRole("combobox")),
  ])
  const stacked = control.top >= label.bottom - 1
  check(
    `${tag}: a row ${width === 390 ? "stacks its control under the label" : "keeps its control beside the label"}`,
    width === 390 ? stacked : !stacked,
  )

  const bar = await box(page.getByTestId("app-bar"))
  if (wide) {
    await nav.getByRole("link", { name: "Danger zone" }).click()
  } else {
    await picker.click()
    await page.getByRole("option", { name: "Danger zone" }).click()
  }
  await page.waitForTimeout(900)
  const heading = page.getByRole("heading", { name: "Danger zone" })
  const landed = await box(heading)
  check(
    `${tag}: going to a section lands it below the sticky bars`,
    landed.top >= bar.bottom,
    `${Math.round(landed.top)}px`,
  )
  check(`${tag}: and focuses its heading`, (await focusedText(page)) === "Danger zone")
  const jumped = wide ? await nav.locator('[aria-current="location"]').textContent() : await picker.textContent()
  check(`${tag}: and marks it, though it can't reach the top`, jumped?.includes("Danger zone"), jumped)
  const sticky = await box(wide ? nav : picker)
  check(
    `${tag}: the ${wide ? "nav" : "picker"} sticks under the bar`,
    sticky.top >= bar.bottom - 1 && sticky.top < bar.bottom + 40,
    `${Math.round(sticky.top)}px`,
  )
  if (scheme === "light") await shot(page, `settings-page-${width}-scrolled.png`)

  await page.mouse.wheel(0, -1)
  await page.locator("#security").evaluate((element) => element.scrollIntoView({ block: "start", behavior: "instant" }))
  await page.waitForTimeout(400)
  const marked = wide ? await nav.locator('[aria-current="location"]').textContent() : await picker.textContent()
  check(`${tag}: scrolling marks the section being read`, marked?.includes("Security"), marked)

  if (width !== 1440 || scheme !== "light") return
  const forget = page.getByRole("button", { name: "Forget device" })
  const before = await box(forget)
  await forget.click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Forget it" }).click()
  await page.getByRole("alertdialog").waitFor({ state: "detached" })
  await page.locator('[data-slot="settings-row"] [data-pending]').waitFor()
  const pending = await forget.evaluate((element) => {
    const spinner = element.querySelector('[data-slot="spinner"]')
    return {
      busy: element.getAttribute("aria-busy"),
      spinner: spinner !== null && spinner.checkVisibility(),
      width: element.getBoundingClientRect().width,
    }
  })
  check(`${tag}: a pending danger trigger is busy with a spinner`, pending.busy === "true" && pending.spinner)
  check(`${tag}: and keeps its width`, Math.abs(pending.width - before.width) < 1, `${before.width} → ${pending.width}`)
  await forget.click({ force: true })
  check(`${tag}: and doesn't open the dialog`, (await page.getByRole("alertdialog").count()) === 0)
  const busy = await axe(page)
  check(`${tag} pending: axe`, busy.length === 0, busy.join(", "))
  await shot(page, "settings-page-pending.png")
}

async function settingsPageFocus(page, check) {
  const tag = "settings-page-check"
  const origin = new URL(page.url()).origin
  const focusedHeading = () =>
    page.evaluate(() => {
      const active = document.activeElement
      return active?.matches('[data-slot="settings-section-title"]') ? active.textContent : null
    })
  const inView = (name) =>
    page.getByRole("heading", { name }).evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return rect.top >= 0 && rect.bottom <= innerHeight
    })
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.goto(`${origin}/?demo=settings-page-check#/settings?section=danger-zone`)
  await page.getByRole("heading", { name: "Danger zone" }).waitFor()
  await page.waitForTimeout(300)
  check(`${tag}: a section the URL names that mounts later takes focus`, (await focusedHeading()) === "Danger zone")
  check(`${tag}: and is scrolled into view`, await inView("Danger zone"))
  check(
    `${tag}: and the address stays`,
    (await page.evaluate(() => location.hash)) === "#/settings?section=danger-zone",
  )

  await page.goto("about:blank")
  await page.goto(`${origin}/?demo=settings-page-check#/settings?section=danger-zone`)
  await page.getByRole("heading", { name: "Account" }).waitFor()
  await page.keyboard.press("Shift")
  const before = await page.evaluate(() => scrollY)
  await page.getByRole("heading", { name: "Danger zone" }).waitFor()
  await page.waitForTimeout(300)
  check(`${tag}: after a key press it doesn't take focus`, (await focusedHeading()) === null)
  check(`${tag}: nor scroll`, (await page.evaluate(() => scrollY)) === before)

  await page.evaluate(() => scrollTo(0, 0))
  const link = page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "Notifications" })
  check(
    `${tag}: section links are hash routes`,
    (await link.getAttribute("href")) === "#/settings?section=notifications",
  )
  const linkBox = await link.boundingBox()
  await page.mouse.move(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  await page.waitForTimeout(900)
  check(`${tag}: a mouse press on a section link focuses its heading`, (await focusedHeading()) === "Notifications")
  check(`${tag}: and scrolls it into view`, await inView("Notifications"))
  check(`${tag}: and marks the link`, (await link.getAttribute("aria-current")) === "location")
  check(`${tag}: and records it`, (await page.evaluate(() => location.hash)) === "#/settings?section=notifications")
}

function visiblePanes(root) {
  return root.evaluate((element) =>
    [...element.querySelectorAll('[data-slot="master-detail-list"], [data-slot="master-detail-detail"]')]
      .filter((pane) => pane.checkVisibility())
      .map((pane) => pane.getBoundingClientRect().toJSON()),
  )
}

async function masterDetailModes(page, check, shot, scheme) {
  const tag = `master-detail modes ${scheme}`
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${new URL(page.url()).origin}/?demo=master-detail-check`)
  await page.locator('[data-slot="master-detail"]').first().waitFor()
  await page.evaluate((dark) => {
    localStorage.clear()
    document.documentElement.classList.toggle("dark", dark)
    document.documentElement.classList.toggle("light", !dark)
    document.documentElement.dataset.colorScheme = dark ? "dark" : "light"
  }, scheme === "dark")
  await settle(page)

  const idle = page.getByRole("group", { name: "Monitored devices" })
  const block = await idle.evaluate((element) => element.getBoundingClientRect().toJSON())
  const stacked = await visiblePanes(idle)
  const [list, detail] = stacked
  check(
    `${tag}: a narrow container stacks the list over a visible idle detail`,
    stacked.length === 2 &&
      !overlaps(stacked) &&
      detail.top >= list.bottom - 1 &&
      Math.abs(detail.width - list.width) < 2,
    JSON.stringify(stacked.map((pane) => Math.round(pane.top))),
  )
  check(
    `${tag}: the idle detail takes at most half the block`,
    detail.height <= block.height / 2 + 2,
    `${detail.height}px`,
  )
  check(
    `${tag}: both panes stay inside the block`,
    detail.bottom <= block.bottom + 1,
    `${detail.bottom} > ${block.bottom}`,
  )
  const violations = await axe(page)
  check(`${tag}: axe`, violations.length === 0, violations.join(", "))
  if (scheme === "light") await shot(page, "master-detail-idle-visible.png")

  const collapse = idle.getByRole("button", { name: "Collapse detail" })
  await collapse.click()
  await idle.getByRole("button", { name: "Expand detail" }).waitFor()
  const folded = await visiblePanes(idle)
  check(
    `${tag}: collapsing leaves a bar under the list`,
    folded.length === 2 && folded[1].height < 64 && folded[0].height > block.height - 80,
    `${folded[1]?.height}px`,
  )
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))
  check(`${tag}: focus stays on the toggle`, focused === "Expand detail", focused)
  await idle.getByRole("button", { name: "Expand detail" }).click()

  await idle.getByRole("button", { name: "Device 3" }).click()
  await idle.getByRole("region", { name: "Device 3" }).waitFor()
  const opened = await visiblePanes(idle)
  check(
    `${tag}: an open item fills the narrow block`,
    opened.length === 1 && opened[0].height > block.height - 4,
    `${opened[0]?.height}px`,
  )
  await idle.getByRole("button", { name: "Back" }).click()

  const auto = page.getByRole("group", { name: "Content sized" })
  const sized = await auto.evaluate((element) => {
    const body = element.querySelector('[data-slot="master-detail-list-body"]')
    return { height: element.getBoundingClientRect().height, scrolls: body.scrollHeight > body.clientHeight + 1 }
  })
  const rem = 16
  check(
    `${tag}: height auto stops at --master-detail-max-height`,
    Math.abs(sized.height - 24 * rem) < 2,
    `${sized.height}px`,
  )
  check(`${tag}: and the list scrolls inside it`, sized.scrolls)
  const few = await page
    .getByRole("group", { name: "Few rows" })
    .evaluate((element) => element.getBoundingClientRect().height)
  check(`${tag}: a short list keeps --master-detail-min-height`, Math.abs(few - 16 * rem) < 2, `${few}px`)
}

async function checkLayoutBlocks(page, check, shot) {
  for (const width of widths) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- one page drives the steps, in order
    for (const scheme of schemes) await masterDetail(page, check, shot, width, scheme)
  }
  // oxlint-disable-next-line eslint/no-await-in-loop -- one page drives the steps, in order
  for (const scheme of schemes) await masterDetailModes(page, check, shot, scheme)
  for (const width of widths) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- one page drives the steps, in order
    for (const scheme of schemes) await listRowActions(page, check, shot, width, scheme)
  }
  for (const width of widths) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- one page drives the steps, in order
    for (const scheme of schemes) await dashboardGrid(page, check, shot, width, scheme)
  }
  for (const width of widths) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- one page drives the steps, in order
    for (const scheme of schemes) await settingsPage(page, check, shot, width, scheme)
  }
  await settingsPageFocus(page, check)
}

export { axe, checkLayoutBlocks, layout, open, overlaps, settle }
