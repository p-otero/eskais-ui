// Measures the prism picker prototype (?demo=prism-picker) on the built showcase: a drag around the dial at 1× and
// 4× CPU (canvas paint time, and pointer move to the next frame), the paints a key press's glide makes, and that
// nothing paints while it's idle. Build first: `bun run --cwd apps/showcase build`.
/* oxlint-disable no-await-in-loop -- each pointer move waits for the frame the one before painted */
import { withShowcase } from "./showcase-browser.mjs"

const percentile = (values, p) => {
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0
}
const summary = (values) =>
  `p50 ${percentile(values, 50).toFixed(2)} ms, p95 ${percentile(values, 95).toFixed(2)} ms, max ${Math.max(...values).toFixed(2)} ms (n=${values.length})`

async function ring(page) {
  const box = await page.locator('[data-slot="prism-picker"] > div').first().boundingBox()
  const radius = Math.min(box.height * 0.31, box.width * 0.3)
  return { x: box.x + box.width * 0.5, y: box.y + box.height * 0.58, radius }
}

async function drag(page, steps) {
  const { x, y, radius } = await ring(page)
  const at = (degrees) => [
    x + Math.cos((degrees * Math.PI) / 180) * radius,
    y + Math.sin((degrees * Math.PI) / 180) * radius,
  ]
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
  await page.mouse.move(...at(170))
  await page.mouse.down()
  for (let step = 0; step <= steps; step++) {
    await page.mouse.move(...at(170 - (step / steps) * 180))
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0))))
  }
  await page.mouse.up()
  return page.evaluate(() => ({ paints: [...window.prismProbe.paints], latency: [...window.prismLatency] }))
}

await withShowcase(async (page) => {
  await page.goto(page.url().replace(/\/$/, "/?demo=prism-picker"))
  await page.waitForSelector('[data-slot="slider-thumb"]')
  await page.waitForTimeout(300)
  const client = await page.context().newCDPSession(page)
  for (const rate of [1, 4]) {
    await client.send("Emulation.setCPUThrottlingRate", { rate })
    const { paints, latency } = await drag(page, 120)
    console.log(`CPU ×${rate} drag: paint ${summary(paints)}`)
    console.log(`CPU ×${rate} drag: pointer move to next frame ${summary(latency)}`)
  }
  await client.send("Emulation.setCPUThrottlingRate", { rate: 1 })

  await page.evaluate(() => (window.prismProbe.paints.length = 0))
  await page.getByRole("slider").focus()
  await page.keyboard.press("PageUp")
  await page.waitForTimeout(400)
  const glide = await page.evaluate(() => window.prismProbe.paints.length)
  console.log(`Page Up glides in ${glide} paints`)

  await page.evaluate(() => (window.prismProbe.paints.length = 0))
  await page.waitForTimeout(2000)
  const idle = await page.evaluate(() => window.prismProbe.paints.length)
  console.log(`Idle for 2 s: ${idle} paints`)
  if (idle !== 0) throw new Error("The prism picker paints while idle")

  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.evaluate(() => (window.prismProbe.paints.length = 0))
  await page.keyboard.press("PageDown")
  await page.waitForTimeout(400)
  const reduced = await page.evaluate(() => window.prismProbe.paints.length)
  console.log(`Page Up with reduced motion: ${reduced} paint`)
  if (reduced !== 1) throw new Error(`Reduced motion should jump in one paint, got ${reduced}`)
})
