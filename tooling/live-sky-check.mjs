import { withShowcase } from "./showcase-browser.mjs"

const frameP95BudgetMs = 12

function expect(condition, message) {
  if (!condition) throw new Error(message)
}

const percentile = (values, p) => {
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0
}

const forecast = {
  current: {
    time: 1_795_600_800,
    interval: 900,
    temperature_2m: 11.6,
    precipitation: 0.9,
    rain: 0.9,
    showers: 0,
    snowfall: 0,
    cloud_cover: 100,
    weather_code: 63,
    wind_speed_10m: 24,
    wind_direction_10m: 240,
    is_day: 1,
    visibility: 8000,
  },
  hourly: { time: [1_795_600_800], precipitation: [3.1] },
}

const framesOver = async (page, ms) => {
  await page.evaluate(() => (window.skyProbe.frames.length = 0))
  await page.waitForTimeout(ms)
  return page.evaluate(() => [...window.skyProbe.frames])
}

const cebuBronzeFacade = { left: 0.17, right: 0.24, top: 0.55, bottom: 0.75 }

const darkestAndBrightestFifth = (page) =>
  page.evaluate(
    (box) =>
      new Promise((done) => {
        const canvas = document.querySelector('[data-slot="live-sky-scene"] [data-slot="live-sky-canvas"]')
        const frames = window.skyProbe.frames
        const push = frames.push.bind(frames)
        frames.push = (pushed) => {
          frames.push = push
          const copy = document.createElement("canvas")
          copy.width = canvas.width
          copy.height = canvas.height
          const context = copy.getContext("2d")
          context.drawImage(canvas, 0, 0)
          const { data } = context.getImageData(
            Math.round(box.left * canvas.width),
            Math.round(box.top * canvas.height),
            Math.round((box.right - box.left) * canvas.width),
            Math.round((box.bottom - box.top) * canvas.height),
          )
          const light = []
          for (let at = 0; at < data.length; at += 4)
            light.push(0.2126 * data[at] + 0.7152 * data[at + 1] + 0.0722 * data[at + 2])
          light.sort((a, b) => a - b)
          const fifth = Math.floor(light.length / 5)
          let dark = 0
          let bright = 0
          for (let index = 0; index < fifth; index++) {
            dark += light[index]
            bright += light[light.length - 1 - index]
          }
          done({ dark: dark / fifth, bright: bright / fifth })
          return push(pushed)
        }
      }),
    cebuBronzeFacade,
  )

const scene = (page) => page.locator('[data-slot="live-sky-scene"]').first()

