import { useState } from "react"
import type { Object3D } from "three"

import { Field, FieldLabel } from "@/components/ui/field"
import { ModelViewer } from "@/components/ui/model-viewer"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack, SliderValue } from "@/components/ui/slider"

// A synthetic person scanned by an open-source photo-to-3D engine (CC0 demo assets, no real person). Both GLBs are
// the same character; each tags its materials with a style in `extras.eskais`. The engine restyles a character (and
// swaps its hair) itself: the UI just shows the GLB it gets, and swapping one for another keeps the camera and pose.
import celUrl from "../../../../test/fixtures/model/character/character-cel-outline.glb?url"
import softUrl from "../../../../test/fixtures/model/character/character-soft-toon.glb?url"

const styles = { soft: softUrl, cel: celUrl }

// Builds the style's toon materials and outline before the first frame. Imported on demand, so three.js stays in the
// viewer's lazy chunk.
const restyle = async (scene: Object3D) =>
  (await import("../../../../test/fixtures/model/character/style")).styleCharacter(scene)

// The GLB carries the character's own body and face weights; these drive ARKit expressions over them, from 0 to 1.
const expressions = [
  { names: ["mouthSmileLeft", "mouthSmileRight"], label: "Smile" },
  { names: ["eyeBlinkLeft", "eyeBlinkRight"], label: "Blink" },
  { names: ["jawOpen"], label: "Jaw open" },
  { names: ["browInnerUp"], label: "Brows up" },
] as const

// Where the head is, in the model's own units, for a close-up.
const face = { center: [0, 0.84, 0.04] as [number, number, number], radius: 0.16 }

export default function ModelViewerDemo() {
  const [values, setValues] = useState<Record<string, number>>({ Smile: 0.3 })
  const [style, setStyle] = useState<keyof typeof styles>("soft")
  const [framing, setFraming] = useState<"full" | "face">("full")
  const weights = Object.fromEntries(
    expressions.flatMap(({ names, label }) => names.map((name) => [name, values[label] ?? 0])),
  )
  return (
    <div className="grid w-full gap-group sm:grid-cols-2">
      <ModelViewer
        model={styles[style]}
        alt="A 3D character with a red bob, in a blue T-shirt and dark trousers"
        aspectRatio={3 / 4}
        framing={framing === "face" ? face : "full"}
        expressions={weights}
        onModelLoad={restyle}
        summary="A standing character with dark skin and a red fringed bob, in a blue T-shirt, dark trousers and white socks. Clips: idle, wave."
      />
      <div className="flex flex-col gap-group">
        <SegmentedControl
          aria-label="Style"
          value={style}
          onValueChange={(next) => next && setStyle(next as keyof typeof styles)}
        >
          <SegmentedControlIndicator />
          <SegmentedControlItem value="soft">Soft toon</SegmentedControlItem>
          <SegmentedControlItem value="cel">Cel outline</SegmentedControlItem>
        </SegmentedControl>
        <SegmentedControl
          aria-label="Framing"
          value={framing}
          onValueChange={(next) => next && setFraming(next as "full" | "face")}
        >
          <SegmentedControlIndicator />
          <SegmentedControlItem value="full">Full body</SegmentedControlItem>
          <SegmentedControlItem value="face">Face</SegmentedControlItem>
        </SegmentedControl>
        {expressions.map(({ label }) => (
          <Field key={label}>
            <Slider
              value={Math.round((values[label] ?? 0) * 100)}
              onValueChange={(next) => setValues((current) => ({ ...current, [label]: next / 100 }))}
              min={0}
              max={100}
              step={5}
              format={(percent) => `${String(percent)}%`}
            >
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
        ))}
      </div>
    </div>
  )
}
