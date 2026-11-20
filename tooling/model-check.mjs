// ModelViewer and ModelScan in Chrome (SwiftShader) with the demo character: lazy three.js, no idle draws, both clips,
// expressions times extras.targetScales with one React commit, the recorded scan's stages, camera and landmarks, focus,
// errors per code, no overflow.
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

// Where each drawn point sits against where its fraction of the photo lands on the photo's drawn box, worked out from
// the image's own object-fit, and how many points each group has on and off the photo.
async function pointPlacement(page) {
  return page.evaluate(() => {
    const img = document.querySelector("[data-testid=scan] [data-slot=model-scan-photo] img")
    const frame = img.getBoundingClientRect()
    const ratio = img.naturalWidth / img.naturalHeight
    const cover = getComputedStyle(img).objectFit === "cover"
    const wider = frame.width / frame.height > ratio
    const width = wider === !cover ? frame.height * ratio : frame.width
    const height = wider === !cover ? frame.height : frame.width / ratio
    const left = frame.left + (frame.width - width) / 2
    const top = frame.top + (frame.height - height) / 2
    let worst = 0
    const groups = {}
    for (const group of document.querySelectorAll("[data-testid=scan] [data-slot=model-scan-points] [data-source]")) {
      groups[group.dataset.source] = { drawn: group.childElementCount, count: Number(group.dataset.count) }
      for (const dot of group.children) {
        const rect = dot.getBoundingClientRect()
        const x = left + (parseFloat(dot.style.left) / 100) * width
        const y = top + (parseFloat(dot.style.top) / 100) * height
        worst = Math.max(worst, Math.hypot(rect.left + rect.width / 2 - x, rect.top + rect.height / 2 - y))
      }
    }
    return { worst, groups, cover }
  })
}

// The viewer's rig (apps/showcase/src/checks/use-model-probe.ts): a target's weight as given, the influence its mesh
// draws with and the multiplier from extras.targetScales; the clip that runs and how far in.
const probe = (page, target) =>
  page.evaluate((name) => {
    const rig = globalThis.modelProbes?.viewer
    if (!rig) return null
    const body = rig.scene.getObjectByName("body")
    const at = body.morphTargetDictionary[name]
    const clip = rig.clipState()
    return {
      weight: rig.weight(name) ?? null,
      influence: body.morphTargetInfluences[at],
      scale: body.userData.targetScales[at],
      clip: clip.name,
      time: clip.time,
    }
  }, target)

