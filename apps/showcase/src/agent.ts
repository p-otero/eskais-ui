import { createConfirm } from "@ui-sdk/react/alert-dialog"
import { createAgent, registerTools } from "@ui-sdk/react/agent"

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

// Publishes snapshot, query and act to the browser's agent (WebMCP) where the browser has it; tooling/agent-bridge-check.mjs
// drives them from outside the page. A step on a data-agent-confirm control stays the person's.
registerTools(agent, { allow: (step) => !step.confirm })

export { agent, approval }
export type { ApprovalRequest }
