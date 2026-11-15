import { createRoot } from "react-dom/client"

import { AgentTaskBoard } from "@/components/ui/agent-task-board"
import type { TaskView } from "@/lib/agent-task-types"

type BoardData = { tasks: TaskView[]; generatedAt: string }

const data = JSON.parse(document.getElementById("board-data")?.textContent ?? "null") as BoardData | null
const root = document.getElementById("root")
if (!data || !root) throw new Error("The page is missing its board data or root element.")

createRoot(root).render(
  <main className="bg-background p-surface text-foreground">
    <AgentTaskBoard tasks={data.tasks} mode="snapshot" generatedAt={data.generatedAt} timeZone="UTC" />
  </main>,
)
