import { useState } from "react"

import { EjectorButton } from "@/components/ui/ejector-button"

import { agent } from "../agent"
import "../../../../registry/styles/ejector-button.css"

declare global {
  interface Window {
    /** Read by tooling/retro-check.mjs: the agent bridge. */
    ejectorProbe?: { agent: typeof agent }
  }
}

window.ejectorProbe = { agent }

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms))

function EjectorButtonDemo() {
  const [log, setLog] = useState("Staging is running.")
  return (
    <main className="flex min-h-dvh justify-center bg-background p-inset-surface text-foreground">
      <div className="flex w-full max-w-md flex-col gap-group">
        <h1 className="text-display-sm tracking-tight">Ejector button</h1>
        <EjectorButton
          label="Delete staging"
          agentConfirm="Deletes the staging environment and its data"
          armTimeoutMs={6000}
          onArmedChange={(armed, details) => {
            if (details.reason !== "eject") setLog(armed ? "Cover open." : `Cover closed (${details.reason}).`)
          }}
          onEject={async () => {
            setLog("Deleting staging…")
            await wait(1200)
            setLog("Staging deleted.")
          }}
        />
        <p className="text-body-sm text-muted-foreground" aria-live="polite">
          {log}
        </p>
      </div>
    </main>
  )
}

export { EjectorButtonDemo }
