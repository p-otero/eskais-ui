// Bundles AgentTaskBoard with embedded task data into one self-contained HTML file using Bun's HTML bundler,
// then opens it from file:// in Chrome with every network request blocked and checks that it works.
// Usage: node tooling/static-board.mjs [output, default dist/static-board.html]
import { spawn } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { chromium } from "playwright"

const repo = resolve(import.meta.dirname, "..")
const source = join(repo, "tooling", "static-board")
const output = resolve(process.argv[2] ?? join(repo, "dist", "static-board.html"))
const work = mkdtempSync(join(tmpdir(), "eskais-static-board-"))
const slash = (path) => path.replaceAll("\\", "/")

function run(command, args) {
  return new Promise((done, fail) => {
    let stdout = ""
    const child = spawn(command, args, {
      cwd: repo,
      stdio: ["ignore", "pipe", "inherit"],
      shell: process.platform === "win32",
    })
    child.stdout.on("data", (chunk) => (stdout += chunk))
    child.on("exit", (code) =>
      code === 0 ? done(stdout) : fail(new Error(`${command} ${args.join(" ")} exited with ${code}`)),
    )
  })
}

// Bun's HTML bundler has no Tailwind step without a plugin, so the CSS is compiled here with the
// same engine the showcase's Vite plugin uses, then handed to Bun as a plain stylesheet.
async function compileCss() {
  const require = createRequire(
    join(realpathSync(join(repo, "apps/showcase/node_modules/@tailwindcss/vite")), "package.json"),
  )
  const { compile } = await import(pathToFileURL(require.resolve("@tailwindcss/node")).href)
  const { Scanner } = await import(pathToFileURL(require.resolve("@tailwindcss/oxide")).href)
  const input = readFileSync(join(source, "index.css"), "utf8")
  const compiler = await compile(input, { base: source, from: join(source, "index.css"), onDependency: () => {} })
  const candidates = new Scanner({ sources: compiler.sources }).scan()
  return compiler.build(candidates)
}

async function taskData(kind) {
  const fixture = slash(join(repo, "test", "fixtures", "agent-tasks.ts"))
  const script = join(work, `data-${kind}.ts`)
  const tasks = kind === "sample" ? "sampleTasks" : "generateTasks(200, 30)"
  writeFileSync(
    script,
    `import { GENERATED_AT, generateTasks, sampleStages, sampleTasks } from "${fixture}"\nconsole.log(JSON.stringify({ tasks: ${tasks}, stages: sampleStages, generatedAt: GENERATED_AT }))\n`,
  )
  return (await run("bun", [script])).trim()
}

async function bundle(css, data, file) {
  const html = readFileSync(join(source, "index.html"), "utf8").replace(
    "./main.tsx",
    // Relative on purpose: Bun reads an absolute src as relative to the HTML file's root on POSIX.
    slash(relative(work, join(source, "main.tsx"))),
  )
  writeFileSync(join(work, "board.css"), css)
  writeFileSync(join(work, "index.html"), html)
  const outdir = join(work, "out")
  await run("bun", [
    "build",
    join(work, "index.html"),
    "--compile",
    "--target=browser",
    "--production",
    `--outdir=${outdir}`,
  ])
  // `<` escaped so the JSON can't close its script element.
  const embedded = `<script type="application/json" id="board-data">${data.replaceAll("<", "\\u003c")}</script>`
  const built = readFileSync(join(outdir, "index.html"), "utf8")
  const marker = built.includes("<!-- board-data -->") ? "<!-- board-data -->" : '<script type="module"'
  const page = built.replace(marker, marker === "<!-- board-data -->" ? embedded : `${embedded}${marker}`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, page)
  // Only markup and stylesheets count: the inlined JavaScript holds React's warning strings, which look like tags.
  const markup = page.replaceAll(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
  const styles = [...page.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]).join("\n")
  const checks = [
    [markup, /<script[^>]+src=/i],
    [markup, /<link[^>]+rel="?(stylesheet|preload|modulepreload)/i],
    [styles, /@import\b/i],
    // Embedded fonts arrive as data: URLs; anything else in url() is fetched from outside the file.
    [styles, /url\(\s*(?!["']?data:)/i],
  ]
  for (const [text, external] of checks) {
    if (external.test(text)) throw new Error(`${file} still loads something from outside the file: ${external}`)
  }
  // Hosts that size a frame to its content (T3's preview) reject any viewport-height unit anywhere in the page,
  // class strings in the bundle included: the page must take its height from its content or its parent.
  const viewportUnit = page.match(/\b\d+(\.\d+)?[dls]?vh\b|\b(min-|max-)?h-(screen|[dls]?vh)\b/)
  if (viewportUnit) throw new Error(`${file} uses a viewport height unit: ${viewportUnit[0]}`)
  return statSync(file).size
}

// Cancelled tasks start hidden, so they have no card.
const shownCards = (data) => JSON.parse(data).tasks.filter((task) => task.status !== "cancelled").length

async function check(browser, file, { cards, select, detail }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, offline: true })
  const page = await context.newPage()
  page.setDefaultTimeout(15_000)
  const errors = []
  const blocked = []
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()))
  page.on("pageerror", (error) => errors.push(error.message))
  await page.route("**/*", (route) => {
    const url = route.request().url()
    if (url.startsWith("file:")) return route.continue()
    blocked.push(url)
    return route.abort()
  })
  await page.goto(pathToFileURL(file).href)
  await page.getByRole("region", { name: "Agent tasks" }).waitFor()
  await page.waitForFunction((count) => document.querySelectorAll('[data-slot="task-card"]').length === count, cards)
  const rendered = await page.evaluate(() => performance.now())
  const loadedFonts = await page.evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts].filter((font) => font.status === "loaded").map((font) => font.family.replaceAll('"', ""))
  })
  for (const family of ["Geist Variable", "Geist Mono Variable"]) {
    if (!loadedFonts.includes(family)) errors.push(`The embedded ${family} font didn't load`)
  }
  const started = Date.now()
  await page.getByRole("button", { name: select }).click()
  await page.getByRole("dialog", { name: detail }).waitFor()
  const opened = Date.now() - started
  await context.close()
  if (blocked.length > 0) errors.push(`Blocked network requests: ${blocked.join(", ")}`)
  if (errors.length > 0) throw new Error(`${file}:\n${errors.join("\n")}`)
  return { rendered, opened }
}

try {
  const css = await compileCss()
  const sampleData = await taskData("sample")
  const scaleData = await taskData("scale")
  const size = await bundle(css, sampleData, output)
  const scaleFile = join(work, "static-board-200x30.html")
  const scaleSize = await bundle(css, scaleData, scaleFile)
  const browser = await chromium.launch({ channel: "chrome" })
  try {
    const sample = await check(browser, output, {
      cards: shownCards(sampleData),
      select: "Open T-014 Index the docs for search",
      detail: "T-014 Index the docs for search",
    })
    const scale = await check(browser, scaleFile, {
      cards: shownCards(scaleData),
      select: /^Open G-014 /,
      detail: /^G-014 /,
    })
    console.log(
      `${output}: ${(size / 1024).toFixed(0)} KiB, board ready ${sample.rendered.toFixed(0)} ms after navigation, detail open in ${sample.opened} ms`,
    )
    console.log(
      `200 tasks × up to 30 attempts: ${(scaleSize / 1024).toFixed(0)} KiB, board ready ${scale.rendered.toFixed(0)} ms after navigation, detail open in ${scale.opened} ms`,
    )
    console.log("Static board check passed: renders from file:// with no network and no console errors.")
  } finally {
    await browser.close()
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
