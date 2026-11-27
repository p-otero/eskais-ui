/* oxlint-disable no-await-in-loop -- each pointer move waits for the frame the one before painted */
import { withShowcase } from "./showcase-browser.mjs"

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

const nextFrame = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 0))))

async function open(page, demo) {
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto(new URL(`/?demo=${demo}`, page.url()).href)
  await page.waitForFunction(() => window.instrumentProbe !== undefined)
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    window.instrumentLatency = []
    window.addEventListener(
      "pointermove",
      () => {
        const start = performance.now()
        requestAnimationFrame(() => {
          const channel = new MessageChannel()
          channel.port1.addEventListener("message", () => window.instrumentLatency.push(performance.now() - start))
          channel.port1.start()
          channel.port2.postMessage(null)
        })
      },
      { capture: true },
    )
  })
}

const paints = (page) => page.evaluate(() => window.instrumentProbe.paints.length)
const clearPaints = (page) => page.evaluate(() => (window.instrumentProbe.paints.length = 0))
const latency = (page) => page.evaluate(() => window.instrumentLatency.splice(0))
const act = (page, ref, action, args = []) =>
  page.evaluate((step) => window.instrumentProbe.agent.act({ steps: [step] }), { ref, action, args })

async function styleWorkWhileIdle(page, client) {
  await page.waitForTimeout(500)
  const metric = async () => {
    const { metrics } = await client.send("Performance.getMetrics")
    const value = (name) => metrics.find((entry) => entry.name === name)?.value ?? 0
    return value("RecalcStyleCount") + value("LayoutCount")
  }
  const before = await metric()
  await page.waitForTimeout(2000)
  return (await metric()) - before
}

async function drag(page, from, to, steps) {
  await page.mouse.move(...from)
  await page.mouse.down()
  for (let step = 1; step <= steps; step++) {
    const t = step / steps
    await page.mouse.move(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t)
    await nextFrame(page)
  }
  await page.mouse.up()
}

async function sunArc(page, client) {
  await open(page, "sun-arc")
  const sun = page.getByRole("slider", { name: "Time" })
  const stage = await page.locator('[data-slot="sun-arc-stage"]').boundingBox()
  const thumb = await page.locator('[data-slot="sun-arc-stage"] [data-slot="slider-thumb"]').boundingBox()
  const at = [thumb.x + thumb.width / 2, thumb.y + thumb.height / 2]
  for (const rate of [1, 4]) {
    await client.send("Emulation.setCPUThrottlingRate", { rate })
    await clearPaints(page)
    await latency(page)
    await drag(page, at, [stage.x + stage.width * 0.3, at[1]], 60)
    const moves = await latency(page)
    console.log(
      `sun-arc CPU ×${String(rate)} drag: ${String(await paints(page))} paints; move to frame ${summary(moves)}`,
    )
    if (rate === 1) expect(percentile(moves, 95) <= moveToFrameP95Ms, "A sun-arc drag takes over 16 ms to a frame")
    await drag(page, [stage.x + stage.width * 0.3, at[1]], at, 20)
  }
  await client.send("Emulation.setCPUThrottlingRate", { rate: 1 })

  await clearPaints(page)
  await page.getByRole("button", { name: /Sunset/ }).click()
  await page.waitForTimeout(700)
  const glide = await paints(page)
  console.log(`sun-arc: Sunset glides in ${String(glide)} paints`)
  expect(glide > 2, "A preset should glide the sun")
  expect(
    Number(await sun.inputValue()) === 1085,
    "Sunset (18:03) should move the sun to 18:05, the nearest 5-minute step",
  )

  const stepped = await act(page, "Meeting time", "setTime", ["09:30"])
  expect(stepped.ok && (await sun.inputValue()) === "570", "An agent's setTime should move the sun to 9:30")
  await page.waitForTimeout(700)
  await clearPaints(page)
  await page.waitForTimeout(2000)
  expect((await paints(page)) === 0, "The sun arc paints while idle")

  await page.emulateMedia({ reducedMotion: "reduce" })
  await clearPaints(page)
  await page.getByRole("button", { name: /Solar noon/ }).click()
  await page.waitForTimeout(500)
  expect((await paints(page)) === 1, `Reduced motion should jump in one paint, not ${String(await paints(page))}`)

  const touch = await page
    .locator('[data-slot="sun-arc-stage"] [data-slot="slider-thumb"]')
    .evaluate((element) => getComputedStyle(element).touchAction)
  expect(touch === "none", "The sun should take touches from page scrolling")
  console.log("sun-arc: ok")
}

