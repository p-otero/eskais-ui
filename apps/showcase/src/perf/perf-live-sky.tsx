import { useState } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { LiveSky } from "@/components/ui/live-sky"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack } from "@/components/ui/slider"

import "../../../../registry/styles/live-sky.css"

const coruna = { latitude: 43.37, longitude: -8.4, name: "A Coruña" }
const noon = Date.UTC(2026, 10, 25, 11)

function LiveSkyScenario() {
  const [rain, setRain] = useState(2)
  return (
    <div className="flex w-full max-w-3xl flex-col gap-group">
      <Field>
        <Slider value={rain} onValueChange={(next: number) => setRain(next)} min={0} max={20} step={0.5}>
          <FieldLabel>Rain rate</FieldLabel>
          <SliderControl>
            <SliderTrack>
              <SliderIndicator />
              <SliderThumb />
            </SliderTrack>
          </SliderControl>
        </Slider>
      </Field>
      <LiveSky
        label="Scrubbed sky"
        simulate={{
          location: coruna,
          time: noon,
          weather: { weatherCode: rain >= 7.6 ? 65 : 63, precipitation: rain, rain, cloudCover: 100, windSpeed: 20 },
        }}
      />
    </div>
  )
}

export { LiveSkyScenario }
