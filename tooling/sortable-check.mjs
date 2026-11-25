import { withShowcase } from "./showcase-browser.mjs"

const failures = []

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

async function load(page, reducedMotion = "no-preference") {
  await page.emulateMedia({ reducedMotion })
  await page.goto(`${new URL(page.url()).origin}/?demo=sortable-check`)
  await page.getByRole("listbox", { name: "Fruits" }).waitFor()
}

const centre = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })
const fruitOrder = (page) => page.locator('output[aria-label="Fruit order"]').textContent()

await withShowcase(async (page) => {
  await load(page)
  const fruits = page.getByRole("listbox", { name: "Fruits" })
  const apple = fruits.getByRole("option", { name: "Apple" })
  const cherry = fruits.getByRole("option", { name: "Cherry" })
  const from = centre(await apple.boundingBox())
  const to = centre(await cherry.boundingBox())

  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x, from.y + 8, { steps: 4 })
  check("a drag past the threshold marks the item grabbed", (await apple.getAttribute("data-grabbed")) === "")
  const renders = await page.evaluate(() => globalThis.sortableRenders ?? 0)
  // oxlint-disable-next-line no-await-in-loop -- pointer moves happen one after another
  for (let step = 1; step <= 10; step++) await page.mouse.move(from.x + step, from.y + 8 + (step % 2))
  const after = await page.evaluate(() => globalThis.sortableRenders ?? 0)
  check(
    "moving the pointer within one slot doesn't re-render the items",
    after === renders,
    `${after - renders} renders`,
  )
  const dragY = await apple.evaluate((el) => el.style.getPropertyValue("--drag-y"))
  check("core writes --drag-y on the grabbed item", dragY !== "", dragY)
  await page.mouse.move(to.x, to.y + 10, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(50)
  check(
    "the drop commits the new order",
    (await fruitOrder(page)) === "Banana,Cherry,Apple,Damson",
    await fruitOrder(page),
  )
  check("the dropped item is no longer grabbed", (await apple.getAttribute("data-grabbed")) === null)

  await apple.focus()
  await page.keyboard.press("Space")
  await page.keyboard.press("ArrowUp")
  const sliding = await fruits.evaluate(
    (el) =>
      el
        .getAnimations({ subtree: true })
        .filter((animation) => !(animation instanceof CSSTransition) && !(animation instanceof CSSAnimation)).length,
  )
  check("a keyboard move slides the neighbours (FLIP)", sliding > 0, `${sliding} animations`)
  await page.keyboard.press("Escape")

  const playlist = page.getByRole("list", { name: "Playlist" })
  const scroller = playlist.locator("xpath=..")
  const handle = page.getByRole("button", { name: "Reorder Track 01" })
  const start = centre(await handle.boundingBox())
  const edge = await scroller.boundingBox()
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x, start.y + 12, { steps: 4 })
  check("a preview drag adds a dragged copy", (await page.locator("[data-drag-preview]").count()) === 1)
  await page.mouse.move(start.x, edge.y + edge.height - 6, { steps: 10 })
  await page.waitForTimeout(700)
  const scrolled = await scroller.evaluate((el) => el.scrollTop)
  check("holding the copy near the bottom edge scrolls the list", scrolled > 40, `scrollTop ${scrolled}`)
  await page.mouse.up()
  const tracks = await playlist.getByRole("listitem").allTextContents()
  const moved = tracks.findIndex((text) => text.includes("Track 01"))
  check("the track lands where the list scrolled to", moved > 4, `index ${moved}`)
  check("the copy is gone after the drop", (await page.locator("[data-drag-preview]").count()) === 0)

  const card = page.getByRole("button", { name: "Move Export app icons" })
  const done = page.getByRole("list", { name: "Done" })
  const grip = centre(await card.boundingBox())
  const target = centre(await done.boundingBox())
  await page.mouse.move(grip.x, grip.y)
  await page.mouse.down()
  await page.mouse.move(grip.x + 10, grip.y, { steps: 3 })
  await page.mouse.move(target.x, target.y, { steps: 15 })
  await page.mouse.up()
  await page.waitForTimeout(50)
  check(
    "a pointer drag moves a card into another column",
    (await done.getByRole("listitem").allTextContents()).some((text) => text.includes("Export app icons")),
  )

  await load(page, "reduce")
  const reducedFruits = page.getByRole("listbox", { name: "Fruits" })
  await reducedFruits.getByRole("option", { name: "Apple" }).focus()
  await page.keyboard.press("Space")
  await page.keyboard.press("ArrowDown")
  const still = await reducedFruits.evaluate(
    (el) =>
      el
        .getAnimations({ subtree: true })
        .filter((animation) => !(animation instanceof CSSTransition) && !(animation instanceof CSSAnimation)).length,
  )
  check("under reduced motion nothing slides", still === 0, `${still} animations`)
  await page.keyboard.press("Space")
  check("and the move still lands", (await fruitOrder(page)) === "Banana,Apple,Cherry,Damson", await fruitOrder(page))
})

if (failures.length > 0) {
  console.error(`\n${failures.length} sortable check(s) failed`)
  process.exit(1)
}
