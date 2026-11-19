import { ImageScan } from "@/components/ui/image-scan"

import { scanSteps, stillLife, stillLifeRegions, targetRegions, targets } from "../sections/image-scan-fixtures"

// ?demo=image-scan-check: every state of ImageScan, and the target image in its own ratio, in a square frame it is
// letterboxed in (contain) and one it fills (cover), for tooling/image-scan-check.mjs.
function ImageScanCheck() {
  return (
    <main className="flex flex-wrap items-start gap-section p-group">
      <section className="w-full max-w-sm" data-testid="uploaded" aria-label="Uploaded">
        <ImageScan src={stillLife} alt="Uploaded still life" width={800} height={600} onScan={() => {}} />
      </section>
      <section className="w-full max-w-sm" data-testid="indeterminate" aria-label="Indeterminate">
        <ImageScan
          src={stillLife}
          alt="Scanning still life"
          width={800}
          height={600}
          status="scanning"
          onCancel={() => {}}
        />
      </section>
      <section className="w-full max-w-sm" data-testid="determinate" aria-label="Determinate">
        <ImageScan
          src={stillLife}
          alt="Measured still life"
          width={800}
          height={600}
          status="scanning"
          progress={0.6}
          statusText="Find objects"
          steps={scanSteps}
          step="detect"
          onCancel={() => {}}
        />
      </section>
      <section className="w-full max-w-sm" data-testid="result" aria-label="Result">
        <ImageScan
          src={stillLife}
          alt="Scanned still life"
          width={800}
          height={600}
          status="result"
          regions={stillLifeRegions}
          defaultSelectedRegion="mug"
        />
      </section>
      <section className="w-full max-w-sm" data-testid="error" aria-label="Error">
        <ImageScan
          src={stillLife}
          alt="Unreadable still life"
          width={800}
          height={600}
          status="error"
          error="The model could not read this image."
          onRetry={() => {}}
        />
      </section>
      <section className="w-full max-w-sm" data-testid="natural" aria-label="Natural">
        <ImageScan src={targets} alt="Targets" status="result" regions={targetRegions} legend={false} />
      </section>
      <section className="w-full max-w-sm" data-testid="contain" aria-label="Contain">
        <ImageScan
          src={targets}
          alt="Letterboxed targets"
          aspectRatio={1}
          fit="contain"
          status="result"
          regions={targetRegions}
          legend={false}
        />
      </section>
      <section className="w-full max-w-sm" data-testid="cover" aria-label="Cover">
        <ImageScan
          src={targets}
          alt="Cropped targets"
          aspectRatio={1}
          fit="cover"
          status="result"
          regions={targetRegions}
          legend={false}
        />
      </section>
    </main>
  )
}

export { ImageScanCheck }
