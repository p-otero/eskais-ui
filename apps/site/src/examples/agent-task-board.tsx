import { useState } from "react"

import { AgentTaskBoard } from "@/components/ui/agent-task-board"
import type { TaskView } from "@/lib/agent-task-types"

import { sampleStages, sampleTasks } from "./fixtures"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function AgentTaskBoardDemo() {
  const [tasks, setTasks] = useState<TaskView[]>(sampleTasks)
  const decide = (id: string, status: TaskView["status"]) =>
    setTasks((list) => list.map((task) => (task.id === id ? { ...task, status, decisionNeeded: undefined } : task)))
  return (
    <AgentTaskBoard
      className="w-full"
      mode="live"
      tasks={tasks}
      stages={sampleStages}
      timeZone="UTC"
      detailPresentation="drawer"
      onApproveProposal={async (id) => {
        await wait(800)
        decide(id, "todo")
      }}
      onRejectProposal={async (id) => {
        await wait(600)
        decide(id, "cancelled")
      }}
    />
  )
}
