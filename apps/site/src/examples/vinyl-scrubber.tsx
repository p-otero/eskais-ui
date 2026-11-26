import { VinylScrubber } from "@/components/ui/vinyl-scrubber"

const peaks = Array.from(
  { length: 240 },
  (_, index) => 0.3 + 0.7 * Math.abs(Math.sin(index * 0.41) * Math.cos(index * 0.13)),
)

export default function VinylScrubberDemo() {
  return (
    <div className="w-full max-w-2xl">
      <VinylScrubber label="Track" title="Night Drive" subtitle="Side B · Track 2" duration={312} peaks={peaks} />
    </div>
  )
}
