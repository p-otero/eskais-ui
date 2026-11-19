import { useState, type ReactNode } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { Select } from "@/components/ui/select"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs"

const projects = [
  { value: "ACM", label: "ACM · Acme" },
  { value: "LNT", label: "LNT · Lantern" },
]

type View = "tasks" | "activity" | "git"

const views: { id: View; label: string }[] = [
  { id: "tasks", label: "Tasks" },
  { id: "activity", label: "Activity" },
  { id: "git", label: "Git" },
]

/** The page around the git views in the reference frames: a project select, then Tasks, Activity and Git tabs. */
function GitWorkspaceFrame({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<string | null>("ACM")
  const placeholder = <p className="py-section text-center text-sm text-muted-foreground">Not part of this demo.</p>
  return (
    <div className="flex min-w-0 flex-col gap-group bg-background p-inset-surface font-sans text-foreground">
      <Field className="max-w-72">
        <FieldLabel>Project</FieldLabel>
        <Select options={projects} value={project} onValueChange={setProject} />
      </Field>
      <Tabs defaultValue="git">
        <TabsList aria-label="Project views">
          {views.map((view) => (
            <TabsTab key={view.id} value={view.id}>
              {view.label}
            </TabsTab>
          ))}
        </TabsList>
        <TabsPanel value="tasks">{placeholder}</TabsPanel>
        <TabsPanel value="activity">{placeholder}</TabsPanel>
        <TabsPanel value="git">
          <div className="flex min-w-0 flex-col gap-group pt-group">{children}</div>
        </TabsPanel>
      </Tabs>
    </div>
  )
}

export { GitWorkspaceFrame }
