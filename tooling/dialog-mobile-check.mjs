// Taps every dialog-like item of the showcase open on emulated phones and checks it is fully on screen, scrolls
// inside, holds focus, keeps the page still, closes on a backdrop tap, and stays above the on-screen keyboard (a
// shorter visual viewport, as iOS Safari and Chrome on Android report it) with the field typed in in view.
// Usage: node tooling/dialog-mobile-check.mjs [--engine=webkit] [--screenshots=<dir>] [--color-scheme=dark]
import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"

import { webkit } from "playwright"

import { withShowcase } from "./showcase-browser.mjs"

const failures = []
const arg = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3)
const engine = arg("engine") ?? "chromium"
const colorScheme = arg("color-scheme") ?? "light"
const shots = arg("screenshots") ? resolve(arg("screenshots")) : undefined
if (shots) mkdirSync(shots, { recursive: true })

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

const devices = [
  { name: "390x844", viewport: { width: 390, height: 844 } },
  { name: "375x667", viewport: { width: 375, height: 667 } },
  { name: "844x390", viewport: { width: 844, height: 390 } },
]

const button = (name) => (page) => page.getByRole("button", { name, exact: true }).first()

// `field`: a text field to type in with the keyboard up. `scrolls`: its content is longer than a phone's screen.
// `dismissible: false`: an alert dialog, which a backdrop tap leaves open. `stage`: a part that must take at least
// half the screen's height, as a lightbox's image does.
const cases = [
  { name: "Dialog", trigger: button("Rename project"), field: "Project name" },
  { name: "ConfirmDialog", trigger: button("Delete project"), dismissible: false },
  { name: "Dialog sm", trigger: button("Open sm"), scrolls: true },
  { name: "Dialog full", trigger: button("Open full"), scrolls: true },
  { name: "Drawer right", trigger: button("Open task panel") },
  { name: "Drawer bottom", trigger: button("Open task sheet") },
  {
    name: "FormDialog",
    trigger: button("Nuevo despliegue con revisión"),
    field: "Notas para el equipo",
    scrolls: true,
  },
  { name: "StepDialog", trigger: button("Nuevo proyecto en pasos"), field: "Nombre del proyecto" },
  {
    name: "Lightbox",
    trigger: (page) => page.getByRole("button", { name: /^View / }).first(),
    stage: "[data-slot=lightbox-stage]",
  },
  { name: "CommandDialog", trigger: button("Search commands"), field: "Run a command" },
  {
    name: "Dialog from a menu item",
    path: "?demo=dialog-mobile-check",
    trigger: button("File actions"),
    menuItem: (page) => page.getByRole("menuitem", { name: "Rename file" }),
    field: "Notes",
  },
  { name: "ShortcutsDialog", path: "?demo=dialog-mobile-check", trigger: button("Keyboard shortcuts") },
  { name: "TaskDetailDialog", path: "?demo=task-dialog", scrolls: true },
  { name: "SidePanel sheet", path: "?demo=side-panel-check&narrow=sheet", narrowOnly: true },
]

async function tap(page, locator) {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
}

let page

function topDialog() {
  return page.locator("[role=dialog]:visible, [role=alertdialog]:visible").last()
}