await withShowcase(
  async (page) => {
    const requests = []
    await page.route(
      (url) => url.hostname !== "localhost",
      (route) => {
        const url = new URL(route.request().url())
        requests.push(url)
        if (url.hostname.endsWith("open-meteo.com")) return route.fulfill({ json: forecast })
        return route.abort()
      },
    )
    await page.goto(page.url().replace(/\/(\?.*)?$/, "/?demo=live-sky&preset=downpour"))
    await scene(page).and(page.locator("[data-mode]")).waitFor()
    const renderer = await scene(page).getAttribute("data-renderer")
    console.log(`Renderer: ${String(renderer)}`)
    expect(renderer === "webgl-software", `SwiftShader should be detected as software GL, not ${String(renderer)}`)

    await page.waitForFunction(() => document.querySelector('[data-slot="live-sky-scene"]').dataset.staticPaints >= 3)
    await page.waitForTimeout(2500)
    const paintsBefore = await scene(page).getAttribute("data-static-paints")
    const running = await framesOver(page, 1500)
    const paintsAfter = await scene(page).getAttribute("data-static-paints")
    expect(
      paintsBefore === paintsAfter,
      `The street and sky were painted again while the weather held (${String(paintsBefore)} → ${String(paintsAfter)})`,
    )
    console.log(
      `Downpour on software GL: ${String(running.length)} frames in 1.5 s, p95 ${percentile(running, 95).toFixed(2)} ms`,
    )
    expect(running.length >= 20, "The sky should draw while it's on screen")
    expect(
      percentile(running, 95) <= frameP95BudgetMs,
      `A frame's drawing p95 should stay under ${String(frameP95BudgetMs)} ms`,
    )

    const live = page.getByRole("group", { name: "A Coruña sky" })
    await live.scrollIntoViewIfNeeded()
    await live.getByText("Moderate rain", { exact: true }).waitFor()
    const forecastRequest = requests.find((url) => url.pathname.endsWith("/forecast"))
    expect(
      forecastRequest?.searchParams.get("latitude") === "43.37",
      "The forecast should be asked for the rounded latitude",
    )
    expect(
      requests.every((url) => url.hostname.endsWith("open-meteo.com")),
      "Only Open-Meteo should be asked",
    )

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.setViewportSize({ width: 1100, height: 300 })
    const staticPaints = () => scene(page).evaluate((element) => Number(element.dataset.staticPaints))
    await page.getByRole("slider", { name: "Rain" }).focus()
    await page.waitForTimeout(700)
    const settledPaints = await staticPaints()
    for (let press = 0; press < 8; press++) {
      // oxlint-disable-next-line no-await-in-loop -- keys land one after another, as a person scrubbing presses them
      await page.keyboard.press("ArrowRight")
      // oxlint-disable-next-line no-await-in-loop -- the gap between presses is part of the scrub
      await page.waitForTimeout(40)
    }
    const whileScrubbing = await staticPaints()
    await page.waitForTimeout(700)
    const afterScrubbing = await staticPaints()
    console.log(
      `Scrubbing the rain: ${String(whileScrubbing - settledPaints)} static paints while keys came, ${String(afterScrubbing - whileScrubbing)} once they stopped`,
    )
    expect(whileScrubbing === settledPaints, "Scrubbing the rain should only move the rain until the keys stop")
    expect(
      afterScrubbing === whileScrubbing + 1,
      "The sky should be painted and lit again once, after the scrubbing stops",
    )

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(300)
    const hidden = await framesOver(page, 1500)
    console.log(`Off screen: ${String(hidden.length)} frames in 1.5 s`)
    expect(hidden.length === 0, "The sky draws while it's off screen")
    expect((await scene(page).getAttribute("data-mode")) === "paused", "An off-screen sky should be paused")

    await page.setViewportSize({ width: 1100, height: 900 })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.waitForTimeout(400)
    const still = await framesOver(page, 2000)
    console.log(`Reduced motion: ${String(still.length)} frames in 2 s`)
    expect((await scene(page).getAttribute("data-mode")) === "still", "Reduced motion should show stills")
    expect(still.length <= 1, `Reduced motion should hold a still, not draw ${String(still.length)} frames`)
    const fade = await scene(page)
      .locator('[data-slot="live-sky-still"]')
      .first()
      .evaluate((canvas) => getComputedStyle(canvas).transitionDuration)
    expect(fade === "2.4s", `The stills should crossfade over 2.4 s, not ${fade}`)
    await page.emulateMedia({ reducedMotion: "no-preference" })

    const refused = await page.evaluate(() =>
      window.skyProbe.agent.act({ steps: [{ ref: "Simulated sky", action: "refresh" }] }),
    )
    expect(
      !refused.ok && refused.error.message.includes("simulated weather"),
      "A simulated sky should refuse refresh with why",
    )

    await page.goto(page.url().replace(/\/(\?.*)?$/, "/?demo=live-sky&live=0&background=photo&preset=downpour"))
    await page.waitForFunction(
      () => Number(document.querySelector('[data-slot="live-sky-scene"][data-photo]')?.dataset.staticPaints) >= 2,
      undefined,
      { timeout: 30_000 },
    )
    await page.waitForTimeout(500)
    const overPhoto = await framesOver(page, 1500)
    console.log(`Downpour over the photo on software GL: ${String(overPhoto.length)} frames in 1.5 s`)
    expect(overPhoto.length >= 20, "The sky over a photo should draw at least 20 frames in 1.5 s on software GL")
    const calibrated = await page.evaluate(() =>
      window.skyProbe.agent.act({ steps: [{ ref: "Simulated sky", action: "calibrate", args: [210, 72, 0.5] }] }),
    )
    expect(calibrated.ok, "An agent should calibrate the photo")
    await page.getByRole("button", { name: "Calibrate" }).click()
    await page.getByRole("slider", { name: "Heading" }).waitFor()
    expect(
      (await page.getByRole("slider", { name: "Heading" }).inputValue()) === "210",
      "The calibration's Heading slider should show the agent's heading",
    )

    await page.goto(page.url().replace(/\/(\?.*)?$/, "/?demo=live-sky&live=0&background=photo&preset=rain"))
    await page.waitForFunction(
      () => Number(document.querySelector('[data-slot="live-sky-scene"][data-photo]')?.dataset.staticPaints) >= 2,
      undefined,
      { timeout: 30_000 },
    )
    await page.getByRole("switch", { name: "Glass" }).click()
    await page.waitForTimeout(800)
    const wet = await darkestAndBrightestFifth(page)
    await page.getByRole("slider", { name: "Rain" }).focus()
    await page.waitForTimeout(400)
    const wetPaints = await staticPaints()
    await page.keyboard.press("Home")
    await page.waitForFunction(
      (before) => Number(document.querySelector('[data-slot="live-sky-scene"]').dataset.staticPaints) > before,
      wetPaints,
    )
    await page.waitForTimeout(300)
    const dry = await darkestAndBrightestFifth(page)
    const darkLift = wet.dark / dry.dark - wet.bright / dry.bright
    console.log(`Rain on the Cebu tower's bronze façade: its dark gaps lift ${darkLift.toFixed(3)} against its fins`)
    expect(
      darkLift < 0.2,
      "Rain should darken a façade above the ground evenly, not lift its dark gaps with the wet ground's sheen",
    )

    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(300)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow <= 0, `The page overflows by ${String(overflow)}px at 390px`)
    const photoRatio = await scene(page).evaluate((element) => element.clientHeight / element.clientWidth)
    expect(
      Math.abs(photoRatio - 0.75) < 0.02,
      `At phone width the photo should keep its 4:3 shape, not ${String(photoRatio)}`,
    )
    await page.goto(page.url().replace(/\/(\?.*)?$/, "/?demo=live-sky&live=0&preset=rain"))
    await scene(page).and(page.locator("[data-mode]")).waitFor()
    const ratio = await scene(page).evaluate((element) => element.clientHeight / element.clientWidth)
    expect(ratio > 1.1, "At phone width the street should stand taller than wide")
    console.log("live-sky-check: ok")
  },
  {},
  { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
)
