// Serves the built showcase with `vite preview` and opens it in the system Chrome.
import { spawn, spawnSync } from "node:child_process"
import { createServer } from "node:net"
import { resolve } from "node:path"

import { chromium } from "playwright"

const showcase = resolve(import.meta.dirname, "..", "apps", "showcase")

// A free port, so parallel checks (several worktrees at once) don't collide.
async function freePort() {
  const server = createServer()
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready))
  const { port } = server.address()
  await new Promise((closed) => server.close(closed))
  return port
}

async function withShowcase(run, pageOptions = {}) {
  const port = await freePort()
  const server = spawn("npx", ["vite", "preview", "--port", String(port), "--strictPort"], {
    cwd: showcase,
    stdio: ["ignore", "pipe", "inherit"],
    shell: process.platform === "win32",
    detached: process.platform !== "win32",
  })
  await new Promise((ready) => server.stdout.on("data", (chunk) => String(chunk).includes(String(port)) && ready()))
  const browser = await chromium.launch({ channel: "chrome" })
  const errors = []
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2, ...pageOptions })
    page.setDefaultTimeout(10_000)
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()))
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(`http://localhost:${port}/`)
    await page.evaluate(() => document.fonts.ready)
    await run(page)
  } finally {
    await browser.close()
    // npx starts vite as a grandchild that keeps our stdout pipe open, so kill the whole tree or Node never exits.
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"])
    else process.kill(-server.pid, "SIGTERM")
    server.stdout.destroy()
  }
  if (errors.length > 0) throw new Error(`Console errors:\n${errors.join("\n")}`)
}

async function setAppearance(page, theme, mode, palette) {
  await page.getByRole("radio", { name: theme }).click()
  if (palette) await page.getByRole("radio", { name: palette, exact: false }).click()
  const dark = page.getByRole("button", { name: "Dark mode" })
  if ((mode === "dark") !== ((await dark.getAttribute("aria-pressed")) === "true")) await dark.click()
  await page.waitForTimeout(250)
  // Inside `content-visibility: auto` columns off screen, a color transition only starts when something
  // reads the style, so axe would read the previous theme's colors. Start them all, then finish them.
  await page.evaluate(() => {
    for (const element of document.querySelectorAll("*")) void getComputedStyle(element).color
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSTransition) animation.finish()
    }
  })
}

export { setAppearance, withShowcase }
