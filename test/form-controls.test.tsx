import { render, screen, waitFor } from "@testing-library/react"
import { createAgent } from "@ui-sdk/react/agent"
import { expect, test, vi } from "vitest"
import { z } from "zod"

import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { DatePicker } from "@/components/ui/date-picker"
import { Form, FormActions, FormField, useFormField } from "@/components/ui/form"
import { Label } from "@/components/ui/label"
import { NumberInput, NumberInputControl, NumberInputGroup } from "@/components/ui/number-input"
import { Radio, RadioGroup, RadioIndicator } from "@/components/ui/radio-group"
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Slider, SliderControl, SliderThumb, SliderTrack } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Toggle, ToggleGroup } from "@/components/ui/toggle-group"

import { axeViolations } from "./axe"

const agent = createAgent()

const regions = [
  { value: "eu", label: "Europe" },
  { value: "us", label: "United States" },
]

const schema = z.object({
  notes: z.string(),
  seats: z.number().nullable(),
  tier: z.string(),
  region: z.string().nullable(),
  budget: z.number(),
  due: z.string().nullable(),
  view: z.string(),
  formats: z.array(z.string()),
  color: z.string(),
})

function Custom() {
  const field = useFormField()
  return (
    <output aria-label="Color" data-invalid={field.invalid || undefined}>
      {String(field.value)}
    </output>
  )
}

function ControlsForm({ onSubmit }: { onSubmit: (values: z.output<typeof schema>) => void }) {
  return (
    <Form
      schema={schema}
      label="Settings"
      onSubmit={onSubmit}
      defaultValues={{
        notes: "",
        seats: 3,
        tier: "free",
        region: null,
        budget: 20,
        due: null,
        view: "list",
        formats: [],
        color: "teal",
      }}
    >
      <FormField name="notes" label="Notes">
        <Textarea />
      </FormField>
      <FormField name="seats" label="Seats">
        <NumberInput>
          <NumberInputGroup>
            <NumberInputControl />
          </NumberInputGroup>
        </NumberInput>
      </FormField>
      <FormField name="tier" label="Tier">
        <RadioGroup>
          {["free", "paid"].map((tier) => (
            <Label key={tier}>
              <Radio value={tier}>
                <RadioIndicator />
              </Radio>
              {tier === "free" ? "Free" : "Paid"}
            </Label>
          ))}
        </RadioGroup>
      </FormField>
      <FormField name="region" label="Region">
        <Combobox items={regions}>
          <ComboboxControl>
            <ComboboxInput />
          </ComboboxControl>
          <ComboboxContent>
            <ComboboxList>
              {(state) =>
                (state.items as typeof regions).map((item) => (
                  <ComboboxItem key={item.value} value={item.value}>
                    {item.label}
                  </ComboboxItem>
                ))
              }
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </FormField>
      <FormField name="budget" label="Budget">
        <Slider>
          <SliderControl>
            <SliderTrack>
              <SliderThumb />
            </SliderTrack>
          </SliderControl>
        </Slider>
      </FormField>
      <FormField name="due" label="Due date">
        <DatePicker locale="en-US" />
      </FormField>
      <FormField name="view" label="View">
        <SegmentedControl>
          <SegmentedControlItem value="list">List</SegmentedControlItem>
          <SegmentedControlItem value="board">Board</SegmentedControlItem>
        </SegmentedControl>
      </FormField>
      <FormField name="formats" label="Formats">
        <ToggleGroup multiple>
          <Toggle value="bold">Bold</Toggle>
          <Toggle value="italic">Italic</Toggle>
        </ToggleGroup>
      </FormField>
      <FormField name="color" label="Accent" render={() => <Custom />} />
      <FormActions submitLabel="Save settings" />
    </Form>
  )
}

test("each registry control binds by name, and agents set them through their own parts", async () => {
  const onSubmit = vi.fn()
  const { container } = render(<ControlsForm onSubmit={onSubmit} />)
  const components = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  const labels = components.map((entry) => entry.label)
  for (const label of ["Notes", "Seats", "Tier", "Region", "Budget", "View", "Formats", "Settings"]) {
    expect(labels, `${label} is missing`).toContain(label)
  }

  const result = await agent.act({
    steps: [
      { ref: "Notes", action: "setValue", args: ["Ship it"] },
      { ref: "Seats", action: "setValue", args: [5] },
      { ref: "Tier", action: "setValue", args: ["Paid"] },
      { ref: "Region", action: "setValue", args: ["Europe"] },
      { ref: "Budget", action: "setValue", args: [40] },
      { ref: "View", action: "setValue", args: ["Board"] },
      { ref: "Formats", action: "setValue", args: [["bold"]] },
      { ref: "Settings", action: "submit" },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit.mock.calls[0]![0]).toEqual({
    notes: "Ship it",
    seats: 5,
    tier: "paid",
    region: "eu",
    budget: 40,
    due: null,
    view: "board",
    formats: ["bold"],
    color: "teal",
  })
  expect(screen.getByRole("status", { name: "Color" }).textContent).toBe("teal")
  expect(await axeViolations(container)).toEqual([])
})
