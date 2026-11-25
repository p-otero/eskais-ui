import { useState } from "react"

import { Label } from "@/components/ui/label"
import { Mixer, type MixerValues } from "@/components/ui/mixer"
import { Switch } from "@/components/ui/switch"

import { exposeInstrumentProbe } from "./instrument-probe"
import "../../../../registry/styles/mixer.css"

const channels = [
  { id: "sales", label: "Sales" },
  { id: "support", label: "Support" },
  { id: "product", label: "Product" },
  { id: "brand", label: "Brand" },
]

exposeInstrumentProbe()

function MixerDemo() {
  const [values, setValues] = useState<MixerValues>({ sales: 35, support: 20, product: 30, brand: 15 })
  const [locked, setLocked] = useState<string[]>(["brand"])
  const [disabled, setDisabled] = useState(false)
  return (
    <main className="flex min-h-dvh justify-center bg-background p-inset-surface text-foreground">
      <div className="flex w-full max-w-xl flex-col gap-group">
        <header className="flex flex-wrap items-end justify-between gap-items">
          <h1 className="text-display-sm tracking-tight">Mixer</h1>
          <Label>
            <Switch checked={disabled} onCheckedChange={setDisabled} />
            Disabled
          </Label>
        </header>
        <Mixer
          label="Budget split"
          channels={channels}
          value={values}
          onValueChange={setValues}
          locked={locked}
          onLockedChange={setLocked}
          format={{ style: "unit", unit: "percent" }}
          disabled={disabled}
        />
        <p className="max-w-prose text-body-sm text-muted-foreground">
          Raise one fader and the unlocked others make room in proportion; the total stays at 100%. Brand is locked.
        </p>
      </div>
    </main>
  )
}

export { MixerDemo }