// Geometry of the topmost dialog. It runs in the page, so its helpers live inside it.
function measure() {
  const dialog = [...document.querySelectorAll("[role=dialog], [role=alertdialog]")].findLast((d) =>
    d.checkVisibility(),
  )
  if (!dialog) return null
  const rect = dialog.getBoundingClientRect()
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the page, which can't see module scope
  const visible = (element) => element.checkVisibility() && element.getBoundingClientRect().width > 0
  const clipsSideways = (element) => {
    for (let node = element.parentElement; node && node !== dialog; node = node.parentElement) {
      if (getComputedStyle(node).overflowX !== "visible") return true
    }
    return false
  }
  const scrollers = [dialog, ...dialog.querySelectorAll("*")].filter(
    (element) =>
      element.scrollHeight > element.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(element).overflowY),
  )
  const inScroller = (element) => scrollers.some((scroller) => scroller !== element && scroller.contains(element))
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the page, which can't see module scope
  const name = (element) =>
    (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 40) || element.tagName
  const controls = [...dialog.querySelectorAll("button, a[href], input, textarea, [role=combobox]")].filter(visible)
  return {
    rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
    innerWidth,
    innerHeight,
    pageOverflow: document.documentElement.scrollWidth - innerWidth,
    scrollY,
    focusInside: dialog.contains(document.activeElement),
    focused: document.activeElement === dialog ? "the dialog" : name(document.activeElement),
    sideways: [...dialog.querySelectorAll("*")]
      .filter(visible)
      .filter((element) => !clipsSideways(element))
      .filter((element) => {
        const box = element.getBoundingClientRect()
        return box.right > rect.right + 1 || box.left < rect.left - 1
      })
      .map((element) => `${element.tagName.toLowerCase()}[${element.dataset.slot ?? ""}]`)
      .slice(0, 3),
    offScreen: controls
      .filter((element) => !inScroller(element))
      .filter((element) => {
        const box = element.getBoundingClientRect()
        return box.top < -0.5 || box.bottom > innerHeight + 0.5 || box.left < -0.5 || box.right > innerWidth + 0.5
      })
      .map(name),
    scrollers: scrollers.map((element) => {
      const before = element.scrollTop
      element.scrollTop = element.scrollHeight
      const moved = element.scrollTop > before
      element.scrollTop = before
      return { slot: element.dataset.slot ?? element.tagName, moved }
    }),
    smallClose: controls
      .filter((element) => element.matches("button[aria-label]") && !element.textContent.trim())
      .filter((element) => /close|cerrar/i.test(element.getAttribute("aria-label")))
      .filter((element) => {
        const box = element.getBoundingClientRect()
        const hit = getComputedStyle(element, "::before")
        const width = Math.max(box.width, Number.parseFloat(hit.width) || 0)
        const height = Math.max(box.height, Number.parseFloat(hit.height) || 0)
        return width < 44 || height < 44
      })
      .map(name),
  }
}

function outside({ rect, innerWidth: width, innerHeight: height }) {
  const points = [
    [width / 2, 4],
    [4, height / 2],
    [width - 4, height / 2],
    [width / 2, height - 4],
  ]
  return points.find(([x, y]) => x < rect.left || x > rect.right || y < rect.top || y > rect.bottom)
}

async function keyboardUp(name, field, device) {
  const dialog = topDialog()
  const input = dialog
    .getByLabel(field)
    .or(dialog.getByRole("combobox", { name: field }))
    .first()
  await tap(page, input)
  const keyboard = Math.round(device.viewport.height * 0.45)
  await page.evaluate((covered) => {
    const height = innerHeight - covered
    Object.defineProperty(visualViewport, "height", { configurable: true, get: () => height })
    visualViewport.dispatchEvent(new Event("resize"))
  }, keyboard)
  await page.waitForTimeout(400)
  const result = await page.evaluate(() => {
    const content = [...document.querySelectorAll("[role=dialog], [role=alertdialog]")].findLast((d) =>
      d.checkVisibility(),
    )
    const rect = content.getBoundingClientRect()
    const focused = document.activeElement.getBoundingClientRect()
    return {
      visible: visualViewport.height,
      top: rect.top,
      bottom: rect.bottom,
      fieldTop: focused.top,
      fieldBottom: focused.bottom,
      inside: content.contains(document.activeElement),
    }
  })
  check(
    `${name} ${device.name}: with the keyboard up the dialog stays above it`,
    result.top >= -0.5 && result.bottom <= result.visible + 0.5,
    `dialog ${Math.round(result.top)}-${Math.round(result.bottom)}, visible to ${result.visible}`,
  )
  check(
    `${name} ${device.name}: with the keyboard up the field typed in is in view`,
    result.inside && result.fieldTop >= Math.max(result.top, 0) - 0.5 && result.fieldBottom <= result.visible + 0.5,
    `field ${Math.round(result.fieldTop)}-${Math.round(result.fieldBottom)}`,
  )
  if (shots) await page.screenshot({ path: join(shots, `${slug(name)}-${device.name}-keyboard.png`) })
  await page.evaluate(() => {
    delete visualViewport.height
    visualViewport.dispatchEvent(new Event("resize"))
  })
}

function slug(name) {
  return name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")
}

// Runs the steps one after another: each drives the same browser.
function inTurn(items, step) {
  return items.reduce((previous, item) => previous.then(() => step(item)), Promise.resolve())
}

function waitsFor(locator, options) {
  return locator
    .waitFor(options)
    .then(() => true)
    .catch(() => false)
}

async function open(item) {
  const trigger = item.trigger(page)
  await trigger.scrollIntoViewIfNeeded()
  const scrolled = await page.evaluate(() => scrollY)
  await tap(page, trigger)
  if (item.menuItem) {
    const next = item.menuItem(page)
    await next.waitFor()
    await page.waitForTimeout(200)
    await tap(page, next)
  }
  return scrolled
}

