import { z } from "zod"

import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import { DatePicker } from "@/components/ui/date-picker"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Field, FieldDescription, FieldError, FieldLabel, type FieldLabelPlacement } from "@/components/ui/field"
import { Form, FormActions, FormField } from "@/components/ui/form"
import { Input, InputGroup } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import {
  NumberInput,
  NumberInputControl,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
} from "@/components/ui/number-input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import { Section } from "../section"

const teams = [
  { value: "web", label: "Web" },
  { value: "data", label: "Data" },
  { value: "infra", label: "Infrastructure" },
]

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function PlacementFields({ placement }: { placement: FieldLabelPlacement }) {
  const id = (name: string) => `${placement}-${name}`
  return (
    <div data-placement-demo={placement} className="flex min-w-0 flex-col gap-group">
      <Field labelPlacement={placement}>
        <FieldLabel>Full name</FieldLabel>
        <Input name={id("name")} placeholder="Ada Lovelace" autoComplete="off" />
        <FieldDescription>As it appears on the invoice.</FieldDescription>
      </Field>
      <Field labelPlacement={placement}>
        <FieldLabel>Work email</FieldLabel>
        <Input name={id("email")} type="email" defaultValue="ada@example.dev" autoComplete="off" />
      </Field>
      <Field labelPlacement={placement} invalid>
        <FieldLabel>Company</FieldLabel>
        <Input name={id("company")} defaultValue="A" autoComplete="off" />
        <FieldError>Use at least 2 characters.</FieldError>
      </Field>
      <Field labelPlacement={placement}>
        <FieldLabel>Search the docs</FieldLabel>
        <InputGroup>
          <SearchIcon />
          <Input name={id("search")} autoComplete="off" />
        </InputGroup>
      </Field>
      <Field labelPlacement={placement}>
        <FieldLabel>Team</FieldLabel>
        <Select options={teams} placeholder="Choose a team" />
      </Field>
      <Field labelPlacement={placement}>
        <FieldLabel>Billing team</FieldLabel>
        <Select options={teams} defaultValue="data" />
      </Field>
      <Field labelPlacement={placement}>
        <FieldLabel>Country</FieldLabel>
        <NativeSelect
          options={[
            { value: "es", label: "Spain" },
            { value: "pt", label: "Portugal" },
          ]}
          placeholder="Choose a country"
        />
      </Field>
      <Field labelPlacement={placement}>
        <FieldLabel>Seats</FieldLabel>
        <NumberInput defaultValue={3} min={1}>
          <NumberInputGroup>
            <NumberInputDecrement />
            <NumberInputControl />
            <NumberInputIncrement />
          </NumberInputGroup>
        </NumberInput>
      </Field>
      <Field labelPlacement={placement}>
        <FieldLabel>Start date</FieldLabel>
        <DatePicker hint={false} />
      </Field>
      <Field labelPlacement={placement}>
        <FieldLabel>Kick-off</FieldLabel>
        <DateTimePicker defaultValue="2026-11-20T10:30" labels={{ time: "Kick-off time" }} />
      </Field>
      <Field labelPlacement={placement}>
        <FieldLabel>Owner</FieldLabel>
        <Combobox items={teams}>
          <ComboboxControl>
            <ComboboxInput />
            <ComboboxTrigger aria-label="Show owners" />
          </ComboboxControl>
          <ComboboxContent>
            <ComboboxList>
              {(state) =>
                (state.items as typeof teams).map((option) => (
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
      <Field labelPlacement={placement}>
        <FieldLabel>Notes</FieldLabel>
        <Textarea name={id("notes")} placeholder="Anything the team should know" />
      </Field>
    </div>
  )
}

const inviteSchema = z.object({ email: z.email(), team: z.string().nullable(), message: z.string().max(80) })

function InviteForm() {
  return (
    <Form
      label="Invite a teammate"
      labelPlacement="in"
      schema={inviteSchema}
      defaultValues={{ email: "", team: null, message: "" }}
      onSubmit={() => undefined}
    >
      <FormField name="email" label="Teammate's email" required>
        <Input type="email" autoComplete="off" />
      </FormField>
      <FormField name="team" label="Their team">
        <Select options={teams} />
      </FormField>
      <FormField name="message" label="A note" labelPlacement="on" description="Shown in the invitation.">
        <Textarea />
      </FormField>
      <FormActions submitLabel="Send invite" />
    </Form>
  )
}

function FloatingLabelsSection() {
  return (
    <Section
      title="Floating labels"
      description='Field labelPlacement="in" floats the label inside the control, "on" sets it on the border. Always a real label.'
    >
      <div className="grid w-full gap-section md:grid-cols-3">
        <PlacementFields placement="in" />
        <PlacementFields placement="on" />
        <InviteForm />
      </div>
    </Section>
  )
}

export { FloatingLabelsSection }
