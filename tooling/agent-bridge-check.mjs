// Calls the showcase's WebMCP tools (registerTools) from outside ?demo=agent-bridge-check: over the DevTools protocol in
// Chrome with --enable-features=WebMCP, then through a stand-in document.modelContext. A refused start or cancel fails
// with why and changes nothing; accepted ones and a person's press go through. Without WebMCP the first pass skips.
// Usage: node tooling/agent-bridge-check.mjs [--require-webmcp] (after `bun run build:showcase`)
import { withShowcase } from "./showcase-browser.mjs"

const failures = []
const requireWebMcp = process.argv.includes("--require-webmcp")

function check(label, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
  if (!ok) failures.push(label)
}

// The page's WebMCP tools, listed and called through the DevTools protocol, as a browser agent would.
async function protocolTools(page) {
  const cdp = await page.context().newCDPSession(page)
  const tools = new Map()
  const responses = new Map()
  const waiting = new Map()
  cdp.on("WebMCP.toolsAdded", ({ tools: added }) => {
    for (const tool of added) tools.set(tool.name, tool)
  })
  cdp.on("WebMCP.toolResponded", (response) => {
    const resolve = waiting.get(response.invocationId)
    if (resolve) resolve(response)
    else responses.set(response.invocationId, response)
  })
  await cdp.send("WebMCP.enable")
  return {
    names: () => [...tools.keys()],
    async call(name, input) {
      const tool = tools.get(name)
      if (!tool) throw new Error(`No WebMCP tool "${name}" on the page. Tools: ${[...tools.keys()].join(", ")}`)
      const { invocationId } = await cdp.send("WebMCP.invokeTool", { frameId: tool.frameId, toolName: name, input })
      const response =
        responses.get(invocationId) ?? (await new Promise((resolve) => waiting.set(invocationId, resolve)))
      if (response.status !== "Completed") throw new Error(`${name} ${response.status}: ${JSON.stringify(response)}`)
      return typeof response.output === "string" ? JSON.parse(response.output) : response.output
    },
  }
}

// The same tools called from inside the page: Chrome's own document.modelContext, or the stand-in below.
function pageTools(page) {
  return {
    names: () => page.evaluate(async () => (await document.modelContext.getTools()).map((tool) => tool.name)),
    call: (name, input) =>
      page.evaluate(
        async ({ name: wanted, input: given }) => {
          const tool = (await document.modelContext.getTools()).find((each) => each.name === wanted)
          const output = await document.modelContext.executeTool(tool, given)
          return typeof output === "string" ? JSON.parse(output) : output
        },
        { name, input },
      ),
  }
}

// What registerTools needs from document.modelContext, for a browser without WebMCP: it lives in the test.
function standInModelContext() {
  if (document.modelContext) return
  const tools = new Map()
  Object.defineProperty(document, "modelContext", {
    value: {
      registerTool(tool, { signal } = {}) {
        tools.set(tool.name, tool)
        signal?.addEventListener("abort", () => tools.delete(tool.name))
        return Promise.resolve()
      },
      getTools: async () => [...tools.values()],
      executeTool: async (tool, input) => JSON.stringify(await tools.get(tool.name).execute(input, {})),
    },
  })
}

async function openFixture(page) {
  await page.goto(`${new URL(page.url()).origin}/?demo=agent-bridge-check`)
  await page.getByRole("group", { name: "Dictation for people" }).waitFor()
  await page.waitForFunction(() => document.querySelectorAll("[data-slot=image-scan]").length === 2)
}

const attribute = (page, selector, name) => page.locator(selector).getAttribute(name)
const voiceState = (page, label) => attribute(page, `[data-slot=voice-input][aria-label="${label}"]`, "data-state")
const scanStatus = (page, alt) => attribute(page, `[data-slot=image-scan][aria-label="${alt}"]`, "data-status")
const waitFor = (page, read, value) =>
  page.waitForFunction(
    ([selector, name, wanted]) => document.querySelector(selector)?.getAttribute(name) === wanted,
    [...read, value],
  )

