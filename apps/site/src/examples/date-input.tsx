import { DateInput } from "@/components/ui/date-input"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"

export default function DateInputDemo() {
  return (
    <Field className="w-fit">
      <FieldLabel>Start date</FieldLabel>
      <DateInput defaultValue="2026-11-02" min="2026-01-01" />
      <FieldDescription>Type it, or paste a whole date.</FieldDescription>
    </Field>
  )
}
