import { Stat, StatDelta, StatGroup, StatHint, StatLabel, StatValue } from "@/components/ui/stat"

const usd = (value: number) => `$${value.toFixed(2)}`

export default function StatDemo() {
  return (
    <StatGroup aria-label="This week" className="w-full max-w-xl">
      <Stat>
        <StatLabel>Done</StatLabel>
        <StatValue value={12} />
        <StatDelta value={0.2} comparison="vs. last week" />
      </Stat>
      <Stat>
        <StatLabel>Cost</StatLabel>
        <StatValue value={{ value: 4.2, quality: "estimated", source: "price table" }} format={usd} />
        <StatDelta value={-0.08} invert comparison="vs. last week" />
      </Stat>
      <Stat>
        <StatLabel>Duration</StatLabel>
        <StatValue value={{ value: null, quality: "unknown" }} />
        <StatHint>Not reported</StatHint>
      </Stat>
    </StatGroup>
  )
}
