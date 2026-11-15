import { useState } from "react"

import { AttemptTimeline } from "@/components/ui/attempt-timeline"
import { UsageStat, UsageTable } from "@/components/ui/usage"

import { GENERATED_AT, sampleTasks } from "../../../../test/fixtures/agent-tasks"
import { Section } from "../section"

const indexDocs = sampleTasks.find((task) => task.id === "T-014")

function AttemptsSection() {
  const [opened, setOpened] = useState<string>()
  if (!indexDocs) return null
  const { usage, attempts } = indexDocs
  return (
    <Section
      title="Usage and AttemptTimeline"
      description="T-014's usage with compact counts and honest values, and its attempts on the UI SDK Timeline: a fallback route, a forked context, a repair, a blocker and checks."
    >
      <div className="flex w-full flex-col gap-6">
        {usage && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-6">
              <UsageStat label="Input tokens" value={usage.inputTokens} locale="en-US" />
              <UsageStat label="Output tokens" value={usage.outputTokens} locale="en-US" />
              <UsageStat label="Cost" kind="cost" value={usage.costUsd} locale="en-US" />
              <UsageStat label="Active time" kind="duration" value={usage.activeMs} locale="en-US" />
            </div>
            <UsageTable usage={usage} aria-label="T-014 usage" locale="en-US" className="max-w-md" />
          </div>
        )}
        <AttemptTimeline
          aria-label="T-014 attempts"
          attempts={attempts}
          now={GENERATED_AT}
          locale="en-US"
          timeZone="UTC"
          onOpenThread={(thread) => setOpened(thread.title ?? thread.id)}
        />
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {opened ? `Opened thread ${opened}` : "Open a thread to see the callback run."}
        </p>
      </div>
    </Section>
  )
}

export { AttemptsSection }
