import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { FileUpload } from "@/components/ui/file-input"
import { cropImage, ImageCropper, type ImageCrop } from "@/components/ui/image-cropper"
import { ImageScan, type ImageScanRegion, type ImageScanStatus } from "@/components/ui/image-scan"

// A generated still life, 800 × 600: a plant, a mug and two books on a table.
const sample = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#e7e2d8"/><rect y="430" width="800" height="170" fill="#b58a62"/><ellipse cx="210" cy="230" rx="90" ry="70" fill="#4f8a4b"/><ellipse cx="170" cy="280" rx="60" ry="45" fill="#3f7a3c"/><ellipse cx="260" cy="285" rx="55" ry="40" fill="#5f9c58"/><path d="M150 330h120l-15 100h-90z" fill="#c4683f"/><rect x="360" y="335" width="90" height="95" rx="10" fill="#3d6ea6"/><path d="M450 355a28 28 0 0 1 0 56" fill="none" stroke="#3d6ea6" stroke-width="12"/><rect x="520" y="390" width="180" height="40" rx="4" fill="#7b4c8c"/><rect x="535" y="352" width="150" height="38" rx="4" fill="#d6a443"/></svg>`,
)}`

const sampleRegions: ImageScanRegion[] = [
  {
    id: "plant",
    label: "Plant",
    description: "94%",
    tone: "success",
    box: { x: 0.14, y: 0.26, width: 0.25, height: 0.46 },
  },
  { id: "mug", label: "Mug", description: "88%", tone: "info", box: { x: 0.44, y: 0.55, width: 0.16, height: 0.17 } },
  {
    id: "books",
    label: "Books",
    description: "81%",
    tone: "violet",
    box: { x: 0.65, y: 0.58, width: 0.23, height: 0.14 },
  },
]

const steps = [
  { id: "read", label: "Read pixels" },
  { id: "detect", label: "Find objects" },
  { id: "label", label: "Label them" },
]

type Picked = { src: string; width: number; height: number; regions: ImageScanRegion[] }

// The sample's regions in the crop's fractions; a region the crop cuts away is left out. An upload gets no regions:
// this page has no model, so it only shows the states.
function regionsInCrop(crop: Required<ImageCrop>): ImageScanRegion[] {
  if (crop.rotation !== 0 || crop.flipX || crop.flipY) return []
  return sampleRegions.flatMap((region) => {
    const left = Math.max(region.box.x * 800, crop.x)
    const top = Math.max(region.box.y * 600, crop.y)
    const right = Math.min((region.box.x + region.box.width) * 800, crop.x + crop.width)
    const bottom = Math.min((region.box.y + region.box.height) * 600, crop.y + crop.height)
    if (right - left < 8 || bottom - top < 8) return []
    const box = {
      x: (left - crop.x) / crop.width,
      y: (top - crop.y) / crop.height,
      width: (right - left) / crop.width,
      height: (bottom - top) / crop.height,
    }
    return [{ ...region, box }]
  })
}

export default function ImageScanDemo() {
  const [source, setSource] = useState<{ src: string; sample: boolean }>({ src: sample, sample: true })
  const [crop, setCrop] = useState<Required<ImageCrop>>()
  const [picked, setPicked] = useState<Picked>()
  const [status, setStatus] = useState<ImageScanStatus>("uploaded")
  const [progress, setProgress] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const choose = (files: File[]) => {
    const file = files[0]
    if (!file) return
    setSource({ src: URL.createObjectURL(file), sample: false })
    setPicked(undefined)
  }

  const scanCrop = async () => {
    if (!crop) return
    const file = await cropImage(source.src, crop, { width: Math.min(crop.width, 960) })
    setPicked({
      src: URL.createObjectURL(file),
      width: crop.width,
      height: crop.height,
      regions: source.sample ? regionsInCrop(crop) : [],
    })
    setStatus("uploaded")
  }

  // Stands in for a local model: progress in steps, then the result.
  const scan = () => {
    setStatus("scanning")
    setProgress(0)
    const advance = (done: number) => {
      timer.current = setTimeout(() => {
        if (done >= 1) {
          setStatus("result")
          return
        }
        setProgress(done)
        advance(Math.round((done + 0.1) * 10) / 10)
      }, 350)
    }
    advance(0.1)
  }

  const cancel = () => {
    clearTimeout(timer.current)
    setStatus("uploaded")
  }

  if (picked) {
    const step = steps[Math.min(steps.length - 1, Math.floor(progress * steps.length))]?.id
    return (
      <div className="flex w-full max-w-md flex-col gap-group">
        <ImageScan
          src={picked.src}
          alt="The cropped photo"
          width={picked.width}
          height={picked.height}
          status={status}
          progress={status === "scanning" ? progress : undefined}
          statusText={steps.find((item) => item.id === step)?.label}
          steps={steps}
          step={step}
          regions={status === "result" ? picked.regions : undefined}
          onScan={scan}
          onCancel={cancel}
          onRetry={scan}
          actions={
            status === "scanning" ? null : (
              <Button variant="ghost" size="sm" onClick={() => setPicked(undefined)}>
                Crop again
              </Button>
            )
          }
        />
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-group">
      <Field>
        <FieldLabel>Photo to analyse</FieldLabel>
        <FileUpload
          accept={["image/*"]}
          maxSize={10_000_000}
          title="Drop a photo here"
          description="Or crop the sample below"
          browseLabel="Choose a photo"
          onValueChange={choose}
        />
      </Field>
      <ImageCropper
        key={source.src}
        aria-label="Crop the photo"
        src={source.src}
        alt={source.sample ? "A plant, a mug and two books on a table" : "The chosen photo"}
        onCropChange={setCrop}
      />
      <Button className="self-end" disabled={!crop} onClick={scanCrop}>
        Scan this crop
      </Button>
    </div>
  )
}
