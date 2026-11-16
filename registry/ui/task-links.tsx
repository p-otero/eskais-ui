"use client"

import { createElement, type ComponentProps, type MouseEvent, type ReactNode } from "react"

import type { TaskLink } from "@/lib/agent-task-types"
import type { Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/ui/status-pill"

type LinkKind = TaskLink["kind"]
type LinkState = NonNullable<TaskLink["state"]>

const taskLinkStateTones: Record<LinkState, Tone> = {
  draft: "neutral",
  open: "info",
  merged: "success",
  closed: "destructive",
}

const kindPaths: Record<LinkKind, ReactNode> = {
  "pull-request": (
    <>
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M13 6h3a2 2 0 0 1 2 2v7M6 9v12" />
    </>
  ),
  branch: (
    <>
      <path d="M6 3v12" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </>
  ),
  commit: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M3 12h6m6 0h6" />
    </>
  ),
  issue: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  external: <path d="M15 3h6v6M10 14 21 3m-3 10v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />,
}

function TaskLinkIcon({ kind, className, ...props }: ComponentProps<"svg"> & { kind: LinkKind }) {
  return (
    <svg
      data-slot="task-link-icon"
      data-kind={kind}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4 shrink-0", className)}
      {...props}
    >
      {kindPaths[kind]}
    </svg>
  )
}

interface TaskLinkLabels {
  kind: Record<LinkKind, string>
  state: Record<LinkState, string>
}

const taskLinkLabels: TaskLinkLabels = {
  kind: { "pull-request": "Pull request", branch: "Branch", commit: "Commit", issue: "Issue", external: "Link" },
  state: { draft: "Draft", open: "Open", merged: "Merged", closed: "Closed" },
}

/** A handler takes over the click, as `onOpenThread` does; without one the link navigates. */
function openWith(link: TaskLink, onOpenLink?: (link: TaskLink) => void) {
  if (!onOpenLink) return undefined
  return (event: MouseEvent) => {
    event.preventDefault()
    onOpenLink(link)
  }
}

type TaskLinksProps = Omit<ComponentProps<"ul">, "children"> & {
  links: readonly TaskLink[]
  labels?: Partial<TaskLinkLabels>
  renderLink?: (link: TaskLink) => ReactNode
  onOpenLink?: (link: TaskLink) => void
}

function TaskLinks({ links, labels, renderLink, onOpenLink, className, ...props }: TaskLinksProps) {
  const text = { ...taskLinkLabels, ...labels }
  return (
    <ul data-slot="task-links" className={cn("flex min-w-0 flex-col gap-inline", className)} {...props}>
      {links.map((link) => (
        <li
          key={`${link.kind} ${link.href}`}
          data-slot="task-link"
          data-kind={link.kind}
          data-state={link.state}
          className="flex min-w-0 items-center gap-inline"
        >
          {renderLink ? (
            renderLink(link)
          ) : (
            <Button
              variant="link"
              size="sm"
              render={createElement("a", { href: link.href })}
              title={`${text.kind[link.kind]}: ${link.href}`}
              onClick={openWith(link, onOpenLink)}
              className="h-auto min-w-0 justify-start px-0 py-inline text-start whitespace-normal wrap-anywhere"
            >
              <TaskLinkIcon kind={link.kind} className="text-muted-foreground" />
              <span className="min-w-0">{link.label}</span>
            </Button>
          )}
          {link.state && (
            <StatusPill tone={taskLinkStateTones[link.state]} className="ms-auto">
              {text.state[link.state]}
            </StatusPill>
          )}
        </li>
      ))}
    </ul>
  )
}

type PullRequestLinkProps = {
  link: TaskLink
  label: string
  onOpenLink?: (link: TaskLink) => void
  className?: string
}

function PullRequestLink({ link, label, onOpenLink, className }: PullRequestLinkProps) {
  return (
    <Button
      data-slot="task-card-pull-request"
      data-state={link.state}
      variant="ghost"
      size="icon"
      render={createElement("a", { href: link.href })}
      aria-label={label}
      title={link.label}
      onClick={openWith(link, onOpenLink)}
      className={cn("size-6 text-muted-foreground [&_svg]:size-3.5", className)}
    >
      <TaskLinkIcon kind="pull-request" />
    </Button>
  )
}

export { PullRequestLink, TaskLinkIcon, TaskLinks, taskLinkLabels, taskLinkStateTones }
export type { PullRequestLinkProps, TaskLinkLabels, TaskLinksProps }
