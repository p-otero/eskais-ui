import {
  FilterSerializeError,
  scalarText,
  valuesOf,
  type FilterLeaf,
  type FilterNode,
  type FilterScalar,
} from "@/lib/filter-ast"
import { checked, type SerializeOptions } from "@/lib/filter-serializers"

type SpringFilterOptions = SerializeOptions & {
  /** `"jpa"` (default) uses `%` and refuses `%`, `_` and `*` in text; `"mongo"` uses `*` and refuses it. */
  module?: "jpa" | "mongo"
  /** `"~~"` matches text without regard to case. Default `"~"`. */
  like?: "~" | "~~"
}

const comparison = { eq: ":", neq: "!", lt: "<", lte: "<:", gt: ">", gte: ">:" }

function quote(text: string) {
  return `'${text.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`
}

function literal(value: FilterScalar, leaf: FilterLeaf, options: SpringFilterOptions) {
  if (value === null) throw new FilterSerializeError(`Use isNull for a null "${leaf.field}" in Spring Filter.`)
  if (typeof value === "number" || typeof value === "boolean") return scalarText(value, options.dates, false)
  return quote(scalarText(value, options.dates, leaf.type === "date"))
}

function likePattern(leaf: FilterLeaf, module: "jpa" | "mongo") {
  const text = String(leaf.value)
  const wildcards = module === "jpa" ? /[%_*]/ : /\*/
  if (wildcards.test(text))
    throw new FilterSerializeError(
      `Spring Filter can't match "${text}" literally in "${leaf.field}": it holds a wildcard.`,
    )
  const any = module === "jpa" ? "%" : "*"
  if (leaf.op === "contains") return `${any}${text}${any}`
  return leaf.op === "startsWith" ? `${text}${any}` : `${any}${text}`
}

function leafText(leaf: FilterLeaf, options: SpringFilterOptions): string {
  const { field } = leaf
  switch (leaf.op) {
    case "isNull":
      return `${field} is ${leaf.value === true ? "" : "not "}null`
    case "contains":
    case "startsWith":
    case "endsWith":
      return `${field} ${options.like ?? "~"} ${quote(likePattern(leaf, options.module ?? "jpa"))}`
    case "in":
    case "nin": {
      const values = valuesOf(leaf)
      if (values.length === 0) throw new FilterSerializeError(`"${leaf.op}" on "${field}" needs a value.`)
      const list = `[${values.map((value) => literal(value, leaf, options)).join(", ")}]`
      return `${field} ${leaf.op === "in" ? "in" : "not in"} ${list}`
    }
    default:
      return `${field} ${comparison[leaf.op]} ${literal(leaf.value as FilterScalar, leaf, options)}`
  }
}

function nodeText(node: FilterNode, options: SpringFilterOptions): string {
  const group = (child: FilterNode) =>
    "and" in child || "or" in child ? `(${nodeText(child, options)})` : nodeText(child, options)
  if ("and" in node) return node.and.map(group).join(" and ")
  if ("or" in node) return node.or.map(group).join(" or ")
  if ("not" in node) return `not (${nodeText(node.not, options)})`
  return leafText(node, options)
}

/**
 * The `filter` param of turkraft's Spring Filter: `status : 'open' and (amount >: 10 or owner is null)`. Strings are
 * single-quoted with backslash escapes; text matches add the module's wildcard and refuse one in the text itself.
 */
function springFilter(ast: FilterNode | null | undefined, options: SpringFilterOptions = {}): string {
  if (!ast) return ""
  return nodeText(checked(ast, options.fields), options)
}

export { springFilter }
export type { SpringFilterOptions }
