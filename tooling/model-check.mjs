// ModelViewer and ModelScan in Chrome (SwiftShader) with the demo character: lazy three.js, no idle draws, clips,
// scaled expressions with one React commit, the scan's stages, camera, landmark meshes, the person from the mask or the
// landmarks, the cloud, every stage's controls (tooltips, 44px on a phone, 4.5:1 over any photo), focus, errors.
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

const threeChunk = /model-viewer-(scene|rig)|model-scan-(intro|cloud)|\.glb$/

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

// CI renders in software, where easing the character's weights takes several times longer than on a GPU: wait for
// the canvas to go still (or the time to run out) before measuring that it stays still.
async function untilStill(page, timeout = 8000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline && (await drawsDuring(page, 300)).all > 0);
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
  // Every stage the root passes through, recorded in the page: a short one can start and end between two polls.
  await scanRoot(page).evaluate((root) => {
    globalThis.scanStages = []
    new MutationObserver(() => globalThis.scanStages.push(root.getAttribute("data-stage"))).observe(root, {
      attributes: true,
      attributeFilter: ["data-stage"],
    })
  })
  await page.getByRole("button", { name: "Make 3D" }).click()
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
  const recorded = await page.evaluate(() => globalThis.scanStages)
  return recorded.filter((stage, index) => stage !== recorded[index - 1])
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

// Where each drawn point sits against where its fraction of the photo lands on the photo's drawn box, worked out from
// the image's own object-fit, and how many points and lines each group draws.
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
    const svg = document.querySelector("[data-testid=scan] [data-slot=model-scan-points] svg")
    const box = svg.viewBox.baseVal
    let worst = 0
    const groups = {}
    for (const group of svg.querySelectorAll("[data-source]")) {
      const dots = group.querySelectorAll("circle")
      groups[group.dataset.source] = {
        drawn: dots.length,
        count: Number(group.dataset.count),
        lines: group.querySelectorAll("line").length,
      }
      for (const dot of dots) {
        const rect = dot.getBoundingClientRect()
        const x = left + (Number(dot.getAttribute("cx")) / box.width) * width
        const y = top + (Number(dot.getAttribute("cy")) / box.height) * height
        worst = Math.max(worst, Math.hypot(rect.left + rect.width / 2 - x, rect.top + rect.height / 2 - y))
      }
    }
    return { worst, groups, cover }
  })
}

// The scan's controls: each one's name, its hit area (the larger of its box and its touch-target ::before), and the
// text contrast inside the floating bars, each bar's translucent fill laid over white and over black, the two
// extremes a photo can put behind it.
const auditControls = (page) =>
  page.evaluate(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext("2d", { willReadFrequently: true })
    const rgba = (value) => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = "#000"
      context.fillStyle = value
      context.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
      return [r / 255, g / 255, b / 255, a / 255]
    }
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the page, which sees only this function
    const luminance = ([r, g, b]) => {
      // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the page, which sees only this function
      const c = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)
    }
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the page, which sees only this function
    const over = (top, under) => top.slice(0, 3).map((v, i) => v * top[3] + under[i] * (1 - top[3]))
    const contrast = (a, b) => {
      const [hi, lo] = [luminance(a), luminance(b)].toSorted((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }
    const root = document.querySelector("[data-testid=scan] [data-slot=model-scan-controls]")
    const controls = [...root.querySelectorAll('button, [role="radio"]')]
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => {
        const box = element.getBoundingClientRect()
        const before = getComputedStyle(element, "::before")
        const bw = before.content === "none" ? 0 : Number.parseFloat(before.width) || 0
        const bh = before.content === "none" ? 0 : Number.parseFloat(before.height) || 0
        return {
          label: element.getAttribute("aria-label") ?? element.textContent.trim(),
          iconOnly: element.textContent.trim() === "",
          hit: [Math.round(Math.max(box.width, bw)), Math.round(Math.max(box.height, bh))],
        }
      })
    const texts = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      const element = node.parentElement
      if (!node.textContent.trim() || !element?.getClientRects().length) continue
      // A checked segment's fill is its group's indicator, a sibling under it, not an ancestor.
      const checked = element.closest('[role="radio"][aria-checked="true"]')
      let fill = checked?.closest('[role="radiogroup"]')?.querySelector('[data-slot$="indicator"]') ?? element
      while (fill && fill !== root && rgba(getComputedStyle(fill).backgroundColor)[3] === 0) fill = fill.parentElement
      const background = rgba(getComputedStyle(fill ?? root).backgroundColor)
      const color = rgba(getComputedStyle(element).color)
      const worst = Math.min(
        ...[
          [1, 1, 1],
          [0, 0, 0],
        ].map((photo) => {
          const behind = over(background, photo)
          return contrast(over(color, behind), behind)
        }),
      )
      texts.push({ text: node.textContent.trim().slice(0, 40), worst: Math.round(worst * 100) / 100 })
    }
    return { controls, texts }
  })

