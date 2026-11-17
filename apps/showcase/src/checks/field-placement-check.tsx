import type { StandardSchemaV1 } from "@standard-schema/spec"

import { Field, FieldDescription, FieldLabel, type FieldLabelPlacement } from "@/components/ui/field"
import { Form, FormField } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"

// ?demo=field-placement-check: the fixture tooling/shell-check.mjs measures. Under a Form's floating placement, a
// Field in the floating layout floats its label on its control; a Field the page lays out as its own box (padding, a
// border, its own text between the parts) keeps the label on top, where it can't cover the control's value.
const teams = [
  { value: "web", label: "Web platform" },
  { value: "data", label: "Data" },
]

type Values = { name: string; team: string | null }

const schema: StandardSchemaV1<Values> = {
  "~standard": { version: 1, vendor: "showcase", validate: (value) => ({ value: value as Values }) },
}

function Placement({ placement }: { placement: FieldLabelPlacement }) {
  return (
    <Form
      label={`Floating ${placement}`}
      labelPlacement={placement}
      schema={schema}
      defaultValues={{ name: "Ada", team: "web" }}
      onSubmit={() => undefined}
      className="w-80"
    >
      <div data-case={`${placement}-field`}>
        <Field>
          <FieldLabel>Team</FieldLabel>
          <Select options={teams} defaultValue="web" />
          <FieldDescription>Who owns it.</FieldDescription>
        </Field>
      </div>
      <div data-case={`${placement}-form-field`}>
        <FormField name="name" label="Name">
          <Input />
        </FormField>
      </div>
      <div data-case={`${placement}-boxed`}>
        {/* oxlint-disable-next-line shadcn/no-restyle -- the consumer layout this fixture reproduces */}
        <Field className="border p-3">
          <FieldLabel>Team</FieldLabel>
          <Select options={teams} defaultValue="web" />
          <p className="text-caption text-muted-foreground">Who owns it.</p>
        </Field>
      </div>
      <div data-case={`${placement}-explicit-top`}>
        <Field labelPlacement="top">
          <FieldLabel>Team</FieldLabel>
          <Select options={teams} defaultValue="web" />
        </Field>
      </div>
    </Form>
  )
}

function FieldPlacementCheck() {
  return (
    <main className="flex flex-wrap items-start gap-section p-section">
      <Placement placement="in" />
      <Placement placement="on" />
    </main>
  )
}

export { FieldPlacementCheck }
