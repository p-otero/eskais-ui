import { TextDiff } from "@/components/ui/text-diff"

const before = `export function total(items: { price: number }[]) {
  let sum = 0
  for (const item of items) sum += item.price
  return sum
}
`

const after = `export function total(items: { price: number; quantity: number }[]) {
  let sum = 0
  for (const item of items) sum += item.price * item.quantity
  return Math.round(sum * 100) / 100
}
`

export default function TextDiffDemo() {
  return <TextDiff aria-label="total.ts changes" oldText={before} newText={after} language="ts" className="w-full" />
}
