import {
  assertFieldName,
  assertLeaf,
  FilterSerializeError,
  negate,
  scalarText,
  valuesOf,
  type DateFormat,
  type FilterLeaf,
  type FilterNode,
  type FilterOp,
  type FilterScalar,
} from "@/lib/filter-ast"
import type { FilterSchema, FilterValues } from "@/lib/filter-schema"

type SerializeOptions = {
  /** How dates are written. Default ISO 8601: `"iso"`. */
  dates?: DateFormat
  /** Refuses any field not listed, on top of the identifier check. Pass `schemaFields(schema)`. */
  fields?: ReadonlySet<string>
}

/** Checks every field and operator, so a hand-built filter can't smuggle a name in. */
function walkLeaves(node: FilterNode, visit: (leaf: FilterLeaf) => void) {
  if ("and" in node) for (const child of node.and) walkLeaves(child, visit)
  else if ("or" in node) for (const child of node.or) walkLeaves(child, visit)
  else if ("not" in node) walkLeaves(node.not, visit)
  else visit(node)
}

function checked(node: FilterNode, fields: ReadonlySet<string> | undefined) {
  walkLeaves(node, (leaf) => {
    assertFieldName(leaf.field, fields)
    assertLeaf(leaf)
  })
  return node
}

/** Flattens nested `and`s and pushes every `not` down; throws when an `or` is left, which flat params can't hold. */
function andLeaves(node: FilterNode, format: string): FilterLeaf[] {
  if ("and" in node) return node.and.flatMap((child) => andLeaves(child, format))
  if ("not" in node) {
    const pushed = negate(node.not)
    if ("not" in pushed) throw new FilterSerializeError(`${format} can't negate "${(pushed.not as FilterLeaf).op}".`)
    return andLeaves(pushed, format)
  }
  if ("or" in node)
    throw new FilterSerializeError(
      `${format} carries only "and"; use rsql, odata, springFilter, graphqlWhere or jsonAst.`,
    )
  return [node]
}

type QueryParamStyle = "dto" | "suffix" | "bracket"

const dtoSuffix: Record<FilterOp, string> = {
  eq: "",
  neq: "Not",
  lt: "Before",
  lte: "To",
  gt: "After",
  gte: "From",
  in: "",
  nin: "NotIn",
  contains: "Contains",
  startsWith: "StartsWith",
  endsWith: "EndsWith",
  isNull: "IsNull",
}

const snakeOp: Record<FilterOp, string> = {
  eq: "eq",
  neq: "neq",
  lt: "lt",
  lte: "lte",
  gt: "gt",
  gte: "gte",
  in: "in",
  nin: "nin",
  contains: "contains",
  startsWith: "starts_with",
  endsWith: "ends_with",
  isNull: "is_null",
}

function camel(path: string) {
  return path.replaceAll(/\.([A-Za-z0-9_])/g, (_match, letter: string) => letter.toUpperCase())
}

function paramName(field: string, op: FilterOp, style: QueryParamStyle) {
  if (style === "dto") return camel(field) + dtoSuffix[op]
  if (style === "suffix") return op === "eq" ? field : `${field}_${snakeOp[op]}`
  return `${field}[${op}]`
}

type QueryParamsOptions = SerializeOptions & {
  /**
   * `"suffix"` (default): `status=open`, `created_gte=…`. `"dto"`: `createdFrom`, `createdTo`, `statusNotIn`, as a
   * request DTO names them. `"bracket"`: `created[gte]=…`, `status[in]=…`.
   */
  style?: QueryParamStyle
  /** `"repeat"` (default) sends `status=a&status=b`; `"comma"` sends `status=a,b` and refuses a value with a comma. */
  arrays?: "repeat" | "comma"
  /** Names a param yourself; return `undefined` to use the style's name. */
  name?: (field: string, op: FilterOp) => string | undefined
}

/** Flat query params, `and` only: a backend DTO, json-server, Django filters or bracket params. */
function queryParams(ast: FilterNode | null | undefined, options: QueryParamsOptions = {}): URLSearchParams {
  const { style = "suffix", arrays = "repeat", dates } = options
  const params = new URLSearchParams()
  if (!ast) return params
  for (const leaf of andLeaves(checked(ast, options.fields), "queryParams")) {
    const name = options.name?.(leaf.field, leaf.op) ?? paramName(leaf.field, leaf.op, style)
    const texts = valuesOf(leaf).map((value) => scalarText(value, dates, leaf.type === "date"))
    if (arrays === "comma" && texts.length > 1) {
      if (texts.some((text) => text.includes(",")))
        throw new FilterSerializeError(`A value of "${leaf.field}" holds a comma; use arrays: "repeat".`)
      params.append(name, texts.join(","))
    } else for (const text of texts) params.append(name, text)
  }
  return params
}

type JsonScalar = string | number | boolean | null
type JsonFilterLeaf = { field: string; op: FilterOp; value: JsonScalar | JsonScalar[]; type?: "date" }
type JsonFilterNode = { and: JsonFilterNode[] } | { or: JsonFilterNode[] } | { not: JsonFilterNode } | JsonFilterLeaf

function jsonScalar(value: FilterScalar, dates: DateFormat | undefined, isDate: boolean): JsonScalar {
  if (value === null || typeof value === "boolean") return value
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new FilterSerializeError(`${String(value)} can't be sent as JSON.`)
    return value
  }
  const text = scalarText(value, dates, isDate)
  return dates === "epoch-ms" && (isDate || typeof value !== "string") ? Number(text) : text
}

function toJson(node: FilterNode, dates: DateFormat | undefined): JsonFilterNode {
  if ("and" in node) return { and: node.and.map((child) => toJson(child, dates)) }
  if ("or" in node) return { or: node.or.map((child) => toJson(child, dates)) }
  if ("not" in node) return { not: toJson(node.not, dates) }
  const isDate = node.type === "date"
  const value = Array.isArray(node.value)
    ? valuesOf(node).map((item) => jsonScalar(item, dates, isDate))
    : jsonScalar(node.value as FilterScalar, dates, isDate)
  return isDate ? { field: node.field, op: node.op, value, type: "date" } : { field: node.field, op: node.op, value }
}

/** The filter as plain JSON for a POST body: the whole grammar, nothing to escape. Validate it again on the server. */
function jsonAst(ast: FilterNode | null | undefined, options: SerializeOptions = {}): JsonFilterNode | null {
  if (!ast) return null
  return toJson(checked(ast, options.fields), options.dates)
}

/** Only free text, for a backend that takes nothing but `q`: every text field's words, joined by spaces. */
function searchOnly<S extends FilterSchema>(
  schema: S,
  values: FilterValues<S>,
  options: { param?: string } = {},
): Record<string, string> {
  const param = assertFieldName(options.param ?? "q")
  const words: string[] = []
  for (const [key, field] of Object.entries(schema)) {
    if (field.kind !== "text") continue
    const value = (values as Record<string, unknown>)[key]
    if (typeof value === "string" && value.trim() !== "") words.push(value.trim())
  }
  return words.length === 0 ? {} : { [param]: words.join(" ") }
}

export { andLeaves, checked, jsonAst, queryParams, searchOnly, walkLeaves }
export type { JsonFilterLeaf, JsonFilterNode, JsonScalar, QueryParamsOptions, QueryParamStyle, SerializeOptions }
