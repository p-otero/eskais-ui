// Presses links in the showcase's Navigation section in Chrome: a fast Link and a ButtonLink navigate while the
// mouse button is still down; a `fast={false}` Link and a touch tap wait for the click.
// Usage: node tooling/fast-link-check.mjs (after `bun run build:showcase`)
import { withShowcase } from "./showcase-browser.mjs"

const failures = []

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

async function pressAndHold(page, name, role = "link") {
  const link = page.getByTestId("fast-links").getByRole(role, { name })
  await link.scrollIntoViewIfNeeded()
  const box = await link.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
}

await withShowcase(async (page) => {
  const home = page.url()
  const reset = async () => {
    await page.mouse.up().catch(() => {})
    await page.goto(home)
    await page.getByTestId("fast-links").waitFor()
  }

  const navigatesOnDown = async (name, search) => {
    await reset()
    await pressAndHold(page, name)
    const navigated = await page
      .waitForURL((url) => url.search === search, { timeout: 3000 })
      .then(() => true)
      .catch(() => false)
    check(`${name}: navigates on mouse down, before mouse up`, navigated, page.url())
  }
  await navigatesOnDown("site demo", "?demo=site")
  await navigatesOnDown("Page demo", "?demo=page")

  await reset()
  await pressAndHold(page, "shell demo (follows on release)")
  await page.waitForTimeout(500)
  check("fast={false}: no navigation while the button is down", new URL(page.url()).search === "", page.url())
  await page.mouse.up()
  const released = await page
    .waitForURL((url) => url.search === "?demo=shell", { timeout: 3000 })
    .then(() => true)
    .catch(() => false)
  check("fast={false}: navigates on release", released, page.url())

  await reset()
  await page.getByTestId("fast-links").getByRole("link", { name: "site demo" }).dispatchEvent("pointerdown", {
    pointerType: "touch",
    button: 0,
    isPrimary: true,
  })
  await page.waitForTimeout(500)
  check("touch press: no navigation before the click", new URL(page.url()).search === "", page.url())
})

if (failures.length > 0) {
  console.error(`\n${failures.length} fast link check(s) failed`)
  process.exit(1)
}
