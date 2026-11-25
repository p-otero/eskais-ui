import { useState } from "react"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { VinylScrubber } from "@/components/ui/vinyl-scrubber"

import { exposeInstrumentProbe, recordPaint } from "./instrument-probe"
import "../../../../registry/styles/vinyl-scrubber.css"

const peaks = Array.from({ length: 400 }, (_, index) => {
  const bar = index % 100
  const breakdown = bar < 6 ? 0.25 : 1
  return (0.3 + 0.7 * Math.abs(Math.sin(index * 0.37) * Math.cos(index * 0.11))) * breakdown
})

exposeInstrumentProbe()

function VinylScrubberDemo() {
  const [disabled, setDisabled] = useState(false)
  return (
    <main className="flex min-h-dvh justify-center bg-background p-inset-surface text-foreground">
      <div className="flex w-full max-w-3xl flex-col gap-group">
        <header className="flex flex-wrap items-end justify-between gap-items">
          <h1 className="text-display-sm tracking-tight">Vinyl scrubber</h1>
          <Label>
            <Switch checked={disabled} onCheckedChange={setDisabled} />
            Disabled
          </Label>
        </header>
        <VinylScrubber
          label="Track 2"
          title="Side A"
          duration={400}
          defaultValue={72}
          peaks={peaks}
          disabled={disabled}
          onPaint={recordPaint}
        />
        <p className="max-w-prose text-body-sm text-muted-foreground">
          Drag the record to scratch back and forth, press the waveform to jump, or focus it for the arrow keys.
        </p>
      </div>
    </main>
  )
}

export { VinylScrubberDemo }
