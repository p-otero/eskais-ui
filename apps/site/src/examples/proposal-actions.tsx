import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { ProposalActions } from "@/components/ui/proposal-actions"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function ProposalActionsDemo() {
  const attempts = useRef(0)
  const [decision, setDecision] = useState<"approved" | "rejected">()
  return (
    <div className="flex flex-col items-center gap-items">
      <p className="text-body-sm text-muted-foreground" aria-live="polite">
        {decision ? `Proposal ${decision}.` : "T-011 · Split the billing service. Approve fails once on purpose."}
      </p>
      {decision === undefined ? (
        <ProposalActions
          taskId="T-011"
          mode="live"
          onApprove={async () => {
            await wait(1000)
            if (attempts.current++ === 0) throw new Error("Couldn't start the agents. Try again.")
            setDecision("approved")
          }}
          onReject={async () => {
            await wait(600)
            setDecision("rejected")
          }}
        />
      ) : (
        <Button size="sm" variant="outline" onClick={() => setDecision(undefined)}>
          Bring the proposal back
        </Button>
      )}
    </div>
  )
}
