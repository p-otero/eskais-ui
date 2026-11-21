// Opens every kind of dialog, short and tall, on emulated phones, tablets, foldables and a narrow desktop window, under
// each viewport model (toolbars, stale innerHeight, scrolled visual viewport, keyboard, heading focus, pinch-zoom), and
// prints the matrix. The full one takes about 12 minutes: run it by hand. Usage: node tooling/dialog-mobile-check.mjs
// [--quick] [--engine=webkit|webkit26] [--screenshots=<dir>] [--color-scheme=dark] [--device=<s>] [--case=<s>] [--report=<file>]
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join, resolve } from "node:path"

import { webkit } from "playwright"

import { withShowcase } from "./showcase-browser.mjs"

const failures = []
const arg = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3)
const engine = arg("engine") ?? "chromium"
const webkit26Prefix = resolve(import.meta.dirname, ".webkit26")

// `webkit26`: WebKit 26.0, Safari 26's engine, which lays out a fixed `height: fit-content` box unlike the WebKit
// Playwright ships. Playwright drives only its own build, so install Playwright 1.56 once (git ignores the folder):
// npm i --prefix tooling/.webkit26 playwright-core@1.56.1 && npx --prefix tooling/.webkit26 playwright-core install webkit
function webkitEngine() {
  if (engine !== "webkit26") return webkit
  if (!existsSync(join(webkit26Prefix, "node_modules", "playwright-core"))) {
    console.error("WebKit 26 isn't installed: see webkitEngine in tooling/dialog-mobile-check.mjs.")
    process.exit(2)
  }
  return createRequire(join(webkit26Prefix, "package.json"))("playwright-core").webkit
}
const colorScheme = arg("color-scheme") ?? "light"
// CI's `--quick` (about 3 minutes) keeps every dialog, short and tall, on the devices and models marked `quick`:
// a small and a large iPhone, Android, a narrow desktop window, and the models that caught real bugs.
const quick = process.argv.includes("--quick")
const shots = arg("screenshots") ? resolve(arg("screenshots")) : undefined
if (shots) mkdirSync(shots, { recursive: true })

// matrix[device][case][model] = true while every check in that cell passes.
const matrix = new Map()

function check(cell, label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
  if (!cell) return
  const [device, item, model] = cell
  if (!matrix.has(device)) matrix.set(device, new Map())
  const row = matrix.get(device)
  if (!row.has(item)) row.set(item, new Map())
  row.get(item).set(model, (row.get(item).get(model) ?? true) && ok)
}

// `touch: false`: a desktop window, opened with the mouse, whose visual viewport never moves.
const devices = [
  { name: "iPhone SE", viewport: { width: 375, height: 667 }, quick: true },
  { name: "iPhone", viewport: { width: 393, height: 852 } },
  { name: "iPhone Max", viewport: { width: 430, height: 932 }, quick: true },
  { name: "iPhone SE landscape", viewport: { width: 667, height: 375 } },
  { name: "iPhone landscape", viewport: { width: 852, height: 393 } },
  { name: "iPhone Max landscape", viewport: { width: 932, height: 430 } },
  { name: "iPad", viewport: { width: 820, height: 1180 } },
  { name: "iPad split view", viewport: { width: 375, height: 1180 } },
  { name: "Android", viewport: { width: 412, height: 915 }, quick: true },
  { name: "Foldable folded", viewport: { width: 344, height: 882 } },
  { name: "Foldable open", viewport: { width: 673, height: 841 } },
  { name: "Desktop narrow", viewport: { width: 700, height: 800 }, touch: false, quick: true },
  // An iPhone 17 Pro in Safari 26 (iOS 26), as measured on one: 402 × 660 under the expanded floating toolbar, 768
  // with it collapsed. Under `--engine=webkit26` it shows a dialog cut off as that phone did.
  { name: "iPhone Safari 26", viewport: { width: 402, height: 660 } },
  { name: "iPhone Safari 26 collapsed", viewport: { width: 402, height: 768 } },
].filter((device, _, all) => {
  if (quick && !device.quick) return false
  const wanted = arg("device")?.toLowerCase()
  if (!wanted) return true
  // A whole name picks that device alone ("iPhone"); otherwise any name that contains it ("ipad").
  const exact = all.some((other) => other.name.toLowerCase() === wanted)
  return exact ? device.name.toLowerCase() === wanted : device.name.toLowerCase().includes(wanted)
})

