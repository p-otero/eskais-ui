import { describe, expect, test } from "vitest"

import { FilterSerializeError, type FilterNode } from "@/lib/filter-ast"
import { graphqlWhere } from "@/lib/filter-graphql"
import { odata } from "@/lib/filter-odata"
import { rsql } from "@/lib/filter-rsql"
import { defineFilters, schemaFields, toFilterAst } from "@/lib/filter-schema"
import { jsonAst, queryParams, searchOnly } from "@/lib/filter-serializers"
import { springFilter } from "@/lib/filter-spring"

const schema = defineFilters({
  q: { kind: "text", label: "Search" },
  status: {
    kind: "options",
    label: "Status",
    multiple: true,
    options: [
      { value: "open", label: "Open" },
      { value: "closed", label: "Closed" },
    ],
  },
  archived: { kind: "boolean", label: "Archived" },
  amount: { kind: "number", label: "Amount" },
  created: { kind: "dateRange", label: "Created" },
  owner: { kind: "options", label: "Owner", field: "owner.name", options: [] },
  title: { kind: "text", label: "Title", search: { fields: ["title"], op: "contains" } },
})

const flat = toFilterAst(schema, {
  q: "ignored here",
  status: ["open", "closed"],
  archived: false,
  amount: { op: "gte", value: 10 },
  created: { from: "2026-01-01", to: "2026-02-01" },
}) as FilterNode

const grouped: FilterNode = {
  and: [
    { field: "status", op: "eq", value: "open" },
    {
      or: [{ field: "amount", op: "gt", value: 100 }, { not: { field: "owner.name", op: "isNull", value: true } }],
    },
  ],
}

const rsqlSkeleton = (text: string) => text.replaceAll(/"(?:\\.|[^"\\])*"/g, "S")
const rsqlShape = (value: string) =>
  rsql({
    and: [
      { field: "title", op: "eq", value },
      { field: "status", op: "in", value: [value, "x"] },
    ],
  })
const odataSkeleton = (text: string) => text.replaceAll(/'(?:''|[^'])*'/g, "S")
const odataShape = (value: string) =>
  odata({
    and: [
      { field: "title", op: "contains", value },
      { field: "status", op: "eq", value },
    ],
  })
const springSkeleton = (text: string) => text.replaceAll(/'(?:\\.|[^'\\])*'/g, "S")
const springShape = (value: string) =>
  springFilter({
    or: [
      { field: "title", op: "eq", value },
      { field: "status", op: "in", value: [value] },
    ],
  })

const payloads = [
  `O'Brien`,
  `say "hi"`,
  `back\\slash`,
  `a,b;c`,
  `x) or (1=1`,
  `' or 1 eq 1 or '`,
  `==;=in=(`,
  `ñandú 日本 🙂`,
  `line\nbreak\ttab`,
  `\u202Eevil`,
]

