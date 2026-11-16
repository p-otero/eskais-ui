import { useState } from "react"
import { z } from "zod"

import { Checkbox, CheckboxIndicator } from "@/components/ui/checkbox"
import { Form, FormActions, FormField, FormRootError, FormServerError } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"

const regions = [
  { value: "fra", label: "Frankfurt" },
  { value: "iad", label: "Virginia" },
  { value: "gru", label: "São Paulo" },
]

const schema = z.object({
  name: z.string().min(3).max(32),
  owner: z.email(),
  region: z
    .string()
    .nullable()
    .refine((value) => value !== null, "Choose a region."),
  terms: z.boolean().refine(Boolean, "Accept the terms to continue."),
})

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function FormDemo() {
  const [created, setCreated] = useState<string | null>(null)
  return (
    <Form
      schema={schema}
      defaultValues={{ name: "", owner: "", region: null, terms: false }}
      label="New deployment"
      onSubmit={async (values) => {
        setCreated(null)
        await wait(800)
        if (values.owner.endsWith("@taken.dev")) {
          throw new FormServerError("Couldn't create the deployment.", {
            owner: "That owner already has an active deployment.",
          })
        }
        setCreated(values.name)
      }}
      className="w-full max-w-md"
    >
      <FormField name="name" label="Project name" description="Between 3 and 32 characters." required>
        <Input autoComplete="off" placeholder="atlas-web" />
      </FormField>
      <FormField name="owner" label="Owner email" description="Try one ending in @taken.dev." required>
        <Input type="email" placeholder="ada@example.dev" />
      </FormField>
      <FormField name="region" label="Region" required>
        <Select options={regions} placeholder="Choose a region" />
      </FormField>
      <FormField name="terms" label="I accept the terms of service">
        <Checkbox>
          <CheckboxIndicator />
        </Checkbox>
      </FormField>
      <FormRootError />
      <output className="text-body-sm text-muted-foreground empty:hidden">
        {created === null ? null : `Created ${created}.`}
      </output>
      <FormActions submitLabel="Create deployment" pendingLabel="Creating the deployment" />
    </Form>
  )
}
