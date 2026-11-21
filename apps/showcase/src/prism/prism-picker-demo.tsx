import { useState } from "react"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

import { agent } from "../agent"
import { PrismPicker } from "./prism-picker"

declare global {
  interface Window {
    /** Read by the prism measurements: each paint's duration in ms, and the agent bridge. */
    prismProbe?: { paints: number[]; agent: typeof agent }
  }
}

const probe = { paints: [] as number[], agent }
window.prismProbe = probe
const recordPaint = (milliseconds: number) => {
  probe.paints.push(milliseconds)
}

/** `?demo=prism-picker`: the prism hue picker prototype, alone on a page. */
function PrismPickerDemo() {
  const [purples, setPurples] = useState(false)
  return (
    <main className="flex min-h-dvh justify-center bg-background p-inset-surface text-foreground">
      <div className="flex w-full max-w-3xl flex-col gap-group">
        <header className="flex flex-wrap items-end justify-between gap-items">
          <div className="flex flex-col gap-inline">
            <p className="text-meta tracking-meta text-muted-foreground uppercase">Prototype</p>
            <h1 className="text-display-sm tracking-tight">Prism picker</h1>
          </div>
          <Label>
            <Switch checked={purples} onCheckedChange={setPurples} />
            Purples past the red end
          </Label>
        </header>
        <PrismPicker label="Prism colour" purples={purples} onPaint={recordPaint} />
        <p className="max-w-prose text-body-sm text-muted-foreground">
          Drag the ring, or grab the prism and turn it. Focus the knob for the arrow keys, Page Up and Page Down, Home
          and End. The exit slit stays put: turning the prism sweeps the spectrum across it, as in a monochromator.
        </p>
      </div>
    </main>
  )
}

export { PrismPickerDemo }
