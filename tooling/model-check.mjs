// ModelViewer and ModelScan in Chrome (WebGL through SwiftShader): the three.js chunk loads only near a viewer; the
// canvas draws nothing idle, off screen or hidden; morphing commits React once; the scan ends at three-quarter, and
// reduced motion crossfades with no particles; nothing overflows at 390 and 1440 px.
// Usage: node tooling/model-check.mjs [--screenshots=<dir>] (after `bun run build:showcase`)
/* oxlint-disable no-await-in-loop -- each width, mode and stage is measured in turn on one page */
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

const threeChunk = /model-viewer-(scene|rig)|model-scan-intro|\.glb$/

// Counts WebGL draws, and the ones that draw points (the particles), on every context the page makes, and React
// commits through the DevTools hook (React DOM's and react-three-fiber's renderer both report there, in production).
const countDraws = () => {
  globalThis.reactCommits = 0
  let renderers = 0
  // oxlint-disable-next-line no-underscore-dangle -- the name React looks for
  globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map(),
    supportsFiber: true,
    isDisabled: false,
    inject(renderer) {
      renderers += 1
      this.renderers.set(renderers, renderer)
      return renderers
    },
    onCommitFiberRoot() {
      globalThis.reactCommits += 1
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
  }
  globalThis.modelDraws = { all: 0, points: 0 }
  for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    for (const name of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
      const original = proto[name]
      if (!original) continue
      proto[name] = function draw(mode, ...rest) {
        globalThis.modelDraws.all += 1
        if (mode === 0) globalThis.modelDraws.points += 1
        return original.call(this, mode, ...rest)
      }
    }
  }
}

const draws = (page) => page.evaluate(() => ({ ...globalThis.modelDraws }))
async function drawsDuring(page, ms) {
  const before = await draws(page)
  await page.waitForTimeout(ms)
  const after = await draws(page)
  return { all: after.all - before.all, points: after.points - before.points }
}

function trackRequests(page) {
  const urls = []
  const listener = (request) => urls.push(request.url())
  page.on("request", listener)
  return { urls, stop: () => page.off("request", listener) }
}

async function open(page, { width, mode = "light", query = "", reducedMotion = "no-preference" }) {
  await page.setViewportSize({ width, height: 1000 })
  await page.emulateMedia({ reducedMotion })
  await page.goto(`${new URL(page.url()).origin}/?demo=model-check${query}`)
  await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), mode === "dark")
}

const viewer = (page) => page.getByTestId("viewer").locator("[data-slot=model-viewer]")
const scanRoot = (page) => page.getByTestId("scan").locator("[data-slot=model-scan]")

async function viewerReady(page) {
  await viewer(page).and(page.locator("[data-status=ready]")).waitFor({ timeout: 20_000 })
  await page.waitForTimeout(400)
}

async function overflow(page) {
  return page.evaluate(() => {
    const viewport = document.documentElement.clientWidth
    const wide = document.documentElement.scrollWidth > viewport
    const parts = [...document.querySelectorAll("[data-slot=model-viewer], [data-slot=model-scan]")].filter((root) => {
      const rect = root.getBoundingClientRect()
      return root.scrollWidth > root.clientWidth + 1 || rect.right > viewport + 0.5 || rect.left < -0.5
    })
    return { page: wide, parts: parts.map((part) => part.getAttribute("aria-label")) }
  })
}

async function runScan(page, { capture } = {}) {
  await page.getByRole("button", { name: "Start scan" }).click()
  const seen = []
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const stage = await scanRoot(page).getAttribute("data-stage")
    if (stage !== seen.at(-1)) {
      seen.push(stage)
      await capture?.(stage)
    }
    if (stage === "ready" || stage === "error") break
    await page.waitForTimeout(50)
  }
  return seen
}

const scanCamera = (page) => page.getByTestId("scan").locator("canvas").getAttribute("data-camera")

