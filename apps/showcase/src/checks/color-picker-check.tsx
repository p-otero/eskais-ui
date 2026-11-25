import { useState } from "react"

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

function CheckedPicker({ name, controlled }: { name: string; controlled: boolean }) {
  const [value, setValue] = useState("oklch(0.62 0.19 259)")
  const [committed, setCommitted] = useState("")
  return (
    <section className="flex w-80 flex-col gap-items">
      <ColorPicker
        aria-label={name}
        space="oklch"
        {...(controlled ? { value, onValueChange: setValue } : { defaultValue: value })}
        onValueCommit={setCommitted}
      >
        <ColorPickerArea>
          <ColorPickerAreaCanvas />
          <ColorPickerAreaThumb aria-label={`${name} chroma and lightness`} />
        </ColorPickerArea>
        <ColorPickerSlider channel="hue">
          <ColorPickerSliderThumb aria-label={`${name} hue`} />
        </ColorPickerSlider>
        <ColorPickerSlider channel="alpha">
          <ColorPickerSliderThumb aria-label={`${name} alpha`} />
        </ColorPickerSlider>
        <div className="flex items-center gap-items">
          <ColorPickerSwatch />
          <ColorPickerInput aria-label={`${name} value`} />
        </div>
      </ColorPicker>
      <output aria-label={`${name} committed`}>{committed}</output>
    </section>
  )
}

function ColorPickerCheck() {
  return (
    <main className="flex flex-wrap gap-section p-inset-surface">
      <CheckedPicker name="Default" controlled={false} />
      <CheckedPicker name="Controlled" controlled />
    </main>
  )
}

export { ColorPickerCheck }
