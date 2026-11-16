import { useRef } from "react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function ConfirmDialogDemo() {
  const attempts = useRef(0)
  return (
    <ConfirmDialog
      trigger="Delete project"
      title="Delete Apollo?"
      description="The project, its files and its deployment history are deleted for everyone. The first attempt fails on purpose."
      confirmLabel="Delete forever"
      tone="destructive"
      agentConfirm="Deletes the Apollo project and its files"
      pendingAnnouncement="Deleting project"
      labels={{ cancel: "Keep project" }}
      onConfirm={async () => {
        await wait(1200)
        if (attempts.current++ === 0) throw new Error("Couldn't delete the project. Try again.")
      }}
    >
      Two agents are still running on it. They stop at once.
    </ConfirmDialog>
  )
}
