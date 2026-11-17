import { describe, expect, test } from "vitest"

import { arraySource } from "@/lib/array-source"
import { defineFilters, type FilterValues } from "@/lib/filter-schema"
import { createUrlCodec, type PageUrlState } from "@/lib/filter-url"

const schema = defineFilters({
  q: { kind: "text", label: "Search" },
  status: {
    kind: "options",
    label: "Status",
    multiple: true,
    options: [
      { value: "open", label: "Open" },
      { value: "closed", label: "Closed" },
      { value: "a,b\\c", label: "Odd" },
    ],
  },
  priority: { kind: "options", label: "Priority", options: [{ value: "high", label: "High" }] },
  archived: { kind: "boolean", label: "Archived" },
  amount: { kind: "number", label: "Amount" },
  due: { kind: "date", label: "Due" },
  created: { kind: "dateRange", label: "Created" },
  owner: { kind: "remoteOption", label: "Owner", source: arraySource([]), getLabel: String, multiple: true },
})

type Values = FilterValues<typeof schema>
const codec = createUrlCodec(schema)

function state(filter: Values, rest: Partial<PageUrlState<Values>> = {}): PageUrlState<Values> {
  return { filter, sort: [], page: 1, size: 25, ...rest }
}

describe("fields format", () => {
  test("writes readable params and leaves defaults out", () => {
    const params = codec.encode(
      state(
        {
          q: "fix login",
          status: ["open", "closed"],
          created: { from: "2026-01-01", to: "2026-02-01" },
          amount: { op: "gte", value: 10 },
        },
        { page: 2, size: 50, sort: [{ field: "name", direction: "asc" }] },
      ),
    )
    expect(decodeURIComponent(params.toString())).toBe(
      "q=fix+login&status=open,closed&amount=gte:10&created=2026-01-01..2026-02-01&sort=name.asc&page=2&size=50",
    )
  })

  test("round-trips every kind exactly, both ways", () => {
    const cases: PageUrlState<Values>[] = [
      state({}),
      state({ q: "ñ & 日本 ?=#", status: ["a,b\\c", "open"], priority: "high", archived: false }),
      state({ amount: { op: "between", min: -1.5, max: 20 }, due: "2026-03-01" }),
      state({ amount: { op: "eq", value: 0 }, created: { to: "2026-02-01" }, owner: ["u,1", "u2"] }),
      state({ created: { from: "2026-01-01T10:00:00.000Z" } }, { cursor: "abc==", size: 10 }),
      state(
        { archived: true },
        {
          sort: [
            { field: "a", direction: "desc" },
            { field: "b.c", direction: "asc" },
          ],
          page: 7,
        },
      ),
    ]
    for (const original of cases) {
      const params = codec.encode(original)
      const decoded = codec.decode(new URLSearchParams(params.toString()))
      expect(decoded).toEqual(original)
      expect(codec.encode(decoded).toString()).toBe(params.toString())
    }
  })

  test("drops what doesn't fit the schema: tampered URLs", () => {
    const decoded = codec.decode(
      new URLSearchParams(
        "status=open,deleted&priority=urgent&archived=maybe&amount=gte:abc&created=2026&page=-3&size=1e9x&sort=name.asc,x;drop.desc&password=1",
      ),
    )
    expect(decoded).toEqual(state({ status: ["open"] }, { sort: [{ field: "name", direction: "asc" }] }))
  })
})

describe("encoded format", () => {
  test("a $where with or groups goes in one param and round-trips", () => {
    const original = state({
      archived: true,
      $where: {
        or: [
          { field: "status", op: "eq", value: "open" },
          { field: "amount", op: "gt", value: 5 },
        ],
      },
    })
    const params = codec.encode(original)
    expect([...params.keys()]).toEqual(["f"])
    expect(codec.decode(params)).toEqual(original)
  })

  test("format: 'encoded' packs every filter, keeping paging readable", () => {
    const packed = createUrlCodec(schema, { format: "encoded" })
    const original = state({ q: "日本", status: ["open"] }, { page: 3 })
    const params = packed.encode(original)
    expect([...params.keys()]).toEqual(["f", "page"])
    expect(packed.decode(params)).toEqual(original)
    expect(packed.decode(new URLSearchParams("f=%%%not-base64"))).toEqual(state({}))
  })
})

test("prefix and merge keep other params; clashing names are refused", () => {
  const tasks = createUrlCodec(schema, { prefix: "t.", defaults: { size: 10 } })
  const merged = tasks.merge(
    new URLSearchParams("tab=board&t.page=4&t.q=old"),
    state({ q: "new" }, { size: 10, page: 1 }),
  )
  expect(merged.toString()).toBe("tab=board&t.q=new")
  expect(tasks.owns("t.status")).toBe(true)
  expect(tasks.owns("tab")).toBe(false)
  expect(() => createUrlCodec(defineFilters({ page: { kind: "boolean", label: "Page" } }))).toThrow(/clashes/)
})
