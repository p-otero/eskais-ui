import { Meter, MeterLabel, MeterRing } from "@/components/ui/meter"
import { Stat, StatDelta, StatGroup, StatLabel, StatValue } from "@/components/ui/stat"
import type { Tone } from "@/lib/tone"

const rings: { size: "sm" | "md" | "lg"; value: number; tone?: Tone; label: string }[] = [
  { size: "sm", value: 25, label: "Quota" },
  { size: "md", value: 68, tone: "success", label: "Storage" },
  { size: "lg", value: 92, tone: "warning", label: "Build minutes" },
  { size: "md", value: 100, tone: "destructive", label: "Error budget" },
  { size: "md", value: 0, tone: "neutral", label: "Seats" },
]

function GaugeCheck() {
  return (
    <main className="flex flex-col gap-section p-section">
      <div data-testid="rings" className="flex flex-wrap items-end gap-section">
        {rings.map((ring) => (
          <Meter key={ring.label} variant="ring" value={ring.value} tone={ring.tone} locale="en-US">
            <MeterRing size={ring.size} />
            <MeterLabel>{ring.label}</MeterLabel>
          </Meter>
        ))}
      </div>
      <div data-testid="narrow-rings" className="grid w-80 grid-cols-3 gap-items">
        {["Disk used across every workspace", "Compute minutes this billing period", "Seats"].map((label) => (
          <Meter key={label} variant="ring" value={40} locale="en-US">
            <MeterRing size="sm" />
            {/* oxlint-disable-next-line shadcn/no-restyle -- reproduces a consumer's truncating label in a narrow column */}
            <MeterLabel className="truncate">{label}</MeterLabel>
          </Meter>
        ))}
      </div>
      <StatGroup aria-label="This week" data-testid="stats" className="max-w-4xl">
        <Stat>
          <StatLabel>Signups</StatLabel>
          <StatValue locale="en-US" value={1284} />
          <StatDelta value={0.12} comparison="vs. last week" locale="en-US" />
        </Stat>
        <Stat>
          <StatLabel>Active users</StatLabel>
          <StatValue locale="en-US" value={932} />
          <StatDelta value={-0.034} comparison="vs. last week" locale="en-US" />
        </Stat>
        <Stat>
          <StatLabel>Cost</StatLabel>
          <StatValue locale="en-US" value={418} />
          <StatDelta value={-0.08} invert comparison="vs. last month" locale="en-US" />
        </Stat>
        <Stat>
          <StatLabel>Uptime</StatLabel>
          <StatValue locale="en-US" value={99.9} />
          <StatDelta value={0} comparison="vs. last week" locale="en-US" />
        </Stat>
      </StatGroup>
    </main>
  )
}

export { GaugeCheck }