async function sunArcPhoto(page, client) {
  await open(page, "sun-arc&mode=photo")
  await page.locator('[data-slot="sun-arc-photo"][data-masked]').waitFor({ timeout: 15_000 })
  const sun = page.getByRole("slider", { name: "Time" })
  const stageOf = () => page.locator('[data-slot="sun-arc-stage"]')
  expect(
    await page.getByRole("slider", { name: "Heading" }).isVisible(),
    "A photo without a heading should open the calibration",
  )
  const calibrated = await act(page, "Meeting time", "calibrate", [82, 67])
  expect(calibrated.ok, `An agent's calibrate should point the photo: ${calibrated.error?.message ?? ""}`)
  await act(page, "Meeting time", "setTime", ["06:20"])
  await page.waitForTimeout(600)
  expect((await stageOf().getAttribute("data-sun-out")) === null, "At 6:20 facing east the sun should be in the photo")
  await act(page, "Meeting time", "setTime", ["12:00"])
  await page.waitForTimeout(600)
  console.log(`sun-arc photo: at noon the sun is out by the ${String(await stageOf().getAttribute("data-sun-out"))}`)
  expect((await stageOf().getAttribute("data-sun-out")) !== null, "At noon the sun is overhead, out of the photo")

  await act(page, "Meeting time", "setTime", ["06:20"])
  await page.waitForTimeout(600)
  const thumb = await page.locator('[data-slot="sun-arc-stage"] [data-slot="slider-thumb"]').boundingBox()
  const from = [thumb.x + thumb.width / 2, thumb.y + thumb.height / 2]
  const before = Number(await sun.inputValue())
  await latency(page)
  await drag(page, from, [from[0] + 10, from[1] - 120], 30)
  const moves = await latency(page)
  const after = Number(await sun.inputValue())
  console.log(
    `sun-arc photo drag up the arc: ${String(before)} to ${String(after)} min; move to frame ${summary(moves)}`,
  )
  expect(after > before, "Dragging the sun up its morning arc should move later")
  expect(percentile(moves, 95) <= moveToFrameP95Ms, "A photo sun drag takes over 16 ms to a frame")

  await sun.focus()
  for (let press = 0; press < 6; press++) await page.keyboard.press("PageUp")
  await page.waitForTimeout(400)
  await clearPaints(page)
  const idle = await styleWorkWhileIdle(page, client)
  console.log(
    `sun-arc photo: idle for 2 s, ${String(await paints(page))} paints, ${String(idle)} style recalcs and layouts`,
  )
  expect((await paints(page)) === 0 && idle === 0, "The photo sun arc works while idle")

  await page.emulateMedia({ reducedMotion: "reduce" })
  await clearPaints(page)
  await page.getByRole("button", { name: /Sunset/ }).click()
  await page.waitForTimeout(500)
  expect((await paints(page)) === 1, `Reduced motion should jump in one paint, not ${String(await paints(page))}`)

  expect((await page.locator('[data-slot="sun-arc-clouds"]').count()) === 0, "Clouds should be off by default")
  await page.getByRole("switch", { name: "Keep clouds" }).click()
  await page.locator('[data-slot="sun-arc-clouds"]').waitFor({ timeout: 15_000 })
  const windows = await page.locator('[data-slot="sun-arc-photo"] [data-light="windows"]').count()
  console.log(`sun-arc photo: clouds kept, window glow ${windows > 0 ? "on" : "found no windows"}`)
  await page.waitForTimeout(400)
  await clearPaints(page)
  const cloudsIdle = await styleWorkWhileIdle(page, client)
  expect((await paints(page)) === 0 && cloudsIdle === 0, "The photo with its clouds works while idle")
  console.log("sun-arc photo: ok")
}

