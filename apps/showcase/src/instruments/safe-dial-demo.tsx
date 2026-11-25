import { useState } from "react"

import { Label } from "@/components/ui/label"
import { SafeDial } from "@/components/ui/safe-dial"
import { Switch } from "@/components/ui/switch"

import { exposeInstrumentProbe } from "./instrument-probe"
import "../../../../registry/styles/safe-dial.css"

exposeInstrumentProbe()

function SafeDialDemo() {
  const [code, setCode] = useState("2704")
  const [opened, setOpened] = useState<string | null>(null)
  const [masked, setMasked] = useState(false)
  const [disabled, setDisabled] = useState(false)
  return (
    <main className="flex min-h-dvh justify-center bg-background p-inset-surface text-foreground">
      <div className="flex w-full max-w-md flex-col gap-group">
        <header className="flex flex-wrap items-end justify-between gap-items">
          <h1 className="text-display-sm tracking-tight">Safe dial</h1>
          <div className="flex flex-wrap gap-group">
            <Label>
              <Switch checked={masked} onCheckedChange={setMasked} />
              Mask
            </Label>
            <Label>
              <Switch checked={disabled} onCheckedChange={setDisabled} />
              Disabled
            </Label>
          </div>
        </header>
        <SafeDial
          label="Vault combination"
          value={code}
          onValueChange={setCode}
          onComplete={setOpened}
          mask={masked}
          disabled={disabled}
        />
        <p className="max-w-prose text-body-sm text-muted-foreground" aria-live="polite">
          {opened === null
            ? "Turn the dial and let go to enter each number. Focus the dial for the arrow keys, Enter and Backspace, or type digits."
            : `onComplete: ${opened}`}
        </p>
      </div>
    </main>
  )
}

export { SafeDialDemo }
