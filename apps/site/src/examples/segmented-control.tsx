import { useState } from "react"

import { Field, FieldLabel } from "@/components/ui/field"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"

export default function SegmentedControlDemo() {
  const [layout, setLayout] = useState<"board" | "table" | "list">("board")
  return (
    <Field>
      <FieldLabel>Layout</FieldLabel>
      <SegmentedControl value={layout} onValueChange={(next) => next && setLayout(next)}>
        <SegmentedControlIndicator />
        <SegmentedControlItem value="board">Board</SegmentedControlItem>
        <SegmentedControlItem value="table">Table</SegmentedControlItem>
        <SegmentedControlItem value="list">List</SegmentedControlItem>
      </SegmentedControl>
    </Field>
  )
}
