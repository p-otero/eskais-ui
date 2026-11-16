import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  NumberInput,
  NumberInputControl,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
} from "@/components/ui/number-input"

export default function NumberInputDemo() {
  return (
    <Field>
      <FieldLabel>Seats</FieldLabel>
      <NumberInput defaultValue={3} min={1} max={50}>
        <NumberInputGroup className="max-w-40">
          <NumberInputDecrement aria-label="Remove a seat" />
          <NumberInputControl />
          <NumberInputIncrement aria-label="Add a seat" />
        </NumberInputGroup>
      </NumberInput>
      <FieldDescription>Between 1 and 50.</FieldDescription>
    </Field>
  )
}
