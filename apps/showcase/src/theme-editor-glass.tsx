import { usePreference } from "@ui-sdk/react/preferences"

import type { AppearanceState } from "@/components/ui/appearance"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack, SliderValue } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"

import { themeGlassItemStrength, type Overrides } from "./theme-editor-store"

/** Shown only when the appearance has a `"glass"` theme; turning it off returns to `"default"`. */
function GlassControls<Theme extends string>({
  appearance,
  strength,
  onStrengthChange,
}: {
  appearance: Pick<AppearanceState<Theme>, "theme">
  strength: number | undefined
  onStrengthChange: (next: Overrides["glass"]) => void
}) {
  const theme = usePreference(appearance.theme).value
  const { values } = appearance.theme
  const glass = values.find((value) => value === "glass")
  const plain = values.find((value) => value === "default")
  if (!glass || !plain) return null
  const on = theme === glass
  return (
    <>
      <Field>
        <div className="flex items-center justify-between gap-items">
          <FieldLabel>Glass</FieldLabel>
          <Switch checked={on} onCheckedChange={(next) => appearance.theme.set(next ? glass : plain)} />
        </div>
        <FieldDescription>
          Translucent, blurred chrome: popovers, menus, toasts, the sidebar and cards. Dialogs and drawers stay opaque.
        </FieldDescription>
      </Field>
      {on && (
        <Field>
          <Slider
            value={strength ?? themeGlassItemStrength}
            onValueChange={(next) => onStrengthChange(next)}
            min={0}
            max={100}
            step={5}
            format={(value) => `${String(value)}%`}
          >
            <div className="flex items-center justify-between gap-items text-body-sm">
              <FieldLabel>Glass strength</FieldLabel>
              <SliderValue />
            </div>
            <SliderControl>
              <SliderTrack>
                <SliderIndicator />
                <SliderThumb />
              </SliderTrack>
            </SliderControl>
          </Slider>
        </Field>
      )}
    </>
  )
}

export { GlassControls }
