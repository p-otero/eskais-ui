import { expect, test } from "vitest"

import { findFilterKey, parseFilterInput } from "@/lib/filter-input"

import { serverTaskFilters as schema } from "./fixtures/server-tasks"

test("options take labels or values, one or many", () => {
  expect(parseFilterInput(schema.status, ["Open", "blocked"])).toEqual(["open", "blocked"])
  expect(parseFilterInput(schema.status, "in progress, Done")).toEqual(["in_progress", "done"])
  expect(parseFilterInput(schema.priority, "URGENT")).toBe("urgent")
  expect(() => parseFilterInput(schema.priority, ["low", "high"])).toThrow(/one option/)
  expect(() => parseFilterInput(schema.status, "Archived")).toThrow(/Open, In progress, Blocked, Done/)
})

test("numbers, booleans and dates from loose text", () => {
  expect(parseFilterInput(schema.points, 5)).toEqual({ op: "eq", value: 5 })
  expect(parseFilterInput(schema.points, ">= 3")).toEqual({ op: "gte", value: 3 })
  expect(parseFilterInput(schema.points, "lt:8")).toEqual({ op: "lt", value: 8 })
  expect(parseFilterInput(schema.points, "2..8")).toEqual({ op: "between", min: 2, max: 8 })
  expect(parseFilterInput(schema.points, { op: "gt", value: 1 })).toEqual({ op: "gt", value: 1 })
  expect(() => parseFilterInput(schema.points, "lots")).toThrow(/Points takes a number/)
  expect(parseFilterInput(schema.archived, "yes")).toBe(true)
  expect(parseFilterInput(schema.archived, "Active")).toBe(false)
  expect(() => parseFilterInput(schema.archived, "maybe")).toThrow(/true or false/)
  expect(parseFilterInput(schema.created, "2026-01-01..2026-01-31")).toEqual({ from: "2026-01-01", to: "2026-01-31" })
  expect(parseFilterInput(schema.created, { to: "2026-02-01" })).toEqual({ to: "2026-02-01" })
  expect(parseFilterInput(schema.created, ["2026-03-01", null])).toEqual({ from: "2026-03-01" })
  expect(() => parseFilterInput(schema.created, "last week")).toThrow(/range/)
  expect(parseFilterInput(schema.assignee, "Ada Lovelace")).toEqual(["Ada Lovelace"])
})

test("empty input clears; fields are found by key or label", () => {
  expect(parseFilterInput(schema.status, [])).toBeUndefined()
  expect(parseFilterInput(schema.q, "")).toBeUndefined()
  expect(parseFilterInput(schema.q, null)).toBeUndefined()
  expect(findFilterKey(schema, "status")).toBe("status")
  expect(findFilterKey(schema, "assignee")).toBe("assignee")
  expect(findFilterKey(schema, "PRIORITY")).toBe("priority")
  expect(() => findFilterKey(schema, "owner")).toThrow(/Filters: Search, Status/)
})
