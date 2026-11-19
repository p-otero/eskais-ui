// Drives ?demo=voice-input-check on Chrome's fake microphone: the level follows the audio with no React commits, frames
// stop and every AudioContext closes on finish, Escape and unmount, reduced motion steps, right to left, 390px, and a
// denied permission. Usage: node tooling/voice-input-check.mjs [--screenshots=<dir>] (after `bun run build:showcase`)
/* oxlint-disable no-await-in-loop -- one page drives the steps in order, each at its own viewport and theme */
import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"

import { withShowcase } from "./showcase-browser.mjs"

const failures = []
const shotsArg = process.argv.find((arg) => arg.startsWith("--screenshots="))
const shots = shotsArg ? resolve(shotsArg.slice("--screenshots=".length)) : undefined
if (shots) mkdirSync(shots, { recursive: true })

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

const fakeMicrophone = [
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
  "--autoplay-policy=no-user-gesture-required",
]

// Counts React commits (through the DevTools hook, which production builds call too) and animation frame requests,
// and keeps every AudioContext the page makes, before any page script runs.
function probe() {
  const counts = { frames: 0, commits: 0 }
  let renderers = 0
  // oxlint-disable-next-line no-underscore-dangle -- React's DevTools hook, which production builds call on each commit
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map(),
    supportsFiber: true,
    inject(renderer) {
      renderers += 1
      this.renderers.set(renderers, renderer)
      return renderers
    },
    onCommitFiberRoot() {
      counts.commits += 1
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
  }
  const request = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (callback) => {
    counts.frames += 1
    return request(callback)
  }
  const contexts = []
  const Native = window.AudioContext
  window.AudioContext = class extends Native {
    constructor(...args) {
      super(...args)
      contexts.push(this)
    }
  }
  window.voiceProbe = { counts, contexts }
}

async function open(page, motion = "no-preference") {
  await page.emulateMedia({ reducedMotion: motion })
  await page.goto(`${new URL(page.url()).origin}/?demo=voice-input-check`)
  await page.getByRole("group", { name: "Live button" }).waitFor()
}

const live = (page, variant) => page.getByRole("group", { name: `Live ${variant}` })
const toggle = (page, variant) => live(page, variant).getByRole("button", { name: "Dictate" })
const stateOf = (page, variant) => live(page, variant).getAttribute("data-state")
const frames = (page) => page.evaluate(() => window.voiceProbe.counts.frames)
const commits = (page) => page.evaluate(() => window.voiceProbe.counts.commits)
const contextsClosed = (page) =>
  page.evaluate(() => window.voiceProbe.contexts.map((context) => context.state).filter((state) => state !== "closed"))

async function listen(page, variant) {
  await toggle(page, variant).click()
  await page.waitForFunction(
    (name) => document.querySelector(`[aria-label="Live ${name}"]`)?.getAttribute("data-state") === "listening",
    variant,
  )
}

// Reads the root's --voice-level every 40 ms.
function sampleLevel(page, variant, ms) {
  return live(page, variant).evaluate(
    (el, duration) =>
      new Promise((done) => {
        const seen = []
        const timer = setInterval(() => seen.push(el.style.getPropertyValue("--voice-level")), 40)
        setTimeout(() => {
          clearInterval(timer)
          done(seen)
        }, duration)
      }),
    ms,
  )
}

async function framesOver(page, ms) {
  const before = await frames(page)
  await page.waitForTimeout(ms)
  return (await frames(page)) - before
}

async function level(page) {
  await page.addInitScript(probe)
  await open(page)
  await listen(page, "button")
  await page.waitForTimeout(300)
  const before = await commits(page)
  const values = (await sampleLevel(page, "button", 2500)).filter(Boolean).map(Number)
  const committed = (await commits(page)) - before
  const spread = Math.max(...values) - Math.min(...values)
  check(
    "--voice-level follows the fake microphone's beeps",
    values.length > 20 && spread > 0.2,
    `range ${spread.toFixed(2)} over ${String(values.length)} samples`,
  )
  check("listening commits nothing to React for 2.5 s", committed === 0, `${String(committed)} commits`)
  const running = await framesOver(page, 500)
  check("frames run while listening", running >= 20, `${String(running)} in 500 ms`)

  await toggle(page, "button").press("Enter")
  check("Enter finishes listening", (await stateOf(page, "button")) === "processing")
  await page.waitForTimeout(150)
  const after = await framesOver(page, 600)
  check("frames stop once listening finishes", after <= 1, `${String(after)} in 600 ms`)
  check(
    "the level is cleared",
    (await live(page, "button").evaluate((el) => el.style.getPropertyValue("--voice-level"))) === "",
  )
  check(
    "every AudioContext is closed",
    (await contextsClosed(page)).length === 0,
    (await contextsClosed(page)).join(", "),
  )
}

