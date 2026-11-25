import { useSkyPhoto } from "@/components/ui/use-sky-photo"
import { fovFromFocalLength35mm } from "@/lib/sky-photo-projection"

const src = "/sky/cebu-skyline.jpg"

export default function SkyPhotoDemo() {
  const sky = useSkyPhoto(src)
  const analysis = sky?.status === "ready" ? sky.analysis : undefined
  const fov = analysis?.exif.focalLength35mm
    ? fovFromFocalLength35mm(analysis.exif.focalLength35mm, analysis.aspect)
    : undefined
  return (
    <div className="flex w-full max-w-2xl flex-col gap-items">
      <div className="relative overflow-hidden rounded-surface border" aria-busy={sky?.status === "reading"}>
        <img src={src} alt="Cebu City skyline" width={1440} height={1080} className="block h-auto w-full" />
        {analysis ? (
          <div
            className="absolute inset-0 bg-violet opacity-60"
            style={{
              maskImage: `url("${analysis.foregroundUrl}"), linear-gradient(black, black)`,
              maskComposite: "exclude",
              maskSize: "100% 100%",
            }}
          />
        ) : null}
        {analysis ? (
          <div
            className="absolute inset-x-0 h-px bg-warning"
            style={{ top: `${(analysis.mask.horizon * 100).toFixed(2)}%` }}
          />
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-items text-body-sm sm:grid-cols-4">
        <div>
          <dt className="text-caption text-muted-foreground">Captured</dt>
          <dd className="font-mono">{analysis?.exif.capturedAt ?? "–"}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">35 mm focal</dt>
          <dd className="font-mono">{analysis?.exif.focalLength35mm ?? "–"} mm</dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Field of view</dt>
          <dd className="font-mono">{fov === undefined ? "–" : `${fov.toFixed(1)}°`}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">Sky found in</dt>
          <dd className="font-mono">{analysis ? `${analysis.analysisMs.toFixed(0)} ms` : "–"}</dd>
        </div>
      </dl>
      <p className="text-caption text-muted-foreground">
        Sky tinted, default horizon as a line. Cebu City skyline by DisRaptor18, CC0, Wikimedia Commons.
      </p>
    </div>
  )
}
