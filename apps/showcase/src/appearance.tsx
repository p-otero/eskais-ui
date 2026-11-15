import { createLocalStorage, createPreference } from "@ui-sdk/core"
import { Field, FieldLabel } from "@ui-sdk/react/field"
import { usePreference } from "@ui-sdk/react/preferences"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack, SliderValue } from "@ui-sdk/react/slider"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

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
    <Field className="flex flex-col gap-1.5">
      <FieldLabel className="text-sm font-medium">Theme</FieldLabel>
      <SegmentedControl<Theme>
        value={value}
        onValueChange={(next) => next && theme.set(next)}
        className="relative isolate inline-flex rounded-control border bg-muted/(--glass-opacity) p-1"
      >
        <SegmentedControlIndicator className="absolute top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) -z-10 h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded-control bg-background shadow-sm transition-all duration-200" />
        {themes.map((name) => (
          <SegmentedControlItem
            key={name}
            value={name}
            className="h-control-sm cursor-pointer rounded-control px-control-x text-sm font-medium text-muted-foreground capitalize outline-none focus-visible:ring-2 focus-visible:ring-ring data-checked:text-foreground"
          >
            {name}
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
    <Field className="flex w-48 flex-col gap-1.5">
      <Slider
        value={opacity}
        onValueChange={(next) => setOpacity(next)}
        min={20}
        max={100}
        step={5}
        format={(percent) => `${percent}%`}
        className="flex flex-col gap-1.5"
      >
        <div className="flex justify-between text-sm">
          <FieldLabel className="font-medium">Glass opacity</FieldLabel>
          <SliderValue className="text-muted-foreground tabular-nums" />
        </div>
        <SliderControl className="flex h-control-sm cursor-pointer items-center">
          <SliderTrack className="relative h-1.5 w-full rounded-full bg-input/40">
            <SliderIndicator className="absolute h-full w-(--slider-indicator-size) rounded-full bg-primary" />
            <SliderThumb className="absolute top-1/2 left-(--slider-thumb-position) size-4 -translate-1/2 rounded-full border border-input bg-background shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-ring" />
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
