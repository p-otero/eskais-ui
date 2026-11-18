import {
  FilterSerializeError,
  formatDate,
  isTemporalLike,
  valuesOf,
  type FilterLeaf,
  type FilterNode,
  type FilterScalar,
} from "@/lib/filter-ast"
import { checked, type SerializeOptions } from "@/lib/filter-serializers"

type ODataOptions = SerializeOptions & {
  /** `true` (default) writes `field in ('a','b')` (OData 4.01); `false` writes `or`ed `eq`s for OData 4.0 servers. */
  inOperator?: boolean
}

const comparison = { eq: "eq", neq: "ne", lt: "lt", lte: "le", gt: "gt", gte: "ge" }
const functions = { contains: "contains", startsWith: "startswith", endsWith: "endswith" }

const dateLiteral = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,12})?)?(?:Z|[+-]\d{2}:\d{2}))?$/

// Navigation paths use `/` in OData.
function path(field: string) {
  return field.replaceAll(".", "/")
}

function literal(value: FilterScalar, leaf: FilterLeaf, options: ODataOptions): string {
  if (value === null) return "null"
  if (typeof value === "boolean") return String(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new FilterSerializeError(`${String(value)} can't be written in OData.`)
    return String(value)
  }
  if (value instanceof Date || isTemporalLike(value) || leaf.type === "date") {
    const text = formatDate(value, options.dates)
    if (!dateLiteral.test(text))
      throw new FilterSerializeError(`"${text}" isn't an OData date; use dates: "iso" or "iso-date".`)
    return text
  }
  return `'${value.replaceAll("'", "''")}'`
}

function leafText(leaf: FilterLeaf, options: ODataOptions): string {
  const field = path(leaf.field)
  switch (leaf.op) {
    case "isNull":
      return `${field} ${leaf.value === true ? "eq" : "ne"} null`
    case "contains":
    case "startsWith":
    case "endsWith":
      return `${functions[leaf.op]}(${field},${literal(String(leaf.value), { ...leaf, type: undefined }, options)})`
    case "in":
    case "nin": {
      const values = valuesOf(leaf)
      if (values.length === 0) throw new FilterSerializeError(`"${leaf.op}" on "${leaf.field}" needs a value.`)
      const listed =
        options.inOperator === false
          ? `(${values.map((value) => `${field} eq ${literal(value, leaf, options)}`).join(" or ")})`
          : `${field} in (${values.map((value) => literal(value, leaf, options)).join(",")})`
      return leaf.op === "in" ? listed : `not (${listed})`
    }
    default:
      return `${field} ${comparison[leaf.op]} ${literal(leaf.value as FilterScalar, leaf, options)}`
  }
}

function nodeText(node: FilterNode, options: ODataOptions): string {
  const group = (child: FilterNode) =>
    "and" in child || "or" in child ? `(${nodeText(child, options)})` : nodeText(child, options)
  if ("and" in node) return node.and.map(group).join(" and ")
  if ("or" in node) return node.or.map(group).join(" or ")
  if ("not" in node) return `not (${nodeText(node.not, options)})`
  return leafText(node, options)
}

/** An OData `$filter` expression: the full grammar, strings in single quotes with `''` escapes, dates unquoted. */
function odata(ast: FilterNode | null | undefined, options: ODataOptions = {}): string {
  if (!ast) return ""
  return nodeText(checked(ast, options.fields), options)
}

export { odata }
export type { ODataOptions }