const narrow = (device) => device.viewport.width <= 760

const button = (name) => (page) => page.getByRole("button", { name, exact: true }).first()
const matrixPath = (content) => `?demo=dialog-matrix-check&content=${content}`

// `field`: a text field to type in with the keyboard up. `scrolls`: its content is longer than a phone's screen, and
// scrolls inside a part that leaves the header and actions in view (`whole`: the content scrolls as one, a Drawer's).
// `dismissible: false`: an alert dialog, which a backdrop tap leaves open. `stage`: a part that must take at least
// half the screen's height, as a lightbox's image does. `narrowOnly`: it is a sheet only at `narrow:`.
const matrixCases = ["short", "tall"].flatMap((content) => {
  const tall = content === "tall"
  const base = { path: matrixPath(content), content, scrolls: tall }
  return [
    { ...base, name: "Dialog", trigger: button("Open dialog"), field: "Project name" },
    { ...base, name: "Dialog full", trigger: button("Open full dialog"), field: "Project name" },
    { ...base, name: "Dialog, heading focus", trigger: button("Open dialog with heading focus"), heading: true },
    { ...base, name: "ConfirmDialog", trigger: button("Open confirm"), dismissible: false },
    { ...base, name: "FormDialog", trigger: button("Open form dialog"), field: "Task title" },
    { ...base, name: "StepDialog", trigger: button("Open step dialog"), field: "Step project name" },
    { ...base, name: "CommandDialog", trigger: button("Open command palette"), field: "Run a command" },
    // A list to read, closed with Escape or a backdrop tap: it has no actions to keep in view.
    { ...base, name: "ShortcutsDialog", trigger: button("Open shortcuts"), actions: false },
    ...(tall
      ? []
      : [{ ...base, name: "Lightbox", trigger: button("Open lightbox"), stage: "[data-slot=lightbox-stage]" }]),
    { ...base, name: "Drawer bottom", trigger: button("Open bottom drawer"), field: "Drawer note", whole: true },
    { ...base, name: "Drawer right", trigger: button("Open side drawer"), field: "Drawer note", whole: true },
    {
      ...base,
      name: "SidePanel sheet",
      trigger: button("Open side panel"),
      field: "Panel note",
      whole: true,
      narrowOnly: true,
    },
  ]
})

const cases = [
  ...matrixCases,
  {
    name: "Dialog from a menu item",
    content: "app",
    path: "?demo=dialog-mobile-check",
    trigger: button("File actions"),
    menuItem: (page) => page.getByRole("menuitem", { name: "Rename file" }),
    field: "Notes",
  },
  { name: "TaskDetailDialog", content: "app", path: "?demo=task-dialog", scrolls: true, insetBody: true },
].filter((item) => !arg("case") || item.name.toLowerCase().includes(arg("case").toLowerCase()))

async function press(page, device, locator) {
  await locator.scrollIntoViewIfNeeded()
  if (device.touch === false) return locator.click()
  const box = await locator.boundingBox()
  return page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
}

