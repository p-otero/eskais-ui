import "./fonts.css"
import { createRoot } from "react-dom/client"

import { AgentTaskBoard } from "@/components/ui/agent-task-board"
import { Appearance, createAppearance } from "@/components/ui/appearance"
import type { TaskView } from "@/lib/agent-task-types"
import type { Stage } from "@/components/ui/stage-track"

type BoardData = { tasks: TaskView[]; stages?: Stage[]; generatedAt: string }

const data = JSON.parse(document.getElementById("board-data")?.textContent ?? "null") as BoardData | null
const root = document.getElementById("root")
if (!data || !root) throw new Error("The page is missing its board data or root element.")

const appearance = createAppearance()
appearance.apply()

createRoot(root).render(
  <Appearance appearance={appearance}>
    <main className="bg-background p-surface text-foreground">
      <AgentTaskBoard
        tasks={data.tasks}
        stages={data.stages}
        mode="snapshot"
        generatedAt={data.generatedAt}
        timeZone="UTC"
      />
    </main>
  </Appearance>,
)
