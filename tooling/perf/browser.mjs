import { readFile, stat } from "node:fs/promises"
import { createServer } from "node:http"
import { extname, join, normalize, resolve } from "node:path"

import { chromium } from "playwright"

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
}

async function serve(dir, { base = "/", spa = true } = {}) {
  const root = resolve(dir)
  const server = createServer(async (request, response) => {
    const { pathname } = new URL(request.url ?? "/", "http://localhost")
    if (!pathname.startsWith(base)) {
      response.writeHead(404).end()
      return
    }
    const relative = normalize(decodeURIComponent(pathname.slice(base.length))).replace(/^(\.\.[/\\])+/, "")
    let file = join(root, relative)
    try {
      if ((await stat(file)).isDirectory()) file = join(file, "index.html")
      await stat(file)
    } catch {
      if (!spa) {
        response.writeHead(404).end()
        return
      }
      file = join(root, "index.html")
    }
    response.writeHead(200, {
      "content-type": types[extname(file)] ?? "application/octet-stream",
      "cache-control": "max-age=3600",
    })
    response.end(await readFile(file))
  })
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready))
  const { port } = server.address()
  return {
    origin: `http://127.0.0.1:${String(port)}${base}`,
    close: () =>
      new Promise((done) => {
        server.closeAllConnections?.()
        server.close(done)
      }),
  }
}

const probe = resolve(import.meta.dirname, "probe.js")

// Without a GPU, as on CI's Linux runner, Chrome composites in software, so a paint or filter only a GPU makes cheap
// shows up there first. PERF_SOFTWARE=1 (--disable-gpu, closest to CI) or =swiftshader (GL emulated) reproduces it.
const softwareModes = {
  1: ["--disable-gpu"],
  swiftshader: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
}
const softwareArgs = softwareModes[process.env.PERF_SOFTWARE ?? ""] ?? []

async function launch() {
  return chromium.launch({
    channel: "chrome",
    args: ["--enable-blink-features=LongAnimationFrameTiming", "--disable-renderer-backgrounding", ...softwareArgs],
  })
}

async function openPage(browser, { cpu = 1, network, viewport = { width: 1280, height: 900 } } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
  await context.addInitScript({ path: probe })
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  const cdp = await context.newCDPSession(page)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu })
  if (network) {
    await cdp.send("Network.enable")
    await cdp.send("Network.emulateNetworkConditions", { offline: false, ...network })
  }
  return { page, context, cdp, errors }
}

async function heapUsed(cdp) {
  await cdp.send("HeapProfiler.enable")
  await cdp.send("HeapProfiler.collectGarbage")
  const { usedSize } = await cdp.send("Runtime.getHeapUsage")
  return usedSize
}

async function countLayers(page, cdp) {
  await cdp.send("DOM.enable")
  await cdp.send("LayerTree.enable")
  const layers = await new Promise((done) => {
    cdp.on("LayerTree.layerTreeDidChange", (event) => event.layers && done(event.layers))
    void page.evaluate(() => document.body.style.setProperty("--perf-nudge", String(Math.random())))
  })
  const reasons = new Map()
  for (const layer of layers) {
    try {
      const { compositingReasons } = await cdp.send("LayerTree.compositingReasons", { layerId: layer.layerId })
      for (const reason of compositingReasons) reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
    } catch {
      reasons.set("unknown", (reasons.get("unknown") ?? 0) + 1)
    }
  }
  await cdp.send("LayerTree.disable")
  const area = layers.reduce((sum, layer) => sum + layer.width * layer.height, 0)
  return { count: layers.length, megapixels: Math.round(area / 1e5) / 10, reasons }
}

export { countLayers, heapUsed, launch, openPage, serve }
