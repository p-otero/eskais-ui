import { useState } from "react"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SunArc } from "@/components/ui/sun-arc"

import { exposeInstrumentProbe, recordPaint } from "./instrument-probe"
import "../../../../registry/styles/sun-arc.css"

const day = new Date("2026-11-25T12:00:00Z")

exposeInstrumentProbe()

function SunArcDemo() {
  const [minutes, setMinutes] = useState(14 * 60 + 20)
  const [disabled, setDisabled] = useState(false)
  return (
    <main className="flex min-h-dvh justify-center bg-background p-inset-surface text-foreground">
      <div className="flex w-full max-w-3xl flex-col gap-group">
        <header className="flex flex-wrap items-end justify-between gap-items">
          <h1 className="text-display-sm tracking-tight">Sun arc</h1>
          <Label>
            <Switch checked={disabled} onCheckedChange={setDisabled} />
            Disabled
          </Label>
        </header>
        <SunArc
          label="Meeting time"
          latitude={43.37}
          longitude={-8.4}
          timeZone="Europe/Madrid"
          date={day}
          value={minutes}
          onValueChange={setMinutes}
          disabled={disabled}
          onPaint={recordPaint}
        />
        <p className="max-w-prose text-body-sm text-muted-foreground">
          A Coruña, 25 November 2026. Drag the sun, press the sky, or focus the sun for the arrow keys, Page Up and Page
          Down.
        </p>
      </div>
    </main>
  )
}

export { SunArcDemo }
