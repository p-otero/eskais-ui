import {
  ColorPicker,
  ColorPickerArea,
  ColorPickerAreaCanvas,
  ColorPickerAreaThumb,
  ColorPickerInput,
  ColorPickerSlider,
  ColorPickerSliderThumb,
  ColorPickerSwatch,
} from "@ui-sdk/react/color-picker"
import { usePreference } from "@ui-sdk/react/preferences"
import { useId, useState } from "react"

import type { AppearanceState } from "@/components/ui/appearance"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack, SliderValue } from "@/components/ui/slider"
import { StatusPill } from "@/components/ui/status-pill"

import { applyOverrides, measure, useThemeMeasurements, type Overrides } from "./hooks/use-theme-measurements"
import { themeSnippet } from "./theme-snippet"

const CUSTOM = "custom"

const thumb =
  "size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-(--color-picker-color) shadow-sm ring-1 ring-foreground/50 outline-none focus-visible:ring-3 focus-visible:ring-ring"

function ContrastRow({ label, ratio }: { label: string; ratio: number | null }) {
  const pass = ratio !== null && ratio >= 4.5
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <span className="tabular-nums">{ratio === null ? "—" : `${ratio.toFixed(2)}:1`}</span>
        <StatusPill tone={pass ? "success" : "destructive"}>{pass ? "Pass" : "Fail"}</StatusPill>
      </span>
    </div>
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
        <div className="flex justify-between text-sm">
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

function ThemeEditor<Theme extends string, Palette extends string>({
  appearance,
  palettes,
}: {
  appearance: AppearanceState<Theme, Palette>
  palettes: readonly Palette[]
}) {
  const { value: palette } = usePreference(appearance.palette)
  const [overrides, setOverrides] = useState<Overrides>({})
  const [{ seeds, primary, text, link }, setMeasured] = useThemeMeasurements(appearance)
  const [copied, setCopied] = useState("")
  const snippetId = useId()

  const customised = Object.keys(overrides).length > 0
  const snippet = themeSnippet(seeds)
  const override = (next: Overrides) => {
    const merged = Object.values(next).every((value) => value === undefined) ? {} : { ...overrides, ...next }
    applyOverrides(merged)
    setOverrides(merged)
    setMeasured(measure())
  }

  return (
    <div className="grid w-full gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel>Preset</FieldLabel>
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
            {customised && <SegmentedControlItem value={CUSTOM}>Custom</SegmentedControlItem>}
          </SegmentedControl>
        </Field>
        <Field>
          <FieldLabel>Brand colour</FieldLabel>
          <ColorPicker
            space="oklch"
            value={seeds.brand}
            onValueChange={(brand) => override({ brand })}
            className="flex flex-col gap-3"
          >
            <ColorPickerArea className="relative h-36 w-full overflow-hidden rounded-choice border">
              <ColorPickerAreaCanvas className="absolute inset-0 size-full" />
              <ColorPickerAreaThumb aria-label="Brand chroma and lightness" className={thumb} />
            </ColorPickerArea>
            <ColorPickerSlider
              channel="hue"
              className="relative h-3 w-full rounded-full bg-(image:--color-slider-background)"
            >
              <ColorPickerSliderThumb aria-label="Brand hue" className={`${thumb} top-1/2`} />
            </ColorPickerSlider>
            <div className="flex items-center gap-2">
              <ColorPickerSwatch className="size-control shrink-0 rounded-choice border bg-(--color-picker-color)" />
              <ColorPickerInput
                aria-label="Brand colour in OKLCH"
                className="h-control w-full min-w-0 rounded-control border border-input bg-background px-control-x text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </ColorPicker>
        </Field>
        <Field>
          <FieldLabel>Link colour</FieldLabel>
          <ColorPicker
            space="oklch"
            value={seeds.linkBrand}
            onValueChange={(linkBrand) => override({ linkBrand })}
            className="flex items-center gap-2"
          >
            <ColorPickerSwatch className="size-control shrink-0 rounded-choice border bg-(--color-picker-color)" />
            <ColorPickerInput
              aria-label="Link colour in OKLCH"
              className="h-control w-full min-w-0 rounded-control border border-input bg-background px-control-x text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </ColorPicker>
          <p className="text-sm text-muted-foreground">
            Links and the editor caret derive from it, capped in lightness to keep 4.5:1.
          </p>
        </Field>
        <SeedSlider
          label="Neutral tint"
          value={seeds.neutralChroma}
          onChange={(tint) => override({ tint })}
          min={0}
          max={0.03}
          step={0.002}
          format={(value) => value.toFixed(3)}
        />
        <SeedSlider
          label="Radius"
          value={seeds.radius}
          onChange={(radius) => override({ radius })}
          min={0}
          max={1.5}
          step={0.125}
          format={(value) => `${value}rem`}
        />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-surface border p-4">
          <h3 className="text-sm font-medium">Contrast (needs 4.5:1)</h3>
          <ContrastRow label="Primary foreground on primary" ratio={primary} />
          <ContrastRow label="Text on background" ratio={text} />
          <ContrastRow label="Links on muted" ratio={link} />
        </div>
        <pre
          id={snippetId}
          aria-label="Theme CSS"
          className="rounded-surface bg-muted p-4 text-xs break-words whitespace-pre-wrap text-muted-foreground"
        >
          {snippet}
        </pre>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            aria-describedby={snippetId}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(snippet)
                setCopied("Copied. Paste it after the theme in your stylesheet.")
              } catch {
                setCopied("The browser blocked the clipboard. Select the CSS above and copy it.")
              }
            }}
          >
            Copy CSS
          </Button>
          <Button variant="outline" onClick={() => override({})}>
            Reset to preset
          </Button>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {copied}
          </p>
        </div>
      </div>
    </div>
  )
}

export { ThemeEditor }
