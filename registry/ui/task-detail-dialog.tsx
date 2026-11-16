"use client"

import { useState, type ComponentProps } from "react"

import type { TaskView } from "@/lib/agent-task-types"
import { cn } from "@/lib/utils"
import { agentTaskBoardLabels } from "@/components/ui/agent-task-labels"
import { Dialog, DialogBackdrop, DialogBody, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerTitle } from "@/components/ui/drawer"
import { TaskDetailContent, type TaskDetailContentProps } from "@/components/ui/task-detail-content"
import { CloseIcon } from "@/components/ui/task-detail-parts"
import type { CloseReason } from "@/components/ui/task-detail-panel"

type TaskDetailDialogProps = Omit<TaskDetailContentProps, "task" | "headingLevel" | "layout" | "showStatus"> & {
  /** The task to show; `undefined` closes the dialog. */
  task: TaskView | undefined
  presentation?: "dialog" | "drawer"
  /** Runs when a person or an agent closes it; clear the task to close it, or keep it to refuse. */
  onClose: (reason: CloseReason | "imperative") => void
  /** Where focus goes once it closes; the element focused before it opened by default. */
  finalFocus?: ComponentProps<typeof DialogContent>["finalFocus"]
  className?: string
}

const parts = {
  dialog: {
    Root: Dialog,
    Backdrop: DialogBackdrop,
    Content: DialogContent,
    Title: DialogTitle,
    Close: DialogClose,
    Body: DialogBody,
  },
  drawer: {
    Root: Drawer,
    Backdrop: DrawerBackdrop,
    Content: DrawerContent,
    Title: DrawerTitle,
    Close: DrawerClose,
    Body: DrawerBody,
  },
}

function DrawerBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain", className)} {...props} />
}

const shapes = {
  dialog: "gap-0 overflow-hidden p-0",
  drawer: "gap-0 overflow-hidden p-0 data-[side=right]:max-w-xl",
}

function closeReason(reason: string): CloseReason | "imperative" {
  return reason === "close-press" || reason === "escape-key" || reason === "outside-press" ? reason : "imperative"
}

function TaskDetailDialog({
  task,
  presentation = "dialog",
  onClose,
  finalFocus,
  className,
  labels = agentTaskBoardLabels,
  ...content
}: TaskDetailDialogProps) {
  // Keeps the last task on screen while the dialog animates out.
  const [shown, setShown] = useState(task)
  if (task && task !== shown) setShown(task)
  const current = task ?? shown
  const { Root, Backdrop, Content, Title, Close, Body } = parts[presentation]

  return (
    <Root
      open={task !== undefined}
      onOpenChange={(open, details) => {
        if (!open) onClose(closeReason(details.reason))
      }}
      {...(presentation === "drawer" ? { side: "right" as const } : {})}
    >
      <Backdrop />
      <Content
        data-task-detail={presentation}
        data-task-id={current?.id}
        initialFocus="content"
        finalFocus={finalFocus}
        {...(presentation === "dialog" ? { size: "xl" as const } : {})}
        className={cn("flex flex-col", shapes[presentation], className)}
      >
        {current && (
          <>
            <div className="flex shrink-0 items-start gap-items border-b px-inset-surface py-group">
              <Title data-slot="task-detail-title" className="min-w-0 flex-1 text-title-sm leading-snug">
                <span className="font-mono text-muted-foreground">{current.id}</span> {current.title}
              </Title>
              <Close variant="ghost" size="icon" aria-label={labels.panel.close}>
                <CloseIcon />
              </Close>
            </div>
            <Body className="@container/task-detail mx-0 p-inset-surface">
              <TaskDetailContent
                task={current}
                labels={labels}
                {...content}
                layout={presentation === "dialog" ? "split" : "stack"}
                headingLevel={3}
              />
            </Body>
          </>
        )}
      </Content>
    </Root>
  )
}

export { TaskDetailDialog }
export type { TaskDetailDialogProps }
