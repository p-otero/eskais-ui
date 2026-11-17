import { describe, expect, expectTypeOf, test } from "vitest"

import { arraySource } from "@/lib/array-source"
import { formatDate, matchesFilter, negate, type FilterNode } from "@/lib/filter-ast"
import {
  activeFilterKeys,
  defineFilters,
  isActiveValue,
  remoteOption,
  schemaFields,
  searchFieldOf,
  searchTerms,
  toFilterAst,
  type DateInput,
  type DateRange,
  type FilterValues,
  type NumberFilter,
} from "@/lib/filter-schema"

const owners = arraySource([{ id: "u1", name: "Ada" }])

const schema = defineFilters({
  q: { kind: "text", label: "Search" },
  title: { kind: "text", label: "Title", search: { fields: ["title", "body"], op: "contains" } },
  status: {
    kind: "options",
    label: "Status",
    multiple: true,
    options: [
      { value: "open", label: "Open" },
      { value: "closed", label: "Closed" },
    ],
  },
  priority: { kind: "options", label: "Priority", options: [{ value: "high", label: "High" }] },
  archived: { kind: "boolean", label: "Archived" },
  amount: { kind: "number", label: "Amount" },
  due: { kind: "date", label: "Due", op: "lte" },
  created: { kind: "dateRange", label: "Created", field: "createdAt" },
  updated: { kind: "dateRange", label: "Updated", end: "next-day" },
  owner: remoteOption({ label: "Owner", source: owners, getLabel: (owner) => owner.name, field: "owner.id" }),
})

type Values = FilterValues<typeof schema>

test("FilterValues infers each field's value", () => {
  expect(schema.owner.getLabel({ id: "u1", name: "Ada" })).toBe("Ada")
  expectTypeOf<Values["q"]>().toEqualTypeOf<string | undefined>()
  expectTypeOf<Values["status"]>().toEqualTypeOf<readonly string[] | undefined>()
  expectTypeOf<Values["priority"]>().toEqualTypeOf<string | undefined>()
  expectTypeOf<Values["archived"]>().toEqualTypeOf<boolean | undefined>()
  expectTypeOf<Values["amount"]>().toEqualTypeOf<NumberFilter | undefined>()
  expectTypeOf<Values["due"]>().toEqualTypeOf<DateInput | undefined>()
  expectTypeOf<Values["created"]>().toEqualTypeOf<DateRange | undefined>()
  expectTypeOf<Values["owner"]>().toEqualTypeOf<string | undefined>()
  expectTypeOf<Values["$where"]>().toEqualTypeOf<FilterNode | undefined>()
})

describe("defineFilters", () => {
  test("refuses keys and fields that aren't identifiers", () => {
    expect(() => defineFilters({ "a b": { kind: "boolean", label: "x" } })).toThrow(/valid field name/)
    expect(() => defineFilters({ ok: { kind: "boolean", label: "x", field: "x;drop" } })).toThrow(/valid field name/)
    expect(() => defineFilters({ t: { kind: "text", label: "x", search: { fields: ["name') or 1=1"] } } })).toThrow(
      /valid field name/,
    )
    expect(() => defineFilters({ $where: { kind: "boolean", label: "x" } })).toThrow(/reserved/)
  })

  test("lists the wire fields and the search field", () => {
    expect([...schemaFields(schema)]).toEqual([
      "title",
      "body",
      "status",
      "priority",
      "archived",
      "amount",
      "due",
      "createdAt",
      "updated",
      "owner.id",
    ])
    expect(searchFieldOf(schema)).toBe("q")
  })
})

