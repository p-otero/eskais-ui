import { Badge } from "@/components/ui/badge"
import { Bento, BentoTile } from "@/components/ui/bento"
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress"

export default function BentoDemo() {
  return (
    <Bento columns={6}>
      <BentoTile
        span={4}
        eyebrow="Wide"
        title="Spans four of six columns"
        description="Two of two on a medium container."
      >
        <Progress value={64} aria-label="Rollout">
          <ProgressTrack>
            <ProgressIndicator />
          </ProgressTrack>
        </Progress>
      </BentoTile>
      <BentoTile span={2} eyebrow="Narrow" title="Two columns" description="Half of a medium container.">
        <div className="flex flex-wrap gap-inline">
          <Badge tone="success">Healthy</Badge>
          <Badge tone="warning">Degraded</Badge>
        </div>
      </BentoTile>
      <BentoTile span={3} title="A linked tile" description="The whole tile follows its link." href="#bento" />
      <BentoTile span={3} title="One column on a phone" description="Tiles stack below 48rem of container width." />
    </Bento>
  )
}