async function bar(page) {
  await page.addInitScript(probe)
  await open(page)
  await listen(page, "bar")
  await page.waitForTimeout(300)
  const before = await commits(page)
  const bars = await live(page, "bar").evaluate(
    (el) =>
      new Promise((done) => {
        const seen = new Set()
        const timer = setInterval(() => seen.add(el.style.getPropertyValue("--voice-bar-23")), 40)
        setTimeout(() => {
          clearInterval(timer)
          done([...seen])
        }, 2500)
      }),
  )
  const committed = (await commits(page)) - before
  check("the newest bar moves with the audio", bars.length > 3, `${String(bars.length)} distinct values`)
  check(
    "the bar's timer is the only commit, once a second",
    committed >= 2 && committed <= 3,
    `${String(committed)} commits in 2.5 s`,
  )
  check("the timer counts", /^0:0[2-4]$/.test(await live(page, "bar").locator("time").innerText()))

  await toggle(page, "bar").focus()
  await page.keyboard.press("Escape")
  check("Escape cancels", (await stateOf(page, "bar")) === "idle")
  check("focus stays on the toggle", await toggle(page, "bar").evaluate((el) => el === document.activeElement))
  await page.waitForTimeout(150)
  check("frames stop after Escape", (await framesOver(page, 600)) <= 1)
  check("every AudioContext is closed after Escape", (await contextsClosed(page)).length === 0)

  await listen(page, "bar")
  await live(page, "bar").getByRole("button", { name: "Cancel recording" }).click()
  check(
    "the cancel button cancels and hands focus to the toggle",
    (await stateOf(page, "bar")) === "idle" &&
      (await toggle(page, "bar").evaluate((el) => el === document.activeElement)),
  )

  await listen(page, "button")
  await listen(page, "bar")
  await page.getByRole("button", { name: "Remove live inputs" }).click()
  await page.waitForTimeout(150)
  check("unmounting while listening stops the frames", (await framesOver(page, 600)) <= 1)
  check("and closes every AudioContext", (await contextsClosed(page)).length === 0)
}

async function reducedMotion(page) {
  await page.addInitScript(probe)
  await open(page, "reduce")
  await listen(page, "button")
  const values = [...new Set((await sampleLevel(page, "button", 2500)).filter(Boolean))]
  check(
    "under reduced motion the level takes quarter steps",
    values.length > 0 && values.every((value) => Number(value) * 4 === Math.round(Number(value) * 4)),
    values.join(" "),
  )
  await listen(page, "bar")
  const profile = await live(page, "bar").evaluate((el) => {
    const read = () =>
      ["--voice-bar-0", "--voice-bar-11", "--voice-bar-23"].map((name) => Number(el.style.getPropertyValue(name)))
    return new Promise((done) => {
      const timer = setInterval(() => {
        const bars = read()
        if (bars[1] > 0) {
          clearInterval(timer)
          done(bars)
        }
      }, 20)
      setTimeout(() => {
        clearInterval(timer)
        done(read())
      }, 3000)
    })
  })
  check(
    "and the bars hold a still hump",
    profile[1] > 0 && profile[1] > profile[0] && profile[1] > profile[2],
    profile.join(" "),
  )
}

async function layout(page) {
  await open(page)
  await page.evaluate(() => document.documentElement.setAttribute("dir", "rtl"))
  const [toggleBox, waveBox] = await Promise.all([
    toggle(page, "bar").boundingBox(),
    live(page, "bar").locator("[data-slot=voice-input-waveform]").boundingBox(),
  ])
  check("right to left puts the toggle at the start, on the left", toggleBox.x < waveBox.x)
  await page.evaluate(() => document.documentElement.removeAttribute("dir"))
  for (const density of ["default", "compact"]) {
    await page.setViewportSize({ width: 390, height: 900 })
    await page.evaluate((value) => document.documentElement.setAttribute("data-density", value), density)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    check(`nothing overflows at 390px, ${density} density`, overflow <= 0, `${String(overflow)}px`)
  }
  await page.evaluate(() => document.documentElement.removeAttribute("data-density"))
}

async function screenshots(page) {
  await open(page)
  for (const width of [390, 1440]) {
    for (const mode of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 })
      await page.evaluate((dark) => {
        document.documentElement.classList.toggle("dark", dark)
        document.documentElement.classList.toggle("light", !dark)
        document.documentElement.setAttribute("data-color-scheme", dark ? "dark" : "light")
      }, mode === "dark")
      if ((await stateOf(page, "button")) !== "listening") await listen(page, "button")
      if ((await stateOf(page, "bar")) !== "listening") await listen(page, "bar")
      await page.mouse.move(0, 0)
      await page.waitForTimeout(700)
      const file = join(shots, `voice-input-${mode}-${String(width)}.png`)
      await page.screenshot({ path: file, fullPage: true })
      console.log(`     ${file}`)
    }
  }
}

await withShowcase(
  async (page) => {
    await level(page)
    await bar(page)
    await reducedMotion(page)
    await layout(page)
    if (shots) await screenshots(page)
  },
  {},
  { args: fakeMicrophone },
)

await withShowcase(
  async (page) => {
    await open(page)
    await toggle(page, "button").click()
    await page.waitForFunction(
      () => document.querySelector('[aria-label="Live button"]')?.getAttribute("data-state") === "denied",
    )
    check("without permission the microphone is denied", (await stateOf(page, "button")) === "denied")
    await page.getByRole("group", { name: "Live bar" }).getByRole("button", { name: "Dictate" }).click()
    await page.waitForFunction(
      () => document.querySelector('[aria-label="Live bar"]')?.getAttribute("data-state") === "denied",
    )
    check("and the bar says so", (await live(page, "bar").innerText()).includes("Microphone access denied"))
  },
  {},
  { args: ["--use-fake-device-for-media-stream"] },
)

if (failures.length > 0) {
  console.error(`\n${String(failures.length)} voice input check(s) failed`)
  process.exit(1)
}
