import { useRef, useState } from "react"

import { AgentTaskProposalsRoot } from "@/components/ui/agent-task-board-root"
import { Button } from "@/components/ui/button"
import { ProposalActions } from "@/components/ui/proposal-actions"
import { agentTaskBoardLabels } from "@/lib/agent-task-board-labels"

import { sampleTasks } from "../../../../test/fixtures/agent-tasks"
import { Section } from "../section"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const proposal = sampleTasks.find((task) => task.id === "T-011")!

function ProposalsSection() {
  const attempts = useRef(0)
  const [decision, setDecision] = useState<"approved" | "rejected">()

  async function approve() {
    await wait(1200)
    if (attempts.current++ === 0) throw new Error("Couldn't start the agents. Try again.")
    setDecision("approved")
  }

  async function reject() {
    await wait(800)
    setDecision("rejected")
  }

  const live = decision === undefined
  return (
    <Section
      title="ProposalActions"
      description="Approve and Reject for one proposal. Approve fails the first time on purpose; Reject asks first. Agents need a person's approval for both."
    >
      <div className="flex w-full flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">
            {proposal.id} · {proposal.title}
          </p>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {decision ? `Proposal ${decision}.` : proposal.decisionNeeded}
          </p>
        </div>
        {live ? (
          <ProposalActions taskId={proposal.id} mode="live" onApprove={approve} onReject={reject} />
        ) : (
          <Button size="sm" variant="outline" onClick={() => setDecision(undefined)}>
            Bring the proposal back
          </Button>
        )}
        <AgentTaskProposalsRoot
          aria-label={agentTaskBoardLabels.proposals.group}
          className="sr-only"
          tasks={live ? [proposal] : []}
          mode="live"
          agentConfirm={agentTaskBoardLabels.proposals.agentConfirm}
          onApproveProposal={approve}
          onRejectProposal={reject}
        />
      </div>
    </Section>
  )
}

export { ProposalsSection }
