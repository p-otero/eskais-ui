import { useState } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { Select } from "@/components/ui/select"

const models = [
  {
    label: "Current",
    options: [
      { value: "opus", label: "Opus" },
      { value: "sonnet", label: "Sonnet" },
      { value: "haiku", label: "Haiku" },
    ],
  },
  { label: "Retired", options: [{ value: "legacy", label: "Legacy", disabled: true }] },
]

export default function SelectDemo() {
  const [model, setModel] = useState<string | null>("sonnet")
  return (
    <Field className="w-full max-w-xs">
      <FieldLabel>Model</FieldLabel>
      <Select options={models} value={model} onValueChange={setModel} placeholder="Any model" clearable="Any model" />
    </Field>
  )
}
