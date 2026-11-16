import { useState } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { NativeSelect } from "@/components/ui/native-select"

const regions = [
  {
    label: "Europe",
    options: [
      { value: "fra", label: "Frankfurt" },
      { value: "mad", label: "Madrid" },
    ],
  },
  {
    label: "Americas",
    options: [
      { value: "iad", label: "Washington, D.C." },
      { value: "gru", label: "São Paulo" },
    ],
  },
]

export default function NativeSelectDemo() {
  const [region, setRegion] = useState<string | null>(null)
  return (
    <Field className="w-full max-w-xs">
      <FieldLabel>Region</FieldLabel>
      <NativeSelect options={regions} value={region} onValueChange={setRegion} placeholder="Choose a region" />
    </Field>
  )
}
