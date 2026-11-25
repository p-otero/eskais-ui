import { withShowcase } from "./showcase-browser.mjs"

function expect(condition, message) {
  if (!condition) throw new Error(message)
}

const demoUrl = (page, demo) => page.url().replace(/\/(\?.*)?$/, `/?demo=${demo}`)

async function countFrames(page, milliseconds) {
  return page.evaluate(
    (duration) =>
      new Promise((done) => {
        const original = window.requestAnimationFrame
        let calls = 0
        window.requestAnimationFrame = (callback) => {
          calls++
          return original.call(window, callback)
        }
        setTimeout(() => {
          window.requestAnimationFrame = original
          done(calls)
        }, duration)
      }),
    milliseconds,
  )
}

async function ledPaintsDuring(page, action, settleMs = 1000) {
  await page.evaluate(() => (window.ledProbe.paints.length = 0))
  await action()
  await page.waitForTimeout(settleMs)
  return page.evaluate(() => window.ledProbe.paints.length)
}

async function checkLedMatrix(page) {
  await page.goto(demoUrl(page, "led-matrix"))
  await page.waitForSelector('[data-slot="led-matrix-dots"]')
  await page.waitForTimeout(400)
  const sign = page.getByRole("marquee", { name: "Pharmacy sign" })

  const scrolling = await ledPaintsDuring(page, async () => {})
  console.log(`Scrolling for 1 s: ${String(scrolling)} paints`)
  expect(
    scrolling >= 15 && scrolling <= 40,
    `A sign at 24 dots a second should paint about 24 times, not ${String(scrolling)}`,
  )

  await sign.getByRole("button", { name: "Pause" }).click()
  await page.waitForTimeout(200)
  const paused = await ledPaintsDuring(page, async () => {})
  console.log(`Paused for 1 s: ${String(paused)} paints`)
  expect(paused <= 1, "A paused sign paints")

  const resumed = await ledPaintsDuring(page, () =>
    page.evaluate(() => window.ledProbe.agent.act({ steps: [{ ref: "Pharmacy sign", action: "resume" }] })),
  )
  expect(resumed > 10, "An agent's resume should start the sign again")

  const offScreen = await ledPaintsDuring(page, () =>
    page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)),
  )
  console.log(`Scrolled off screen for 1 s: ${String(offScreen)} paints`)
  expect(offScreen <= 1, "A sign off screen paints")
  await page.evaluate(() => window.scrollTo(0, 0))

  await page.emulateMedia({ reducedMotion: "reduce" })
  const paged = await ledPaintsDuring(page, async () => {}, 2000)
  console.log(`Reduced motion for 2 s: ${String(paged)} paints`)
  expect(paged <= 2, `Under reduced motion the sign should hold a page, not paint ${String(paged)} times`)
  await page.emulateMedia({ reducedMotion: "no-preference" })

  const text = await sign.locator('[data-slot="led-matrix-text"]').textContent()
  expect(text?.startsWith("Pharmacy on duty"), `The live text should be the first message, not ${String(text)}`)
}

async function checkIdle(page, demo, settleMs) {
  await page.goto(demoUrl(page, demo))
  await page.waitForTimeout(settleMs)
  const frames = await countFrames(page, 2000)
  console.log(`${demo} idle for 2 s: ${String(frames)} frame callbacks`)
  expect(frames === 0, `${demo} asks for frames while idle`)
}

async function checkNeonSign(page) {
  await checkIdle(page, "neon-sign", 2500)
  const studio = page.getByRole("status", { name: "Studio" })
  const result = await page.evaluate(() =>
    window.neonProbe.agent.act({ steps: [{ ref: "Studio", action: "turnOff" }] }),
  )
  expect(
    result.ok && (await studio.getAttribute("data-state")) === "off",
    "An agent's turnOff should switch the sign off",
  )
  await page.getByRole("switch", { name: "Studio live" }).click()
  expect((await studio.getAttribute("data-striking")) === "", "Turning the sign on should strike it")
  await page.waitForTimeout(2200)
  expect((await studio.getAttribute("data-striking")) === null, "The strike should end")
}

async function checkChalkboard(page) {
  await checkIdle(page, "chalkboard", 7000)
  await page.getByRole("button", { name: "Wipe and rewrite" }).click()
  const board = page.getByRole("region", { name: "Today's menu" })
  expect(await board.getByRole("heading", { name: "Tonight" }).isVisible(), "The new words should be on the board")
  await page.waitForTimeout(2600)
  expect((await board.locator('[data-slot="chalkboard-erasing"]').count()) === 0, "The smudge should clear")
}

async function checkTeletext(page) {
  await checkIdle(page, "teletext", 800)
  const region = page.locator('[data-slot="teletext-page"]')
  await region.focus()
  await page.keyboard.type("400")
  expect(
    (await page.locator('[data-slot="teletext-number"][data-searching]').count()) === 1,
    "The counter should search after three digits",
  )
  await page.waitForTimeout(1200)
  expect((await region.getAttribute("aria-label")) === "Weather", "Typing 400 should tune to the weather")
  await page.getByRole("button", { name: "TV guide" }).click()
  await page.waitForTimeout(1200)
  expect((await region.getAttribute("aria-label")) === "TV guide", "The yellow key should go to the TV guide")
  const box = await page.locator('[data-slot="teletext"]').boundingBox()
  expect(Math.abs(box.width / box.height - 4 / 3) < 0.01, "The set should be 4:3")
}

await withShowcase(async (page) => {
  await checkLedMatrix(page)
  await checkNeonSign(page)
  await checkChalkboard(page)
  await checkTeletext(page)
  console.log("signs-check: ok")
})
