import { useState } from "react"

import { Label } from "@/components/ui/label"
import { RetroTv } from "@/components/ui/retro-tv"
import { Switch } from "@/components/ui/switch"
import { Teletext } from "@/components/ui/teletext"

import { agent } from "../agent"
import "../../../../registry/styles/retro-tv.css"
import "../../../../registry/styles/teletext.css"
import { teletextDemoPages } from "./teletext-pages"

declare global {
  interface Window {
    /** Read by tooling/signs-check.mjs: the agent bridge. */
    teletextTvProbe?: { agent: typeof agent }
  }
}

window.teletextTvProbe = { agent }

function TeletextTvDemo() {
  const [power, setPower] = useState(true)
  const [perspective, setPerspective] = useState(true)
  return (
    <main className="flex min-h-dvh justify-center bg-background p-inset-surface text-foreground">
      <div className="flex w-full max-w-3xl flex-col gap-group">
        <header className="flex flex-wrap items-end justify-between gap-items">
          <h1 className="text-display-sm tracking-tight">Teletext on a TV</h1>
          <Label>
            <Switch checked={perspective} onCheckedChange={setPerspective} />
            Perspective
          </Label>
        </header>
        <RetroTv
          label="Living room TV"
          phosphor="white"
          perspective={perspective}
          power={power}
          onPowerChange={setPower}
        >
          <Teletext label="Teletext" service="ESKAIS" pages={teletextDemoPages} screen="flat" />
        </RetroTv>
        <p className="max-w-prose text-body-sm text-muted-foreground" aria-live="polite">
          {power
            ? "Focus the screen and type 101, 400 or 600, or use the coloured keys. The power button switches the set off."
            : "The set is off."}
        </p>
      </div>
    </main>
  )
}

export { TeletextTvDemo }
