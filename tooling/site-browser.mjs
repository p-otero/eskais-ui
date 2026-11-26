import { readFile, stat } from "node:fs/promises"
import { createServer } from "node:http"
import { extname, join, normalize, resolve } from "node:path"

import { chromium } from "playwright"

const dist = resolve(import.meta.dirname, "..", "apps", "site", "dist")
const base = "/eskais-ui/"

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
}

async function resolveFile(pathname) {
  if (!pathname.startsWith(base)) return undefined
  const relative = normalize(decodeURIComponent(pathname.slice(base.length))).replace(/^(\.\.[/\\])+/, "")
  let file = join(dist, relative)
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html")
    await stat(file)
    return file
  } catch {
    return undefined
  }
}

async function serve() {
  const server = createServer(async (request, response) => {
    const { pathname } = new URL(request.url ?? "/", "http://localhost")
    const file = await resolveFile(pathname)
    if (!file) {
      response.writeHead(404, { "content-type": "text/plain" })
      response.end("Not found")
      return
    }
    if (!pathname.endsWith("/") && file.endsWith("index.html") && !pathname.endsWith(".html")) {
      response.writeHead(301, { location: `${pathname}/` })
      response.end()
      return
    }
    response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" })
    response.end(await readFile(file))
  })
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready))
  const { port } = server.address()
  return { origin: `http://127.0.0.1:${port}${base}`, close: () => new Promise((done) => server.close(done)) }
}

async function withSite(run, { colorScheme = "light" } = {}) {
  const site = await serve()
  const browser = await chromium.launch({ channel: "chrome" })
  try {
    await run({ browser, origin: site.origin, colorScheme })
  } finally {
    await browser.close()
    await site.close()
  }
}

async function openPage(browser, url, { width = 1440, height = 900, colorScheme = "light" } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme })
  const page = await context.newPage()
  page.setDefaultTimeout(15_000)
  const errors = []
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()))
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto(url)
  await page.waitForLoadState("networkidle")
  await page.evaluate(() => document.fonts.ready)
  return { page, context, errors }
}

export { openPage, withSite }
