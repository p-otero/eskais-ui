import { useState } from "react"

import { Button } from "@/components/ui/button"
import { ButtonLink } from "@/components/ui/button-link"
import { Hero } from "@/components/ui/hero"
import { StageTrack } from "@/components/ui/stage-track"
import { StatusPill } from "@/components/ui/status-pill"
import { TaskCard } from "@/components/ui/task-card"
import type { TaskView } from "@/lib/agent-task-types"

import { GENERATED_AT, sampleStages, sampleTasks } from "../examples/fixtures"
import { ArrowRightIcon } from "../icons"
import { followTo } from "../router"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const proposal = sampleTasks.find((task) => task.id === "T-011") ?? sampleTasks[0]!
const working = sampleTasks.find((task) => task.status === "working") ?? sampleTasks[1]!

function CardStack() {
  const [task, setTask] = useState<TaskView>(proposal)
  const decide = (status: TaskView["status"]) =>
    setTask((current) => ({ ...current, status, decisionNeeded: undefined }))
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div
        aria-hidden="true"
        inert
        className="absolute inset-x-6 -top-6 rotate-3 rounded-surface border bg-card p-inset-surface opacity-60 shadow-surface narrow:hidden"
      >
        <div className="flex items-center justify-between gap-items">
          <span className="text-title-sm">{working.title}</span>
          <StatusPill tone="info" dot pulse>
            Working
          </StatusPill>
        </div>
      </div>
      <div
        aria-hidden="true"
        inert
        className="absolute inset-x-3 -top-3 -rotate-2 rounded-surface border bg-card p-inset-surface opacity-80 shadow-surface narrow:hidden"
      >
        <StageTrack aria-label="Stage" stages={sampleStages} current="staging" size="sm" />
      </div>
      <div className="relative flex flex-col gap-items rounded-surface border bg-card p-inline shadow-floating">
        <TaskCard
          task={task}
          mode="live"
          now={GENERATED_AT}
          locale="en-US"
          timeZone="UTC"
          stages={sampleStages}
          onApproveProposal={async () => {
            await wait(700)
            decide("todo")
          }}
          onRejectProposal={async () => {
            await wait(500)
            decide("cancelled")
          }}
        />
        <p className="px-inset-item pb-inline text-caption text-muted-foreground" aria-live="polite">
          {task.status === "proposed"
            ? "A live TaskCard: approve or reject the proposal. An agent would need your approval too."
            : `Moved to ${task.status === "todo" ? "To do" : "Cancelled"}. `}
          {task.status !== "proposed" && (
            <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setTask(proposal)}>
              Reset the demo
            </Button>
          )}
        </p>
      </div>
    </div>
  )
}

function SiteHero() {
  return (
    <Hero
      eyebrow={
        <>
          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
          Built on Vercel UI SDK · installed with shadcn
        </>
      }
      title="React components people"
      titleMuted="and their agents can operate."
      titleBreak={false}
      description="Eskais UI is an accessible, themeable registry where every control is a UI SDK part: keyboard, focus and ARIA come built in, and an agent can read the page and act on it, with a person approving anything that can't be undone."
      actions={
        <>
          <ButtonLink size="lg" className="group" {...followTo("/docs/installation")}>
            Get started
            <ArrowRightIcon className="transition-transform duration-micro ease-standard group-hover:translate-x-0.5" />
          </ButtonLink>
          <ButtonLink size="lg" variant="outline" {...followTo("/docs/components")}>
            Browse components
          </ButtonLink>
        </>
      }
      install="npx shadcn@latest add @eskais/agent-task-board"
      aside={<CardStack />}
    />
  )
}

export { SiteHero }