// Runs a scan until both landmark groups have arrived, and stops it there.
async function detectBoth(page) {
  await page.getByRole("button", { name: "Make 3D" }).click()
  await page.waitForFunction(
    () => document.querySelectorAll("[data-testid=scan] [data-slot=model-scan-points] [data-source]").length === 2,
    undefined,
    { timeout: 20_000 },
  )
  // Every line and point has drawn in: the stagger is at most 0.7 s, plus the draw.
  await page.waitForTimeout(1200)
}

const scanCamera = (page) => page.getByTestId("scan").locator("canvas").getAttribute("data-camera")
const scanData = (page) =>
  page
    .getByTestId("scan")
    .locator("canvas")
    .evaluate((canvas) => ({ ...canvas.dataset }))
const toolbar = (page) => page.getByTestId("scan").getByRole("toolbar", { name: "3D model controls" })

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
    await untilStill(page)
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
      await untilStill(page)
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
      await untilStill(page)
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

    // Make 3D goes while a run goes, focus moves to Cancel, and comes back to Make 3D after cancelling.
    {
      await open(page, { width: 1440, query: "&slowdown=40" })
      await page.getByRole("button", { name: "Make 3D" }).focus()
      await page.keyboard.press("Enter")
      await scanRoot(page).and(page.locator("[data-stage=detecting]")).waitFor()
      const scan = page.getByTestId("scan")
      check("while a run goes, Make 3D is gone", (await scan.getByRole("button", { name: "Make 3D" }).count()) === 0)
      const focused = () => page.evaluate(() => document.activeElement?.textContent?.trim())
      check("starting moves focus to Cancel", (await focused()) === "Cancel", await focused())
      await page.keyboard.press("Enter")
      await scanRoot(page).and(page.locator("[data-stage=photo]")).waitFor()
      check("cancelling moves focus back to Make 3D", (await focused()) === "Make 3D", await focused())
    }

    // Points are fractions of the original photo: on the 9:16 photo they land on its drawn box, contained in a stage of
    // its own ratio or cropped into a square one, joined by the face's contours and the body's skeleton.
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
      const { face, body } = placement.groups
      check(
        `9:16 photo, ${label}: the face's contours and the body's skeleton draw as meshes`,
        face?.drawn >= 30 && face.lines >= 30 && body?.drawn >= 18 && body.lines >= 20,
        JSON.stringify(placement.groups),
      )
      if (shots)
        await page
          .getByTestId("scan")
          .screenshot({ path: join(shots, `model-scan-tall-${placement.cover ? "cover-" : ""}detecting.png`) })
    }

    // The person: from the engine's mask, or a hull around the body's landmarks without one; the background dims
    // around them either way.
    for (const [query, from] of [
      ["", "mask"],
      ["&mask=off", "landmarks"],
    ]) {
      await open(page, { width: 1440, query: `${query}&slowdown=40` })
      await detectBoth(page)
      const found = await page
        .waitForFunction(
          (source) =>
            document.querySelector("[data-testid=scan] [data-slot=model-scan-points]")?.dataset.person === source,
          from,
          { timeout: 10_000 },
        )
        .then(() => true)
        .catch(() => false)
      check(`${from}: the person comes from the ${from === "mask" ? "mask" : "landmarks' hull"}`, found)
      const layers = await page.locator("[data-testid=scan] [data-slot=model-scan-points] > span").count()
      check(`${from}: the background dims around the person`, layers === 2, String(layers))
      if (shots) await page.getByTestId("scan").screenshot({ path: join(shots, `model-scan-person-${from}.png`) })
    }

    // An engine error shows the consumer's words for its code over the stage, read at once; without WebGL2, no Retry.
    for (const code of ["no-face", "webgl2-unavailable"]) {
      await open(page, { width: 1440, query: `&fail=${code}` })
      const seen = await runScan(page)
      const scan = page.getByTestId("scan")
      const retry = await scan.getByRole("button", { name: "Try again" }).count()
      check(`${code}: the run ends in the error stage`, seen.at(-1) === "error", seen.join(","))
      check(
        `${code}: ${code === "webgl2-unavailable" ? "no Retry, ModelViewer's no-WebGL line" : "Retry"} and Start over`,
        (code === "webgl2-unavailable"
          ? retry === 0 && (await scan.getByText("3D isn't available in this browser.").count()) > 0
          : retry === 1) && (await scan.getByRole("button", { name: "Start over" }).count()) === 1,
      )
    }

    // The scan: the person's pixels fly as a cloud from the mask, the camera ends at three-quarter, and one toolbar
    // takes over.
    await open(page, { width: 1440, query: "&slowdown=10" })
    const points = { before: (await draws(page)).points }
    const stages = await runScan(page)
    check("the scan runs every stage", stages.join(",") === "detecting,building,refining,ready", stages.join(","))
    await scanRoot(page).and(page.locator("[data-intro=done]")).waitFor({ timeout: 30_000 })
    await page.waitForFunction(
      () => document.querySelector("[data-testid=scan] canvas")?.dataset.camera === "35.0 8.0 1.00",
      undefined,
      { timeout: 8000 },
    )
    check("the scan's camera ends at the three-quarter view", (await scanCamera(page)) === "35.0 8.0 1.00")
    points.after = (await draws(page)).points
    check("the transition draws the cloud", points.after - points.before > 0, String(points.after - points.before))
    {
      const cloud = await scanData(page)
      check(
        "the cloud flies the person's pixels, picked by the mask",
        Number(cloud.particles) > 2000 && cloud.person === "mask",
        JSON.stringify(cloud),
      )
    }
    {
      const scan = page.getByTestId("scan")
      check(
        "ready: one toolbar over the model, without the viewer's own bar",
        (await toolbar(page).isVisible()) &&
          (await scan.getByRole("group", { name: "3D view controls" }).count()) === 0,
      )
      check("ready: the style picker shows", await scan.getByRole("radiogroup", { name: "Style" }).isVisible())
      // Every icon-only control shows its name in a tooltip.
      for (const name of ["Wave", "Download 3D model", "Start over"]) {
        await toolbar(page).getByRole("button", { name }).hover()
        const tip = await page
          .locator('[role="tooltip"]:visible')
          .first()
          .textContent({ timeout: 3000 })
          .catch(() => null)
        check(`ready: ${name} shows its name in a tooltip`, tip?.trim() === name, String(tip))
        await page.mouse.move(0, 0)
        await page.waitForTimeout(200)
      }
      await toolbar(page).getByRole("button", { name: "Download 3D model" }).click()
      check("ready: Download calls onDownload", (await scan.getAttribute("data-downloads")) === "1")
      const requests = trackRequests(page)
      await scan.getByRole("radio", { name: "Cel outline" }).click()
      await page.waitForTimeout(1500)
      requests.stop()
      check(
        "ready: another style loads its model",
        requests.urls.some((url) => /character-cel-outline.*\.glb$/.test(url)),
      )
      // The floor reads the theme again when it changes: with the clip paused and the canvas still, it draws again.
      await toolbar(page).getByRole("button", { name: "Wave" }).click()
      await untilStill(page)
      // One frame follows the change, maybe before another round trip: count from before it.
      const still = await draws(page)
      await page.evaluate(() => document.documentElement.classList.add("dark"))
      await page.waitForTimeout(600)
      const themed = { all: (await draws(page)).all - still.all }
      await page.evaluate(() => document.documentElement.classList.remove("dark"))
      check("a theme change redraws the floor in the new colours", themed.all > 0, JSON.stringify(themed))
      await toolbar(page).getByRole("button", { name: "Start over" }).click()
      await scanRoot(page).and(page.locator("[data-stage=photo]")).waitFor()
      check("Start over goes back to the photo", await scan.getByRole("button", { name: "Make 3D" }).isVisible())
    }

    // Without a mask, the landmarks' hull picks the cloud's pixels.
    await open(page, { width: 1440, query: "&slowdown=10&mask=off" })
    await runScan(page)
    await scanRoot(page).and(page.locator("[data-intro=done]")).waitFor({ timeout: 30_000 })
    {
      const cloud = await scanData(page)
      check(
        "without a mask, the landmarks' hull picks the cloud's pixels",
        Number(cloud.particles) > 2000 && cloud.person === "landmarks",
        JSON.stringify(cloud),
      )
    }

    // Reduced motion: a crossfade, no cloud and no camera flight, and the progress shows while building.
    await open(page, { width: 1440, query: "&slowdown=10", reducedMotion: "reduce" })
    const reducedBefore = (await draws(page)).points
    let barWhileBuilding = false
    await runScan(page, {
      capture: async (stage) => {
        if (stage === "building") barWhileBuilding = await page.getByTestId("scan").getByRole("progressbar").isVisible()
      },
    })
    await scanRoot(page).and(page.locator("[data-intro=done]")).waitFor({ timeout: 30_000 })
    await page.waitForTimeout(300)
    check("reduced motion: the progress shows while building", barWhileBuilding)
    check("reduced motion: no cloud", (await draws(page)).points - reducedBefore === 0)
    check("reduced motion: the camera jumps to the three-quarter view", (await scanCamera(page)) === "35.0 8.0 1.00")
    check(
      "reduced motion: the clip waits, paused",
      (await toolbar(page).getByRole("button", { name: "Wave" }).getAttribute("aria-pressed")) === "false",
    )

    // Controls below the stage: the same controls, under it rather than over it.
    {
      await open(page, { width: 1440, query: "&controls=below" })
      const stage = await page.getByTestId("scan").locator("[data-slot=model-viewer-stage]").boundingBox()
      const row = await page.getByTestId("scan").locator("[data-slot=model-scan-controls]").boundingBox()
      check(
        "controls below: under the stage, Make 3D there",
        row.y >= stage.y + stage.height - 0.5 &&
          (await page.getByTestId("scan").getByRole("button", { name: "Make 3D" }).isVisible()),
        `${String(row.y)} vs ${String(stage.y + stage.height)}`,
      )
      if (shots) await page.getByTestId("scan").screenshot({ path: join(shots, "model-scan-below-photo.png") })
    }

    // On a phone: every control reaches 44px, and every text in the floating controls reads at 4.5:1 over the
    // brightest and the darkest photo, in each stage and both modes.
    {
      const phone = await page
        .context()
        .browser()
        .newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
      const touch = await phone.newPage()
      const origin = new URL(page.url()).origin
      const audit = async (label) => {
        const result = await auditControls(touch)
        const small = result.controls.filter((control) => control.hit[0] < 44 || control.hit[1] < 44)
        check(`phone, ${label}: every control reaches 44px`, small.length === 0, JSON.stringify(small))
        const faint = result.texts.filter((text) => text.worst < 4.5)
        check(
          `phone, ${label}: the controls' text reads at 4.5:1 over any photo`,
          result.texts.length > 0 && faint.length === 0,
          JSON.stringify(faint.length > 0 ? faint : result.texts.length),
        )
      }
      for (const mode of ["light", "dark"]) {
        for (const photoTone of ["light", "dark"]) {
          const label = `${mode} mode, ${photoTone} photo`
          await touch.goto(`${origin}/?demo=model-check&slowdown=10&photo=${photoTone}`)
          await touch.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), mode === "dark")
          await touch.getByTestId("scan").getByRole("button", { name: "Make 3D" }).waitFor()
          await audit(`${label}, photo`)
          if (shots)
            await touch
              .getByTestId("scan")
              .screenshot({ path: join(shots, `model-scan-phone-${mode}-${photoTone}-photo.png`) })
          await touch.getByTestId("scan").getByRole("button", { name: "Make 3D" }).tap()
          await touch.getByTestId("scan").getByRole("progressbar").waitFor({ timeout: 20_000 })
          await audit(`${label}, working`)
          await touch
            .getByTestId("scan")
            .getByRole("toolbar", { name: "3D model controls" })
            .waitFor({ timeout: 60_000 })
          await touch.waitForTimeout(400)
          await audit(`${label}, ready`)
          if (shots)
            await touch
              .getByTestId("scan")
              .screenshot({ path: join(shots, `model-scan-phone-${mode}-${photoTone}-ready.png`) })
        }
        await touch.goto(`${origin}/?demo=model-check&fail&photo=dark`)
        await touch.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), mode === "dark")
        await touch.getByTestId("scan").getByRole("button", { name: "Make 3D" }).tap()
        await touch.getByTestId("scan").getByRole("button", { name: "Try again" }).waitFor({ timeout: 30_000 })
        await audit(`${mode} mode, error`)
      }
      await phone.close()
    }

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
            // Both landmark groups, drawn in.
            if (stage === "detecting")
              await page.waitForFunction(
                () =>
                  document.querySelectorAll("[data-testid=scan] [data-slot=model-scan-points] [data-source]").length ===
                  2,
                undefined,
                { timeout: 20_000 },
              )
            if (stage === "detecting") await page.waitForTimeout(1200)
            if (stage === "refining") await page.waitForTimeout(600)
            await page
              .getByTestId("scan")
              .screenshot({ path: join(shots, `model-scan-${String(width)}-${mode}-${stage}.png`) })
          },
        })
        await scanRoot(page).and(page.locator("[data-intro=done]")).waitFor({ timeout: 30_000 })
        await page.waitForTimeout(1500)
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
