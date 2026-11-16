import { Field, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { Radio, RadioGroup, RadioIndicator } from "@/components/ui/radio-group"

const plans = [
  { value: "hobby", label: "Hobby" },
  { value: "pro", label: "Pro" },
  { value: "team", label: "Team" },
]

export default function RadioGroupDemo() {
  return (
    <Field>
      <FieldLabel>Plan</FieldLabel>
      <RadioGroup defaultValue="pro">
        {plans.map((plan) => (
          <Label key={plan.value}>
            <Radio value={plan.value}>
              <RadioIndicator />
            </Radio>
            <span>{plan.label}</span>
          </Label>
        ))}
      </RadioGroup>
    </Field>
  )
}
