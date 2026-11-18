// Drives ?demo=agent-workspace in Chrome: the thread follows a streamed reply, scrolling up stops it and a reply
// below shows as "1 new below" without moving the view, the pill jumps back (at once under reduced motion); the
// activity log records the agent's moves and a person's click as a person's, and Ctrl+Z undoes outside text fields.
// Usage: node tooling/conversation-check.mjs [--screenshots=<dir>] (after `bun run build:showcase`)
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

async function shot(page, file) {
  if (!shots) return
  await page.screenshot({ path: join(shots, file), animations: "disabled" })
  console.log(`     ${join(shots, file)}`)
}

async function open(page, motion = "no-preference") {
  await page.emulateMedia({ reducedMotion: motion })
  await page.goto(`${new URL(page.url()).origin}/?demo=agent-workspace`)
  await page.getByRole("log", { name: "Thread with the agent" }).waitFor()
  await page.evaluate(() => document.fonts.ready)
}

const log = (page) => page.getByRole("log", { name: "Thread with the agent" })
const gap = (page) => log(page).evaluate((el) => Math.round(el.scrollHeight - el.clientHeight - el.scrollTop))
const top = (page) => log(page).evaluate((el) => Math.round(el.scrollTop))
const pill = (page) => page.getByRole("button", { name: /new below|Jump to latest/ })

async function untilStreamed(page) {
  await page.waitForFunction(() => document.querySelector("[data-slot=conversation-message][aria-busy=true]") === null)
}

async function scrollUp(page) {
  await log(page).hover()
  await page.mouse.wheel(0, -400)
  await page.waitForTimeout(250)
}

async function thread(page) {
  await open(page)
  check("the thread opens at its newest message", (await gap(page)) <= 1, `${await gap(page)}px from the end`)

  await page.getByRole("button", { name: "Let the agent work" }).click()
  await page.waitForFunction(() => document.querySelector("[data-slot=conversation-message][aria-busy=true]") !== null)
  // Samples the distance from the end on every frame until the reply is whole.
  const gaps = await log(page).evaluate(
    (el) =>
      new Promise((done) => {
        const seen = []
        const sample = () => {
          seen.push(Math.round(el.scrollHeight - el.clientHeight - el.scrollTop))
          if (el.querySelector("[aria-busy=true]")) requestAnimationFrame(sample)
          else done(seen)
        }
        sample()
      }),
  )
  await page.waitForTimeout(100)
  check(
    "a streamed reply keeps the end in view while following",
    Math.max(...gaps, await gap(page)) <= 48 && (await gap(page)) <= 1,
    `largest gap ${Math.max(...gaps)}px`,
  )
  check("no pill while following", (await pill(page).count()) === 0)

  await scrollUp(page)
  const before = await top(page)
  check("scrolling up shows Jump to latest", (await pill(page).textContent())?.includes("Jump to latest") === true)
  await page.getByRole("button", { name: "Let the agent work" }).click()
  await untilStreamed(page)
  await page.waitForTimeout(150)
  check(
    "a reply below doesn't move the reader",
    Math.abs((await top(page)) - before) <= 1,
    `${before} → ${await top(page)}`,
  )
  check("it shows as 1 new below", (await pill(page).textContent())?.includes("1 new below") === true)
  await shot(page, "conversation-new-below.png")

  await pill(page).focus()
  await page.keyboard.press("Enter")
  await page.waitForTimeout(40)
  const midway = await gap(page)
  await page.waitForTimeout(700)
  check("the pill scrolls smoothly back to the end", midway > 1 && (await gap(page)) <= 1, `${midway}px after 40ms`)
  check("and leaves", (await pill(page).count()) === 0)
  check("focus moves to the log", await page.evaluate(() => document.activeElement?.getAttribute("role") === "log"))
}

async function reducedMotion(page) {
  await open(page, "reduce")
  await scrollUp(page)
  await pill(page).click()
  await page.waitForTimeout(16)
  check("under reduced motion the jump is instant", (await gap(page)) <= 1, `${await gap(page)}px after one frame`)
}

async function activity(page) {
  await open(page)
  const activityLog = page.getByRole("group", { name: "Activity" })
  await page.getByRole("button", { name: "Let the agent work" }).click()
  await activityLog.getByRole("button", { name: /Agent moved T-014 to review/ }).waitFor()
  check(
    "the agent's move is recorded as the agent's",
    (await activityLog.locator("li").first().getAttribute("data-actor")) === "agent",
  )
  check(
    "and offers Undo in a toast",
    await page.locator("[data-slot=toast]").getByRole("button", { name: "Undo" }).isVisible(),
  )

  await page.getByRole("switch", { name: "Notify me when a task needs review" }).click()
  await page.waitForTimeout(100)
  check(
    "a person's click is recorded as a person's",
    (await activityLog.locator("li").first().getAttribute("data-actor")) === "person",
  )

  const notify = page.getByRole("switch", { name: "Notify me when a task needs review" })
  await page.locator("body").click({ position: { x: 2, y: 2 } })
  await page.keyboard.press("Control+z")
  await page.waitForTimeout(300)
  check("Ctrl+Z undoes the click", (await notify.getAttribute("aria-checked")) === "false")
  await page.keyboard.press("Control+z")
  await page.waitForTimeout(300)
  const review = await page.locator("[data-slot=task-card][data-task-id=T-014]").first().getAttribute("data-status")
  check("and then the agent's move, on the board too", review !== "review", `T-014 is ${review}`)
  await page.keyboard.press("Control+Shift+z")
  await page.waitForTimeout(300)
  check(
    "Shift+Ctrl+Z redoes it",
    (await page.locator("[data-slot=task-card][data-task-id=T-014]").first().getAttribute("data-status")) === "review",
  )

  const field = page.getByRole("textbox", { name: "Message" })
  const position = await activityLog.locator("[aria-current=step]").textContent()
  await field.click()
  await page.keyboard.type("draft")
  await page.keyboard.press("Control+z")
  await page.waitForTimeout(300)
  check(
    "Ctrl+Z in the message field leaves the log alone",
    (await activityLog.locator("[aria-current=step]").textContent()) === position,
  )
  check("and isn't recorded, being outside the log's area", !(await activityLog.textContent())?.includes("Message"))
  await shot(page, "activity-log.png")
}

await withShowcase(async (page) => {
  await thread(page)
  await reducedMotion(page)
  await activity(page)
})

if (failures.length > 0) {
  console.error(`\n${failures.length} conversation check(s) failed`)
  process.exit(1)
}