function checkGeometry(label, item, device, geometry, scrolled) {
  const { rect } = geometry
  check(
    `${label}: the page keeps the screen's width`,
    geometry.innerWidth === device.viewport.width && geometry.pageOverflow <= 0,
    `layout viewport ${geometry.innerWidth}px, page ${geometry.pageOverflow}px wider`,
  )
  check(
    `${label}: within the viewport`,
    rect.left >= -0.5 &&
      rect.top >= -0.5 &&
      rect.right <= device.viewport.width + 0.5 &&
      rect.bottom <= device.viewport.height + 0.5,
    [rect.left, rect.top, rect.right, rect.bottom].map(Math.round).join(", "),
  )
  check(`${label}: nothing overflows it sideways`, geometry.sideways.length === 0, geometry.sideways.join(", "))
  check(`${label}: its controls are on screen`, geometry.offScreen.length === 0, geometry.offScreen.join(", "))
  if (item.scrolls && device.viewport.width <= 760) {
    check(
      `${label}: long content scrolls inside it`,
      geometry.scrollers.some((scroller) => scroller.moved),
      JSON.stringify(geometry.scrollers),
    )
  }
  check(`${label}: focus is inside`, geometry.focusInside, geometry.focused)
  check(
    `${label}: opening left the page where it was`,
    geometry.scrollY === scrolled,
    `${scrolled} -> ${geometry.scrollY}`,
  )
  check(
    `${label}: an icon close button has a 44px hit area`,
    geometry.smallClose.length === 0,
    geometry.smallClose.join(", "),
  )
}

async function checkStage(label, item, device) {
  if (!item.stage) return
  const height = await page.locator(item.stage).evaluate((element) => element.getBoundingClientRect().height)
  check(
    `${label}: ${item.stage} takes at least half the screen`,
    height >= device.viewport.height / 2,
    `${Math.round(height)}px`,
  )
}

async function checkBackdrop(label, item, geometry) {
  const point = outside(geometry)
  if (!point) return
  await page.mouse.move(point[0], point[1])
  await page.mouse.wheel(0, 600)
  await page.waitForTimeout(200)
  const after = await page.evaluate(() => scrollY)
  check(`${label}: the page behind doesn't scroll`, after === geometry.scrollY, `${geometry.scrollY} -> ${after}`)
  if (item.dismissible === false) return
  await page.touchscreen.tap(point[0], point[1])
  const closed = await waitsFor(topDialog(), { state: "hidden", timeout: 2000 })
  check(`${label}: a backdrop tap closes it`, closed, `tapped ${point.map(Math.round).join(", ")}`)
}

async function checkCase(context, origin, device, item) {
  if (item.narrowOnly && device.viewport.width > 760) return
  const label = `${item.name} ${device.name}`
  page = await context.newPage()
  page.setDefaultTimeout(10_000)
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto(`${origin}/${item.path ?? ""}`)
  // The showcase keeps its own appearance over the emulated scheme, so dark mode is set the way `Appearance` does.
  if (colorScheme === "dark") await page.evaluate(() => document.documentElement.classList.add("dark"))
  await page.evaluate(() => document.fonts.ready)
  const scrolled = item.trigger ? await open(item) : 0
  const opened = await waitsFor(topDialog(), { timeout: 3000 })
  check(`${label}: opens on a tap`, opened)
  if (opened) {
    await page.waitForTimeout(700)
    const geometry = await page.evaluate(measure)
    checkGeometry(label, item, device, geometry, scrolled)
    await checkStage(label, item, device)
    if (shots) await page.screenshot({ path: join(shots, `${slug(item.name)}-${device.name}.png`) })
    if (item.field) await keyboardUp(item.name, item.field, device)
    await checkBackdrop(label, item, geometry)
  }
  check(`${label}: no page errors`, errors.length === 0, errors.join("; "))
  await page.close()
}

function run(origin, browser) {
  return inTurn(devices, async (device) => {
    const context = await browser.newContext({
      viewport: device.viewport,
      deviceScaleFactor: 3,
      hasTouch: true,
      isMobile: engine === "chromium",
      colorScheme,
    })
    await inTurn(cases, (item) => checkCase(context, origin, device, item))
    await context.close()
  })
}

await withShowcase(async (chromePage) => {
  const origin = new URL(chromePage.url()).origin
  if (engine === "webkit") {
    const browser = await webkit.launch()
    try {
      await run(origin, browser)
    } finally {
      await browser.close()
    }
  } else {
    await run(origin, chromePage.context().browser())
  }
})

if (failures.length > 0) {
  console.error(`\n${failures.length} dialog mobile check(s) failed`)
  process.exit(1)
}
