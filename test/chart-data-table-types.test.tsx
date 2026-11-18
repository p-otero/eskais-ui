import { render, screen } from "@testing-library/react"
import { expect, expectTypeOf, test } from "vitest"

import { ChartDataTable, type ChartDataTableProps } from "@/components/ui/chart"

interface Point {
  d: string
  v: number
}

const points: Point[] = [
  { d: "Mon", v: 3 },
  { d: "Tue", v: 5 },
]

test("interface-typed rows need no index signature", () => {
  render(
    <ChartDataTable
      aria-label="Visits"
      data={points}
      labelKey="d"
      keys={["v"]}
      config={{ v: { label: "Visits" } }}
      visuallyHidden={false}
    />,
  )
  expect(screen.getByRole("rowheader", { name: "Tue" })).toBeTruthy()
  expect(screen.getByRole("columnheader", { name: "Visits" })).toBeTruthy()
  expect(screen.getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["3", "5"])
})

test("keys are checked against the row type", () => {
  expectTypeOf<ChartDataTableProps<Point>["labelKey"]>().toEqualTypeOf<"d" | "v">()
  expectTypeOf<ChartDataTableProps<Point>["keys"]>().toEqualTypeOf<readonly ("d" | "v")[] | undefined>()

  const readonlyRows = [{ month: "Jan", sales: 1 }] as const
  // Type-only: the JSX is never rendered.
  const valid = <ChartDataTable aria-label="Sales" data={readonlyRows} labelKey="month" keys={["sales"]} />
  // @ts-expect-error "missing" is not a field of Point
  const unknownLabel = <ChartDataTable aria-label="Visits" data={points} labelKey="missing" />
  // @ts-expect-error "w" is not a field of Point
  const unknownKey = <ChartDataTable aria-label="Visits" data={points} labelKey="d" keys={["w"]} />
  expect([valid, unknownLabel, unknownKey]).toHaveLength(3)
})
