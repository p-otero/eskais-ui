"use client"

// Internal to Form: its shape changes without notice. Apps import from `@/components/ui/form` (`useFormInstance`,
// `useFormWatch`, `useFormFieldArray`, `useFormField`), never from this file.

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import type { StandardSchemaV1 } from "@standard-schema/spec"
import { createContext, useContext } from "react"
import type { FieldError, FieldErrors, FieldValues, Resolver, UseFormReturn } from "react-hook-form"

import type { FieldLabelPlacement } from "@/components/ui/field"
import {
  issueFromInput,
  issueFromSchema,
  issuePath,
  resolveFormMessage,
  type FormErrorInput,
  type FormIssue,
  type FormMessages,
} from "@/components/ui/form-messages"

type SubmitInterceptor = {
  /** `false` stops the submit before validation. */
  beforeSubmit?: () => boolean | Promise<boolean>
  onInvalid?: (errors: FieldErrors) => void
  onError?: (error: unknown) => void
}

type FormContextValue = {
  form: UseFormReturn<FieldValues>
  messages?: FormMessages
  labelPlacement?: FieldLabelPlacement
  pending: boolean
  disabled: boolean
  fields: Map<string, string | undefined>
  setRoot: (root: HTMLElement | null) => void
  setConfirm: (confirm: boolean) => void
  /** FormActions holds submits while it is disabled or forced pending by the app. */
  setBlocked: (blocked: boolean) => void
  /** A StepForm takes over submits: Next on its earlier steps, and the step to show after errors. */
  setInterceptor: (interceptor: SubmitInterceptor | null) => void
  /** Puts an error in any shape `onSubmit` may throw on its fields and the root error. */
  applyError: (error: unknown) => void
  /** Moves focus to the first invalid field, or the root error, after the next render. */
  requestFocus: () => void
  /** Whether the schema rejects this field when it is empty; `false` when that can't be told synchronously. */
  requires: (name: string) => boolean
  requiredLabel?: string
}

const FormContext = createContext<FormContextValue | null>(null)

function emptyLike(value: unknown) {
  if (value === null) return null
  if (typeof value === "string") return ""
  if (Array.isArray(value)) return []
  if (typeof value === "boolean") return false
  return undefined
}

function withValueAt(values: unknown, path: string[], value: unknown): unknown {
  const [key, ...rest] = path
  if (key === undefined) return value
  const source = values && typeof values === "object" ? (values as Record<string, unknown>) : {}
  const copy = (Array.isArray(source) ? [...source] : { ...source }) as Record<string, unknown>
  copy[key] = withValueAt(source[key], rest, value)
  return copy
}

/**
 * Probes the schema with each field emptied in turn: a field is required when that alone gives it an issue. This
 * reads any Standard Schema, but only one that reports every issue (Zod, Valibot, ArkType) and validates
 * synchronously; an async schema marks nothing.
 */
function requiredProbe(schema: StandardSchemaV1, defaults: unknown) {
  const cache = new Map<string, boolean>()
  return (name: string) => {
    const known = cache.get(name)
    if (known !== undefined) return known
    const path = name.split(".")
    const values = withValueAt(defaults, path, emptyLike(valueAt(defaults, path)))
    let required = false
    try {
      const result = schema["~standard"].validate(values)
      if (!(result instanceof Promise)) required = (result.issues ?? []).some((issue) => issuePath(issue) === name)
    } catch {
      required = false
    }
    cache.set(name, required)
    return required
  }
}

function valueAt(values: unknown, path: string[]) {
  let current = values
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

function useFormContext(part: string) {
  const context = useContext(FormContext)
  if (!context) throw new Error(`${part} must be inside a Form.`)
  return context
}

type IssueError = FieldError & { params?: Record<string, unknown> }

function errorAt(errors: Record<string, unknown>, path: string) {
  let current: unknown = errors
  for (const key of path.split(".")) {
    if (!current || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current as IssueError | undefined
}

/**
 * `standardSchemaResolver` keeps only each issue's message. This wraps the schema to see the issues too, and writes
 * each one's code and params onto the error at its path, so messages can be translated from codes.
 */
function issueResolver(schema: StandardSchemaV1): Resolver<FieldValues> {
  let issues: readonly StandardSchemaV1.Issue[] = []
  const capture = (result: StandardSchemaV1.Result<unknown>) => {
    issues = result.issues ?? []
    return result
  }
  const watched: StandardSchemaV1 = {
    "~standard": {
      ...schema["~standard"],
      validate: (value) => {
        const result = schema["~standard"].validate(value)
        return result instanceof Promise ? result.then(capture) : capture(result)
      },
    },
  }
  const resolve = standardSchemaResolver(watched as StandardSchemaV1<FieldValues>) as Resolver<FieldValues>
  return async (values, context, options) => {
    const result = await resolve(values, context, options)
    const seen = new Set<string>()
    for (const issue of issues) {
      const path = issuePath(issue)
      if (seen.has(path)) continue
      seen.add(path)
      const error = errorAt(result.errors, path)
      if (!error) continue
      const parsed = issueFromSchema(issue, values)
      error.type = parsed.code
      error.params = parsed.params
      error.message = parsed.message
    }
    return result
  }
}

function toFieldError(input: FormErrorInput): IssueError {
  const issue = issueFromInput(input, "")
  return { type: issue.code, message: issue.message, params: issue.params }
}

function issueFromError(error: IssueError, field: string, label?: string): FormIssue {
  return {
    code: error.type || "invalid",
    field,
    label,
    params: error.params ?? {},
    message: error.message,
  }
}

function errorText(
  error: IssueError,
  field: string,
  label: string | undefined,
  ...layers: (FormMessages | undefined)[]
) {
  return resolveFormMessage(issueFromError(error, field, label), ...layers)
}

export { FormContext, errorAt, errorText, issueResolver, requiredProbe, toFieldError, useFormContext }
export type { FormContextValue, IssueError, SubmitInterceptor }