describe("toFilterAst", () => {
  test("nothing active is null", () => {
    expect(toFilterAst(schema, {})).toBeNull()
    expect(toFilterAst(schema, { q: "  ", status: [], created: {} })).toBeNull()
  })

  test("one condition is a leaf; a param-mapped search stays out", () => {
    expect(toFilterAst(schema, { q: "hello", archived: false })).toEqual({ field: "archived", op: "eq", value: false })
    expect(searchTerms(schema, { q: " hello " })).toEqual({ q: "hello" })
  })

  test("every kind, joined by and", () => {
    const values: Values = {
      title: " bug ",
      status: ["open", "closed"],
      priority: "high",
      amount: { op: "between", min: 10, max: 20 },
      due: "2026-03-01",
      created: { from: "2026-01-01", to: "2026-02-01" },
      updated: { to: "2026-01-31" },
      owner: "u1",
    }
    expect(toFilterAst(schema, values)).toEqual({
      and: [
        {
          or: [
            { field: "title", op: "contains", value: "bug" },
            { field: "body", op: "contains", value: "bug" },
          ],
        },
        { field: "status", op: "in", value: ["open", "closed"] },
        { field: "priority", op: "eq", value: "high" },
        { field: "amount", op: "gte", value: 10 },
        { field: "amount", op: "lte", value: 20 },
        { field: "due", op: "lte", value: "2026-03-01", type: "date" },
        { field: "createdAt", op: "gte", value: "2026-01-01", type: "date" },
        { field: "createdAt", op: "lte", value: "2026-02-01", type: "date" },
        { field: "updated", op: "lt", value: "2026-02-01", type: "date" },
        { field: "owner.id", op: "eq", value: "u1" },
      ],
    })
  })

  test("next-day works on Date and Temporal-like values", () => {
    const date = toFilterAst(schema, { updated: { to: new Date("2026-12-31T00:00:00Z") } }) as { value: Date }
    expect(date.value).toEqual(new Date("2027-01-01T00:00:00Z"))
    const plain = { toString: () => "2026-12-31", add: () => ({ toString: () => "2027-01-01" }) }
    expect(String((toFilterAst(schema, { updated: { to: plain } }) as { value: unknown }).value)).toBe("2027-01-01")
    expect(() => toFilterAst(schema, { updated: { to: "31/12/2026" } })).toThrow(/next-day/)
  })

  test("$where joins in, checked against the schema's fields", () => {
    const where: FilterNode = {
      or: [
        { field: "status", op: "eq", value: "open" },
        { field: "owner.id", op: "isNull", value: true },
      ],
    }
    expect(toFilterAst(schema, { archived: true, $where: where })).toEqual({
      and: [{ field: "archived", op: "eq", value: true }, where],
    })
    expect(() => toFilterAst(schema, { $where: { field: "password", op: "eq", value: "x" } })).toThrow(/isn't a field/)
    expect(() => toFilterAst(schema, { $where: { field: "status) or (1", op: "eq", value: "x" } })).toThrow(
      /valid field name/,
    )
  })
})

test("active values and keys", () => {
  expect(isActiveValue(false)).toBe(true)
  expect(isActiveValue(0)).toBe(true)
  expect(isActiveValue({ from: "", to: undefined })).toBe(false)
  expect(activeFilterKeys(schema, { status: [], archived: false, q: "x" })).toEqual(["q", "archived"])
})

describe("negate", () => {
  test("pushes not to the leaves with De Morgan", () => {
    expect(
      negate({
        and: [
          { field: "a", op: "lt", value: 1 },
          {
            or: [
              { field: "b", op: "in", value: ["x"] },
              { field: "c", op: "isNull", value: true },
            ],
          },
        ],
      }),
    ).toEqual({
      or: [
        { field: "a", op: "gte", value: 1 },
        {
          and: [
            { field: "b", op: "nin", value: ["x"] },
            { field: "c", op: "isNull", value: false },
          ],
        },
      ],
    })
    expect(negate({ field: "c", op: "isNull", value: true })).toEqual({ field: "c", op: "isNull", value: false })
    expect(negate({ field: "t", op: "contains", value: "x" })).toEqual({
      not: { field: "t", op: "contains", value: "x" },
    })
    expect(negate({ not: { field: "a", op: "eq", value: 1 } })).toEqual({ field: "a", op: "eq", value: 1 })
  })
})

describe("formatDate", () => {
  const date = new Date("2026-01-02T03:04:05.006Z")
  test("iso, iso-date, epoch-ms and a function", () => {
    expect(formatDate(date)).toBe("2026-01-02T03:04:05.006Z")
    expect(formatDate(date, "iso-date")).toBe("2026-01-02")
    expect(formatDate(date, "epoch-ms")).toBe(String(date.getTime()))
    expect(formatDate("2026-01-02", "epoch-ms")).toBe(String(Date.UTC(2026, 0, 2)))
    expect(formatDate(date, (value) => `d:${String(value instanceof Date)}`)).toBe("d:true")
  })
  test("Temporal-like values use toString and epochMilliseconds", () => {
    const instant = { toString: () => "2026-01-02T03:04:05Z", epochMilliseconds: 42 }
    expect(formatDate(instant)).toBe("2026-01-02T03:04:05Z")
    expect(formatDate(instant, "epoch-ms")).toBe("42")
    expect(formatDate({ toString: () => "2026-01-02" }, "iso-date")).toBe("2026-01-02")
  })
  test("invalid dates throw", () => {
    expect(() => formatDate(new Date(Number.NaN))).toThrow(/Invalid Date/)
    expect(() => formatDate("soon", "epoch-ms")).toThrow(/isn't a date/)
  })
})

describe("matchesFilter", () => {
  const item = {
    title: "Fix Login",
    status: "open",
    amount: 15,
    owner: { id: "u1" },
    createdAt: "2026-02-01T18:30:00Z",
  }
  test("evaluates every operator in memory", () => {
    expect(matchesFilter(toFilterAst(schema, { title: "login", status: ["open"] }), item)).toBe(true)
    expect(matchesFilter(toFilterAst(schema, { amount: { op: "gt", value: 15 } }), item)).toBe(false)
    expect(matchesFilter(toFilterAst(schema, { owner: "u1" }), item)).toBe(true)
    expect(matchesFilter({ field: "missing", op: "isNull", value: true }, item)).toBe(true)
    expect(matchesFilter({ field: "status", op: "nin", value: ["closed"] }, item)).toBe(true)
    expect(matchesFilter({ field: "title", op: "startsWith", value: "fix" }, item)).toBe(true)
    expect(matchesFilter({ not: { field: "title", op: "endsWith", value: "IN" } }, item)).toBe(false)
    expect(matchesFilter(null, item)).toBe(true)
  })
  test("a date-only range end keeps the whole day", () => {
    expect(matchesFilter(toFilterAst(schema, { created: { from: "2026-01-01", to: "2026-02-01" } }), item)).toBe(true)
    expect(matchesFilter(toFilterAst(schema, { created: { to: "2026-01-31" } }), item)).toBe(false)
  })
})
