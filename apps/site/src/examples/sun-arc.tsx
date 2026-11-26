import { useState } from "react"

import { SunArc } from "@/components/ui/sun-arc"
import { SunArcPhotoUpload, type SunArcPhoto } from "@/components/ui/sun-arc-photo"

import cebuSkyline from "../assets/cebu-skyline.jpg"

const cebu = { latitude: 10.326725, longitude: 123.904889, timeZone: "Asia/Manila" }

export default function SunArcDemo() {
  const [photo, setPhoto] = useState<SunArcPhoto>({ src: cebuSkyline })
  const [place, setPlace] = useState(cebu)
  return (
    <div className="flex w-full max-w-2xl flex-col gap-items">
      <SunArc
        label="Golden hour walk"
        {...place}
        date={new Date("2025-04-14T04:00:00Z")}
        defaultValue={6 * 60 + 20}
        photo={photo}
        onPhotoChange={setPhoto}
      />
      <div className="flex flex-wrap items-center gap-items">
        <SunArcPhotoUpload
          label="Use your own photo"
          onPhoto={(next, location) => {
            setPhoto(next)
            if (location) setPlace((current) => ({ ...current, ...location }))
          }}
        />
        <p className="text-caption text-muted-foreground">
          Read on this device, never uploaded. Cebu City skyline by DisRaptor18, CC0, Wikimedia Commons.
        </p>
      </div>
    </div>
  )
}
