import { withShowcase } from "./showcase-browser.mjs"

const failures = []

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

const controls = [
  { kind: "tabs", list: "tablist", item: "tab", state: "aria-selected", name: "Tabs", target: "Password" },
  { kind: "segmented", list: "radiogroup", item: "radio", state: "aria-checked", name: "View", target: "Table" },
]

async function isOn(page, control, onPress) {
  const group = page.getByRole(control.list, { name: `${control.name} ${onPress ? "on press" : "on release"}` })
  return (await group.getByRole(control.item, { name: control.target }).getAttribute(control.state)) === "true"
}

async function load(page) {
  await page.goto(`${new URL(page.url()).origin}/?demo=press-check`)
  await page.getByRole("tablist", { name: "Tabs on press" }).waitFor()
}

await withShowcase(async (page) => {
  await load(page)
  for (const control of controls) {
    for (const onPress of [true, false]) {
      const label = `${control.kind} ${onPress ? "with" : "without"} activateOnPress`
      const group = page.getByRole(control.list, { name: `${control.name} ${onPress ? "on press" : "on release"}` })
      const box = await group.getByRole(control.item, { name: control.target }).boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      check(
        `${label}: mouse down without release ${onPress ? "selects" : "doesn't select"}`,
        (await isOn(page, control, onPress)) === onPress,
      )
      await page.mouse.up()
      check(`${label}: the release leaves it selected`, await isOn(page, control, onPress))
    }
  }

  await load(page)
  const tab = page.getByRole("tablist", { name: "Tabs on press" }).getByRole("tab", { name: "Account" })
  const password = page.getByRole("tablist", { name: "Tabs on press" }).getByRole("tab", { name: "Password" })
  const box = await password.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + 200)
  await page.mouse.up()
  check(
    "tabs with activateOnPress: dragging away after the press keeps the new tab",
    (await password.getAttribute("aria-selected")) === "true",
  )
  await password.focus()
  await page.keyboard.press("ArrowLeft")
  check("tabs with activateOnPress: arrow keys still select", (await tab.getAttribute("aria-selected")) === "true")

  const browser = page.context().browser()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const touch = await context.newPage()
  await touch.goto(page.url())
  await touch.getByRole("tablist", { name: "Tabs on press" }).waitFor()
  const cdp = await context.newCDPSession(touch)
  for (const control of controls) {
    const item = touch
      .getByRole(control.list, { name: `${control.name} on press` })
      .getByRole(control.item, { name: control.target })
    const target = await item.boundingBox()
    const point = { x: target.x + target.width / 2, y: target.y + target.height / 2 }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] })
    await touch.waitForTimeout(100)
    check(`${control.kind} with activateOnPress: a touch doesn't select on press`, !(await isOn(touch, control, true)))
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    await touch.waitForTimeout(100)
    check(`${control.kind} with activateOnPress: the touch selects on release`, await isOn(touch, control, true))
  }
  await context.close()
})

if (failures.length > 0) {
  console.error(`\n${failures.length} press check(s) failed`)
  process.exit(1)
}