// Runs a scan until both landmark groups have arrived, and stops it there.
async function detectBoth(page) {
  await page.getByRole("button", { name: "Start scan" }).click()
  await page.waitForFunction(
    () => document.querySelectorAll("[data-testid=scan] [data-slot=model-scan-points] [data-source]").length === 2,
    undefined,
    { timeout: 20_000 },
  )
  // Every point has grown in: the stagger is at most 0.4 s, plus the grow.
  await page.waitForTimeout(700)
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

    // Both clips play: idle by default, then wave once chosen; each moves on frame after frame.
    {
      const first = await probe(page, "expr.jawOpen")
      await page.waitForTimeout(400)
      const later = await probe(page, "expr.jawOpen")
      check("the idle clip plays", first?.clip === "idle" && later.time !== first.time, JSON.stringify([first, later]))
      await page.getByTestId("viewer").getByRole("combobox", { name: "Animation" }).selectOption("wave")
      await page.waitForTimeout(400)
      const wave = await probe(page, "expr.jawOpen")
      await page.waitForTimeout(400)
      const waving = await probe(page, "expr.jawOpen")
      check("the wave clip plays", wave?.clip === "wave" && waving.time !== wave.time, JSON.stringify([wave, waving]))
      check("waving keeps drawing", (await drawsDuring(page, 500)).all > 5)
      if (shots) await page.getByTestId("viewer").screenshot({ path: join(shots, "model-viewer-wave.png") })
    }

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
    // The GLB stores its targets scaled to fill their bytes: an expression at 1 reaches the mesh times its scale.
    {
      const jaw = await probe(page, "expr.jawOpen")
      check(
        "an expression reaches the mesh multiplied by the GLB's extras.targetScales",
        jaw?.weight === 1 && Math.abs(jaw.influence - jaw.scale) < 1e-6 && jaw.scale < 0.5,
        JSON.stringify(jaw),
      )
      if (shots) await page.getByTestId("viewer").screenshot({ path: join(shots, "model-viewer-morphed.png") })
      await page.getByRole("button", { name: "Unmorph" }).click()
      await page.waitForTimeout(1200)
      const back = await probe(page, "expr.jawOpen")
      check("unmorphed, the expression goes back to 0", back?.influence === 0, JSON.stringify(back))
    }

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
        requests.urls.some((url) => /character-cel-outline.*\.glb$/.test(url)),
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

    // Start scan goes while a run goes, focus moves to Cancel, and comes back to Start scan after cancelling.
    {
      await open(page, { width: 1440, query: "&slowdown=40" })
      await page.getByRole("button", { name: "Start scan" }).focus()
      await page.keyboard.press("Enter")
      await scanRoot(page).and(page.locator("[data-stage=detecting]")).waitFor()
      const scan = page.getByTestId("scan")
      check(
        "while a run goes, Start scan is gone",
        (await scan.getByRole("button", { name: "Start scan" }).count()) === 0,
      )
      const focused = () => page.evaluate(() => document.activeElement?.textContent?.trim())
      check("starting moves focus to Cancel", (await focused()) === "Cancel", await focused())
      await page.keyboard.press("Enter")
      await scanRoot(page).and(page.locator("[data-stage=photo]")).waitFor()
      check("cancelling moves focus back to Start scan", (await focused()) === "Start scan", await focused())
    }

    // Points are fractions of the original photo: on the 9:16 photo they land on its drawn box, contained in a stage of
    // its own ratio or cropped into a square one, and none is drawn off the photo.
    for (const query of ["", "&fit=cover&stage=1"]) {
      await open(page, { width: 1440, query: `${query}&slowdown=40` })
      await detectBoth(page)
      const placement = await pointPlacement(page)
      check("the points show while detecting", (await scanRoot(page).getAttribute("data-stage")) === "detecting")
      const label = placement.cover ? "cover in a square stage" : "contain"
      check(
        `9:16 photo, ${label}: points land on the photo's drawn box`,
        placement.worst < 1.5,
        placement.worst.toFixed(2),
      )
      check(
        `9:16 photo, ${label}: the face's contours and the body's landmarks on the photo are all drawn`,
        placement.groups.face?.drawn === placement.groups.face?.count &&
          placement.groups.face?.count > 30 &&
          placement.groups.body?.drawn === placement.groups.body?.count &&
          placement.groups.body?.count > 20,
        JSON.stringify(placement.groups),
      )
      if (shots && !placement.cover)
        await page.getByTestId("scan").screenshot({ path: join(shots, "model-scan-tall-detecting.png") })
      if (shots && placement.cover)
        await page.getByTestId("scan").screenshot({ path: join(shots, "model-scan-tall-cover-detecting.png") })
    }

    // An engine error shows the consumer's words for its code, read at once; without WebGL2, no Retry.
    for (const code of ["no-face", "webgl2-unavailable"]) {
      await open(page, { width: 1440, query: `&fail=${code}` })
      const seen = await runScan(page)
      const scan = page.getByTestId("scan")
      const retry = await scan.getByRole("button", { name: "Try again" }).count()
      check(`${code}: the run ends in the error stage`, seen.at(-1) === "error", seen.join(","))
      check(
        `${code}: ${code === "webgl2-unavailable" ? "no Retry, ModelViewer's no-WebGL line" : "Retry"}`,
        code === "webgl2-unavailable"
          ? retry === 0 && (await scan.getByText("3D isn't available in this browser.").count()) > 0
          : retry === 1,
      )
    }

    // The scan: the camera ends at three-quarter, after a flight drawn with particles.
    await open(page, { width: 1440, query: "&slowdown=10" })
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
    await open(page, { width: 1440, query: "&slowdown=10", reducedMotion: "reduce" })
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
        if (!shots) continue
        // Both styles: the soft toon GLB, then the cel one with its outline.
        const viewerShot = (style) =>
          page
            .getByTestId("viewer")
            .screenshot({ path: join(shots, `model-viewer-${String(width)}-${mode}-${style}.png`) })
        await viewerShot("soft")
        await page.getByRole("button", { name: "Swap model" }).click()
        await page.waitForTimeout(2500)
        await viewerShot("cel")
        await page
          .getByTestId("scan")
          .screenshot({ path: join(shots, `model-scan-${String(width)}-${mode}-photo.png`) })
        await runScan(page, {
          capture: async (stage) => {
            // Both landmark groups, grown in.
            if (stage === "detecting")
              await page.waitForFunction(
                () =>
                  document.querySelectorAll("[data-testid=scan] [data-slot=model-scan-points] [data-source]").length ===
                  2,
                undefined,
                { timeout: 20_000 },
              )
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
