import { useState } from "react"
import { z } from "zod"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Form, FormActions, FormField } from "@/components/ui/form"
import { TokenInput, TokenInputEditor, type Token } from "@/components/ui/token-input"
import type { Tone } from "@/lib/tone"

import { Section } from "../section"

const labelTones: Record<string, Tone> = { bug: "destructive", docs: "info", "good first issue": "success" }
const toneOf = (token: Token): Tone => labelTones[token.label] ?? "neutral"

const draft = [
  "Compare ",
  { type: "file", value: "src/routes.ts", label: "routes.ts" },
  " with ",
  { type: "file", value: "src/app.tsx", label: "app.tsx" },
] as const

const issueSchema = z.object({ labels: z.array(z.string()).min(1).max(4) })

function IssueLabelsForm() {
  return (
    <Form
      schema={issueSchema}
      defaultValues={{ labels: [] }}
      onSubmit={async () => undefined}
      label="Release notes"
      className="w-full max-w-md"
    >
      <FormField
        name="labels"
        label="Release labels"
        labelPlacement="in"
        description="Up to four. Enter or a comma adds one."
      >
        <TokenInput tokenType="label" max={4} tone={toneOf}>
          <TokenInputEditor placeholder="bug, docs…" />
        </TokenInput>
      </FormField>
      <FormActions submitLabel="Save labels" />
    </Form>
  )
}

function TokenInputSection() {
  const [labels, setLabels] = useState<readonly string[]>(["bug", "docs"])
  return (
    <Section
      title="Token input"
      description="Labels as removable chips: Enter or a comma adds, Backspace removes, Ctrl+Z brings one back, a paste splits."
    >
      <div data-token-input-demo className="grid w-full gap-section md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-group">
          <Field>
            <FieldLabel>Triage labels</FieldLabel>
            <TokenInput tokenType="label" value={labels} onValueChange={setLabels} tone={toneOf}>
              <TokenInputEditor placeholder="Add a label" />
            </TokenInput>
            <FieldDescription>{labels.length === 0 ? "No labels" : labels.join(", ")}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Topics</FieldLabel>
            <TokenInput tokenType="topic" tone="violet">
              <TokenInputEditor placeholder="Add a topic" />
            </TokenInput>
          </Field>
          <Field invalid>
            <FieldLabel>Reviewers</FieldLabel>
            <TokenInput tokenType="reviewer" defaultValue={["ada"]} validate={(name) => /^[a-z]+$/.test(name)}>
              <TokenInputEditor />
            </TokenInput>
            <FieldError>Add at least two reviewers.</FieldError>
          </Field>
          <Field>
            <FieldLabel>Prompt</FieldLabel>
            <TokenInput defaultValue={draft} tone="info" readOnly>
              <TokenInputEditor />
            </TokenInput>
            <FieldDescription>Without tokenType: text and file tokens, read-only.</FieldDescription>
          </Field>
        </div>
        <IssueLabelsForm />
      </div>
    </Section>
  )
}

export { TokenInputSection }
