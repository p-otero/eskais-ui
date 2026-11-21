// Checks PrismPicker on the built showcase (?demo=prism-picker) in Chrome: a drag around the ring sweeps the
// spectrum and a drag on the prism turns it, at 1× and 4× CPU (canvas paint time, and pointer move to the next
// frame, with a ceiling at 1×); keys and an agent's step glide the prism; nothing paints while idle; reduced motion
// jumps in one paint; and a disabled picker ignores the pointer. `bun run test:browser` builds the showcase first.
/* oxlint-disable no-await-in-loop -- each pointer move waits for the frame the one before painted */
import { withShowcase } from "./showcase-browser.mjs"

// A frame at 60 Hz; the median run here is near 3 ms.
const moveToFrameP95Ms = 16

const percentile = (values, p) => {
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0
}
const summary = (values) =>
  `p50 ${percentile(values, 50).toFixed(1)} ms, p95 ${percentile(values, 95).toFixed(1)} ms (n=${String(values.length)})`

function expect(condition, message) {
  if (!condition) throw new Error(message)
}

async function dial(page) {
  const box = await page.locator('[data-slot="prism-stage"]').boundingBox()
  const radius = Math.min(box.height * 0.31, box.width * 0.3)
  const x = box.x + box.width * 0.5
  const y = box.y + box.height * 0.58
  return (degrees, distance = radius) => [
    x + Math.cos((degrees * Math.PI) / 180) * distance,
    y + Math.sin((degrees * Math.PI) / 180) * distance,
  ]
}

const value = (page) => page.getByRole("slider", { name: "Wavelength" }).inputValue()

async function listen(page) {
  await page.evaluate(() => {
    window.prismLatency = []
    window.prismProbe.paints.length = 0
    if (window.prismListening) return
    window.prismListening = true
    window.addEventListener(
      "pointermove",
      () => {
        const start = performance.now()
        requestAnimationFrame(() => {
          const channel = new MessageChannel()
          channel.port1.addEventListener("message", () => window.prismLatency.push(performance.now() - start))
          channel.port1.start()
          channel.port2.postMessage(null)
        })
      },
      { capture: true },
    )
  })
}

const nextFrame = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0))))

async function dragRing(page, steps) {
  const at = await dial(page)
  await listen(page)
  await page.mouse.move(...at(170))
  await page.mouse.down()
  for (let step = 0; step <= steps; step++) {
    await page.mouse.move(...at(170 - (step / steps) * 195))
    await nextFrame(page)
  }
  await page.mouse.up()
  return page.evaluate(() => ({ paints: [...window.prismProbe.paints], latency: [...window.prismLatency] }))
}

const paintsAfter = async (page, action) => {
  await page.evaluate(() => (window.prismProbe.paints.length = 0))
  await action()
  await page.waitForTimeout(400)
  return page.evaluate(() => window.prismProbe.paints.length)
}

await withShowcase(async (page) => {
  await page.goto(page.url().replace(/\/$/, "/?demo=prism-picker"))
  await page.waitForSelector('[data-slot="slider-thumb"]')
  await page.waitForTimeout(300)
  const client = await page.context().newCDPSession(page)

  for (const rate of [1, 4]) {
    await client.send("Emulation.setCPUThrottlingRate", { rate })
    const { paints, latency } = await dragRing(page, 120)
    console.log(`CPU ×${String(rate)} drag: paint ${summary(paints)}; pointer move to next frame ${summary(latency)}`)
    if (rate === 1) {
      expect(
        percentile(latency, 95) <= moveToFrameP95Ms,
        `A drag at 1× takes over ${String(moveToFrameP95Ms)} ms from pointer move to frame`,
      )
    }
  }
  await client.send("Emulation.setCPUThrottlingRate", { rate: 1 })
  expect((await value(page)) === "700", `A drag past the red end should hold at 700, not ${await value(page)}`)

  // Grabbing the prism turns it by the angle the pointer travels, from where the knob was.
  const at = await dial(page)
  const before = Number(await value(page))
  await page.mouse.move(...at(0, 20))
  await page.mouse.down()
  for (let step = 1; step <= 10; step++) {
    await page.mouse.move(...at(step * 8, 20))
    await nextFrame(page)
  }
  await page.mouse.up()
  expect(Number(await value(page)) < before, "Turning the prism clockwise should move toward violet")

  await page.getByRole("slider", { name: "Wavelength" }).focus()
  const glide = await paintsAfter(page, () => page.keyboard.press("PageUp"))
  console.log(`Page Up glides in ${String(glide)} paints`)
  expect(glide > 2, "A key press should glide the prism")

  const stepped = await page.evaluate(() =>
    window.prismProbe.agent.act({ steps: [{ ref: "Prism colour", action: "setWavelength", args: [470] }] }),
  )
  expect(stepped.ok && (await value(page)) === "470", "An agent's setWavelength should turn the dial to 470")

  await page.waitForTimeout(400)
  const idle = await paintsAfter(page, () => page.waitForTimeout(2000))
  console.log(`Idle for 2 s: ${String(idle)} paints`)
  expect(idle === 0, "The prism picker paints while idle")

  await page.emulateMedia({ reducedMotion: "reduce" })
  const reduced = await paintsAfter(page, () => page.keyboard.press("PageDown"))
  console.log(`Page Down with reduced motion: ${String(reduced)} paint`)
  expect(reduced === 1, `Reduced motion should jump in one paint, not ${String(reduced)}`)

  expect(
    (await page.locator('[data-slot="prism-grip"]').evaluate((grip) => getComputedStyle(grip).touchAction)) === "none",
    "The ring should take touches from page scrolling",
  )

  await page.getByRole("switch", { name: "Disabled" }).click()
  const held = await value(page)
  await page.mouse.move(...at(90))
  await page.mouse.down()
  await page.mouse.move(...at(30))
  await page.mouse.up()
  expect((await value(page)) === held, "A disabled picker should ignore a drag")
  console.log("prism-check: ok")
})
