import { createConfirm } from "@ui-sdk/react/alert-dialog"
import { createAgent } from "@ui-sdk/react/agent"

type ApprovalRequest = { sentence: string }

// The approval must be its own top-layer dialog: a modal the agent opened makes the rest of the page inert.
const approval = createConfirm<ApprovalRequest>()

const agent = createAgent({
  allow: (step, { signal }) => {
    if (!step.confirm) return true
    signal.addEventListener("abort", () => approval.controller.close(), { once: true })
    return approval({ sentence: step.confirm })
  },
})

export { agent, approval }
export type { ApprovalRequest }
