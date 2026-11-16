import { QuantityValue } from "@/components/ui/quantity-value"

const usd = (value: number) => `$${value.toFixed(2)}`

export default function QuantityDemo() {
  return (
    <dl className="grid grid-cols-2 gap-x-group gap-y-inline text-body">
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
    </dl>
  )
}
