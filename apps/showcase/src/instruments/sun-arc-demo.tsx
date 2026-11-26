import { useState } from "react"

import { Label } from "@/components/ui/label"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { SunArc } from "@/components/ui/sun-arc"
import { SunArcPhotoUpload, type SunArcPhoto } from "@/components/ui/sun-arc-photo"
import { Switch } from "@/components/ui/switch"

import cebuSkyline from "../assets/cebu-skyline.jpg"
import { exposeInstrumentProbe, recordPaint } from "./instrument-probe"
import "../../../../registry/styles/sun-arc.css"

exposeInstrumentProbe()

const coruna = { latitude: 43.37, longitude: -8.4, timeZone: "Europe/Madrid", date: new Date("2026-11-25T12:00:00Z") }
const cebu = {
  latitude: 10.326725,
  longitude: 123.904889,
  timeZone: "Asia/Manila",
  date: new Date("2025-04-14T04:00:00Z"),
}
const cebuPhoto: SunArcPhoto = { src: cebuSkyline }

type Mode = "city" | "photo"

function SunArcDemo() {
  const params = new URLSearchParams(location.search)
  const [mode, setMode] = useState<Mode>(params.get("mode") === "photo" ? "photo" : "city")
  const [minutes, setMinutes] = useState(mode === "photo" ? 12 * 60 : 14 * 60 + 20)
  const [photo, setPhoto] = useState<SunArcPhoto>(cebuPhoto)
  const [place, setPlace] = useState(cebu)
  const [disabled, setDisabled] = useState(false)
  const [keepClouds, setKeepClouds] = useState(params.get("clouds") === "1")
  const scene = mode === "photo" ? place : coruna
  return (
    <main className="flex min-h-dvh justify-center bg-background p-inset-surface text-foreground">
      <div className="flex w-full max-w-3xl flex-col gap-group">
        <header className="flex flex-wrap items-end justify-between gap-items">
          <h1 className="text-display-sm tracking-tight">Sun arc</h1>
          <div className="flex flex-wrap items-center gap-group">
            <SegmentedControl<Mode> aria-label="Scene" value={mode} onValueChange={(next) => next && setMode(next)}>
              <SegmentedControlIndicator />
              <SegmentedControlItem value="city">City</SegmentedControlItem>
              <SegmentedControlItem value="photo">Photo</SegmentedControlItem>
            </SegmentedControl>
            <Label>
              <Switch checked={disabled} onCheckedChange={setDisabled} />
              Disabled
            </Label>
          </div>
        </header>
        <SunArc
          key={mode}
          label="Meeting time"
          {...scene}
          value={minutes}
          onValueChange={setMinutes}
          disabled={disabled}
          onPaint={recordPaint}
          photo={mode === "photo" ? { ...photo, keepClouds } : undefined}
          onPhotoChange={setPhoto}
        />
        {mode === "photo" ? (
          <div className="flex flex-wrap items-center gap-items">
            <Label>
              <Switch checked={keepClouds} onCheckedChange={setKeepClouds} />
              Keep clouds
            </Label>
            <SunArcPhotoUpload
              label="Use your own photo"
              onPhoto={(next, location) => {
                setPhoto(next)
                if (location) setPlace((current) => ({ ...current, ...location }))
              }}
            />
            <p className="text-body-sm text-muted-foreground">
              Read on this device, never uploaded. Photo: Cebu City skyline by DisRaptor18, CC0, Wikimedia Commons.
            </p>
          </div>
        ) : (
          <p className="max-w-prose text-body-sm text-muted-foreground">
            A Coruña, 25 November 2026. Drag the sun, press the sky, or focus the sun for the arrow keys, Page Up and
            Page Down.
          </p>
        )}
      </div>
    </main>
  )
}

export { SunArcDemo }
