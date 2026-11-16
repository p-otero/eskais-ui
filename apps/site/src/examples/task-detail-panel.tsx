import { TaskDetailPanel } from "@/components/ui/task-detail-panel"

import { GENERATED_AT, sampleStages, sampleTasks } from "./fixtures"

const task = sampleTasks.find((candidate) => candidate.id === "T-014") ?? sampleTasks[0]!

export default function TaskDetailPanelDemo() {
  return (
    <div className="h-136 w-full max-w-2xl overflow-auto rounded-surface border bg-background">
      <TaskDetailPanel task={task} now={GENERATED_AT} locale="en-US" timeZone="UTC" stages={sampleStages} />
    </div>
  )
}
