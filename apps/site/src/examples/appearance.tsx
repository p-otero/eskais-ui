import { createLocalStorage } from "@ui-sdk/core"
import { usePreference } from "@ui-sdk/react/preferences"

import { Appearance, createAppearance } from "@/components/ui/appearance"
import { Field, FieldLabel } from "@/components/ui/field"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"

const appearance = createAppearance({
  colorScheme: "system",
  storage: { colorScheme: createLocalStorage("demo-color-scheme") },
})

function ColorSchemePicker() {
  const { value } = usePreference(appearance.colorScheme)
  return (
    <Field>
      <FieldLabel>Color scheme</FieldLabel>
      <SegmentedControl value={value} onValueChange={(next) => next && appearance.colorScheme.set(next)}>
        <SegmentedControlIndicator />
        <SegmentedControlItem value="system">System</SegmentedControlItem>
        <SegmentedControlItem value="light">Light</SegmentedControlItem>
        <SegmentedControlItem value="dark">Dark</SegmentedControlItem>
      </SegmentedControl>
    </Field>
  )
}

export default function AppearanceDemo() {
  return (
    <Appearance appearance={appearance}>
      <ColorSchemePicker />
    </Appearance>
  )
}
