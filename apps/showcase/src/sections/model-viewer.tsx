import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { ModelScan } from "@/components/ui/model-scan"
import { ModelViewer } from "@/components/ui/model-viewer"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack, SliderValue } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"

import { Section } from "../section"
import { figureFace, figureUrl, portrait, useFakeModelScan } from "./model-fixtures"

const morphs = ["Build", "HeadSize", "Smile"] as const

function ModelViewerSection() {
  const [weights, setWeights] = useState<Record<string, number>>({ Build: 0, HeadSize: 0, Smile: 0.4 })
  const [framing, setFraming] = useState<"full" | "face">("full")
  const [toon, setToon] = useState(false)
  return (
    <Section
      title="Model viewer"
      description="A glTF character in a stage that turns with drag, wheel, pinch and keys, with views, zoom, clips and morph weights. The three.js scene loads only when the stage nears the viewport, and draws only while something moves."
    >
      <div className="grid w-full gap-group md:grid-cols-2">
        <ModelViewer
          model={figureUrl}
          alt="A stylised figure in a teal shirt"
          poster={portrait.src}
          aspectRatio={3 / 4}
          framing={framing === "face" ? figureFace : "full"}
          material={toon ? "toon" : "standard"}
          weights={weights}
          summary="A standing figure with short brown hair, a teal shirt and dark trousers. Clips: Idle, Wave."
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
          {morphs.map((name) => (
            <Field key={name}>
              <Slider
                value={Math.round((weights[name] ?? 0) * 100)}
                onValueChange={(next) => setWeights((current) => ({ ...current, [name]: next / 100 }))}
                min={0}
                max={100}
                step={5}
                format={(percent) => `${String(percent)}%`}
              >
                <div className="flex justify-between text-sm">
                  <FieldLabel>{name}</FieldLabel>
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
    </Section>
  )
}

function ModelScanSection() {
  const { state, start, cancel, fail, setFail } = useFakeModelScan(figureUrl)
  return (
    <Section
      title="Model scan"
      description="A photo becomes a 3D character, from an engine's events: points over the photo, the photo burning into particles while the camera turns and the model appears, then weights streaming in. This one is a fake engine with a generated figure."
    >
      <div className="flex w-full max-w-sm flex-col gap-group">
        <ModelScan
          src={portrait.src}
          alt="A front photo of a stylised figure"
          width={portrait.width}
          height={portrait.height}
          {...state}
          modelAlt="A 3D stylised figure in a teal shirt"
          idleClip="Wave"
          onCancel={state.stage === "photo" ? undefined : cancel}
          onRetry={start}
          actions={
            state.stage === "photo" ? (
              <Button size="sm" onClick={start}>
                Make 3D
              </Button>
            ) : state.stage === "ready" || state.stage === "error" ? (
              <Button variant="ghost" size="sm" onClick={cancel}>
                Start over
              </Button>
            ) : null
          }
        />
        <Label>
          <Switch checked={fail} onCheckedChange={setFail} />
          Fail the next run
        </Label>
      </div>
    </Section>
  )
}

export { ModelScanSection, ModelViewerSection }