async function mixer(page, client) {
  await open(page, "mixer")
  const faders = ["Sales", "Support", "Product", "Brand"]
  const values = () => Promise.all(faders.map((name) => page.getByRole("slider", { name }).inputValue().then(Number)))
  const cap = await page.locator('[data-slot="mixer-fader"] [data-slot="slider-thumb"]').first().boundingBox()
  const from = [cap.x + cap.width / 2, cap.y + cap.height / 2]
  await latency(page)
  await drag(page, from, [from[0], from[1] - 80], 40)
  const moves = await latency(page)
  console.log(`mixer drag: move to frame ${summary(moves)}`)
  expect(percentile(moves, 95) <= moveToFrameP95Ms, "A mixer drag takes over 16 ms to a frame")
  const after = await values()
  expect(after.reduce((sum, value) => sum + value, 0) === 100, `The channels should sum to 100, not ${after.join("+")}`)
  expect(after[0] > 35 && after[3] === 15, `Sales should rise and locked Brand stay at 15: ${after.join(", ")}`)

  const refused = await act(page, "Budget split", "setChannel", ["sales", 95])
  expect(!refused.ok && refused.error.message.includes("at most 85"), "setChannel past the locks should fail with why")
  const set = await act(page, "Budget split", "setChannel", ["support", 40])
  expect(set.ok && (await values())[1] === 40, "An agent's setChannel should move Support to 40")

  const idle = await styleWorkWhileIdle(page, client)
  console.log(`mixer: idle for 2 s, ${String(idle)} style recalcs and layouts`)
  expect(idle === 0, "The mixer restyles while idle")
  console.log("mixer: ok")
}

async function safeDial(page, client) {
  await open(page, "safe-dial")
  const code = page.getByRole("textbox", { name: "Combination" })
  const dial = await page.locator('[data-slot="safe-dial-dial"]').boundingBox()
  const centre = [dial.x + dial.width / 2, dial.y + dial.height / 2]
  const radius = dial.width * 0.4
  const point = (degrees) => [
    centre[0] + Math.cos((degrees * Math.PI) / 180) * radius,
    centre[1] + Math.sin((degrees * Math.PI) / 180) * radius,
  ]
  await latency(page)
  await page.mouse.move(...point(-90))
  await page.mouse.down()
  for (let step = 1; step <= 30; step++) {
    await page.mouse.move(...point(-90 + step * 3))
    await nextFrame(page)
  }
  await page.mouse.up()
  const moves = await latency(page)
  console.log(`safe-dial drag: move to frame ${summary(moves)}`)
  expect(percentile(moves, 95) <= moveToFrameP95Ms, "A safe-dial drag takes over 16 ms to a frame")
  expect((await code.inputValue()) === "270425", `A quarter turn should enter 25, not ${await code.inputValue()}`)

  await page.getByRole("slider", { name: "Dial" }).focus()
  await page.keyboard.press("Backspace")
  await page.keyboard.press("ArrowLeft")
  await page.keyboard.press("Enter")
  expect(
    (await code.inputValue()) === "270424",
    `Backspace then ← and Enter should give 270424, not ${await code.inputValue()}`,
  )

  const entered = await act(page, "Vault combination", "enter", ["11-22-33-44"])
  expect(entered.ok && (await code.inputValue()) === "11223344", "An agent's enter should fill the code")
  const refused = await act(page, "Vault combination", "enter", ["11-22"])
  expect(!refused.ok && refused.error.message.includes("takes 4 numbers"), "A short code should fail with why")

  await page.getByRole("slider", { name: "Dial" }).blur()
  const idle = await styleWorkWhileIdle(page, client)
  console.log(`safe-dial: idle for 2 s, ${String(idle)} style recalcs and layouts`)
  expect(idle === 0, "The safe dial restyles while idle")
  console.log("safe-dial: ok")
}

