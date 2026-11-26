import { createLocalStorage } from "@ui-sdk/core"
import { usePreference } from "@ui-sdk/react/preferences"
import { useState } from "react"

import { createAppearance } from "@/components/ui/appearance"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack, SliderValue } from "@/components/ui/slider"

import { useGlassOpacity } from "./hooks/use-glass-opacity"
import { createThemeEditorStore } from "./theme-editor-store"

const themes = ["default", "compact", "glass", "liquid"] as const
type Theme = (typeof themes)[number]
const palettes = ["neutral", "blue", "violet", "green", "orange"] as const

const appearance = createAppearance({
  colorScheme: "light",
  palette: "neutral",
  palettes,
  storage: { theme: createLocalStorage("eskais-showcase-theme") },
})
const { theme } = appearance
const themeEditor = createThemeEditorStore()

function ThemePicker() {
  const { value } = usePreference(theme)
  return (
    <Field>
      <FieldLabel>Theme</FieldLabel>
      <SegmentedControl<Theme> value={value} onValueChange={(next) => next && theme.set(next)}>
        <SegmentedControlIndicator />
        {themes.map((name) => (
          <SegmentedControlItem key={name} value={name}>
            {name.charAt(0).toUpperCase() + name.slice(1)}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </Field>
  )
}

function GlassOpacity() {
  const { value } = usePreference(theme)
  const [opacity, setOpacity] = useState(60)

  useGlassOpacity(value === "glass", opacity)

  if (value !== "glass") return null
  return (
    <Field className="w-48">
      <Slider
        value={opacity}
        onValueChange={(next) => setOpacity(next)}
        min={20}
        max={100}
        step={5}
        format={(percent) => `${percent}%`}
      >
        <div className="flex justify-between text-sm">
          <FieldLabel>Glass opacity</FieldLabel>
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
  )
}

function DarkToggle() {
  const dark = usePreference(appearance.colorScheme).resolved === "dark"
  return (
    <Button variant="outline" aria-pressed={dark} onClick={() => appearance.colorScheme.set(dark ? "light" : "dark")}>
      Dark mode
    </Button>
  )
}

function AppearanceControls() {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <ThemePicker />
      <GlassOpacity />
      <DarkToggle />
    </div>
  )
}

export { AppearanceControls, appearance, palettes, themeEditor }
