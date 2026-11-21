import {
  FilterSerializeError,
  negate,
  scalarText,
  valuesOf,
  type FilterLeaf,
  type FilterNode,
  type FilterScalar,
} from "@/lib/filter-ast"
import { checked, type SerializeOptions } from "@/lib/filter-serializers"

type RsqlOptions = SerializeOptions & {
  /** The null check. Default `"=isnull="` (`field=isnull=true`), as rsql-jpa-specification reads it. */
  isNull?: "=isnull=" | "=null="
}

const comparison = { eq: "==", neq: "!=", lt: "=lt=", lte: "=le=", gt: "=gt=", gte: "=ge=", in: "=in=", nin: "=out=" }

// Quoted arguments may hold any character; only the quote and the backslash need escaping.
function quote(text: string) {
  return `"${text.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
}

function argument(value: FilterScalar, leaf: FilterLeaf, options: RsqlOptions) {
  if (typeof value === "number" || typeof value === "boolean") return scalarText(value, options.dates, false)
  if (value === null) throw new FilterSerializeError(`Use isNull for a null "${leaf.field}" in RSQL.`)
  return quote(scalarText(value, options.dates, leaf.type === "date"))
}

function likePattern(leaf: FilterLeaf) {
  const text = String(leaf.value)
  if (text.includes("*"))
    throw new FilterSerializeError(`RSQL can't match a literal "*" in "${leaf.field}"; it is the wildcard.`)
  if (leaf.op === "contains") return `*${text}*`
  return leaf.op === "startsWith" ? `${text}*` : `*${text}`
}

function leafText(leaf: FilterLeaf, options: RsqlOptions, negated: boolean): string {
  const { field } = leaf
  if (leaf.op === "isNull") return `${field}${options.isNull ?? "=isnull="}${String((leaf.value === true) !== negated)}`
  if (leaf.op === "contains" || leaf.op === "startsWith" || leaf.op === "endsWith")
    return `${field}${negated ? "!=" : "=="}${quote(likePattern(leaf))}`
  if (negated) throw new FilterSerializeError(`RSQL can't negate "${leaf.op}".`)
  if (leaf.op === "in" || leaf.op === "nin") {
    const values = valuesOf(leaf)
    if (values.length === 0) throw new FilterSerializeError(`"${leaf.op}" on "${field}" needs at least one value.`)
    return `${field}${comparison[leaf.op]}(${values.map((value) => argument(value, leaf, options)).join(",")})`
  }
  return `${field}${comparison[leaf.op]}${argument(leaf.value as FilterScalar, leaf, options)}`
}

function nodeText(node: FilterNode, options: RsqlOptions): string {
  if ("and" in node)
    return node.and
      .map((child) => ("or" in child ? `(${nodeText(child, options)})` : nodeText(child, options)))
      .join(";")
  if ("or" in node) return node.or.map((child) => nodeText(child, options)).join(",")
  if ("not" in node) {
    const pushed = negate(node.not)
    if ("not" in pushed) {
      const inner = pushed.not
      return "field" in inner ? leafText(inner, options, true) : nodeText(pushed, options)
    }
    return nodeText(pushed, options)
  }
  return leafText(node, options, false)
}

/**
 * RSQL/FIQL: `;` is and, `,` is or, with parentheses. `not` is pushed down to the comparisons; a negated text match
 * becomes `!=` with wildcards. String arguments are always quoted and escaped.
 */
function rsql(ast: FilterNode | null | undefined, options: RsqlOptions = {}): string {
  if (!ast) return ""
  return nodeText(checked(ast, options.fields), options)
}

export { rsql }
export type { RsqlOptions }
