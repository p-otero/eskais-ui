import { AttemptStatusPill, ContextModePill, TaskStatusPill } from "@/components/ui/task-status"

export default function TaskStatusDemo() {
  return (
    <div className="flex flex-col items-center gap-group">
      <div className="flex flex-wrap justify-center gap-items">
        <TaskStatusPill status="proposed" />
        <TaskStatusPill status="todo" />
        <TaskStatusPill status="working" />
        <TaskStatusPill status="review" />
        <TaskStatusPill status="done" />
        <TaskStatusPill status="blocked" />
      </div>
      <div className="flex flex-wrap justify-center gap-items">
        <AttemptStatusPill status="active" />
        <AttemptStatusPill status="succeeded" />
        <ContextModePill mode="fork" />
      </div>
    </div>
  )
}
