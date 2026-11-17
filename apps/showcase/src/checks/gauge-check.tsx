import { Meter, MeterLabel, MeterRing } from "@/components/ui/meter"
import type { Tone } from "@/lib/tone"

// ?demo=gauge-check: the fixture tooling/shell-check.mjs measures and screenshots: ring meters in each size and tone.
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
    </main>
  )
}

export { GaugeCheck }
