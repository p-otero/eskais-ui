import { useState } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { ModelViewer } from "@/components/ui/model-viewer"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack, SliderValue } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"

// A stylised figure built in code (no real person), with morph targets and two clips, and a front image as poster.
import { figureFace } from "../../../../test/fixtures/model/fake-engine"
import figureUrl from "../../../../test/fixtures/model/figure.glb?url"
import portraitUrl from "../../../../test/fixtures/model/portrait.svg?url"

// Target names come from the GLB (its extras.targetNames); an ARKit expression goes through `expressions`.
const controls = [
  { name: "body.pc00", label: "Build" },
  { name: "face.head_size.incr", label: "Larger head" },
  { name: "face.head_size.decr", label: "Smaller head" },
  { name: "smile", label: "Smile" },
] as const

export default function ModelViewerDemo() {
  const [values, setValues] = useState<Record<string, number>>({ smile: 0.4 })
  const [framing, setFraming] = useState<"full" | "face">("full")
  const [toon, setToon] = useState(false)
  const smile = values.smile ?? 0
  return (
    <div className="grid w-full gap-group sm:grid-cols-2">
      <ModelViewer
        model={figureUrl}
        alt="A stylised figure in a teal shirt"
        poster={portraitUrl}
        aspectRatio={3 / 4}
        framing={framing === "face" ? figureFace : "full"}
        material={toon ? "toon" : "standard"}
        weights={values}
        expressions={{ mouthSmileLeft: smile, mouthSmileRight: smile }}
        summary="A standing figure with short brown hair, a teal shirt and dark trousers."
      />
      <div className="flex flex-col gap-group">
        <SegmentedControl
          aria-label="Framing"
          value={framing}
          onValueChange={(next) => next && setFraming(next as "full" | "face")}
        >
          <SegmentedControlIndicator />
          <SegmentedControlItem value="full">Full body</SegmentedControlItem>
          <SegmentedControlItem value="face">Face</SegmentedControlItem>
        </SegmentedControl>
        <Label>
          <Switch checked={toon} onCheckedChange={setToon} />
          Toon material
        </Label>
        {controls.map(({ name, label }) => (
          <Field key={name}>
            <Slider
              value={Math.round((values[name] ?? 0) * 100)}
              onValueChange={(next) => setValues((current) => ({ ...current, [name]: next / 100 }))}
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
