import type { StandardSchemaV1 } from "@standard-schema/spec"

import { isRecord } from "@/lib/narrow"

type FormIssueCode =
  | "required"
  | "minLength"
  | "maxLength"
  | "minItems"
  | "maxItems"
  | "min"
  | "max"
  | "email"
  | "url"
  | "pattern"
  | "invalid"
  | "server"
  | (string & {})

type FormIssue = {
  code: FormIssueCode
  /** The field's name, as a dot path like `address.city`; `root` for the form as a whole. */
  field: string
  /** The field's label, when it is a string. */
  label?: string
  /** Values the message may use, like `{ min: 3 }`. */
  params: Record<string, unknown>
  /** The schema's or the server's own text. */
  message?: string
}

/** A message: a string with `{param}` placeholders (`{label}` too), or a function of the issue. */
type FormMessage = string | ((issue: FormIssue) => string)

type FormMessageDictionary = Partial<Record<FormIssueCode, FormMessage>>

/** A dictionary, or a function that returns the text for an issue, `undefined` to fall back to the defaults. */
type FormMessages = FormMessageDictionary | ((issue: FormIssue) => string | undefined)

/** An error from your code or your server: plain text, or a code your `messages` translate. */
type FormErrorInput = string | { code: string; params?: Record<string, unknown>; message?: string }

type FormErrors = {
  fieldErrors?: Record<string, FormErrorInput>
  message?: FormErrorInput
}

const plural = (count: unknown, one: string, other: string) => (count === 1 ? one : other)

const formMessagesEn: FormMessageDictionary = {
  required: "This field is required.",
  minLength: ({ params }) => `Use at least ${String(params.min)} ${plural(params.min, "character", "characters")}.`,
  maxLength: ({ params }) => `Use at most ${String(params.max)} ${plural(params.max, "character", "characters")}.`,
  minItems: "Choose at least {min}.",
  maxItems: "Choose at most {max}.",
  min: "Enter {min} or more.",
  max: "Enter {max} or less.",
  email: "Enter a valid email address.",
  url: "Enter a valid URL.",
  pattern: "Use the expected format.",
}

const formMessagesEs: FormMessageDictionary = {
  required: "Este campo es obligatorio.",
  minLength: ({ params }) => `Escribe al menos ${String(params.min)} ${plural(params.min, "carácter", "caracteres")}.`,
  maxLength: ({ params }) =>
    `Escribe como máximo ${String(params.max)} ${plural(params.max, "carácter", "caracteres")}.`,
  minItems: "Elige al menos {min}.",
  maxItems: "Elige como máximo {max}.",
  min: "Introduce {min} o más.",
  max: "Introduce {max} o menos.",
  email: "Introduce un correo electrónico válido.",
  url: "Introduce una URL válida.",
  pattern: "Usa el formato indicado.",
}

function interpolate(template: string, issue: FormIssue) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (key === "label") return issue.label ?? ""
    const value = issue.params[key]
    return value === undefined ? match : String(value)
  })
}

function fromLayer(layer: FormMessages | undefined, issue: FormIssue) {
  if (!layer) return undefined
  if (typeof layer === "function") return layer(issue)
  const message = layer[issue.code]
  if (message === undefined) return undefined
  return typeof message === "function" ? message(issue) : interpolate(message, issue)
}

/** The text for an issue: the first layer that has one, then English, then the issue's own message, then its code. */
function resolveFormMessage(issue: FormIssue, ...layers: (FormMessages | undefined)[]) {
  for (const layer of [...layers, formMessagesEn]) {
    const message = fromLayer(layer, issue)
    if (message !== undefined) return message
  }
  return issue.message ?? issue.code
}

/** Messages from a `t(key, params)` function (i18next, FormatJS, Lingui…): keys are `<prefix>.<code>`, unless the code already starts with the prefix. */
function createFormMessages(
  t: (key: string, params: Record<string, unknown>) => string | undefined,
  prefix = "form",
): (issue: FormIssue) => string | undefined {
  return (issue) => {
    const key = issue.code.startsWith(`${prefix}.`) ? issue.code : `${prefix}.${issue.code}`
    const text = t(key, { ...issue.params, field: issue.label })
    return text === undefined || text === key ? undefined : text
  }
}

