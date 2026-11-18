import type { NumberOp } from "@/lib/filter-schema"

type FilterFieldLabels = {
  /** The choice that clears a single option or a boolean. */
  any: string
  yes: string
  no: string
  from: string
  to: string
  min: string
  max: string
  value: string
  comparison: string
  operators: Record<NumberOp | "between", string>
}

const filterFieldLabels: FilterFieldLabels = {
  any: "Any",
  yes: "Yes",
  no: "No",
  from: "From",
  to: "To",
  min: "Minimum",
  max: "Maximum",
  value: "Value",
  comparison: "Comparison",
  operators: {
    eq: "Equals",
    neq: "Is not",
    lt: "Less than",
    lte: "At most",
    gt: "More than",
    gte: "At least",
    between: "Between",
  },
}

export { filterFieldLabels }
export type { FilterFieldLabels }
