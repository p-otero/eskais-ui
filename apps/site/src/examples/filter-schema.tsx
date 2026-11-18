import { useState } from "react"

import { CodeBlock } from "@/components/ui/code-block"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Select } from "@/components/ui/select"
import { graphqlWhere } from "@/lib/filter-graphql"
import { odata } from "@/lib/filter-odata"
import { rsql } from "@/lib/filter-rsql"
import { defineFilters, searchTerms, toFilterAst, type FilterValues } from "@/lib/filter-schema"
import { jsonAst, queryParams, searchOnly } from "@/lib/filter-serializers"
import { springFilter } from "@/lib/filter-spring"
import { createUrlCodec } from "@/lib/filter-url"

const schema = defineFilters({
  q: { kind: "text", label: "Search" },
  status: {
    kind: "options",
    label: "Status",
    multiple: true,
    options: [
      { value: "open", label: "Open" },
      { value: "blocked", label: "Blocked" },
      { value: "done", label: "Done" },
    ],
  },
  amount: { kind: "number", label: "Amount" },
  created: { kind: "dateRange", label: "Created" },
})

type Values = FilterValues<typeof schema>
type Format = "url" | "params" | "rsql" | "odata" | "spring" | "graphql" | "json" | "q"

const formats: { value: Format; label: string }[] = [
  { value: "url", label: "URL" },
  { value: "params", label: "Params" },
  { value: "rsql", label: "RSQL" },
  { value: "odata", label: "OData" },
  { value: "spring", label: "Spring" },
  { value: "graphql", label: "GraphQL" },
  { value: "json", label: "JSON" },
  { value: "q", label: "q only" },
]

const codec = createUrlCodec(schema)

function serialize(format: Format, values: Values) {
  const ast = toFilterAst(schema, values)
  const terms = new URLSearchParams(searchTerms(schema, values))
  try {
    switch (format) {
      case "url":
        return `?${decodeURIComponent(codec.encode({ filter: values, sort: [], page: 1, size: 25 }).toString())}`
      case "params":
        return `?${decodeURIComponent(new URLSearchParams([...terms, ...queryParams(ast)]).toString())}`
      case "rsql":
        return `filter=${rsql(ast)}`
      case "odata":
        return `$filter=${odata(ast)}`
      case "spring":
        return `filter=${springFilter(ast)}`
      case "graphql":
        return JSON.stringify({ where: graphqlWhere(ast) }, null, 2)
      case "json":
        return JSON.stringify({ q: terms.get("q") ?? undefined, where: jsonAst(ast) }, null, 2)
      default:
        return JSON.stringify(searchOnly(schema, values))
    }
  } catch (error) {
    return error instanceof Error ? `// ${error.message}` : String(error)
  }
}

export default function FilterSchemaDemo() {
  const [values, setValues] = useState<Values>({
    status: ["open", "blocked"],
    amount: { op: "gte", value: 100 },
    created: { from: "2026-01-01", to: "2026-01-31" },
  })
  const [format, setFormat] = useState<Format>("rsql")
  const output = serialize(format, values)
  return (
    <div className="flex w-full max-w-2xl flex-col gap-group">
      <div className="grid gap-items sm:grid-cols-2">
        <Field>
          <FieldLabel>Search</FieldLabel>
          <Input
            value={values.q ?? ""}
            onValueChange={(q) => setValues((previous) => ({ ...previous, q: q === "" ? undefined : q }))}
            placeholder="O'Brien, 50%…"
          />
        </Field>
        <Field>
          <FieldLabel>Status</FieldLabel>
          <Select<string, true>
            multiple
            options={schema.status.options}
            value={[...(values.status ?? [])]}
            onValueChange={(status) => setValues((previous) => ({ ...previous, status }))}
            placeholder="Any status"
          />
        </Field>
      </div>
      <Field>
        <FieldLabel>Wire format</FieldLabel>
        <SegmentedControl value={format} onValueChange={(next) => next && setFormat(next)} className="flex-wrap">
          <SegmentedControlIndicator />
          {formats.map((item) => (
            <SegmentedControlItem key={item.value} value={item.value}>
              {item.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </Field>
      <CodeBlock
        code={output}
        language={format === "graphql" || format === "json" || format === "q" ? "json" : "bash"}
        title="Request"
        wrap
      />
    </div>
  )
}
