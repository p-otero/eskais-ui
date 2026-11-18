import { valuesOf, type FilterLeaf, type FilterNode, type FilterScalar } from "@/lib/filter-ast"
import { checked, jsonAst, type JsonScalar, type SerializeOptions } from "@/lib/filter-serializers"

type GraphqlWhereOptions = SerializeOptions & {
  /** `"hasura"` (default): `_and`, `_eq`, `_ilike`. `"prisma"`: `AND`, `equals`, `contains`. */
  dialect?: "hasura" | "prisma"
  /** Text matches without regard to case: Hasura `_ilike` (default) or Prisma `mode: "insensitive"`. */
  caseInsensitive?: boolean
}

type GraphqlWhere = { [key: string]: GraphqlValue }
type GraphqlValue = JsonScalar | GraphqlValue[] | GraphqlWhere

const hasuraOps = {
  eq: "_eq",
  neq: "_neq",
  lt: "_lt",
  lte: "_lte",
  gt: "_gt",
  gte: "_gte",
  in: "_in",
  nin: "_nin",
}
const prismaOps = {
  eq: "equals",
  neq: "not",
  lt: "lt",
  lte: "lte",
  gt: "gt",
  gte: "gte",
  in: "in",
  nin: "notIn",
  contains: "contains",
  startsWith: "startsWith",
  endsWith: "endsWith",
}

// Postgres LIKE escapes with a backslash by default, so the text matches itself and nothing more.
function likeText(text: string) {
  return text.replaceAll(/[\\%_]/g, (match) => `\\${match}`)
}

function nest(field: string, condition: GraphqlValue): GraphqlWhere {
  return field
    .split(".")
    .reduceRight<GraphqlValue>((inner, segment) => ({ [segment]: inner }), condition) as GraphqlWhere
}

function scalar(leaf: FilterLeaf, value: FilterScalar, options: GraphqlWhereOptions): JsonScalar {
  const json = jsonAst({ ...leaf, op: "eq", value }, { dates: options.dates }) as { value: JsonScalar }
  return json.value
}

function hasuraLeaf(leaf: FilterLeaf, options: GraphqlWhereOptions): GraphqlWhere {
  if (leaf.op === "isNull") return nest(leaf.field, { _is_null: leaf.value === true })
  if (leaf.op === "contains" || leaf.op === "startsWith" || leaf.op === "endsWith") {
    const text = likeText(String(leaf.value))
    const pattern = leaf.op === "contains" ? `%${text}%` : leaf.op === "startsWith" ? `${text}%` : `%${text}`
    return nest(leaf.field, { [options.caseInsensitive === false ? "_like" : "_ilike"]: pattern })
  }
  const value =
    leaf.op === "in" || leaf.op === "nin"
      ? valuesOf(leaf).map((item) => scalar(leaf, item, options))
      : scalar(leaf, leaf.value as FilterScalar, options)
  return nest(leaf.field, { [hasuraOps[leaf.op]]: value })
}

function prismaLeaf(leaf: FilterLeaf, options: GraphqlWhereOptions): GraphqlWhere {
  if (leaf.op === "isNull") return nest(leaf.field, leaf.value === true ? { equals: null } : { not: null })
  const value =
    leaf.op === "in" || leaf.op === "nin"
      ? valuesOf(leaf).map((item) => scalar(leaf, item, options))
      : scalar(leaf, leaf.value as FilterScalar, options)
  const text = leaf.op === "contains" || leaf.op === "startsWith" || leaf.op === "endsWith"
  const condition: GraphqlWhere = { [prismaOps[leaf.op]]: value }
  if (text && options.caseInsensitive !== false) condition.mode = "insensitive"
  return nest(leaf.field, condition)
}

function toWhere(node: FilterNode, options: GraphqlWhereOptions): GraphqlWhere {
  const prisma = options.dialect === "prisma"
  if ("and" in node) return { [prisma ? "AND" : "_and"]: node.and.map((child) => toWhere(child, options)) }
  if ("or" in node) return { [prisma ? "OR" : "_or"]: node.or.map((child) => toWhere(child, options)) }
  if ("not" in node) return { [prisma ? "NOT" : "_not"]: toWhere(node.not, options) }
  return prisma ? prismaLeaf(node, options) : hasuraLeaf(node, options)
}

/** A typed `where` input for GraphQL variables, never spliced into the query text. `{}` matches everything. */
function graphqlWhere(ast: FilterNode | null | undefined, options: GraphqlWhereOptions = {}): GraphqlWhere {
  if (!ast) return {}
  return toWhere(checked(ast, options.fields), options)
}

export { graphqlWhere }
export type { GraphqlValue, GraphqlWhere, GraphqlWhereOptions }
