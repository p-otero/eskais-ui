import { useState } from "react"

import { Label } from "@/components/ui/label"
import { PrismPicker, type PrismColor } from "@/components/ui/prism-picker"
import { Switch } from "@/components/ui/switch"

import { agent } from "../agent"
import "../../../../registry/styles/prism-picker.css"

declare global {
  interface Window {
    /** Read by tooling/prism-check.mjs: each paint's duration in ms, and the agent bridge. */
    prismProbe?: { paints: number[]; agent: typeof agent }
  }
}

const probe = { paints: [] as number[], agent }
window.prismProbe = probe
const recordPaint = (milliseconds: number) => {
  probe.paints.push(milliseconds)
}

function PrismPickerDemo() {
  const [wavelength, setWavelength] = useState(520)
  const [color, setColor] = useState<PrismColor | null>(null)
  const [disabled, setDisabled] = useState(false)
  return (
    <main className="flex min-h-dvh justify-center bg-background p-inset-surface text-foreground">
      <div className="flex w-full max-w-3xl flex-col gap-group">
        <header className="flex flex-wrap items-end justify-between gap-items">
          <h1 className="text-display-sm tracking-tight">Prism picker</h1>
          <Label>
            <Switch checked={disabled} onCheckedChange={setDisabled} />
            Disabled
          </Label>
        </header>
        <PrismPicker
          label="Prism colour"
          value={wavelength}
          onValueChange={setWavelength}
          onColorChange={setColor}
          disabled={disabled}
          onPaint={recordPaint}
        />
        <p className="max-w-prose text-body-sm text-muted-foreground" aria-live="polite">
          {color
            ? `onColorChange: ${color.hex}, ${String(color.wavelength)} nm, OKLCH hue ${color.oklchHue.toFixed(1)}°`
            : "Drag the ring, or grab the prism and turn it. Focus the knob for the arrow keys, Page Up and Page Down, Home and End."}
        </p>
      </div>
    </main>
  )
}

export { PrismPickerDemo }
