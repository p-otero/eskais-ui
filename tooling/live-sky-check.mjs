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

    const running = await framesOver(page, 1500)
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

    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(300)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow <= 0, `The page overflows by ${String(overflow)}px at 390px`)
    const ratio = await scene(page).evaluate((element) => element.clientHeight / element.clientWidth)
    expect(ratio > 1.1, "At phone width the scene should stand taller than wide")
    console.log("live-sky-check: ok")
  },
  {},
  { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
)
