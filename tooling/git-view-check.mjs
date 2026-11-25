import { withShowcase } from "./showcase-browser.mjs"

const failures = []

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

const rect = (page, selector) =>
  page.evaluate((target) => {
    const element = document.querySelector(target)
    if (!element) return null
    const box = element.getBoundingClientRect()
    return { left: box.left, width: box.width, height: box.height }
  }, selector)

async function open(page) {
  await page.goto(`${new URL(page.url()).origin}/?demo=git-view-check`)
  await page.waitForSelector("[data-testid=split] [role=row]")
  await page.waitForTimeout(200)
}

async function treeBesideList(page) {
  const tree = await rect(page, "[data-testid=beside-list] [role=tree]")
  const viewport = await rect(page, "[data-testid=beside-list] [data-slot=diff-view-viewport]")
  check(
    "1440: the file tree is 13rem beside a 34rem list",
    tree !== null && Math.abs(tree.width - 208) < 1,
    `${String(tree?.width)}px`,
  )
  check(
    "1440: the diff keeps at least 36rem",
    viewport !== null && viewport.width >= 576,
    `${String(viewport?.width)}px`,
  )

  const before = await rect(page, "[data-testid=collapsible] [data-slot=diff-view-viewport]")
  const toggle = page.locator("[data-testid=collapsible]").getByRole("button", { name: "Changed files" })
  await toggle.hover()
  const tooltip = await page
    .getByRole("tooltip")
    .textContent({ timeout: 3000 })
    .catch(() => null)
  check("the tree toggle names itself in a tooltip", tooltip?.includes("Changed files") === true, String(tooltip))
  await toggle.click()
  await page.waitForTimeout(100)
  const hidden = (await page.locator("[data-testid=collapsible] [role=tree]").count()) === 0
  const after = await rect(page, "[data-testid=collapsible] [data-slot=diff-view-viewport]")
  check(
    "collapsing the tree gives its width to the diff",
    hidden && after.width > before.width + 150,
    `${String(before?.width)} → ${String(after?.width)}`,
  )
  await toggle.click()
}

async function autoHeight(page) {
  const short = await page.evaluate(() => {
    const viewport = document.querySelector("[data-testid=auto-short] [data-slot=diff-view-viewport]")
    return {
      scroll: viewport.scrollHeight,
      client: viewport.clientHeight,
      overscroll: getComputedStyle(viewport).overscrollBehaviorY,
    }
  })
  check(
    "auto: a short diff grows to its content, no scroller of its own",
    short.scroll <= short.client + 1,
    `${String(short.scroll)} / ${String(short.client)}`,
  )
  check("auto: the diff doesn't contain overscroll", short.overscroll === "auto", short.overscroll)

  const long = await page.evaluate(() => {
    const scope = document.querySelector("[data-testid=auto-long]")
    const viewport = scope.querySelector("[data-slot=diff-view-viewport]")
    const tree = scope.querySelector("[role=tree]")
    const cap = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 20
    return {
      cap,
      diff: scope.querySelector("[data-slot=diff-view]").getBoundingClientRect().height,
      tree: tree.getBoundingClientRect().height,
      scroll: viewport.scrollHeight,
      client: viewport.clientHeight,
    }
  })
  check(
    "auto: a long diff stops at --diff-max-height",
    long.diff <= long.cap + 1 && long.scroll > long.client,
    `${String(long.diff)}px, cap ${String(long.cap)}px`,
  )
  check("auto: the tree beside it stops there too", long.tree <= long.cap + 1, `${String(long.tree)}px`)

  const box = await page.evaluate(() => {
    const body = document.querySelector("[data-testid=dialog-body]")
    body.scrollIntoView({ block: "center" })
    const viewport = body.querySelector("[data-testid=auto-long] [data-slot=diff-view-viewport]")
    body.scrollTop += viewport.getBoundingClientRect().top - body.getBoundingClientRect().top - 40
    viewport.scrollTop = viewport.scrollHeight
    const { left, top } = viewport.getBoundingClientRect()
    return { left, top }
  })
  await page.waitForTimeout(150)
  const bodyBefore = await page.evaluate(() => document.querySelector("[data-testid=dialog-body]").scrollTop)
  await page.mouse.move(box.left + 200, box.top + 60)
  await page.mouse.wheel(0, 240)
  await page.waitForTimeout(300)
  const bodyAfter = await page.evaluate(() => document.querySelector("[data-testid=dialog-body]").scrollTop)
  check(
    "auto: at the diff's end the wheel scrolls the body",
    bodyAfter > bodyBefore + 50,
    `${String(bodyBefore)} → ${String(bodyAfter)}`,
  )
}

