import { useState } from "react"

import { SunArc } from "@/components/ui/sun-arc"

export default function SunArcDemo() {
  const [minutes, setMinutes] = useState<number>()
  return (
    <div className="flex w-full max-w-2xl flex-col gap-items">
      <SunArc
        label="Golden hour walk"
        latitude={40.42}
        longitude={-3.7}
        timeZone="Europe/Madrid"
        onValueChange={setMinutes}
      />
      <p className="text-body-sm text-muted-foreground">
        {minutes === undefined ? "Drag the sun to pick a time." : `${String(minutes)} minutes after midnight`}
      </p>
    </div>
  )
}
