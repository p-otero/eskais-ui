import { useState } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { ServerCombobox } from "@/components/ui/server-combobox"
import { arraySource } from "@/lib/array-source"

import { serverTasks } from "./fixtures"

type TaskOption = { id: string; title: string }

const source = arraySource<TaskOption, { q?: string }>(
  serverTasks.map((task) => ({ id: task.id, title: `${task.id} ${task.title}` })),
  { key: ["docs", "server-combobox"], delay: 300, search: { fields: ["title"] } },
)

export default function ServerComboboxDemo() {
  const [blockedBy, setBlockedBy] = useState<string[]>([])
  return (
    <Field className="w-full max-w-sm">
      <FieldLabel>Blocked by</FieldLabel>
      <ServerCombobox
        multiple
        source={source}
        getLabel={(task) => task.title}
        value={blockedBy}
        onValueChange={setBlockedBy}
        placeholder="Search 312 tasks"
      />
    </Field>
  )
}
