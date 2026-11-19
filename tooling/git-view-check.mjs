// Drives ?demo=git-view-check in Chrome: GitDiff's file tree beside a 34rem list at 1440px (13rem, collapsible),
// GitDiff height="auto" in a scrolling body (grows to a short diff, caps a long one at --diff-max-height and hands
// the wheel back to the body).
// Usage: node tooling/git-view-check.mjs (after `bun run build:showcase`)
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
  await page.waitForSelector("[data-testid=auto-long] [role=row]")
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

  // Scroll the long diff to its end, then wheel over it: the body scrolls on.
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

await withShowcase(
  async (page) => {
    await open(page)
    await treeBesideList(page)
    await autoHeight(page)
  },
  { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 },
)

if (failures.length > 0) {
  console.error(`\n${String(failures.length)} git view check(s) failed`)
  process.exit(1)
}
