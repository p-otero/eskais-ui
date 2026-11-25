import { useState } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { LiveSky, type LiveSkySimulation } from "@/components/ui/live-sky"
import { Select } from "@/components/ui/select"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack, SliderValue } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"

import { agent } from "../agent"
import "../../../../registry/styles/live-sky.css"

declare global {
  interface Window {
    /** Read by tooling/live-sky-check.mjs: each frame's drawing time in ms, and the agent bridge. */
    skyProbe?: { frames: number[]; agent: typeof agent }
  }
}

const probe = { frames: [] as number[], agent }
window.skyProbe = probe
const recordFrame = (milliseconds: number) => {
  probe.frames.push(milliseconds)
}

const coruna = { latitude: 43.37, longitude: -8.4, name: "A Coruña" }
const centralEuropeanOffsetHours = 1

const at = (hour: number) => Date.UTC(2026, 10, 25, 0, 0) + (hour - centralEuropeanOffsetHours) * 3_600_000

type Preset = { label: string; rain: number; hour: number; weather: LiveSkySimulation["weather"] }

const presets = {
  drizzle: {
    label: "Drizzle",
    rain: 18,
    hour: 13,
    weather: { weatherCode: 53, cloudCover: 100, windSpeed: 14, windDirection: 250, visibility: 7000, temperature: 13 },
  },
  rain: {
    label: "Rain",
    rain: 55,
    hour: 12,
    weather: { weatherCode: 63, cloudCover: 100, windSpeed: 22, windDirection: 240, visibility: 9000, temperature: 12 },
  },
  downpour: {
    label: "Downpour",
    rain: 92,
    hour: 11,
    weather: { weatherCode: 65, cloudCover: 100, windSpeed: 34, windDirection: 230, visibility: 2500, temperature: 11 },
  },
  "night-rain": {
    label: "Night rain",
    rain: 60,
    hour: 22.5,
    weather: { weatherCode: 63, cloudCover: 100, windSpeed: 18, windDirection: 250, visibility: 8000, temperature: 10 },
  },
  golden: {
    label: "Clear, golden hour",
    rain: 0,
    hour: 17.3,
    weather: { weatherCode: 1, cloudCover: 38, windSpeed: 8, windDirection: 300, visibility: 30_000, temperature: 14 },
  },
  snow: {
    label: "Snow",
    rain: 0,
    hour: 12,
    weather: {
      weatherCode: 73,
      snowfall: 1.4,
      precipitation: 1,
      cloudCover: 100,
      windSpeed: 9,
      windDirection: 20,
      visibility: 3000,
      temperature: -1,
    },
  },
  fog: {
    label: "Fog",
    rain: 0,
    hour: 9.5,
    weather: { weatherCode: 45, cloudCover: 90, windSpeed: 4, windDirection: 200, visibility: 250, temperature: 9 },
  },
} satisfies Record<string, Preset>

type PresetName = keyof typeof presets
const presetNames = Object.keys(presets).filter((name): name is PresetName => name in presets)
const presetOptions = presetNames.map((name) => ({ value: name, label: presets[name].label }))

const rainRateAt = (position: number) => (position <= 0 ? 0 : 0.08 * 10 ** ((position / 100) * 2.4))
const rainCodeAt = (rate: number, base: number) => {
  if (rate <= 0) return base
  if (rate < 0.5) return 53
  if (rate < 7.6) return 63
  return 65
}

const params = new URLSearchParams(location.search)
const initialPreset = presetNames.find((name) => name === params.get("preset")) ?? "rain"
const showLive = params.get("live") !== "0"

const hourText = (hour: number) =>
  `${String(Math.floor(hour)).padStart(2, "0")}:${String(Math.round((hour % 1) * 60)).padStart(2, "0")}`

function LiveSkyDemo() {
  const [preset, setPreset] = useState<PresetName>(initialPreset)
  const [rain, setRain] = useState<number>(presets[initialPreset].rain)
  const [hour, setHour] = useState<number>(presets[initialPreset].hour)
  const [glass, setGlass] = useState(true)
  const chosen = presets[preset]
  const rate = rainRateAt(rain)
  const raining = chosen.rain > 0 || rain > 0
  const simulate: LiveSkySimulation = {
    location: coruna,
    time: at(hour),
    weather: {
      ...chosen.weather,
      ...(raining
        ? {
            precipitation: rate,
            rain: rate,
            weatherCode: rainCodeAt(rate, chosen.weather.weatherCode),
            cloudCover: rate > 0 ? 100 : chosen.weather.cloudCover,
          }
        : {}),
    },
  }

  const choose = (name: PresetName | null) => {
    if (!name) return
    setPreset(name)
    setRain(presets[name].rain)
    setHour(presets[name].hour)
  }

  return (
    <main className="flex min-h-dvh justify-center bg-background p-inset-surface text-foreground">
      <div className="flex w-full max-w-4xl flex-col gap-section">
        <section className="flex flex-col gap-group" aria-labelledby="scrubber-title">
          <header className="flex flex-wrap items-end justify-between gap-items">
            <h1 id="scrubber-title" className="text-display-sm tracking-tight">
              Live sky
            </h1>
            <Label>
              <Switch checked={glass} onCheckedChange={setGlass} />
              Glass
            </Label>
          </header>
          <div className="flex flex-wrap items-end gap-group">
            <Field className="w-56">
              <FieldLabel>Weather</FieldLabel>
              <Select<PresetName> options={presetOptions} value={preset} onValueChange={choose} />
            </Field>
            <Field className="min-w-56 grow basis-0">
              <Slider
                value={rain}
                onValueChange={(next: number) => setRain(next)}
                min={0}
                max={100}
                step={1}
                format={() => `${rate.toFixed(rate < 1 ? 2 : 1)} mm/h`}
              >
                <div className="flex justify-between text-body-sm">
                  <FieldLabel>Rain</FieldLabel>
                  <SliderValue />
                </div>
                <SliderControl>
                  <SliderTrack>
                    <SliderIndicator />
                    <SliderThumb />
                  </SliderTrack>
                </SliderControl>
              </Slider>
            </Field>
            <Field className="min-w-56 grow basis-0">
              <Slider
                value={hour}
                onValueChange={(next: number) => setHour(next)}
                min={0}
                max={24}
                step={0.25}
                format={hourText}
              >
                <div className="flex justify-between text-body-sm">
                  <FieldLabel>Time of day</FieldLabel>
                  <SliderValue />
                </div>
                <SliderControl>
                  <SliderTrack>
                    <SliderIndicator />
                    <SliderThumb />
                  </SliderTrack>
                </SliderControl>
              </Slider>
            </Field>
          </div>
          <LiveSky label="Simulated sky" simulate={simulate} glass={glass} onFrame={recordFrame} />
        </section>
        {showLive ? (
          <section className="flex flex-col gap-group" aria-labelledby="live-title">
            <h2 id="live-title" className="text-title tracking-tight">
              A Coruña, now
            </h2>
            <LiveSky label="A Coruña sky" location={coruna} />
          </section>
        ) : null}
      </div>
    </main>
  )
}

export { LiveSkyDemo }
