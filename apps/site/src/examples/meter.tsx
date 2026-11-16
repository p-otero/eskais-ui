import { Meter, MeterLabel, MeterTrack, MeterValue } from "@/components/ui/meter"

export default function MeterDemo() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-group">
      <Meter value={68}>
        <MeterLabel>Storage used</MeterLabel>
        <MeterValue />
        <MeterTrack />
      </Meter>
      <Meter value={92} tone="warning">
        <MeterLabel>Build minutes used</MeterLabel>
        <MeterValue />
        <MeterTrack />
      </Meter>
    </div>
  )
}
