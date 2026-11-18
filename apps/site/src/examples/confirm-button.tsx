import { useState } from "react"
import { Trash2Icon } from "lucide-react"

import { ConfirmButton } from "@/components/ui/confirm-button"

export default function ConfirmButtonDemo() {
  const [deleted, setDeleted] = useState(0)
  return (
    <div className="flex flex-wrap items-center gap-items">
      <ConfirmButton agentConfirm="Deletes the draft" onConfirm={() => setDeleted((count) => count + 1)}>
        <Trash2Icon />
        Delete draft
      </ConfirmButton>
      <ConfirmButton
        variant="outline"
        hold={900}
        agentConfirm="Archives every finished task"
        onConfirm={() => setDeleted((count) => count + 1)}
      >
        Archive finished
      </ConfirmButton>
      <p className="text-body-sm text-muted-foreground" aria-live="polite">
        {deleted === 0 ? "Press twice, or hold the second one." : `Confirmed ${String(deleted)} times.`}
      </p>
    </div>
  )
}