function topDialog(page) {
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
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the page, which can't see module scope
  const name = (element) =>
    (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 40) || element.tagName
  const controls = [...dialog.querySelectorAll("button, a[href], input, textarea, [role=combobox]")].filter(visible)
  return {
    rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
    innerWidth,
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
    scrollers: scrollers.map((element) => {
      const before = element.scrollTop
      element.scrollTop = element.scrollHeight
      const moved = element.scrollTop > before
      element.scrollTop = before
      return { slot: element.dataset.slot ?? element.tagName, moved, whole: element === dialog }
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

// Where the dialog sits against the visible part of the page: its edges, its title, and every control that isn't
// inside a scroller (the header's and the actions'), which must all be in view.
function measureInViewport() {
  const dialog = [...document.querySelectorAll("[role=dialog], [role=alertdialog]")].findLast((d) =>
    d.checkVisibility(),
  )
  // A reported visible part can't end below the layout viewport at scale 1: what does is a stale report, and the
  // part you can see is then the same height, cut to the layout viewport.
  const layout = document.documentElement.clientHeight
  const top = Math.max(0, Math.min(visualViewport.offsetTop, layout - visualViewport.height))
  const bottom = Math.min(layout, top + visualViewport.height)
  const rect = dialog.getBoundingClientRect()
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the page, which can't see module scope
  const scrolls = (element) =>
    element.scrollHeight > element.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(element).overflowY)
  const fixed = [...dialog.querySelectorAll("button, a[href], input, textarea, [role=combobox]")]
    .filter((element) => element.checkVisibility() && element.getBoundingClientRect().width > 0)
    .filter((element) => {
      for (let node = element.parentElement; node && node !== dialog.parentElement; node = node.parentElement) {
        if (scrolls(node)) return false
      }
      return true
    })
  const outside = (element) => {
    const box = element.getBoundingClientRect()
    return box.top < top - 0.5 || box.bottom > bottom + 0.5
  }
  const title = dialog.querySelector("[data-slot$=title], h2")
  const owner = dialog.parentElement?.matches("[data-slot=drawer-viewport]") ? dialog.parentElement : dialog
  return {
    top,
    bottom,
    rect: { top: rect.top, bottom: rect.bottom },
    outside: fixed
      .filter(outside)
      .map((element) => (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().slice(0, 30)),
    fixedControls: fixed.length,
    titleOutside: title ? outside(title) : false,
    keyboard: dialog.hasAttribute("data-dialog-keyboard"),
    box: owner.style.getPropertyValue("--dialog-viewport-bottom"),
    focused: document.activeElement?.tagName.toLowerCase() ?? "",
    field:
      document.activeElement?.matches(
        "input:not([type=button], [type=checkbox], [type=radio]), textarea, [contenteditable]",
      ) ?? false,
  }
}

// iOS Safari's viewport, as fractions of the screen so no model depends on one toolbar's height: `visible` is how
// much of the layout viewport you can see, `offsetTop` how far the visible part is scrolled down it, and
// `innerHeight` what the page reads (iOS 26 can leave it stale; Android Chrome moves it with its toolbar).
// `quick`: kept by `--quick`.
const toolbarModels = [
  { name: "toolbars collapsed", visible: 1, offsetTop: 0 },
  { name: "toolbars expanded", visible: 0.88, offsetTop: 0 },
  { name: "innerHeight stale", visible: 0.88, offsetTop: 0, innerHeight: 0.88, quick: true },
  { name: "visual viewport scrolled", visible: 0.84, offsetTop: 0.05, quick: true },
  // iOS Safari can keep the keyboard's offsetTop after it closes, with the full height: a box past the layout one.
  { name: "offsetTop left by a closed keyboard", visible: 1, offsetTop: 0.4, quick: true },
].filter((model) => !quick || model.quick)

function simulateViewport({ height, offsetTop, innerHeight: reported, scale, width }) {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the page, which can't see module scope
  const define = (target, key, value) =>
    value !== undefined && Object.defineProperty(target, key, { configurable: true, get: () => value })
  const own = Object.getOwnPropertyDescriptor(window, "innerHeight")
  globalThis.restoreSimulatedViewport = () => {
    for (const key of ["height", "offsetTop", "scale", "width"]) delete visualViewport[key]
    if (own) Object.defineProperty(window, "innerHeight", own)
    else delete window.innerHeight
    visualViewport.dispatchEvent(new Event("resize"))
    dispatchEvent(new Event("resize"))
  }
  define(visualViewport, "height", height)
  define(visualViewport, "offsetTop", offsetTop)
  define(visualViewport, "scale", scale)
  define(visualViewport, "width", width)
  define(window, "innerHeight", reported)
  visualViewport.dispatchEvent(new Event("resize"))
  visualViewport.dispatchEvent(new Event("scroll"))
  dispatchEvent(new Event("resize"))
}

async function underModel(page, device, model, measureUnder) {
  const { height } = device.viewport
  await page.evaluate(simulateViewport, {
    height: Math.round(height * model.visible),
    offsetTop: Math.round(height * model.offsetTop),
    innerHeight: model.innerHeight === undefined ? undefined : Math.round(height * model.innerHeight),
  })
  await page.waitForTimeout(60)
  await settled(page)
  try {
    return await measureUnder()
  } finally {
    await page.evaluate(() => globalThis.restoreSimulatedViewport())
  }
}

function checkPlacement(cell, label, result, item) {
  const where = `dialog ${Math.round(result.rect.top)}-${Math.round(result.rect.bottom)}, visible ${Math.round(result.top)}-${Math.round(result.bottom)}`
  check(
    cell,
    `${label}: stays inside the visible part`,
    result.rect.top >= result.top - 0.5 && result.rect.bottom <= result.bottom + 0.5,
    where,
  )
  check(
    cell,
    `${label}: its title and actions are in view`,
    result.outside.length === 0 && !result.titleOutside,
    result.outside.length > 0 ? `outside: ${result.outside.join(", ")}` : result.titleOutside ? "title outside" : "",
  )
  if (item.scrolls && !item.whole && item.actions !== false) {
    check(cell, `${label}: its actions sit outside the scrolling body`, result.fixedControls > 0)
  }
}

async function checkModels(page, device, item, focus = "") {
  if (device.touch === false) return
  await inTurn(toolbarModels, (model) =>
    underModel(page, device, model, async () => {
      const cell = [device.name, caseName(item), focus ? `${model.name}, field focused` : model.name]
      const label = `${caseName(item)} ${device.name}: ${model.name}${focus}`
      const result = await page.evaluate(measureInViewport)
      checkPlacement(cell, label, result, item)
      // A field can't tell the toolbars from a short keyboard; with none focused it is never a keyboard.
      if (!result.field) check(cell, `${label}: isn't taken for a keyboard`, !result.keyboard)
    }),
  )
}

async function checkKeyboard(page, device, item) {
  if (!item.field || device.touch === false) return
  const dialog = topDialog(page)
  const input = dialog
    .getByLabel(item.field)
    .or(dialog.getByRole("combobox", { name: item.field }))
    .first()
  await press(page, device, input)
  // The keyboard covers the bottom; iOS can also scroll the visible part down the layout viewport.
  const keyboards = [
    { name: "keyboard up", visible: 0.55, offsetTop: 0 },
    { name: "keyboard up, visible part scrolled", visible: 0.5, offsetTop: 0.12, quick: true },
  ].filter((model) => !quick || model.quick)
  await inTurn(keyboards, (model) =>
    underModel(page, device, model, async () => {
      const cell = [device.name, caseName(item), model.name]
      const label = `${caseName(item)} ${device.name}: ${model.name}`
      const result = await page.evaluate(() => {
        const content = [...document.querySelectorAll("[role=dialog], [role=alertdialog]")].findLast((d) =>
          d.checkVisibility(),
        )
        const rect = content.getBoundingClientRect()
        const focused = document.activeElement.getBoundingClientRect()
        return {
          top: visualViewport.offsetTop,
          bottom: visualViewport.offsetTop + visualViewport.height,
          rect: { top: rect.top, bottom: rect.bottom },
          fieldTop: focused.top,
          fieldBottom: focused.bottom,
          inside: content.contains(document.activeElement),
        }
      })
      check(
        cell,
        `${label}: the dialog stays above the keyboard`,
        result.rect.top >= result.top - 0.5 && result.rect.bottom <= result.bottom + 0.5,
        `dialog ${Math.round(result.rect.top)}-${Math.round(result.rect.bottom)}, visible ${Math.round(result.top)}-${Math.round(result.bottom)}`,
      )
      check(
        cell,
        `${label}: the field typed in is in view`,
        result.inside &&
          result.fieldTop >= Math.max(result.rect.top, result.top) - 0.5 &&
          result.fieldBottom <= result.bottom + 0.5,
        `field ${Math.round(result.fieldTop)}-${Math.round(result.fieldBottom)}`,
      )
      if (shots)
        await page.screenshot({
          path: join(shots, `${slug(caseName(item))}-${slug(device.name)}-${slug(model.name)}.png`),
        })
    }),
  )
  await page.waitForTimeout(150)
  await checkModels(page, device, item, ", field focused")
}

// Pinch-zoomed, the visual viewport is a window into the page, not the page's frame: the dialog stays where it was,
// on the box measured before the zoom.
async function checkPinchZoom(page, device, item, before) {
  if (device.touch === false || quick) return
  const { height, width } = device.viewport
  const cell = [device.name, caseName(item), "pinch-zoom"]
  await page.evaluate(simulateViewport, {
    height: Math.round(height / 2),
    width: Math.round(width / 2),
    offsetTop: Math.round(height / 4),
    scale: 2,
  })
  await page.waitForTimeout(60)
  await settled(page)
  const after = await page.evaluate(measureInViewport)
  await page.evaluate(() => globalThis.restoreSimulatedViewport())
  const label = `${caseName(item)} ${device.name}: pinch-zoom`
  check(
    cell,
    `${label}: the visible part written before stays`,
    after.box === before.box,
    `${before.box} -> ${after.box}`,
  )
  check(
    cell,
    `${label}: the dialog stays put in the layout viewport`,
    Math.abs(after.rect.top - before.rect.top) <= 1 && after.rect.bottom <= height + 0.5,
    `${Math.round(before.rect.top)} -> ${Math.round(after.rect.top)}`,
  )
}

function slug(name) {
  return name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")
}

function caseName(item) {
  return item.content === "app" ? item.name : `${item.name} (${item.content})`
}

// Runs the steps one after another: each drives the same page.
function inTurn(items, step) {
  return items.reduce((previous, item) => previous.then(() => step(item)), Promise.resolve())
}

function waitsFor(locator, options) {
  return locator
    .waitFor(options)
    .then(() => true)
    .catch(() => false)
}

// The dialog has stopped moving: its enter transition, a drawer's snap, or a move after a viewport change. Polls the
// rect rather than the animations, which a busy WebKit can start late.
function settled(page) {
  return page
    .waitForFunction(
      () => {
        const dialog = [...document.querySelectorAll("[role=dialog], [role=alertdialog]")].findLast((d) =>
          d.checkVisibility(),
        )
        if (!dialog || document.querySelector("[data-starting-style]")) return false
        // Where a transition ends is what's measured, not how long a busy browser takes to get there.
        for (const animation of document.getAnimations()) {
          if (
            animation instanceof CSSTransition &&
            animation.effect?.target?.closest?.("[role=dialog], [role=alertdialog]")
          )
            animation.finish()
        }
        const { top, bottom } = dialog.getBoundingClientRect()
        const key = `${String(Math.round(top))} ${String(Math.round(bottom))}`
        const now = performance.now()
        const last = globalThis.lastDialogRect
        const moving = document
          .getAnimations()
          .some(
            (animation) =>
              animation.playState === "running" &&
              animation.effect?.getTiming().iterations !== Infinity &&
              dialog.parentElement?.contains(animation.effect?.target ?? null),
          )
        if (moving || last?.key !== key) {
          globalThis.lastDialogRect = { key, since: now, frames: 0 }
          return false
        }
        last.frames += 1
        return last.frames >= 4 && now - last.since > 100
      },
      undefined,
      { timeout: 2500, polling: "raf" },
    )
    .catch(() => {})
}

async function open(page, device, item) {
  if (!item.trigger) return 0
  const trigger = item.trigger(page)
  await trigger.scrollIntoViewIfNeeded()
  const scrolled = await page.evaluate(() => scrollY)
  await press(page, device, trigger)
  if (item.menuItem) {
    const next = item.menuItem(page)
    await next.waitFor()
    await page.waitForTimeout(200)
    await press(page, device, next)
  }
  return scrolled
}

function checkGeometry(cell, label, item, device, geometry, scrolled) {
  const { rect } = geometry
  check(
    cell,
    `${label}: the page keeps the screen's width`,
    geometry.innerWidth === device.viewport.width && geometry.pageOverflow <= 0,
    `layout viewport ${geometry.innerWidth}px, page ${geometry.pageOverflow}px wider`,
  )
  check(
    cell,
    `${label}: within the screen`,
    rect.left >= -0.5 &&
      rect.top >= -0.5 &&
      rect.right <= device.viewport.width + 0.5 &&
      rect.bottom <= device.viewport.height + 0.5,
    [rect.left, rect.top, rect.right, rect.bottom].map(Math.round).join(", "),
  )
  check(cell, `${label}: nothing overflows it sideways`, geometry.sideways.length === 0, geometry.sideways.join(", "))
  if (item.scrolls) {
    const inside = geometry.scrollers.filter((scroller) => scroller.moved && (item.whole || !scroller.whole))
    check(cell, `${label}: long content scrolls inside it`, inside.length > 0, JSON.stringify(geometry.scrollers))
  }
  if (!item.heading) check(cell, `${label}: focus is inside`, geometry.focusInside, geometry.focused)
  check(
    cell,
    `${label}: opening left the page where it was`,
    geometry.scrollY === scrolled,
    `${scrolled} -> ${geometry.scrollY}`,
  )
  // The hit area grows on a coarse pointer only, as the `touch-target` class does.
  if (device.touch === false) return
  check(
    cell,
    `${label}: an icon close button has a 44px hit area`,
    geometry.smallClose.length === 0,
    geometry.smallClose.join(", "),
  )
}

async function checkStage(cell, label, page, item, device) {
  if (!item.stage) return
  const height = await page.locator(item.stage).evaluate((element) => element.getBoundingClientRect().height)
  check(
    cell,
    `${label}: ${item.stage} takes at least half the screen`,
    height >= device.viewport.height / 2,
    `${Math.round(height)}px`,
  )
}

function outsidePoint({ rect }, { width, height }) {
  const points = [
    [width / 2, 4],
    [4, height / 2],
    [width - 4, height / 2],
    [width / 2, height - 4],
  ]
  return points.find(([x, y]) => x < rect.left || x > rect.right || y < rect.top || y > rect.bottom)
}

async function close(cell, label, page, device, item, geometry) {
  const point = outsidePoint(geometry, device.viewport)
  if (point) {
    await page.mouse.move(point[0], point[1])
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(200)
    const after = await page.evaluate(() => scrollY)
    check(
      cell,
      `${label}: the page behind doesn't scroll`,
      after === geometry.scrollY,
      `${geometry.scrollY} -> ${after}`,
    )
  }
  if (point && item.dismissible !== false) {
    if (device.touch === false) await page.mouse.click(point[0], point[1])
    else await page.touchscreen.tap(point[0], point[1])
    const closed = await waitsFor(topDialog(page), { state: "hidden", timeout: 2000 })
    check(cell, `${label}: a backdrop tap closes it`, closed, `tapped ${point.map(Math.round).join(", ")}`)
    if (closed) return
  }
  await page.keyboard.press("Escape")
  await waitsFor(topDialog(page), { state: "hidden", timeout: 2000 })
}

async function checkCase(page, device, item) {
  const label = `${caseName(item)} ${device.name}`
  const cell = [device.name, caseName(item), "opened"]
  const scrolled = await open(page, device, item)
  const opened = await waitsFor(topDialog(page), { timeout: 3000 })
  check(cell, `${label}: opens`, opened)
  if (!opened) return
  await settled(page)
  if (item.heading) {
    const focused = await page.evaluate(() => document.activeElement?.matches("[data-matrix-heading]") ?? false)
    check(cell, `${label}: the heading took focus`, focused)
  }
  const geometry = await page.evaluate(measure)
  checkGeometry(cell, label, item, device, geometry, scrolled)
  await checkStage(cell, label, page, item, device)
  if (item.insetBody) {
    // A flush content drops the body's own inset; a body that pads itself keeps its sides off the dialog's edge.
    const inset = await page.evaluate(() => {
      const body = document.querySelector('[role="dialog"] [data-slot="dialog-body"]')
      return body ? Number.parseFloat(getComputedStyle(body).paddingLeft) : 0
    })
    check(cell, `${label}: the body keeps its side inset`, inset >= 12, `${String(inset)}px`)
  }
  if (shots) await page.screenshot({ path: join(shots, `${slug(caseName(item))}-${slug(device.name)}.png`) })
  const before = await page.evaluate(measureInViewport)
  checkPlacement(cell, label, before, item)
  await checkModels(page, device, item)
  await checkPinchZoom(page, device, item, before)
  await checkKeyboard(page, device, item)
  await close(cell, label, page, device, item, geometry)
}

async function checkDevice(browser, origin, device) {
  const context = await browser.newContext({
    viewport: device.viewport,
    deviceScaleFactor: device.touch === false ? 1 : 3,
    hasTouch: device.touch !== false,
    isMobile: engine === "chromium" && device.touch !== false,
    colorScheme,
  })
  const byPath = Map.groupBy(
    cases.filter((item) => !item.narrowOnly || narrow(device)),
    (item) => item.path ?? "",
  )
  await inTurn([...byPath], async ([path, items]) => {
    const page = await context.newPage()
    page.setDefaultTimeout(10_000)
    const errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(`${origin}/${path}`)
    // The showcase keeps its own appearance over the emulated scheme, so dark mode is set the way `Appearance` does.
    if (colorScheme === "dark") await page.evaluate(() => document.documentElement.classList.add("dark"))
    await page.evaluate(() => document.fonts.ready)
    await inTurn(items, (item) => checkCase(page, device, item))
    check(null, `${device.name} ${path || "/"}: no page errors`, errors.length === 0, errors.join("; "))
    await page.close()
  })
  await context.close()
}

// Chromium runs a few devices at once, each in its own context. Headless WebKit stops running frames for the
// contexts in the background, which stalls a drawer's slide, so it takes them one at a time.
async function run(origin, browser) {
  const queue = [...devices]
  const worker = async () => {
    // oxlint-disable-next-line no-await-in-loop -- a worker takes the next device once its current one is done
    for (let device = queue.shift(); device; device = queue.shift()) await checkDevice(browser, origin, device)
  }
  await Promise.all(Array.from({ length: engine.startsWith("webkit") ? 1 : 3 }, worker))
}

function printMatrix() {
  const models = new Set()
  for (const row of matrix.values())
    for (const cells of row.values()) for (const model of cells.keys()) models.add(model)
  const report = {}
  console.log(`\nMatrix (${engine}${quick ? ", quick" : ""}): ✓ every check passed, ✗ one failed, · not applicable`)
  for (const [device, row] of matrix) {
    report[device] = {}
    console.log(`\n${device}`)
    for (const [item, cells] of row) {
      report[device][item] = Object.fromEntries(cells)
      const marks = [...models].map((model) => (cells.has(model) ? (cells.get(model) ? "✓" : "✗") : "·")).join(" ")
      console.log(`  ${marks}  ${item}`)
    }
  }
  console.log(`\nColumns: ${[...models].join(" | ")}`)
  if (arg("report"))
    writeFileSync(resolve(arg("report")), JSON.stringify({ engine, models: [...models], report }, null, 2))
}

await withShowcase(async (chromePage) => {
  const origin = new URL(chromePage.url()).origin
  if (engine.startsWith("webkit")) {
    const browser = await webkitEngine().launch()
    try {
      await run(origin, browser)
    } finally {
      await browser.close()
    }
  } else {
    await run(origin, chromePage.context().browser())
  }
})

printMatrix()

if (failures.length > 0) {
  console.error(`\n${failures.length} dialog mobile check(s) failed`)
  process.exit(1)
}
