import { createLocalStorage, createPreference } from "@ui-sdk/core"
import { usePreference } from "@ui-sdk/react/preferences"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack, SliderValue } from "@/components/ui/slider"

const themes = ["default", "compact", "glass"] as const
type Theme = (typeof themes)[number]

const theme = createPreference({
  values: themes,
  defaultValue: "default",
  attribute: "data-theme",
  global: true,
  storage: createLocalStorage("eskais-showcase-theme"),
})

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

  useEffect(() => {
    const root = document.documentElement
    if (value !== "glass") return
    root.style.setProperty("--glass-opacity", `${opacity}%`)
    // A fully opaque surface hides what's behind it, so skip the blur, the expensive part.
    if (opacity === 100) root.style.setProperty("--glass-blur", "0px")
    else root.style.removeProperty("--glass-blur")
    return () => {
      root.style.removeProperty("--glass-opacity")
      root.style.removeProperty("--glass-blur")
    }
  }, [value, opacity])

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
  const [dark, setDark] = useState(false)
  return (
    <Button
      variant="outline"
      aria-pressed={dark}
      onClick={() => {
        document.documentElement.classList.toggle("dark", !dark)
        setDark(!dark)
      }}
    >
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

export { AppearanceControls, theme }