async function safeVault(page, client) {
  await open(page, "safe-vault")
  const vault = page.locator('[data-slot="safe-vault"]')
  const code = page.getByRole("textbox", { name: "Combination" })
  const contents = page.locator('[data-slot="safe-vault-contents"]')
  await page.waitForFunction(
    () => document.querySelector('[data-slot="safe-vault"]')?.dataset.vault === "3d",
    undefined,
    {
      timeout: 20_000,
    },
  )
  const loaded = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name))
  const inWorker = loaded.some((name) => name.includes("safe-vault-worker"))
  console.log(`safe-vault: the safe draws ${inWorker ? "in its worker" : "on the page"}`)
  expect(inWorker && !loaded.some((name) => name.includes("safe-vault-runner")), "The safe should draw in its worker")

  const dial = await page.locator('[data-slot="safe-dial-dial"]').boundingBox()
  const centre = [dial.x + dial.width / 2, dial.y + dial.height / 2]
  const radius = dial.width * 0.4
  const point = (degrees) => [
    centre[0] + Math.cos((degrees * Math.PI) / 180) * radius,
    centre[1] + Math.sin((degrees * Math.PI) / 180) * radius,
  ]
  await latency(page)
  await page.mouse.move(...point(-90))
  await page.mouse.down()
  for (let step = 1; step <= 30; step++) {
    await page.mouse.move(...point(-90 + step * 3))
    await nextFrame(page)
  }
  await page.mouse.up()
  const moves = await latency(page)
  console.log(`safe-vault drag on the 3D dial: move to frame ${summary(moves)}`)
  expect(percentile(moves, 95) <= moveToFrameP95Ms, "A drag on the 3D dial takes over 16 ms to a frame")
  expect(
    (await code.inputValue()) === "25",
    `A quarter turn of the 3D dial should enter 25, not ${await code.inputValue()}`,
  )

  const denied = await act(page, "Vault", "enter", ["11-22-33-44"])
  expect(denied.ok, "An agent's wrong code should still enter")
  expect((await vault.getAttribute("data-status")) === "denied", "A wrong code should be denied")
  await page.waitForTimeout(800)
  expect(
    (await code.inputValue()) === "" && (await vault.getAttribute("data-status")) === "locked",
    "A denied code should clear and lock again once the dial has shaken",
  )

  const started = Date.now()
  const entered = await act(page, "Vault", "enter", ["27-46-13-33"])
  expect(entered.ok, "An agent's enter should unlock the vault")
  await page.waitForTimeout(1200)
  expect((await contents.getAttribute("inert")) !== null, "The contents should stay inert while the door swings")
  await page.waitForFunction(() => !document.querySelector('[data-slot="safe-vault-contents"]')?.hasAttribute("inert"))
  console.log(`safe-vault: open in ${String(Date.now() - started)} ms`)
  const copy = page.getByRole("button", { name: "Copy" })
  const hit = await copy.evaluate((button) => {
    const box = button.getBoundingClientRect()
    return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest("button") === button
  })
  expect(hit, "The plaque's Copy button should be hit where it shows, through the plaque's transform")
  await copy.click()
  expect((await page.getByRole("button", { name: "Copied" }).count()) === 1, "A click on the plaque should press Copy")

  await page.evaluate(() => {
    window.vaultFrames = 0
    const original = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (callback) =>
      original((time) => {
        window.vaultFrames += 1
        callback(time)
      })
  })
  const idle = await styleWorkWhileIdle(page, client)
  const frames = await page.evaluate(() => window.vaultFrames)
  console.log(`safe-vault: open and idle for 2 s, ${String(frames)} frames, ${String(idle)} style recalcs and layouts`)
  expect(frames === 0 && idle === 0, "The open vault works while idle")

  await act(page, "Lock", "press")
  const closing = await contents.evaluate((region) => ({
    shown: !region.hidden && (region.textContent ?? "").includes("esk_demo_"),
    reachable: !region.hasAttribute("inert") || region.getAttribute("aria-hidden") !== "true",
  }))
  const agentSeesCopy = await page.evaluate(() =>
    window.instrumentProbe.agent.snapshot().some((entry) => !entry.offPage && /^Cop(y|ied)$/.test(entry.label ?? "")),
  )
  expect(
    closing.shown && !closing.reachable && !agentSeesCopy,
    `Locking should leave the contents on the plaque, out of reach of people and agents: ${JSON.stringify(closing)}`,
  )
  await page.waitForTimeout(2100)
  expect((await page.getByText("esk_demo_").count()) === 0, "The contents should leave the page once the door shuts")

  await page.emulateMedia({ reducedMotion: "reduce" })
  await act(page, "Vault", "enter", ["27-46-13-33"])
  await page.waitForTimeout(150)
  expect((await contents.getAttribute("inert")) === null, "Under reduced motion the vault should open at once")
  await act(page, "Lock", "press")
  console.log("safe-vault: ok")
}

