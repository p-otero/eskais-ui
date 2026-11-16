import { useState } from "react"
import { z } from "zod"

import { FormField } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { StepDialog, type FormStep } from "@/components/ui/step-dialog"
import { Textarea } from "@/components/ui/textarea"

const schema = z.object({
  name: z.string().min(3),
  region: z.enum(["eu", "us"]),
  brief: z.string().min(10),
})

type Values = z.input<typeof schema>

const steps: FormStep<Values>[] = [
  {
    id: "project",
    title: "Project",
    description: "A name your team will recognize.",
    render: () => (
      <FormField name="name" label="Project name">
        <Input placeholder="Atlas" />
      </FormField>
    ),
  },
  {
    id: "region",
    title: "Region",
    description: "Where its agents run and its data stays.",
    render: () => (
      <FormField name="region" label="Region">
        <Select
          options={[
            { value: "eu", label: "Europe" },
            { value: "us", label: "United States" },
          ]}
        />
      </FormField>
    ),
  },
  {
    id: "brief",
    title: "Brief",
    render: () => (
      <FormField name="brief" label="What should the agents do first?">
        <Textarea placeholder="Index the docs and open a pull request with a summary." />
      </FormField>
    ),
  },
]

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function StepDialogDemo() {
  const [created, setCreated] = useState<string | null>(null)
  return (
    <div className="flex flex-col items-center gap-items">
      <StepDialog
        schema={schema}
        defaultValues={{ name: "", region: "eu", brief: "" }}
        steps={steps}
        trigger="New project"
        title="New project"
        labels={{ submit: "Create project" }}
        onSubmit={async (values) => {
          await wait(700)
          setCreated(values.name)
        }}
      />
      <output className="text-body-sm text-muted-foreground empty:hidden">
        {created === null ? null : `Created "${created}".`}
      </output>
    </div>
  )
}
