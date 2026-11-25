import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RetroTv, type RetroTvPhosphor } from "@/components/ui/retro-tv"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Switch } from "@/components/ui/switch"
import { useTvPowerOff } from "@/components/ui/tv-power-off"

import { agent } from "../agent"
import "../../../../registry/styles/retro-tv.css"

declare global {
  interface Window {
    /** Read by tooling/retro-check.mjs: the agent bridge. */
    retroProbe?: { agent: typeof agent }
  }
}

window.retroProbe = { agent }

const hourlySales = [
  { hour: "09", value: 30 },
  { hour: "10", value: 45 },
  { hour: "11", value: 38 },
  { hour: "12", value: 60 },
  { hour: "13", value: 52 },
  { hour: "14", value: 70 },
  { hour: "15", value: 64 },
  { hour: "16", value: 88 },
  { hour: "17", value: 76 },
  { hour: "18", value: 92 },
  { hour: "19", value: 84 },
  { hour: "20", value: 100 },
]

const phosphors: RetroTvPhosphor[] = ["green", "amber", "white"]

function SalesScreen() {
  return (
    <div className="flex h-full flex-col justify-between gap-items p-inset-surface text-caption narrow:px-inset-item narrow:py-inset-item">
      <div className="flex justify-between gap-items uppercase">
        <span>Sales · today</span>
        <span>19:42</span>
      </div>
      <div className="flex flex-col">
        <span className="text-display leading-none tracking-tight narrow:text-display-sm">€12,430</span>
        <span className="flex justify-between gap-items text-muted-foreground">
          <span>▲ 8.4% vs yesterday</span>
          <span>312 orders</span>
        </span>
      </div>
      <span className="sr-only">Sales per hour, rising through the day</span>
      <div className="flex h-20 items-end gap-inline narrow:h-12" aria-hidden="true">
        {hourlySales.map(({ hour, value }) => (
          <span key={hour} className="flex-1 bg-primary" style={{ height: `${String(value)}%` }} />
        ))}
      </div>
      <div className="flex justify-between gap-items text-muted-foreground uppercase">
        <span>API ok</span>
        <span>Queue 3</span>
        <span>CPU 41%</span>
      </div>
    </div>
  )
}

function RetroTvDemo() {
  const [phosphor, setPhosphor] = useState<RetroTvPhosphor>("green")
  const [perspective, setPerspective] = useState(true)
  const [power, setPower] = useState(true)
  const logout = useTvPowerOff({ phosphor })
  return (
    <main className="flex min-h-dvh justify-center bg-background p-inset-surface text-foreground">
      <div className="flex w-full max-w-3xl flex-col gap-group">
        <header className="flex flex-wrap items-end justify-between gap-items">
          <h1 className="text-display-sm tracking-tight">Retro TV</h1>
          <div className="flex flex-wrap items-center gap-group">
            <SegmentedControl
              aria-label="Phosphor"
              value={phosphor}
              onValueChange={(next) => next && setPhosphor(next)}
            >
              <SegmentedControlIndicator />
              {phosphors.map((item) => (
                <SegmentedControlItem key={item} value={item}>
                  {item}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
            <Label>
              <Switch checked={perspective} onCheckedChange={setPerspective} />
              Perspective
            </Label>
          </div>
        </header>
        <RetroTv
          label="Sales monitor"
          phosphor={phosphor}
          perspective={perspective}
          power={power}
          onPowerChange={setPower}
        >
          <SalesScreen />
        </RetroTv>
        <div className="flex flex-wrap items-center justify-between gap-items">
          <p className="text-body-sm text-muted-foreground" aria-live="polite">
            {power ? "The set is on." : "The set is off."}
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              await logout.powerOff()
              logout.reset()
            }}
          >
            Log out
          </Button>
        </div>
        {logout.overlay}
      </div>
    </main>
  )
}

export { RetroTvDemo }
