import { Field, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"

export default function SwitchDemo() {
  return (
    <div className="flex flex-col gap-items">
      <Field>
        <Switch defaultChecked />
        <FieldLabel>Email me when a deploy fails</FieldLabel>
      </Field>
      <Field>
        <Switch />
        <FieldLabel>Weekly usage digest</FieldLabel>
      </Field>
    </div>
  )
}
