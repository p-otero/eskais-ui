import { useState } from "react"

import { LedMatrix, type LedColor, type LedMatrixMode } from "@/components/ui/led-matrix"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"

import { agent } from "../agent"
import "../../../../registry/styles/led-matrix.css"

declare global {
  interface Window {
    /** Read by tooling/signs-check.mjs: each canvas paint's duration in ms, and the agent bridge. */
    ledProbe?: { paints: number[]; agent: typeof agent }
  }
}

const probe = { paints: [] as number[], agent }
window.ledProbe = probe
const recordPaint = (milliseconds: number) => {
  probe.paints.push(milliseconds)
}

const pharmacy = [
  "Pharmacy on duty: 12 Harbour Street",
  "Open until 22:00 · Tel. 555 0142",
  "Ñandú, ¿qué tal? Café 2,50 € · Größe",
]
const bus = ["47 Millbrook — 3 min", "12 Ashby Vale — 8 min", "N4 Night service — 23:40"]

const colors: LedColor[] = ["amber", "red", "green", "white"]

function LedMatrixDemo() {
  const [color, setColor] = useState<LedColor>("amber")
  const [mode, setMode] = useState<LedMatrixMode>("scroll")
  return (
    <main className="flex min-h-dvh justify-center bg-background p-inset-surface text-foreground">
      <div className="flex w-full max-w-4xl flex-col gap-group">
        <header className="flex flex-wrap items-end justify-between gap-items">
          <h1 className="text-display-sm tracking-tight">LED matrix</h1>
          <div className="flex flex-wrap items-center gap-items">
            <SegmentedControl<LedColor>
              aria-label="Colour"
              value={color}
              onValueChange={(next) => next && setColor(next)}
            >
              <SegmentedControlIndicator />
              {colors.map((entry) => (
                <SegmentedControlItem key={entry} value={entry}>
                  {entry}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
            <SegmentedControl<LedMatrixMode>
              aria-label="Mode"
              value={mode}
              onValueChange={(next) => next && setMode(next)}
            >
              <SegmentedControlIndicator />
              <SegmentedControlItem value="scroll">Scroll</SegmentedControlItem>
              <SegmentedControlItem value="hold">Hold</SegmentedControlItem>
            </SegmentedControl>
          </div>
        </header>
        <LedMatrix label="Pharmacy sign" color={color} mode={mode} defaultMessages={pharmacy} onPaint={recordPaint} />
        <LedMatrix label="Bus stop" color="amber" rows={16} columns={84} defaultMessages={bus} />
        <LedMatrix label="Departures" color="red" mode="hold" columns={64} defaultMessages={bus} live="polite" />
        <div className="min-h-dvh" aria-hidden="true" />
        <div className="min-h-dvh" aria-hidden="true" />
        <LedMatrix label="Below the fold" color="green" defaultMessages={["Painted only while it is on screen"]} />
      </div>
    </main>
  )
}

export { LedMatrixDemo }
