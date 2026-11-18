import { ActivityLog, undoToast } from "@/components/ui/activity-log"
import { createActivityLog } from "@/components/ui/activity-log-store"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"

import { agent } from "../agent"

// Created when the example loads, before its switches render, and limited to them.
const log = createActivityLog(agent, { within: () => document.getElementById("activity-log-demo-settings") })

const settings = ["Email me when a deploy fails", "Weekly usage digest", "Share anonymous metrics"]

export default function ActivityLogDemo() {
  const askAgent = async () => {
    await agent.act({
      steps: [
        { ref: "Weekly usage digest", action: "setChecked", args: [true] },
        { ref: "Share anonymous metrics", action: "setChecked", args: [true] },
      ],
    })
    undoToast("The agent changed two settings", { onUndo: () => log.undoActor("agent") })
  }

  return (
    <div className="grid w-full gap-section md:grid-cols-2">
      <div id="activity-log-demo-settings" className="flex flex-col gap-items">
        {settings.map((label) => (
          <Field key={label}>
            <Switch />
            <FieldLabel>{label}</FieldLabel>
          </Field>
        ))}
        <Button variant="outline" className="self-start" onClick={askAgent}>
          Let the agent turn two on
        </Button>
      </div>
      <div className="flex max-h-80 min-h-0 flex-col rounded-surface border border-border bg-card px-inset-item py-inset-item">
        <ActivityLog log={log} label="Activity" header={<h3 className="text-title-sm">Activity</h3>} />
      </div>
    </div>
  )
}
