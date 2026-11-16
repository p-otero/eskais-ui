import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

export default function TextareaDemo() {
  return (
    <Field className="w-full max-w-md">
      <FieldLabel>Task brief</FieldLabel>
      <Textarea autoResize placeholder="What should the agent do?" className="max-h-48" />
      <FieldDescription>Grows with its text, up to a limit.</FieldDescription>
    </Field>
  )
}
