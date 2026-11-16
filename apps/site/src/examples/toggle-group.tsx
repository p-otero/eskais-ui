import { Field, FieldLabel } from "@/components/ui/field"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup } from "@/components/ui/toggle-group"

export default function ToggleGroupDemo() {
  return (
    <Field>
      <FieldLabel>Text formatting</FieldLabel>
      <ToggleGroup multiple defaultValue={["bold"]}>
        <Toggle value="bold">Bold</Toggle>
        <Toggle value="italic">Italic</Toggle>
        <Toggle value="code">Code</Toggle>
      </ToggleGroup>
    </Field>
  )
}