const translationKey = /^[A-Za-z_$][\w$-]*(\.[\w$-]+)+$/

const builtInCodes = new Set<string>([
  "required",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "min",
  "max",
  "email",
  "url",
  "pattern",
  "invalid",
])

const codedPrefix = "@@form:"

/**
 * A schema message that carries its code and params, for schemas whose issues have no codes, like Effect Schema:
 * `@@form:<code>` or `@@form:<code>|<JSON params>`. Any code round-trips, built-in or a dotted key. A plain dotted
 * key (`"form.name.taken"`) and the earlier `<code>|<JSON params>` still read as coded.
 */
function formIssueMessage(code: string, params?: Record<string, unknown>) {
  const head = `${codedPrefix}${code}`
  return params === undefined || Object.keys(params).length === 0 ? head : `${head}|${JSON.stringify(params)}`
}

function paramsFrom(json: string): Record<string, unknown> | undefined {
  try {
    const params: unknown = JSON.parse(json)
    if (isRecord(params) && !Array.isArray(params)) return params
  } catch {
    return undefined
  }
  return undefined
}

function codedMessage(message: string): Pick<FormIssue, "code" | "params"> | undefined {
  const prefixed = message.startsWith(codedPrefix)
  const body = prefixed ? message.slice(codedPrefix.length) : message
  const split = body.indexOf("|")
  const code = split < 0 ? body : body.slice(0, split)
  if (prefixed) {
    if (!code) return undefined
    return { code, params: split < 0 ? {} : (paramsFrom(body.slice(split + 1)) ?? {}) }
  }
  if (!translationKey.test(code) && !(split >= 0 && builtInCodes.has(code))) return undefined
  if (split < 0) return { code, params: {} }
  const params = paramsFrom(body.slice(split + 1))
  return params && { code, params }
}

function isEmptyValue(value: unknown) {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)
}

function bound(value: unknown) {
  return typeof value === "bigint" ? Number(value) : value
}

function vendorCode(issue: Record<string, unknown>, value: unknown): Pick<FormIssue, "code" | "params"> | undefined {
  const code = issue.code
  const kind = issue.origin ?? issue.type
  const many = Array.isArray(value) || kind === "array" || kind === "set"
  const text = typeof value === "string" || kind === "string"
  if (code === "too_small") {
    const min = bound(issue.minimum)
    if (text && min === 1) return { code: "required", params: {} }
    return { code: many ? "minItems" : text ? "minLength" : "min", params: { min } }
  }
  if (code === "too_big") {
    const max = bound(issue.maximum)
    return { code: many ? "maxItems" : text ? "maxLength" : "max", params: { max } }
  }
  const format = code === "invalid_format" ? issue.format : code === "invalid_string" ? issue.validation : undefined
  if (format === "email" || format === "url") return { code: format, params: {} }
  if (format !== undefined) return { code: "pattern", params: { pattern: String(issue.pattern ?? format) } }

  switch (issue.type) {
    case "non_empty":
      return { code: "required", params: {} }
    case "min_length":
      return { code: many ? "minItems" : "minLength", params: { min: issue.requirement } }
    case "max_length":
      return { code: many ? "maxItems" : "maxLength", params: { max: issue.requirement } }
    case "min_value":
      return { code: "min", params: { min: issue.requirement } }
    case "max_value":
      return { code: "max", params: { max: issue.requirement } }
    case "email":
    case "url":
      return { code: issue.type, params: {} }
    case "regex":
      return { code: "pattern", params: { pattern: String(issue.requirement) } }
    default:
      return undefined
  }
}

function issuePath(issue: StandardSchemaV1.Issue) {
  if (!issue.path?.length) return "root"
  return issue.path.map((segment) => String(typeof segment === "object" ? segment.key : segment)).join(".")
}

function valueAt(values: unknown, path: string) {
  let current = values
  for (const key of path.split(".")) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }
  return current
}

