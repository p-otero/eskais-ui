import { useState } from "react"

import { Checkbox, CheckboxIndicator } from "@/components/ui/checkbox"
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectItemIndicator,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import { Section } from "../section"

type Option = { value: string; label: string }

const models: Option[] = [
  { value: "opus", label: "Opus" },
  { value: "sonnet", label: "Sonnet" },
  { value: "haiku", label: "Haiku" },
]
const legacyModels: Option[] = [{ value: "legacy", label: "Legacy" }]

const profiles: Option[] = [
  { value: "reviewer", label: "Reviewer" },
  { value: "researcher", label: "Researcher" },
  { value: "release", label: "Release manager" },
  { value: "triage", label: "Triage" },
]

function SelectionSection() {
  const [model, setModel] = useState<string | null>(null)
  const [profile, setProfile] = useState<string | null>(null)
  const [layout, setLayout] = useState<"board" | "table">("board")
  const [archived, setArchived] = useState(false)

  const summary = [
    `layout ${layout}`,
    `model ${model ?? "any"}`,
    `profile ${profile ?? "any"}`,
    archived ? "with archived tasks" : "without archived tasks",
  ].join(", ")

  return (
    <Section
      title="Select, Combobox, SegmentedControl, Checkbox and Textarea"
      description="Task board filters built from UI SDK parts. Field labels name every control, so agents find them too."
    >
      <div className="grid w-full gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel>Layout</FieldLabel>
          <SegmentedControl value={layout} onValueChange={(next) => next && setLayout(next)}>
            <SegmentedControlIndicator />
            <SegmentedControlItem value="board">Board</SegmentedControlItem>
            <SegmentedControlItem value="table">Table</SegmentedControlItem>
          </SegmentedControl>
        </Field>

        <Field>
          <FieldLabel>Model</FieldLabel>
          <Select
            items={[...models, { type: "separator" }, { type: "group", label: "Retired", items: legacyModels }]}
            value={model}
            onValueChange={setModel}
            placeholder="Any model"
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                  <SelectItemIndicator />
                </SelectItem>
              ))}
              <SelectSeparator />
              <SelectGroup>
                <SelectGroupLabel>Retired</SelectGroupLabel>
                {legacyModels.map((option) => (
                  <SelectItem key={option.value} value={option.value} disabled>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
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

        <Field className="flex-row items-start self-end">
          <Checkbox checked={archived} onCheckedChange={(next) => setArchived(next === true)}>
            <CheckboxIndicator />
          </Checkbox>
          <div className="flex flex-col gap-1">
            <FieldLabel>Include archived tasks</FieldLabel>
            <FieldDescription>Closed more than 30 days ago.</FieldDescription>
          </div>
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel>Task brief</FieldLabel>
          <Textarea autoResize placeholder="What should the agent do?" className="max-h-48" />
          <FieldDescription>Grows with its text.</FieldDescription>
        </Field>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing {summary}.
      </p>
    </Section>
  )
}

export { SelectionSection }
