import { ColorPicker } from "@/components/ui/color-picker"
import { Field, FieldLabel } from "@/components/ui/field"

export default function ColorPickerDemo() {
  return (
    <Field className="w-full max-w-xs">
      <FieldLabel>Brand colour</FieldLabel>
      <ColorPicker space="oklch" defaultValue="oklch(0.62 0.19 259)" />
    </Field>
  )
}
