import { AcceptanceBar, AcceptanceList, countAcceptance } from "@/components/ui/acceptance-list"
import { QuantityValue } from "@/components/ui/quantity-value"
import { RelativeTime, useNow } from "@/components/ui/relative-time"
import { Stat, StatDelta, StatGroup, StatHint, StatLabel, StatValue } from "@/components/ui/stat"

import { Section } from "../section"

const usd = (value: number) => `$${value.toFixed(2)}`

const criteria = [
  { text: "The build has no warnings", result: "pass", evidence: "CI run 812, 4 min" },
  { text: "Empty, loading and error states are designed", result: "pass" },
  { text: "Text meets 4.5:1 contrast in every theme", result: "fail", evidence: "2.8:1 on glass in dark mode" },
  { text: "Works offline", result: "unverified" },
  { text: "Survives a page reload", result: "unverified" },
] as const

function ValuesSection() {
  const now = useNow()
  const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString()
  return (
    <Section
      title="Values and time"
      description="Honest values (unknown is a dash, estimated has ~), relative times with the instant in the title, acceptance and summary figures."
    >
      <div className="flex w-full flex-col gap-4">
        <dl className="grid max-w-md grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Measured</dt>
          <dd>
            <QuantityValue value={{ value: 18_240, quality: "measured" }} locale="en-US" />
          </dd>
          <dt className="text-muted-foreground">Estimated</dt>
          <dd>
            <QuantityValue value={{ value: 0.42, quality: "estimated", source: "price table" }} format={usd} />
          </dd>
          <dt className="text-muted-foreground">Derived</dt>
          <dd>
            <QuantityValue value={{ value: 3, quality: "derived", source: "sum of attempts" }} />
          </dd>
          <dt className="text-muted-foreground">Unknown</dt>
          <dd>
            <QuantityValue value={{ value: null, quality: "unknown" }} />
          </dd>
          <dt className="text-muted-foreground">Updated (UTC)</dt>
          <dd>
            <RelativeTime value={minutesAgo(5)} now={now} locale="en-US" timeZone="UTC" />
          </dd>
          <dt className="text-muted-foreground">Actualizado (Madrid)</dt>
          <dd>
            <RelativeTime value={minutesAgo(190)} now={now} locale="es-ES" timeZone="Europe/Madrid" />
          </dd>
        </dl>

        <div className="flex max-w-md flex-col gap-3">
          <AcceptanceBar counts={countAcceptance(criteria)} />
          <AcceptanceList criteria={criteria} />
        </div>

        <StatGroup aria-label="Summary">
          <Stat>
            <StatLabel>Done</StatLabel>
            <StatValue value={12} />
            <StatHint>of 20</StatHint>
            <StatDelta value={0.2} comparison="vs. last week" locale="en-US" />
          </Stat>
          <Stat>
            <StatLabel>Cost</StatLabel>
            <StatValue value={{ value: 4.2, quality: "estimated", source: "price table" }} format={usd} />
            <StatHint>Estimated from tokens</StatHint>
            <StatDelta value={-0.08} invert comparison="vs. last week" locale="en-US" />
          </Stat>
          <Stat>
            <StatLabel>Duration</StatLabel>
            <StatValue value={{ value: null, quality: "unknown" }} />
            <StatHint>Not reported</StatHint>
          </Stat>
          <Stat>
            <StatLabel>Last activity</StatLabel>
            <StatValue>
              <RelativeTime value={minutesAgo(2)} now={now} locale="en-US" />
            </StatValue>
          </Stat>
        </StatGroup>
      </div>
    </Section>
  )
}

export { ValuesSection }
