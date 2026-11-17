import { useState } from "react"

import { Button } from "@/components/ui/button"
import { ShortcutHint, ShortcutScope, useShortcut } from "@/components/ui/shortcuts"

export default function ShortcutsDemo() {
  const [status, setStatus] = useState("Focus the card, then press U, P or G then I.")
  useShortcut("g i", () => setStatus("Went to the inbox"), { description: "Go to inbox", scope: null })
  return (
    <ShortcutScope
      name="shortcuts-demo"
      label="Message"
      className="flex w-full max-w-md flex-col gap-items rounded-surface border p-inset-surface"
    >
      <div className="flex flex-wrap gap-items">
        <Button variant="outline" shortcut="u" onClick={() => setStatus("Marked read")}>
          Mark read
        </Button>
        <Button variant="outline" shortcut="p" onClick={() => setStatus("Pinned")}>
          Pin
        </Button>
      </div>
      <p className="flex items-center gap-inline text-body-sm text-muted-foreground">
        Go to inbox <ShortcutHint keys="g i" />
      </p>
      <output className="text-body-sm">{status}</output>
    </ShortcutScope>
  )
}
