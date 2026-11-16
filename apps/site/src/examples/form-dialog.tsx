import { useState } from "react"
import { z } from "zod"

import { FormDialog } from "@/components/ui/form-dialog"
import { FormField } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const schema = z.object({
  title: z.string().min(3),
  brief: z.string().max(200),
})

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function FormDialogDemo() {
  const [created, setCreated] = useState<string | null>(null)
  return (
    <div className="flex flex-col items-center gap-items">
      <FormDialog
        schema={schema}
        defaultValues={{ title: "", brief: "" }}
        trigger="New task"
        title="New task"
        description="An agent picks it up from the backlog."
        submitLabel="Create task"
        cancelLabel="Cancel"
        confirmDiscard="Discard this task?"
        discardLabel="Discard"
        keepEditingLabel="Keep editing"
        onSubmit={async (values) => {
          await wait(700)
          setCreated(values.title)
        }}
      >
        <FormField name="title" label="Title" required>
          <Input placeholder="Index the docs" />
        </FormField>
        <FormField name="brief" label="Brief">
          <Textarea placeholder="What should the agent do?" />
        </FormField>
      </FormDialog>
      <output className="text-body-sm text-muted-foreground empty:hidden">
        {created === null ? null : `Created "${created}".`}
      </output>
    </div>
  )
}
