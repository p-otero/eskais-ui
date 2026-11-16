import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  createConfirm,
} from "@ui-sdk/react/alert-dialog"
import { createAgent } from "@ui-sdk/react/agent"

import { buttonVariants } from "@/components/ui/button"
import { backdropClassName, contentClassName } from "@/components/ui/dialog"

type ApprovalRequest = { sentence: string }

// The approval is its own top-layer dialog: a modal the agent opened makes the rest of the page inert.
const approval = createConfirm<ApprovalRequest>()

const agent = createAgent({
  allow: (step, { signal }) => {
    if (!step.confirm) return true
    signal.addEventListener("abort", () => approval.controller.close(), { once: true })
    return approval({ sentence: step.confirm })
  },
})

function AgentApproval() {
  return (
    <AlertDialog controller={approval.controller}>
      <AlertDialogBackdrop className={backdropClassName} />
      <AlertDialogContent<ApprovalRequest> className={contentClassName}>
        {(state) => (
          <>
            <div className="flex flex-col gap-inline">
              <AlertDialogTitle className="text-title">An agent needs your approval</AlertDialogTitle>
              <AlertDialogDescription className="text-body text-muted-foreground">
                It wants to: {state.payload?.sentence}
              </AlertDialogDescription>
            </div>
            <div className="flex flex-col-reverse gap-items sm:flex-row sm:justify-end">
              <AlertDialogClose className={buttonVariants({ variant: "outline" })}>Deny</AlertDialogClose>
              <AlertDialogClose value="confirm" className={buttonVariants({ variant: "destructive" })}>
                Approve
              </AlertDialogClose>
            </div>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { agent, AgentApproval, approval }
