import { usePreference } from "@ui-sdk/react/preferences"
import { RotateCcwIcon } from "lucide-react"
import { useSyncExternalStore } from "react"

import type { AppearanceState } from "@/components/ui/appearance"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CodeBlock } from "@/components/ui/code-block"
import {
  ColorPicker,
  ColorPickerArea,
  ColorPickerAreaCanvas,
  ColorPickerAreaThumb,
  ColorPickerInput,
  ColorPickerSlider,
  ColorPickerSliderThumb,
  ColorPickerSwatch,
} from "@/components/ui/color-picker"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack, SliderValue } from "@/components/ui/slider"
import { StatusPill } from "@/components/ui/status-pill"

import { measure, useThemeMeasurements } from "./hooks/use-theme-measurements"
import type { Overrides, ThemeEditorStore } from "./theme-editor-store"
import { ShapeControls } from "./theme-editor-shape"
import { themeSnippet } from "./theme-snippet"

const CUSTOM = "custom"

// A fixed rainbow rather than the picker's own track, which draws the hue at the current chroma: a grey brand would
// get a flat grey bar that disappears in dark mode.
const hueTrack = {
  background: `linear-gradient(to right, ${[0, 60, 120, 180, 240, 300, 360].map((hue) => `oklch(0.65 0.18 ${hue})`).join(", ")})`,
}

function ContrastRow({ label, ratio }: { label: string; ratio: number | null }) {
  const pass = ratio !== null && ratio >= 4.5
  return (
    <li
      data-slot="theme-editor-contrast-row"
      className="flex flex-wrap items-center justify-between gap-x-items gap-y-inline py-inset-item text-body-sm"
    >
      <span className="min-w-0">{label}</span>
      <span className="ms-auto flex shrink-0 items-center gap-inline">
        <span>{ratio === null ? "—" : `${ratio.toFixed(2)}:1`}</span>
        <StatusPill tone={pass ? "success" : "destructive"}>{pass ? "Pass" : "Fail"}</StatusPill>
      </span>
    </li>
  )
}

function SeedSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  format: (value: number) => string
}) {
  return (
    <Field>
      <Slider value={value} onValueChange={onChange} min={min} max={max} step={step} format={format}>
        <div className="flex items-center justify-between gap-items text-body-sm">
          <FieldLabel>{label}</FieldLabel>
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

function SeedColor({
  label,
  name,
  value,
  onChange,
  description,
}: {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  description: string
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <ColorPicker space="oklch" value={value} onValueChange={onChange}>
        <ColorPickerArea>
          <ColorPickerAreaCanvas />
          <ColorPickerAreaThumb aria-label={`${name} chroma and lightness`} />
        </ColorPickerArea>
        <ColorPickerSlider channel="hue" style={hueTrack}>
          <ColorPickerSliderThumb aria-label={`${name} hue`} />
        </ColorPickerSlider>
        <div className="flex items-center gap-items">
          <ColorPickerSwatch />
          <ColorPickerInput aria-label={`${label} in OKLCH`} />
        </div>
      </ColorPicker>
      <FieldDescription>{description}</FieldDescription>
    </Field>
  )
}

/**
 * Edits the theme's seeds on `<html>` and shows the CSS to keep them. The choices live in `store`, so they stay
 * while the reader moves around the site. Two columns only when its container has room
 * for both, so it fits a card in a docs column as well as a full-width showcase section.
 */
function ThemeEditor<Theme extends string, Palette extends string>({
  appearance,
  palettes,
  store,
}: {
  appearance: AppearanceState<Theme, Palette>
  palettes: readonly Palette[]
  store: ThemeEditorStore
}) {
  const { value: palette } = usePreference(appearance.palette)
  const { value: density } = usePreference(appearance.density)
  const { value: radius } = usePreference(appearance.radius)
  const overrides = useSyncExternalStore(store.subscribe, store.get, store.get)
  const [{ seeds, primary, text, link }, setMeasured] = useThemeMeasurements(appearance, store)

  const customised = Object.keys(overrides).length > 0
  const snippet = themeSnippet(seeds, { density, radius })
  const override = (next: Overrides) => {
    const merged = Object.values(next).every((value) => value === undefined) ? {} : { ...overrides, ...next }
    store.set(merged)
    setMeasured(measure())
  }
  const reset = () => {
    store.reset()
    appearance.palette.set(appearance.palette.defaultValue)
    appearance.density.set(appearance.density.defaultValue)
    appearance.radius.set(appearance.radius.defaultValue)
    setMeasured(measure())
  }

  return (
    <div data-slot="theme-editor" className="@container w-full min-w-0">
      <div className="grid min-w-0 grid-cols-1 gap-section @2xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-group">
          <Field>
            <div className="flex items-center justify-between gap-items">
              <FieldLabel>Preset</FieldLabel>
              {customised && <Badge variant="outline">Custom</Badge>}
            </div>
            <div className="-m-1 overflow-x-auto p-1">
              <SegmentedControl<Palette | typeof CUSTOM>
                value={customised ? CUSTOM : palette}
                onValueChange={(next) => {
                  if (!next || next === CUSTOM) return
                  override({})
                  appearance.palette.set(next)
                }}
              >
                <SegmentedControlIndicator />
                {palettes.map((name) => (
                  <SegmentedControlItem key={name} value={name}>
                    {name.charAt(0).toUpperCase() + name.slice(1)}
                  </SegmentedControlItem>
                ))}
              </SegmentedControl>
            </div>
          </Field>
          <SeedColor
            label="Brand colour"
            name="Brand"
            value={seeds.brand}
            onChange={(brand) => override({ brand })}
            description="A grey brand has no chroma, so its hue shows only once you drag right in the area."
          />
          <SeedColor
            label="Link colour"
            name="Link"
            value={seeds.linkBrand}
            onChange={(linkBrand) => override({ linkBrand })}
            description="Links and the editor caret derive from it, capped in lightness to keep 4.5:1."
          />
          <SeedSlider
            label="Neutral tint"
            value={seeds.neutralChroma}
            onChange={(tint) => override({ tint })}
            min={0}
            max={0.03}
            step={0.002}
            format={(value) => value.toFixed(3)}
          />
          <ShapeControls appearance={appearance} />
        </div>
        <div className="flex min-w-0 flex-col gap-group">
          <section
            aria-labelledby="theme-editor-contrast"
            data-slot="theme-editor-contrast"
            className="flex min-w-0 flex-col rounded-surface border bg-card px-inset-item py-inset-item"
          >
            <h3 id="theme-editor-contrast" className="text-title-sm">
              Contrast <span className="font-normal text-muted-foreground">(needs 4.5:1)</span>
            </h3>
            <ul className="flex flex-col divide-y">
              <ContrastRow label="Primary foreground on primary" ratio={primary} />
              <ContrastRow label="Text on background" ratio={text} />
              <ContrastRow label="Links on muted" ratio={link} />
            </ul>
          </section>
          <CodeBlock code={snippet} language="css" title="Theme CSS" wrap className="min-w-0" />
          <div className="flex flex-wrap items-center gap-items">
            <Button variant="outline" onClick={reset}>
              <RotateCcwIcon />
              Reset
            </Button>
            <p className="min-w-0 flex-1 text-body-sm text-muted-foreground">
              Paste the CSS after the theme in your stylesheet.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export { ThemeEditor }