async function autoHuge(page) {
  const measure = () =>
    page.evaluate(() => {
      const body = document.querySelector("[data-testid=huge-body]")
      const viewport = body.querySelector("[data-slot=diff-view-viewport]")
      const bar = body.querySelector(
        "[data-slot=diff-view] [data-slot=scroll-area-scrollbar][data-orientation=vertical]",
      )
      return {
        scroll: viewport.scrollHeight,
        client: viewport.clientHeight,
        bar: bar?.hasAttribute("data-visible") ?? false,
        bodyScroll: body.scrollHeight,
        bodyClient: body.clientHeight,
        bodyTop: body.scrollTop,
        rows: viewport.querySelectorAll("[role=row]").length,
        layers: body.parentElement.querySelectorAll("[hidden=until-found]").length,
      }
    })
  const start = await measure()
  check(
    "auto, uncapped: 2,000 lines have no scroller of their own",
    start.scroll <= start.client + 1 && !start.bar,
    `${String(start.scroll)} / ${String(start.client)}, scrollbar ${String(start.bar)}`,
  )
  check(
    "auto, uncapped: the body scrolls the diff",
    start.bodyScroll > start.bodyClient + 30_000,
    `${String(start.bodyScroll)} / ${String(start.bodyClient)}`,
  )
  check("auto, uncapped: rows virtualize against the body", start.rows > 0 && start.rows < 150, String(start.rows))
  check("auto, uncapped: off-screen rows stay findable", start.layers > 0, String(start.layers))

  const middle = await page.evaluate(async () => {
    const body = document.querySelector("[data-testid=huge-body]")
    body.scrollIntoView({ block: "center" })
    body.scrollTop = body.scrollHeight / 2
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const box = body.getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    return {
      row: hit?.closest("[role=row]")?.textContent?.slice(0, 40) ?? null,
      rows: body.querySelectorAll("[data-slot=diff-view-viewport] [role=row]").length,
    }
  })
  check(
    "auto, uncapped: halfway down the body, its rows are rendered",
    middle.row !== null && middle.rows < 150,
    `${String(middle.row)}, ${String(middle.rows)} rows`,
  )

  await page.evaluate(() => {
    document.querySelector("[data-testid=huge-body]").scrollTop = 0
  })
  await page.waitForTimeout(100)
  await page
    .locator("[data-testid=huge-body] [role=gridcell]")
    .filter({ hasText: "export const value0 " })
    .first()
    .click()
  const before = await measure()
  await page.keyboard.press("j")
  await page.waitForTimeout(200)
  const after = await measure()
  const focused = await page.evaluate(() => {
    const body = document.querySelector("[data-testid=huge-body]")
    const cell = document.activeElement
    const box = cell.getBoundingClientRect()
    const view = body.getBoundingClientRect()
    return {
      inside: body.contains(cell) && box.top >= view.top && box.bottom <= view.bottom,
      text: cell.closest("[role=row]")?.textContent?.slice(0, 40),
    }
  })
  check(
    "auto, uncapped: j scrolls the body to the next hunk",
    after.bodyTop > before.bodyTop + 1000 && focused.inside,
    `${String(before.bodyTop)} → ${String(after.bodyTop)}, ${String(focused.text)}`,
  )
}

async function autoInPage(page) {
  const result = await page.evaluate(async () => {
    const viewport = document.querySelector("[data-testid=page-huge] [data-slot=diff-view-viewport]")
    const box = viewport.getBoundingClientRect()
    window.scrollTo({ top: window.scrollY + box.top + box.height / 2 })
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const hit = document.elementFromPoint(box.left + 200, innerHeight / 2)
    return {
      scroll: viewport.scrollHeight,
      client: viewport.clientHeight,
      rows: viewport.querySelectorAll("[role=row]").length,
      inside: viewport.contains(hit) && hit?.closest("[role=row]") !== null,
    }
  })
  check(
    "auto, in the page: the window scrolls 2,000 lines, rendered where they show and nowhere else",
    result.scroll <= result.client + 1 && result.inside && result.rows < 150,
    JSON.stringify(result),
  )
}

async function splitAdded(page, width) {
  const cells = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("[data-testid=split] [role=row]")].filter(
      (row) => row.querySelector("[role=gridcell]")?.dataset.old !== undefined,
    )
    return rows.slice(0, 5).map((row) => {
      const box = row.getBoundingClientRect()
      const cell = [...row.querySelectorAll("[role=gridcell]")].map((entry) => entry.getBoundingClientRect())
      return { row: [box.left, box.width], cells: cell.map((entry) => [entry.left, entry.width]) }
    })
  })
  const ok =
    cells.length > 0 &&
    cells.every(
      ({ row, cells: list }) =>
        list.length === 1 && Math.abs(list[0][0] - row[0]) < 1 && Math.abs(list[0][1] - row[1]) < 1,
    )
  check(`${String(width)}: an added file's new side spans the split row`, ok, JSON.stringify(cells[0]))
}

for (const width of [1440, 1920]) {
  // oxlint-disable-next-line eslint/no-await-in-loop -- one browser at a time, each at its own viewport
  await withShowcase(
    async (page) => {
      await open(page)
      if (width === 1440) {
        await treeBesideList(page)
        await autoHeight(page)
        await autoHuge(page)
        await autoInPage(page)
      }
      await splitAdded(page, width)
    },
    { viewport: { width, height: 1000 }, deviceScaleFactor: 1 },
  )
}

if (failures.length > 0) {
  console.error(`\n${String(failures.length)} git view check(s) failed`)
  process.exit(1)
}
