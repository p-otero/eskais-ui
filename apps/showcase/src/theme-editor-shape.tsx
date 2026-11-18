import { usePreference } from "@ui-sdk/react/preferences"

import type { AppearanceState, Density, Radius } from "@/components/ui/appearance"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"

const densityOptions: { value: Density; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "compact", label: "Compact" },
]

// Without data-radius the shape derives from --radius, which is the lg step.
const radiusOptions: { value: Exclude<Radius, "default">; label: string }[] = [
  { value: "none", label: "None" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "full", label: "Full" },
]

/** Density and corner radius, two attributes on `<html>` that the appearance keeps between visits. */
function ShapeControls({ appearance }: { appearance: Pick<AppearanceState, "density" | "radius"> }) {
  const density = usePreference(appearance.density).value
  const radius = usePreference(appearance.radius).value
  return (
    <>
      <Field>
        <FieldLabel>Density</FieldLabel>
        <SegmentedControl<Density> value={density} onValueChange={(next) => next && appearance.density.set(next)}>
          <SegmentedControlIndicator />
          {densityOptions.map((option) => (
            <SegmentedControlItem key={option.value} value={option.value}>
              {option.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <FieldDescription>Compact tightens controls, spacing and type; the radius stays yours.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>Corner radius</FieldLabel>
        <div className="-m-1 overflow-x-auto p-1">
          <SegmentedControl<Radius>
            value={radius === "default" ? "lg" : radius}
            onValueChange={(next) => next && appearance.radius.set(next)}
          >
            <SegmentedControlIndicator />
            {radiusOptions.map((option) => (
              <SegmentedControlItem key={option.value} value={option.value}>
                {option.label}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </div>
      </Field>
    </>
  )
}

export { ShapeControls }