async function vinyl(page) {
  await open(page, "vinyl-scrubber")
  const position = page.getByRole("slider", { name: "Position" })
  const play = page.getByRole("button", { name: "Play" })
  await clearPaints(page)
  await play.click()
  await page.waitForTimeout(1000)
  const playingPaints = await paints(page)
  console.log(`vinyl: 1 s of playback, ${String(playingPaints)} paints`)
  expect(playingPaints > 30, "The record should turn every frame while it plays")
  await play.click()
  await page.waitForTimeout(300)
  await clearPaints(page)
  await page.waitForTimeout(2000)
  expect((await paints(page)) === 0, "The vinyl scrubber paints while paused")

  const turntable = page.locator('[data-slot="vinyl-turntable"]')
  await turntable
    .locator("canvas")
    .waitFor({ state: "attached", timeout: 5000 })
    .catch(() => {})
  await page
    .waitForFunction(() => document.querySelector('[data-slot="vinyl-turntable"]')?.dataset.renderer, undefined, {
      timeout: 15_000,
    })
    .catch(() => {})
  const rendered = await turntable.getAttribute("data-renderer")
  console.log(`vinyl: the turntable draws with ${rendered ?? "CSS"}`)
  const before = Number(await position.inputValue())
  const table = await turntable.boundingBox()
  const platter = await turntable.locator('[data-slot="vinyl-platter"]').boundingBox()
  const recordRingOnStage = rendered
    ? {
        x: table.x + table.width * 0.4258,
        y: table.y + table.height * 0.5674,
        rx: table.width * 0.1,
        ry: table.height * 0.072,
      }
    : {
        x: platter.x + platter.width / 2,
        y: platter.y + platter.height / 2,
        rx: platter.width * 0.3,
        ry: platter.width * 0.3,
      }
  const ring = recordRingOnStage
  await page.mouse.move(ring.x, ring.y - ring.ry)
  await page.mouse.down()
  for (let step = 1; step <= 108; step++) {
    const angle = -90 + step * 10
    await page.mouse.move(
      ring.x + Math.cos((angle * Math.PI) / 180) * ring.rx,
      ring.y + Math.sin((angle * Math.PI) / 180) * ring.ry,
    )
    await nextFrame(page)
  }
  await page.mouse.up()
  const scratched = Number(await position.inputValue())
  console.log(`vinyl: three turns scratched ${String(before)} s to ${String(scratched)} s`)
  expect(
    Math.abs(scratched - before - 3 * 1.8) < 0.5,
    "Three turns clockwise on the record should move about 5.4 s forward",
  )

  const seek = await act(page, "Track 2", "seek", ["5:00"])
  expect(seek.ok && (await position.inputValue()) === "300", "An agent's seek should move to 5:00")
  const past = await act(page, "Track 2", "seek", [900])
  expect(!past.ok && past.error.message.includes("takes 0 to 400 seconds"), "A seek past the end should fail with why")

  await page.emulateMedia({ reducedMotion: "reduce" })
  await clearPaints(page)
  await play.click()
  await page.waitForTimeout(1000)
  const reduced = await paints(page)
  await play.click()
  console.log(`vinyl: 1 s of playback with reduced motion, ${String(reduced)} paints`)
  expect(reduced <= 6, "Reduced motion should paint only when the time changes")
  console.log("vinyl-scrubber: ok")
}

await withShowcase(async (page) => {
  const client = await page.context().newCDPSession(page)
  await client.send("Performance.enable")
  await sunArc(page, client)
  await sunArcPhoto(page, client)
  await mixer(page, client)
  await safeDial(page, client)
  await safeVault(page, client)
  await vinyl(page)
  console.log("instruments-check: ok")
})
