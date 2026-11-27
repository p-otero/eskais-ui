import { CopyIcon, RotateCwIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { SafeVault, type SafeVaultStatus } from "@/components/ui/safe-vault"

import { exposeInstrumentProbe } from "./instrument-probe"
import "../../../../registry/styles/safe-dial.css"
import "../../../../registry/styles/safe-vault.css"

exposeInstrumentProbe()

const combination = "27461333"
const demoKey = "esk_demo_51Hx9tQ2·7cWmP4·vR8eLk3N"

function SafeVaultDemo() {
  const [status, setStatus] = useState<SafeVaultStatus>("locked")
  const [copied, setCopied] = useState(false)
  return (
    <main className="flex min-h-dvh justify-center bg-background p-inset-surface text-foreground">
      <div className="flex w-full max-w-4xl flex-col gap-group">
        <header className="flex flex-wrap items-end justify-between gap-items">
          <h1 className="text-display-sm tracking-tight">Safe vault</h1>
          <p className="text-body-sm text-muted-foreground">
            The combination is <span className="font-mono">27-46-13-33</span>
          </p>
        </header>
        <SafeVault
          label="Vault"
          status={status}
          onStatusChange={setStatus}
          onComplete={(code) => setStatus(code === combination ? "unlocked" : "denied")}
        >
          <div className="flex flex-col gap-items">
            <span className="text-meta tracking-meta text-muted-foreground uppercase">Vault unlocked</span>
            <h2 className="text-title-sm">Production API key</h2>
            <code className="w-fit max-w-full truncate rounded-md bg-muted px-inset-chip py-inset-chip font-mono text-body-sm">
              {demoKey}
            </code>
            <div className="flex flex-wrap gap-items">
              <Button size="sm" onClick={() => setCopied(true)}>
                <CopyIcon />
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button size="sm" variant="outline">
                <RotateCwIcon />
                Rotate
              </Button>
            </div>
          </div>
        </SafeVault>
        <p className="max-w-prose text-body-sm text-muted-foreground">
          Turn the dial and let go to enter each number, or focus it for the arrow keys, Enter and Backspace. A wrong
          code shakes the dial; the right one opens the door onto the key.
        </p>
      </div>
    </main>
  )
}

export { SafeVaultDemo }
