import { useState } from "react"

import {
  Combobox,
  ComboboxClear,
  ComboboxContent,
  ComboboxControl,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import { Field, FieldLabel } from "@/components/ui/field"

type Option = { value: string; label: string }

const profiles: Option[] = [
  { value: "reviewer", label: "Reviewer" },
  { value: "researcher", label: "Researcher" },
  { value: "release", label: "Release manager" },
  { value: "triage", label: "Triage" },
]

export default function ComboboxDemo() {
  const [profile, setProfile] = useState<string | null>(null)
  return (
    <Field className="w-full max-w-xs">
      <FieldLabel>Agent profile</FieldLabel>
      <Combobox items={profiles} value={profile} onValueChange={setProfile}>
        <ComboboxControl>
          <ComboboxInput placeholder="Any profile" />
          <ComboboxClear aria-label="Clear agent profile" />
          <ComboboxTrigger aria-label="Show agent profiles" />
        </ComboboxControl>
        <ComboboxContent>
          <ComboboxEmpty>No profiles match.</ComboboxEmpty>
          <ComboboxList>
            {(state) =>
              (state.items as Option[]).map((option) => (
                <ComboboxItem key={option.value} value={option.value}>
                  {option.label}
                  <ComboboxItemIndicator />
                </ComboboxItem>
              ))
            }
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  )
}
