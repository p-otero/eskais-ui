import { useState } from "react"

import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"

export default function DateTimePickerDemo() {
  const [value, setValue] = useState<string | null>("2026-11-20T09:30")
  return (
    <Field className="w-full max-w-sm">
      <FieldLabel>Maintenance window</FieldLabel>
      <DateTimePicker value={value} onValueChange={setValue} locale="en-GB" timeZone="Europe/Madrid" />
      <FieldDescription>Local time in the region: {value ?? "not set"}.</FieldDescription>
    </Field>
  )
}
