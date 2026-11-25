import { spawn, spawnSync } from "node:child_process"
import { createServer } from "node:net"
import { resolve } from "node:path"

import { chromium } from "playwright"

const apps = resolve(import.meta.dirname, "..", "apps")

async function freePort() {
  const server = createServer()
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready))
  const { port } = server.address()
  await new Promise((closed) => server.close(closed))
  return port
}

function withShowcase(run, pageOptions = {}, launchOptions = {}) {
  return withApp("showcase", run, pageOptions, launchOptions)
}

/** Needs the docs site built with `bun run build:site`. */
function withSite(run, pageOptions = {}, launchOptions = {}) {
  return withApp("site", run, pageOptions, launchOptions)
}

async function withApp(app, run, pageOptions, launchOptions) {
  const port = await freePort()
  const server = spawn("npx", ["vite", "preview", "--port", String(port), "--strictPort"], {
    cwd: resolve(apps, app),
    stdio: ["ignore", "pipe", "inherit"],
    shell: process.platform === "win32",
    detached: process.platform !== "win32",
  })
  await new Promise((ready) => server.stdout.on("data", (chunk) => String(chunk).includes(String(port)) && ready()))
  const browser = await chromium.launch({ channel: "chrome", ...launchOptions })
  const errors = []
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2, ...pageOptions })
    page.setDefaultTimeout(10_000)
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()))
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(`http://localhost:${port}/`)
    await rendered(page)
    await run(page)
  } finally {
    await browser.close()
    // Workaround: npx starts vite as a grandchild that keeps our stdout pipe open, so kill the whole tree or Node never exits.
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"])
    else process.kill(-server.pid, "SIGTERM")
    server.stdout.destroy()
  }
  if (errors.length > 0) throw new Error(`Console errors:\n${errors.join("\n")}`)
}

/** Waits for the showcase page to mount (it loads its page module first) and for its fonts. */
async function rendered(page) {
  await page.locator("#root > *").first().waitFor({ state: "attached" })
  await page.evaluate(() => document.fonts.ready)
}

async function setAppearance(page, theme, mode, palette) {
  await page.getByRole("radiogroup", { name: "Theme", exact: true }).getByRole("radio", { name: theme }).click()
  if (palette) await page.getByRole("radio", { name: palette, exact: false }).click()
  const dark = page.getByRole("button", { name: "Dark mode" })
  if ((mode === "dark") !== ((await dark.getAttribute("aria-pressed")) === "true")) await dark.click()
  await page.waitForTimeout(250)
  // Workaround: inside `content-visibility: auto` columns off screen, a color transition only starts when something
  // reads the style, so axe would read the previous theme's colors. Start them all, then finish them.
  await page.evaluate(() => {
    for (const element of document.querySelectorAll("*")) void getComputedStyle(element).color
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSTransition) animation.finish()
    }
  })
}

export { rendered, setAppearance, withShowcase, withSite }
