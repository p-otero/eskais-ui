import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { ImageScan, type ImageScanStatus } from "@/components/ui/image-scan"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

import { Section } from "../section"
import { scanSteps, stillLife, stillLifeRegions } from "./image-scan-fixtures"

const indeterminateSweepMs = 1200

function ImageScanSection() {
  const [status, setStatus] = useState<ImageScanStatus>("uploaded")
  const [progress, setProgress] = useState<number>()
  const [fail, setFail] = useState(false)
  const [log, setLog] = useState("Press Scan image.")
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const scan = () => {
    setStatus("scanning")
    setProgress(undefined)
    const advance = (done: number) => {
      timer.current = setTimeout(() => {
        if (done >= 1) {
          setStatus(fail ? "error" : "result")
          setLog(fail ? "The scan failed." : `Found ${String(stillLifeRegions.length)} items.`)
          return
        }
        setProgress(done)
        advance(Math.round((done + 0.1) * 10) / 10)
      }, 400)
    }
    timer.current = setTimeout(() => advance(0.1), indeterminateSweepMs)
  }

  const step = scanSteps[Math.min(scanSteps.length - 1, Math.floor((progress ?? 0) * scanSteps.length))]
  return (
    <Section
      title="Image scan"
      description="A photo under local analysis: a sweep while progress is unknown, a line once it is, then the regions found as buttons over the image. Cancel, Retry and the regions are agent actions."
    >
      <div className="flex w-full max-w-lg flex-col gap-group">
        <ImageScan
          src={stillLife}
          alt="A plant, a mug and two books on a table"
          width={800}
          height={600}
          status={status}
          progress={progress}
          statusText={progress === undefined ? undefined : step?.label}
          steps={scanSteps}
          step={progress === undefined ? undefined : step?.id}
          regions={stillLifeRegions}
          onScan={scan}
          onCancel={(details) => {
            clearTimeout(timer.current)
            setStatus("uploaded")
            setLog(`Canceled by ${details.source}.`)
          }}
          onRetry={scan}
          onSelectedRegionChange={(region, details) => setLog(`Selected ${region ?? "nothing"} by ${details.source}.`)}
          error="The model could not read this image."
          actions={
            status === "result" || status === "error" ? (
              <Button variant="ghost" size="sm" onClick={() => setStatus("uploaded")}>
                Start over
              </Button>
            ) : null
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-items">
          <Label>
            <Switch checked={fail} onCheckedChange={setFail} />
            Fail the next scan
          </Label>
          <p className="text-body-sm text-muted-foreground">{log}</p>
        </div>
      </div>
    </Section>
  )
}

export { ImageScanSection }
