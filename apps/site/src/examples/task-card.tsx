import { TaskCard } from "@/components/ui/task-card"

import { GENERATED_AT, sampleStages, sampleTasks } from "./fixtures"

export default function TaskCardDemo() {
  return (
    <div className="grid w-full max-w-2xl gap-items sm:grid-cols-2">
      {sampleTasks.slice(0, 2).map((task) => (
        <TaskCard key={task.id} task={task} now={GENERATED_AT} locale="en-US" timeZone="UTC" stages={sampleStages} />
      ))}
    </div>
  )
}
