import { UsageStat, UsageTable } from "@/components/ui/usage"

import { sampleTasks } from "./fixtures"

const usage = (sampleTasks.find((task) => task.id === "T-014") ?? sampleTasks[0]!).usage!

export default function UsageDemo() {
  return (
    <div className="flex w-full max-w-md flex-col gap-group">
      <div className="flex flex-wrap gap-section">
        <UsageStat label="Input tokens" value={usage.inputTokens} locale="en-US" />
        <UsageStat label="Output tokens" value={usage.outputTokens} locale="en-US" />
        <UsageStat label="Cost" kind="cost" value={usage.costUsd} locale="en-US" />
      </div>
      <UsageTable usage={usage} aria-label="T-014 usage" locale="en-US" />
    </div>
  )
}
