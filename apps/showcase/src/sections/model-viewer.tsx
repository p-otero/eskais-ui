import { useState } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { ModelScan } from "@/components/ui/model-scan"
import { ModelViewer } from "@/components/ui/model-viewer"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack, SliderValue } from "@/components/ui/slider"

import { Section } from "../section"
import {
  character,
  characterFace,
  characterStyles,
  downloadCharacter,
  photo,
  restyle,
  useScanReplay,
} from "./model-fixtures"

const expressions = [
  { names: ["mouthSmileLeft", "mouthSmileRight"], label: "Smile" },
  { names: ["eyeBlinkLeft", "eyeBlinkRight"], label: "Blink" },
  { names: ["jawOpen"], label: "Jaw open" },
  { names: ["browInnerUp"], label: "Brows up" },
] as const

function ModelViewerSection() {
  const [values, setValues] = useState<Record<string, number>>({ Smile: 0.3 })
  const [style, setStyle] = useState<keyof typeof character>("soft")
  const [framing, setFraming] = useState<"full" | "face">("full")
  const weights = Object.fromEntries(
    expressions.flatMap(({ names, label }) => names.map((name) => [name, values[label] ?? 0])),
  )
  return (
    <Section
      title="Model viewer"
      description="A glTF character in a stage that turns with drag, wheel, pinch and keys, with views, zoom, clips and morph weights. The three.js scene loads only when the stage nears the viewport, and draws only while something moves. The character is a synthetic person scanned by an open-source engine, in two styles."
    >
      <div className="grid w-full gap-group md:grid-cols-2">
        <ModelViewer
          model={character[style]}
          alt="A 3D character with a red bob, in a blue T-shirt and dark trousers"
          aspectRatio={3 / 4}
          framing={framing === "face" ? characterFace : "full"}
          expressions={weights}
          onModelLoad={restyle}
          summary="A standing character with dark skin and a red fringed bob, in a blue T-shirt, dark trousers and white socks. Clips: idle, wave."
        />
        <div className="flex flex-col gap-group">
          <SegmentedControl
            aria-label="Style"
            value={style}
            onValueChange={(next) => next && setStyle(next as keyof typeof character)}
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
    </Section>
  )
}

function ModelScanSection() {
  const { props, start, cancel, running } = useScanReplay()
  const [style, setStyle] = useState<keyof typeof character>("soft")
  return (
    <Section
      title="Model scan"
      description="A photo becomes a 3D character, from an engine's events: points and their mesh over the photo while the background dims around the person, then the person's pixels fly as a cloud onto the model while the camera turns, and weights stream in. This one replays a recorded scan of a synthetic person, 15 times slower than the engine ran it."
    >
      <div className="flex w-full max-w-sm flex-col gap-group">
        <ModelScan
          src={photo.src}
          alt="A full-length photo of a person with a red bob, in a grey top and shorts"
          width={photo.width}
          height={photo.height}
          {...props}
          model={props.stage === "ready" ? { glb: character[style] } : props.model}
          modelAlt="A 3D character made from the photo"
          idleClip="wave"
          viewer={{ onModelLoad: restyle }}
          labels={{ play: "Wave" }}
          styles={characterStyles}
          selectedStyle={style}
          onStyleChange={(next) => setStyle(next as keyof typeof character)}
          onStart={start}
          onCancel={running ? cancel : undefined}
          onStartOver={cancel}
          onDownload={() => downloadCharacter(style)}
        />
      </div>
    </Section>
  )
}

export { ModelScanSection, ModelViewerSection }
