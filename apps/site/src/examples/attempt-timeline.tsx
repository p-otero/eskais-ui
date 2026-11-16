import { AttemptTimeline } from "@/components/ui/attempt-timeline"

import { GENERATED_AT, sampleTasks } from "./fixtures"

const task = sampleTasks.find((candidate) => candidate.id === "T-014") ?? sampleTasks[0]!

export default function AttemptTimelineDemo() {
  return (
    <AttemptTimeline
      aria-label={`${task.id} attempts`}
      attempts={task.attempts}
      now={GENERATED_AT}
      locale="en-US"
      timeZone="UTC"
      className="w-full max-w-2xl"
    />
  )
}