await withShowcase(
  async (page) => {
    await page.addInitScript(countDraws)

    // Pages that render no viewer never ask for the three.js chunk or the model.
    for (const demo of ["image-scan-check", "page"]) {
      const requests = trackRequests(page)
      await page.goto(`${new URL(page.url()).origin}/?demo=${demo}`)
      await page.waitForTimeout(1500)
      requests.stop()
      const loaded = requests.urls.filter((url) => threeChunk.test(url))
      check(`?demo=${demo} loads no three.js chunk`, loaded.length === 0, loaded.join(", "))
    }

    // The showcase renders a viewer far below the fold: its chunk waits until the section nears the viewport.
    {
      await page.setViewportSize({ width: 1440, height: 900 })
      const requests = trackRequests(page)
      await page.goto(new URL(page.url()).origin)
      await page.waitForTimeout(2000)
      const early = requests.urls.filter((url) => threeChunk.test(url))
      check(
        "the showcase defers the three.js chunk while the viewer is off screen",
        early.length === 0,
        early.join(", "),
      )
      await page.getByRole("heading", { name: "Model viewer" }).scrollIntoViewIfNeeded()
      await page.waitForFunction(
        () => document.querySelector("[data-slot=model-viewer]")?.getAttribute("data-status") === "ready",
        undefined,
        { timeout: 20_000 },
      )
      requests.stop()
      check(
        "scrolled near, the viewer loads its chunk and the model",
        requests.urls.some((url) => /model-viewer-scene/.test(url)) &&
          requests.urls.some((url) => url.endsWith(".glb")),
      )
    }

    await open(page, { width: 1440 })
    await viewerReady(page)
    const playing = await drawsDuring(page, 600)
    check("a playing clip keeps drawing", playing.all > 10, JSON.stringify(playing))

    // Scrolled away, nothing draws; back in view, the clip goes on.
    await page.getByTestId("spacer").evaluate((element) => element.scrollIntoView({ block: "end" }))
    await page.waitForTimeout(300)
    const away = await drawsDuring(page, 1000)
    check("off screen, the canvas draws nothing", away.all === 0, JSON.stringify(away))
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(300)
    check("back in view, it draws again", (await drawsDuring(page, 500)).all > 5)

    // A hidden tab stops it too, whatever the browser does with its frames.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await page.waitForTimeout(200)
    const hidden = await drawsDuring(page, 1000)
    check("in a hidden tab, the canvas draws nothing", hidden.all === 0, JSON.stringify(hidden))
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" })
      document.dispatchEvent(new Event("visibilitychange"))
    })

    // Paused, the viewer goes idle; morphing draws until the weights arrive, with one React commit for the click.
    await page.getByRole("button", { name: "Play animation" }).click()
    await page.waitForTimeout(600)
    const idle = await drawsDuring(page, 1000)
    check("paused and still, the canvas draws nothing", idle.all === 0, JSON.stringify(idle))
    const commitsBefore = await page.evaluate(() => globalThis.reactCommits)
    const drawsBefore = await draws(page)
    await page.getByRole("button", { name: "Morph", exact: true }).click()
    await page.waitForTimeout(1200)
    const morphDraws = (await draws(page)).all - drawsBefore.all
    const commits = (await page.evaluate(() => globalThis.reactCommits)) - commitsBefore
    check("morphing draws frame after frame", morphDraws > 10, String(morphDraws))
    // The click's commit in React DOM, and the scene's in react-three-fiber, which gets the new weights.
    check(
      "morphing commits React once, not per frame",
      commits <= 3,
      `${String(commits)} commits, ${String(morphDraws)} draws`,
    )
    const settled = await drawsDuring(page, 800)
    check("once the weights arrive, drawing stops", settled.all === 0, JSON.stringify(settled))

    // A new model fades in over the old one: frames while it does, a few commits (the click, the load, the end),
    // none per frame, and stillness after.
    {
      const requests = trackRequests(page)
      const swapCommitsBefore = await page.evaluate(() => globalThis.reactCommits)
      const swapDrawsBefore = await draws(page)
      await page.getByRole("button", { name: "Swap model" }).click()
      await page.waitForTimeout(1500)
      requests.stop()
      const swapDraws = (await draws(page)).all - swapDrawsBefore.all
      const swapCommits = (await page.evaluate(() => globalThis.reactCommits)) - swapCommitsBefore
      check(
        "a new model loads",
        requests.urls.some((url) => /figure-final.*\.glb$/.test(url)),
      )
      check("the swap draws while the new model fades in", swapDraws > 10, String(swapDraws))
      check(
        "the swap commits React a few times, not per frame",
        swapCommits <= 8,
        `${String(swapCommits)} commits, ${String(swapDraws)} draws`,
      )
      const after = await drawsDuring(page, 800)
      check("once swapped, drawing stops", after.all === 0, JSON.stringify(after))
    }

    // Keys on the stage turn the camera, which comes to rest where they put it.
    await page.getByTestId("viewer").locator("[data-slot=model-viewer-stage]").focus()
    await page.keyboard.press("ArrowRight")
    await page.waitForFunction(
      () => document.querySelector("[data-testid=viewer] canvas")?.dataset.camera === "-15.0 0.0 1.00",
      undefined,
      { timeout: 5000 },
    )
    check("an arrow turns the camera 15°", true)

    // The scan: the camera ends at three-quarter, after a flight drawn with particles.
    await open(page, { width: 1440, query: "&speed=2" })
    const points = { before: (await draws(page)).points }
    const stages = await runScan(page)
    check("the scan runs every stage", stages.join(",") === "detecting,building,refining,ready", stages.join(","))
    await scanRoot(page).and(page.locator("[data-intro=done]")).waitFor({ timeout: 15_000 })
    await page.waitForFunction(
      () => document.querySelector("[data-testid=scan] canvas")?.dataset.camera === "35.0 8.0 1.00",
      undefined,
      { timeout: 8000 },
    )
    check("the scan's camera ends at the three-quarter view", (await scanCamera(page)) === "35.0 8.0 1.00")
    points.after = (await draws(page)).points
    check("the transition draws particles", points.after - points.before > 0, String(points.after - points.before))
    check(
      "ready, the scan hands over to the viewer's controls",
      await page.getByTestId("scan").getByRole("group", { name: "3D view controls" }).isVisible(),
    )

    // Reduced motion: a crossfade, no particles and no camera flight, and the progress bar shows while building.
    await open(page, { width: 1440, query: "&speed=2", reducedMotion: "reduce" })
    const reducedBefore = (await draws(page)).points
    let barWhileBuilding = false
    await runScan(page, {
      capture: async (stage) => {
        if (stage === "building") barWhileBuilding = await page.getByTestId("scan").getByRole("progressbar").isVisible()
      },
    })
    await scanRoot(page).and(page.locator("[data-intro=done]")).waitFor({ timeout: 15_000 })
    await page.waitForTimeout(300)
    check("reduced motion: the progress bar shows while building", barWhileBuilding)
    check("reduced motion: no particles", (await draws(page)).points - reducedBefore === 0)
    check("reduced motion: the camera jumps to the three-quarter view", (await scanCamera(page)) === "35.0 8.0 1.00")
    check(
      "reduced motion: the clip waits, paused",
      (await page.getByTestId("scan").getByRole("button", { name: "Play animation" }).getAttribute("aria-pressed")) ===
        "false",
    )

    for (const width of [390, 1440]) {
      for (const mode of ["light", "dark"]) {
        const label = `${String(width)} px ${mode}`
        await open(page, { width, mode })
        await viewerReady(page)
        const result = await overflow(page)
        check(`${label}: nothing overflows`, !result.page && result.parts.length === 0, result.parts.join(", "))
        if (shots)
          await page
            .getByTestId("viewer")
            .screenshot({ path: join(shots, `model-viewer-${String(width)}-${mode}.png`) })
        if (!shots) continue
        await page
          .getByTestId("scan")
          .screenshot({ path: join(shots, `model-scan-${String(width)}-${mode}-photo.png`) })
        await runScan(page, {
          capture: async (stage) => {
            if (stage === "detecting") await page.waitForTimeout(500)
            if (stage === "refining") await page.waitForTimeout(600)
            await page
              .getByTestId("scan")
              .screenshot({ path: join(shots, `model-scan-${String(width)}-${mode}-${stage}.png`) })
          },
        })
        await page.waitForTimeout(2500)
        await page
          .getByTestId("scan")
          .screenshot({ path: join(shots, `model-scan-${String(width)}-${mode}-ready-settled.png`) })
        const after = await overflow(page)
        check(`${label}: nothing overflows once the scan is ready`, !after.page && after.parts.length === 0)
        await open(page, { width, mode, query: "&fail" })
        await runScan(page)
        await page
          .getByTestId("scan")
          .screenshot({ path: join(shots, `model-scan-${String(width)}-${mode}-error.png`) })
      }
    }

    // A frame sequence of the hand-over: the last 2D frame, then the 3D one, then the flight.
    if (shots) {
      await open(page, { width: 1440 })
      await runScan(page, {
        capture: async (stage) => {
          if (stage !== "building") return
          const frame = page.getByTestId("scan").locator("[data-slot=model-viewer-stage]")
          for (let index = 0; index < 16; index += 1) {
            await frame.screenshot({ path: join(shots, `model-scan-transition-${String(index).padStart(2, "0")}.png`) })
            await page.waitForTimeout(120)
          }
        },
      })
    }
  },
  {},
  { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] },
)

if (failures.length > 0) {
  console.error(`\n${String(failures.length)} model check(s) failed`)
  process.exit(1)
}
