import type { ComponentProps, ReactNode } from "react"

import type { TaskStatus } from "@/lib/agent-task-types"
import { cn } from "@/lib/utils"

const statusIconColor: Record<TaskStatus, string> = {
  proposed: "text-warning",
  todo: "text-muted-foreground",
  working: "text-info",
  review: "text-warning",
  blocked: "text-destructive",
  done: "text-success",
  cancelled: "text-muted-foreground",
}

const statusIconShape: Record<TaskStatus, ReactNode> = {
  proposed: <circle cx="8" cy="8" r="6" strokeDasharray="2.4 2.3" />,
  todo: <circle cx="8" cy="8" r="6" />,
  working: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5a3.5 3.5 0 0 1 0 7Z" fill="currentColor" stroke="none" />
    </>
  ),
  review: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5a3.5 3.5 0 1 1-3.5 3.5H8Z" fill="currentColor" stroke="none" />
    </>
  ),
  blocked: (
    <>
      <circle cx="8" cy="8" r="6.5" fill="currentColor" stroke="none" />
      <path d="M5.25 8h5.5" className="stroke-background" />
    </>
  ),
  done: (
    <>
      <circle cx="8" cy="8" r="6.5" fill="currentColor" stroke="none" />
      <path d="m5.25 8.1 1.8 1.8 3.7-3.7" className="stroke-background" />
    </>
  ),
  cancelled: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="m4 12 8-8" />
    </>
  ),
}

type TaskStatusIconProps = Omit<ComponentProps<"svg">, "children"> & {
  status: TaskStatus
  /** Names the icon when no status text is beside it; without it, it is decorative. */
  label?: string
}

function TaskStatusIcon({ status, label, className, ...props }: TaskStatusIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      data-slot="task-status-icon"
      data-status={status}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("size-3.5 shrink-0", statusIconColor[status], className)}
      {...props}
    >
      {statusIconShape[status]}
    </svg>
  )
}

export { TaskStatusIcon }
export type { TaskStatusIconProps }