describe("queryParams", () => {
  test("suffix style (default)", () => {
    expect(queryParams(flat).toString()).toBe(
      "status_in=open&status_in=closed&archived=false&amount_gte=10&created_gte=2026-01-01&created_lte=2026-02-01",
    )
  })

  test("dto and bracket styles, comma arrays, a custom name", () => {
    expect([...queryParams(flat, { style: "dto" })]).toEqual([
      ["status", "open"],
      ["status", "closed"],
      ["archived", "false"],
      ["amountFrom", "10"],
      ["createdFrom", "2026-01-01"],
      ["createdTo", "2026-02-01"],
    ])
    expect(queryParams(flat, { style: "bracket", arrays: "comma" }).toString()).toBe(
      "status%5Bin%5D=open%2Cclosed&archived%5Beq%5D=false&amount%5Bgte%5D=10&created%5Bgte%5D=2026-01-01&created%5Blte%5D=2026-02-01",
    )
    expect(queryParams({ field: "owner.name", op: "nin", value: ["a"] }, { style: "dto" }).toString()).toBe(
      "ownerNameNotIn=a",
    )
    expect(
      queryParams(flat, { name: (field, op) => (field === "status" ? `filter.${op}` : undefined) }).get("filter.in"),
    ).toBe("open")
  })

  test("not is pushed down; an or is refused", () => {
    expect(queryParams({ not: { field: "amount", op: "lt", value: 5 } }).toString()).toBe("amount_gte=5")
    expect(() => queryParams(grouped)).toThrow(FilterSerializeError)
    expect(() => queryParams({ not: { field: "q", op: "contains", value: "x" } })).toThrow(/can't negate/)
  })

  test("dates as epoch-ms; comma arrays refuse a value with a comma", () => {
    expect(
      queryParams({ field: "created", op: "gte", value: "2026-01-01", type: "date" }, { dates: "epoch-ms" }).get(
        "created_gte",
      ),
    ).toBe(String(Date.UTC(2026, 0, 1)))
    expect(() => queryParams({ field: "status", op: "in", value: ["a,b", "c"] }, { arrays: "comma" })).toThrow(/comma/)
  })

  test("injection: every value stays inside its own param", () => {
    for (const payload of payloads) {
      const params = queryParams({
        and: [
          { field: "title", op: "contains", value: payload },
          { field: "a", op: "eq", value: 1 },
        ],
      })
      expect([...params]).toEqual([
        ["title_contains", payload],
        ["a", "1"],
      ])
      expect(new URLSearchParams(params.toString()).get("title_contains")).toBe(payload)
    }
  })
})

describe("jsonAst", () => {
  test("keeps the grammar, formats dates, refuses non-finite numbers", () => {
    expect(jsonAst(grouped)).toEqual(grouped)
    expect(
      jsonAst(
        { field: "created", op: "gte", value: new Date("2026-01-01T00:00:00Z"), type: "date" },
        { dates: "epoch-ms" },
      ),
    ).toEqual({ field: "created", op: "gte", value: Date.UTC(2026, 0, 1), type: "date" })
    expect(() => jsonAst({ field: "a", op: "eq", value: Number.NaN })).toThrow(/JSON/)
    expect(jsonAst(null)).toBeNull()
  })

  test("injection: hostile values survive a JSON round trip unchanged", () => {
    for (const payload of payloads) {
      const node: FilterNode = { field: "title", op: "eq", value: payload }
      expect(JSON.parse(JSON.stringify(jsonAst(node)))).toEqual(node)
    }
  })
})

describe("rsql", () => {
  test("and, or with parentheses, every comparison", () => {
    expect(rsql(flat)).toBe(
      'status=in=("open","closed");archived==false;amount=ge=10;created=ge="2026-01-01";created=le="2026-02-01"',
    )
    expect(rsql(grouped)).toBe('status=="open";(amount=gt=100,owner.name=isnull=false)')
    expect(rsql({ field: "t", op: "startsWith", value: "ab" })).toBe('t=="ab*"')
    expect(rsql({ not: { field: "t", op: "contains", value: "ab" } })).toBe('t!="*ab*"')
    expect(rsql({ field: "n", op: "nin", value: [1, 2] })).toBe("n=out=(1,2)")
    expect(rsql({ field: "n", op: "isNull", value: true }, { isNull: "=null=" })).toBe("n=null=true")
  })

  test("refuses what it can't write", () => {
    expect(() => rsql({ field: "t", op: "contains", value: "a*b" })).toThrow(/wildcard/)
    expect(() => rsql({ field: "t", op: "eq", value: null })).toThrow(/isNull/)
    expect(() => rsql({ field: "t", op: "in", value: [] })).toThrow(/at least one/)
    expect(() => rsql({ field: "t;x==1", op: "eq", value: 1 })).toThrow(/valid field name/)
    expect(() => rsql({ field: "t", op: "eq", value: Number.POSITIVE_INFINITY })).toThrow(FilterSerializeError)
  })

  test("injection: stripping quoted arguments leaves the benign skeleton", () => {
    const benign = rsqlSkeleton(rsqlShape("plain"))
    expect(benign).toBe("title==S;status=in=(S,S)")
    for (const payload of payloads) expect(rsqlSkeleton(rsqlShape(payload)), payload).toBe(benign)
  })
})

describe("odata", () => {
  test("the full grammar", () => {
    expect(odata(flat)).toBe(
      "status in ('open','closed') and archived eq false and amount ge 10 and created ge 2026-01-01 and created le 2026-02-01",
    )
    expect(odata(grouped)).toBe("status eq 'open' and (amount gt 100 or not (owner/name eq null))")
    expect(odata({ field: "s", op: "in", value: ["a", "b"] }, { inOperator: false })).toBe("(s eq 'a' or s eq 'b')")
    expect(odata({ field: "s", op: "nin", value: ["a"] })).toBe("not (s in ('a'))")
    expect(odata({ field: "t", op: "endsWith", value: "x" })).toBe("endswith(t,'x')")
    expect(odata({ field: "d", op: "lt", value: new Date("2026-01-01T00:00:00Z") })).toBe(
      "d lt 2026-01-01T00:00:00.000Z",
    )
  })

  test("refuses dates it can't write as a literal", () => {
    expect(() => odata({ field: "d", op: "lt", value: "tomorrow", type: "date" })).toThrow(/OData date/)
    expect(() => odata({ field: "d", op: "lt", value: "2026-01-01", type: "date" }, { dates: "epoch-ms" })).toThrow(
      /OData date/,
    )
  })

  test("injection: stripping string literals leaves the benign skeleton", () => {
    const benign = odataSkeleton(odataShape("plain"))
    expect(benign).toBe("contains(title,S) and status eq S")
    for (const payload of payloads) expect(odataSkeleton(odataShape(payload)), payload).toBe(benign)
    expect(odata({ field: "t", op: "eq", value: "O'Brien" })).toBe("t eq 'O''Brien'")
  })
})

describe("springFilter", () => {
  test("Spring Filter syntax", () => {
    expect(springFilter(flat)).toBe(
      "status in ['open', 'closed'] and archived : false and amount >: 10 and created >: '2026-01-01' and created <: '2026-02-01'",
    )
    expect(springFilter(grouped)).toBe("status : 'open' and (amount > 100 or not (owner.name is null))")
    expect(springFilter({ field: "t", op: "contains", value: "ab" }, { like: "~~" })).toBe("t ~~ '%ab%'")
    expect(springFilter({ field: "t", op: "startsWith", value: "ab" }, { module: "mongo" })).toBe("t ~ 'ab*'")
    expect(springFilter({ field: "n", op: "nin", value: [1] })).toBe("n not in [1]")
    expect(springFilter({ field: "n", op: "isNull", value: false })).toBe("n is not null")
  })

  test("refuses wildcards inside text and nulls outside isNull", () => {
    expect(() => springFilter({ field: "t", op: "contains", value: "50%" })).toThrow(/wildcard/)
    expect(() => springFilter({ field: "t", op: "contains", value: "snake_case" })).toThrow(/wildcard/)
    expect(springFilter({ field: "t", op: "contains", value: "snake_case" }, { module: "mongo" })).toBe(
      "t ~ '*snake_case*'",
    )
    expect(() => springFilter({ field: "t", op: "eq", value: null })).toThrow(/isNull/)
  })

  test("injection: stripping string literals leaves the benign skeleton", () => {
    const benign = springSkeleton(springShape("plain"))
    expect(benign).toBe("title : S or status in [S]")
    for (const payload of payloads) expect(springSkeleton(springShape(payload)), payload).toBe(benign)
    expect(springFilter({ field: "t", op: "eq", value: "d'Artagnan\\" })).toBe("t : 'd\\'Artagnan\\\\'")
  })
})

describe("graphqlWhere", () => {
  test("Hasura", () => {
    expect(graphqlWhere(grouped)).toEqual({
      _and: [
        { status: { _eq: "open" } },
        { _or: [{ amount: { _gt: 100 } }, { _not: { owner: { name: { _is_null: true } } } }] },
      ],
    })
    expect(graphqlWhere({ field: "t", op: "contains", value: "50%_off\\" })).toEqual({
      t: { _ilike: "%50\\%\\_off\\\\%" },
    })
    expect(graphqlWhere({ field: "t", op: "startsWith", value: "a" }, { caseInsensitive: false })).toEqual({
      t: { _like: "a%" },
    })
    expect(graphqlWhere(null)).toEqual({})
  })

  test("Prisma", () => {
    expect(graphqlWhere(flat, { dialect: "prisma" })).toEqual({
      AND: [
        { status: { in: ["open", "closed"] } },
        { archived: { equals: false } },
        { amount: { gte: 10 } },
        { created: { gte: "2026-01-01" } },
        { created: { lte: "2026-02-01" } },
      ],
    })
    expect(graphqlWhere({ field: "t", op: "contains", value: "x" }, { dialect: "prisma" })).toEqual({
      t: { contains: "x", mode: "insensitive" },
    })
    expect(graphqlWhere({ not: { field: "o.n", op: "isNull", value: true } }, { dialect: "prisma" })).toEqual({
      NOT: { o: { n: { equals: null } } },
    })
  })

  test("injection: values are data, and a field can't become a key path", () => {
    for (const payload of payloads)
      expect(graphqlWhere({ field: "title", op: "eq", value: payload })).toEqual({ title: { _eq: payload } })
    expect(() =>
      graphqlWhere({ field: "__proto__.polluted", op: "eq", value: 1 }, { fields: schemaFields(schema) }),
    ).toThrow(/isn't a field/)
    expect(() => graphqlWhere({ field: "a b", op: "eq", value: 1 })).toThrow(/valid field name/)
  })
})

test("searchOnly sends only the text, under q", () => {
  expect(searchOnly(schema, { q: " hello ", title: "world", archived: true })).toEqual({ q: "hello world" })
  expect(searchOnly(schema, { archived: true })).toEqual({})
  expect(searchOnly(schema, { q: "x" }, { param: "search" })).toEqual({ search: "x" })
  expect(() => searchOnly(schema, { q: "x" }, { param: "a&b" })).toThrow(/valid field name/)
})

test("a field whitelist refuses anything the schema doesn't name, in every format", () => {
  const fields = schemaFields(schema)
  const hostile: FilterNode = { field: "password", op: "eq", value: "x" }
  for (const serialize of [
    () => queryParams(hostile, { fields }),
    () => jsonAst(hostile, { fields }),
    () => rsql(hostile, { fields }),
    () => odata(hostile, { fields }),
    () => springFilter(hostile, { fields }),
    () => graphqlWhere(hostile, { fields }),
  ])
    expect(serialize).toThrow(/isn't a field of this filter schema/)
  expect(() => rsql({ field: "status", op: "like" as never, value: "x" })).toThrow(/Unknown operator/)
  expect(() => rsql({ field: "status", op: "in", value: "x" })).toThrow(/needs a list/)
})
