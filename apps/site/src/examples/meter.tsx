import { Meter, MeterLabel, MeterRing, MeterTrack, MeterValue } from "@/components/ui/meter"

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
      <div className="flex items-end gap-section">
        <Meter variant="ring" value={40} tone="success">
          <MeterRing size="sm" />
          <MeterLabel>Seats</MeterLabel>
        </Meter>
        <Meter variant="ring" value={68}>
          <MeterRing />
          <MeterLabel>Storage</MeterLabel>
        </Meter>
      </div>
    </div>
  )
}
