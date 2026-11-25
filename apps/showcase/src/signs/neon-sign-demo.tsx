import { useState } from "react"

import { Label } from "@/components/ui/label"
import { NeonSign } from "@/components/ui/neon-sign"
import { Switch } from "@/components/ui/switch"

import { agent } from "../agent"
import "../../../../registry/styles/neon-sign.css"

declare global {
  interface Window {
    /** Read by tooling/signs-check.mjs: the agent bridge. */
    neonProbe?: { agent: typeof agent }
  }
}

window.neonProbe = { agent }

function NeonSignDemo() {
  const [live, setLive] = useState(true)
  return (
    <main className="flex min-h-dvh justify-center bg-background p-inset-surface text-foreground">
      <div className="flex w-full max-w-4xl flex-col gap-group">
        <header className="flex flex-wrap items-end justify-between gap-items">
          <h1 className="text-display-sm tracking-tight">Neon sign</h1>
          <Label>
            <Switch checked={live} onCheckedChange={setLive} />
            Studio live
          </Label>
        </header>
        <NeonSign
          label="Studio"
          text="On air"
          sub="Studio 2"
          color="red"
          subColor="cyan"
          on={live}
          onOnChange={setLive}
        />
        <div className="grid gap-section md:grid-cols-2">
          <NeonSign label="Shop" text="Open" sub="Late tonight" color="pink" subColor="blue" wall="dark" />
          <NeonSign label="Camera" text="Rec" color="green" wall="dark" defaultOn={false} />
        </div>
      </div>
    </main>
  )
}

export { NeonSignDemo }