/**
 * Gives a Standard Schema issue a stable code: a coded message (`formIssueMessage`) as its code and params, with no
 * `message`; `required` for an empty value; the known Zod and Valibot validators with their bounds; else `invalid`
 * with the schema's message.
 */
function issueFromSchema(issue: StandardSchemaV1.Issue, values?: unknown): FormIssue {
  const field = issuePath(issue)
  const coded = codedMessage(issue.message)
  if (coded) return { ...coded, field, message: undefined }
  const value = field === "root" ? values : valueAt(values, field)
  const known =
    values !== undefined && isEmptyValue(value) && field !== "root"
      ? { code: "required", params: {} }
      : isRecord(issue)
        ? vendorCode(issue, value)
        : undefined
  return { ...(known ?? { code: "invalid", params: {} }), field, message: issue.message }
}

function issueFromInput(input: FormErrorInput, field: string): FormIssue {
  if (typeof input === "string") return { code: "server", field, params: {}, message: input }
  return { code: input.code, field, params: input.params ?? {}, message: input.message }
}

/** Throw it from `onSubmit`: its field errors go to their fields and its message to `FormRootError`. */
class FormServerError extends Error {
  fieldErrors: Record<string, FormErrorInput>
  code?: string
  params?: Record<string, unknown>

  constructor(message: FormErrorInput = "", fieldErrors: Record<string, FormErrorInput> = {}) {
    super(typeof message === "string" ? message : (message.message ?? message.code))
    this.name = "FormServerError"
    this.fieldErrors = fieldErrors
    if (typeof message !== "string") {
      this.code = message.code
      this.params = message.params
    }
  }
}

function isIssueList(value: unknown): value is readonly StandardSchemaV1.Issue[] {
  return Array.isArray(value) && value.every((item) => item && typeof item === "object" && "message" in item)
}

function isErrorInput(value: unknown): value is FormErrorInput {
  return typeof value === "string" || (isRecord(value) && typeof value.code === "string")
}

/** The field errors an app threw, keeping the entries in a shape `FormErrorInput` describes. */
function errorInputs(value: unknown): Record<string, FormErrorInput> | undefined {
  if (!isRecord(value)) return undefined
  const inputs: Record<string, FormErrorInput> = {}
  for (const [field, input] of Object.entries(value)) if (isErrorInput(input)) inputs[field] = input
  return inputs
}

function toIssueInput(issue: FormIssue): FormErrorInput {
  return { code: issue.code, params: issue.params, message: issue.message }
}

/**
 * Reads errors in any of the shapes `onSubmit` may throw: a `FormServerError`, `{ fieldErrors, message }`, a Standard
 * Schema issue list or `{ issues }`. Anything else returns `undefined`.
 */
function toFormErrors(error: unknown): FormErrors | undefined {
  if (error instanceof FormServerError) {
    const message = error.code ? { code: error.code, params: error.params, message: error.message } : error.message
    return { fieldErrors: error.fieldErrors, message: message || undefined }
  }
  const issues = isIssueList(error) ? error : isRecord(error) && isIssueList(error.issues) ? error.issues : undefined
  if (issues) {
    const result: FormErrors = { fieldErrors: {} }
    for (const issue of issues) {
      const parsed = issueFromSchema(issue)
      if (parsed.field === "root") result.message ??= toIssueInput(parsed)
      else result.fieldErrors![parsed.field] ??= toIssueInput(parsed)
    }
    return result
  }
  if (error instanceof Error || !isRecord(error)) return undefined
  const fieldErrors = errorInputs(error.fieldErrors)
  const message = isErrorInput(error.message) ? error.message : undefined
  if (fieldErrors === undefined && message === undefined) return undefined
  return { fieldErrors, message }
}

export {
  FormServerError,
  createFormMessages,
  formIssueMessage,
  formMessagesEn,
  formMessagesEs,
  issueFromInput,
  issueFromSchema,
  issuePath,
  resolveFormMessage,
  toFormErrors,
}
export type { FormErrorInput, FormErrors, FormIssue, FormIssueCode, FormMessage, FormMessageDictionary, FormMessages }
