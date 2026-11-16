import { Checkbox, CheckboxIndicator } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"

export default function CheckboxDemo() {
  return (
    <div className="flex flex-col gap-items">
      <Field>
        <Checkbox defaultChecked>
          <CheckboxIndicator />
        </Checkbox>
        <div className="flex flex-col gap-inline">
          <FieldLabel>Include archived tasks</FieldLabel>
          <FieldDescription>Closed more than 30 days ago.</FieldDescription>
        </div>
      </Field>
      <Field>
        <Checkbox>
          <CheckboxIndicator />
        </Checkbox>
        <FieldLabel>Only my tasks</FieldLabel>
      </Field>
    </div>
  )
}
