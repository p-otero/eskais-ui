import { useState } from "react"

import { LiveSky, type LiveSkySimulation } from "@/components/ui/live-sky"
import type { LiveSkyPhoto } from "@/components/ui/live-sky-photo"
import { LiveSkyPhotoUpload } from "@/components/ui/live-sky-photo-controls"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"

import cebuSkyline from "../assets/cebu-skyline.jpg"

type Background = "street" | "photo"

const rain: LiveSkySimulation["weather"] = {
  weatherCode: 63,
  precipitation: 2.4,
  rain: 2.4,
  cloudCover: 100,
  windSpeed: 22,
  temperature: 12,
}

const coruna = { latitude: 43.37, longitude: -8.4, name: "A Coruña" }
const cebu = { latitude: 10.33, longitude: 123.9, name: "Cebu City" }

const hourMs = 3_600_000
const solarNoonOn25November = (longitude: number) => Date.UTC(2026, 10, 25, 12) - (longitude / 15) * hourMs

export default function LiveSkyDemo() {
  const [background, setBackground] = useState<Background>("street")
  const [photo, setPhoto] = useState<LiveSkyPhoto>({ src: cebuSkyline, heading: 200 })
  const [photoPlace, setPhotoPlace] = useState(cebu)
  const place = background === "photo" ? photoPlace : coruna
  return (
    <div className="flex w-full max-w-3xl flex-col gap-items">
      <div className="flex flex-wrap items-center gap-items">
        <SegmentedControl<Background>
          aria-label="Background"
          value={background}
          onValueChange={(next) => next && setBackground(next)}
        >
          <SegmentedControlIndicator />
          <SegmentedControlItem value="street">Street</SegmentedControlItem>
          <SegmentedControlItem value="photo">Photo</SegmentedControlItem>
        </SegmentedControl>
        {background === "photo" ? (
          <LiveSkyPhotoUpload
            label="Use your own photo"
            onPhoto={(next, location) => {
              setPhoto(next)
              if (location) setPhotoPlace({ ...location, name: "Your photo" })
            }}
          />
        ) : null}
      </div>
      <LiveSky
        label={`Sky over ${place.name}`}
        simulate={{ location: place, time: solarNoonOn25November(place.longitude), weather: rain }}
        photo={background === "photo" ? photo : undefined}
        onPhotoChange={setPhoto}
      />
      {background === "photo" ? (
        <p className="text-caption text-muted-foreground">
          Your photo is read on this device and never uploaded.
          {photo.src === cebuSkyline ? " Cebu City skyline by DisRaptor18, CC0, Wikimedia Commons." : null}
        </p>
      ) : null}
    </div>
  )
}
