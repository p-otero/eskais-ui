/* oxlint-disable no-await-in-loop -- each theme, width and CPU rate is captured in turn */
import { mkdirSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { withShowcase } from "./showcase-browser.mjs"

const out = resolve(process.argv[2] ?? "model-scan-capture")
mkdirSync(out, { recursive: true })
const arg = (name, fallback) => {
  const found = process.argv.find((item) => item.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : fallback
}
const themes = arg("themes", "light,dark").split(",")
const sizeNames = arg("sizes", "desktop,mobile").split(",")
const rates = arg("cpu", "1,4,6").split(",").map(Number)
const query = arg("query", "")
const timingOnly = process.argv.includes("--timing-only")

const sizes = {
  desktop: { viewport: { width: 1100, height: 1000 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
}
const report = { renderer: "", runs: [] }

const scan = (page) => page.getByTestId("scan")
const stageIs = (page, stage) =>
  page.waitForFunction(
    (name) => document.querySelector("[data-testid=scan] [data-slot=model-scan]")?.dataset.stage === name,
    stage,
    { timeout: 60_000 },
  )
const introDone = (page) =>
  page.waitForFunction(
    () => document.querySelector("[data-testid=scan] [data-slot=model-scan]")?.dataset.intro === "done",
    undefined,
    { timeout: 60_000 },
  )

async function open(page, theme, extra = "") {
  await page.goto(`${new URL(page.url()).origin}/?demo=model-check&scan-only&slowdown=15${query}${extra}`)
  await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), theme === "dark")
  await page.evaluate(() => document.fonts.ready)
  await scan(page).getByRole("button", { name: "Make 3D" }).waitFor()
}

async function start(page) {
  const button = scan(page).getByRole("button", { name: "Make 3D" })
  if (await page.evaluate(() => matchMedia("(pointer: coarse)").matches)) await button.tap()
  else await button.click()
}

const startFrames = (page) =>
  page.evaluate(() => {
    const times = []
    globalThis.frameTimes = times
    globalThis.stopFrames = false
    let last = performance.now()
    const tick = (now) => {
      times.push(now - last)
      last = now
      if (!globalThis.stopFrames) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

const stopFrames = (page) =>
  page.evaluate(() => {
    globalThis.stopFrames = true
    const times = globalThis.frameTimes.slice(1).toSorted((a, b) => a - b)
    const sum = times.reduce((total, time) => total + time, 0)
    const at = (p) => times[Math.min(times.length - 1, Math.floor(p * times.length))] ?? 0
    return {
      frames: times.length,
      fps: Math.round((times.length / (sum / 1000)) * 10) / 10,
      mean: Math.round((sum / times.length) * 10) / 10,
      p95: Math.round(at(0.95) * 10) / 10,
      max: Math.round((times.at(-1) ?? 0) * 10) / 10,
      over20: times.filter((time) => time > 20).length,
      over50: times.filter((time) => time > 50).length,
    }
  })

const describe = (run) =>
  `${String(run.frames)} frames, ${String(run.fps)} fps, mean ${String(run.mean)} ms, p95 ${String(run.p95)} ms, max ${String(run.max)} ms, ${String(run.over20)} over 20 ms, ${String(run.over50)} over 50 ms`

await withShowcase(
  async (page) => {
    const browser = page.context().browser()
    report.renderer = await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl2")
      const info = gl?.getExtension("WEBGL_debug_renderer_info")
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown"
    })
    console.log(`renderer: ${report.renderer}`)
    const origin = new URL(page.url()).origin

    for (const sizeName of timingOnly ? [] : sizeNames) {
      const context = await browser.newContext({ deviceScaleFactor: 2, ...sizes[sizeName] })
      const shotPage = await context.newPage()
      await shotPage.goto(origin)
      const shot = (name) => scan(shotPage).screenshot({ path: join(out, `${name}.png`), animations: "allow" })
      for (const theme of themes) {
        const base = `${sizeName}-${theme}`
        await open(shotPage, theme)
        await shot(`${base}-1-photo`)
        await start(shotPage)
        await stageIs(shotPage, "detecting")
        await shotPage.waitForFunction(
          () =>
            document.querySelectorAll("[data-testid=scan] [data-slot=model-scan-points] [data-source]").length === 2,
          undefined,
          { timeout: 60_000 },
        )
        await shotPage.waitForTimeout(1500)
        await shot(`${base}-2-detecting`)
        await shotPage.waitForSelector("[data-testid=scan] [data-handed-off]", { state: "attached", timeout: 60_000 })
        for (let i = 0; i < 12; i += 1) {
          await shotPage.waitForTimeout(250)
          await shot(`${base}-3-transition-${String(i).padStart(2, "0")}`)
        }
        await introDone(shotPage)
        await stageIs(shotPage, "ready")
        await shotPage.waitForTimeout(1200)
        await shot(`${base}-4-ready`)
        await open(shotPage, theme, "&fail")
        await start(shotPage)
        await stageIs(shotPage, "error")
        await shotPage.waitForTimeout(500)
        await shot(`${base}-5-error`)
        console.log(`captured ${base}`)
      }
      await context.close()
    }

    for (const rate of rates) {
      await open(page, "light")
      const cdp = await page.context().newCDPSession(page)
      await cdp.send("Emulation.setCPUThrottlingRate", { rate })
      await start(page)
      await page.waitForSelector("[data-testid=scan] [data-handed-off]", { state: "attached", timeout: 120_000 })
      await startFrames(page)
      await introDone(page)
      const run = await stopFrames(page)
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 })
      const built = await scan(page)
        .locator("canvas")
        .evaluate((canvas) => ({ cloudMs: canvas.dataset.cloudMs, particles: canvas.dataset.particles }))
      report.runs.push({ cpu: rate, ...run, ...built })
      console.log(`CPU ×${String(rate)}: ${describe(run)}; cloud of ${built.particles} built in ${built.cloudMs} ms`)
    }
  },
  { viewport: { width: 1100, height: 1000 } },
  { args: ["--enable-gpu", "--ignore-gpu-blocklist"] },
)

writeFileSync(join(out, "frames.json"), `${JSON.stringify(report, null, 2)}\n`)