const fails = (result, message) => result.ok === false && result.error?.message?.includes(message) === true

async function scenario(page, tools, via) {
  const act = (ref, action) => tools.call("act", { steps: [{ ref, action }] })

  const names = await tools.names()
  check(
    `${via}: the page publishes snapshot, query and act`,
    ["snapshot", "query", "act"].every((name) => names.includes(name)),
    names.join(", "),
  )
  const snapshot = await tools.call("snapshot", {})
  const listed = snapshot.find((entry) => entry.label === "Dictation for people")
  check(`${via}: snapshot lists the voice input and its actions`, listed?.actions?.includes("start") === true)

  const refused = await act("Dictation for people", "start")
  check(
    `${via}: a start the app refuses fails the step`,
    fails(refused, "start was refused by the app."),
    JSON.stringify(refused.error),
  )
  check(`${via}: the refused voice input stays idle`, (await voiceState(page, "Dictation for people")) === "idle")

  const started = await act("Dictation for everyone", "start")
  check(`${via}: a start the app accepts goes through`, started.ok === true, JSON.stringify(started.error))
  await waitFor(page, ["[data-slot=voice-input][aria-label='Dictation for everyone']", "data-state"], "listening")
  const twice = await act("Dictation for everyone", "start")
  check(
    `${via}: a start while listening fails with the state`,
    fails(twice, "start isn't available while listening."),
    JSON.stringify(twice.error),
  )

  await page.getByRole("group", { name: "Dictation for people" }).getByRole("button", { name: "Dictate" }).click()
  await waitFor(page, ["[data-slot=voice-input][aria-label='Dictation for people']", "data-state"], "listening")
  check(
    `${via}: a person's press on the refusing voice input still starts it`,
    (await voiceState(page, "Dictation for people")) === "listening",
  )

  const cancelRefused = await act("Scan for people", "cancel")
  check(
    `${via}: a scan cancel the app refuses fails the step`,
    fails(cancelRefused, "cancel was refused by the app."),
    JSON.stringify(cancelRefused.error),
  )
  check(`${via}: the refused scan keeps scanning`, (await scanStatus(page, "Scan for people")) === "scanning")
  const cancelled = await act("Scan for everyone", "cancel")
  check(`${via}: a cancel the app accepts goes through`, cancelled.ok === true, JSON.stringify(cancelled.error))
  await waitFor(page, ["[data-slot=image-scan][aria-label='Scan for everyone']", "data-status"], "uploaded")
  const late = await act("Scan for everyone", "cancel")
  check(
    `${via}: a cancel with nothing scanning fails with the status`,
    fails(late, "cancel works only while scanning (status: uploaded)."),
    JSON.stringify(late.error),
  )
}

let native = true
await withShowcase(
  async (page) => {
    native = await page.evaluate(() => typeof document.modelContext?.registerTool === "function")
    if (!native) return
    const tools = await protocolTools(page)
    await openFixture(page)
    await scenario(page, tools, "WebMCP over CDP")
    const inPage = await pageTools(page).call("act", { steps: [{ ref: "Scan for people", action: "cancel" }] })
    check(
      "WebMCP in the page: document.modelContext.executeTool runs the same act",
      inPage.ok === false && inPage.error?.message?.includes("cancel was refused by the app.") === true,
      JSON.stringify(inPage.error),
    )
  },
  {},
  { args: ["--enable-features=WebMCP"] },
)
if (!native) {
  const message = "this Chrome has no document.modelContext with --enable-features=WebMCP (Chrome 158 or later has it)"
  if (requireWebMcp) failures.push(message)
  console.log(`${requireWebMcp ? "FAIL" : "skip"} WebMCP over CDP: ${message}`)
}

await withShowcase(async (page) => {
  await page.addInitScript(standInModelContext)
  await openFixture(page)
  await scenario(page, pageTools(page), "stand-in modelContext")
})

if (failures.length > 0) {
  console.error(`\n${failures.length} agent bridge check(s) failed`)
  process.exit(1)
}
console.log("\nagent bridge checks passed")
