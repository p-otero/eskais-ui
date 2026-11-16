import { TaskCard } from "@/components/ui/task-card"
import type { TaskView } from "@/lib/agent-task-types"

// The shape every agent-task component reads; map your own API to it once.
const task: TaskView = {
  id: "T-101",
  title: "Translate the onboarding emails",
  goal: "Spanish and Portuguese versions of the three onboarding emails.",
  status: "working",
  profile: "writer",
  dependsOn: [{ id: "T-099", title: "Freeze the English copy", status: "done" }],
  acceptance: [{ text: "A native speaker reviewed each email", result: "unverified" }],
  attempts: [],
  labels: ["i18n"],
  updatedAt: "2026-11-15T18:00:00Z",
}

export default function AgentTaskTypesDemo() {
  return <TaskCard task={task} now="2026-11-15T18:42:00Z" locale="en-US" timeZone="UTC" className="w-full max-w-sm" />
}
