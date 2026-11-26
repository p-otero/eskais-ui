"use client"

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import type { StandardSchemaV1 } from "@standard-schema/spec"
import type { PasswordInputController } from "@ui-sdk/react/password-input"
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
import { assumeType, isRecord } from "@/lib/narrow"

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
  /** The sensitive fields, by name: read into the form's values only for a submit or a step's validation. */
  secrets: Map<string, PasswordInputController>
  setRoot: (root: HTMLElement | null) => void
  setConfirm: (confirm: boolean) => void
  /** While `true`, submits are held. */
  setBlocked: (blocked: boolean) => void
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

const quietly = { shouldDirty: false, shouldValidate: false, shouldTouch: false }

/** Copies each sensitive field's value into the form's values, for validation and the submit that follows. */
function loadSecrets(form: UseFormReturn<FieldValues>, secrets: Map<string, PasswordInputController>) {
  for (const [name, controller] of secrets) form.setValue(name, controller.getValue(), quietly)
}

/** Empties the sensitive fields in the form's values; their controls keep what's typed. */
function forgetSecrets(form: UseFormReturn<FieldValues>, secrets: Map<string, PasswordInputController>) {
  for (const name of secrets.keys()) form.setValue(name, "", quietly)
}

/** Empties the sensitive controls themselves, after a submit succeeds or the form resets. */
function clearSecrets(secrets: Map<string, PasswordInputController>) {
  for (const controller of secrets.values()) controller.clear()
}

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
  const source: Record<string, unknown> = isRecord(values) ? values : {}
  const copy: object = Array.isArray(source) ? [...source] : { ...source }
  Reflect.set(copy, key, withValueAt(source[key], rest, value))
  return copy
}

/**
 * A field is required when emptying it alone gives it an issue. Needs a synchronous schema that reports every issue
 * (Zod, Valibot, ArkType); an async one marks nothing.
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
    if (!isRecord(current)) return undefined
    current = current[key]
  }
  return current
}

function useFormContext(part: string) {
  const context = useContext(FormContext)
  if (!context) throw new Error(`${part} must be inside a Form.`)
  return context
}

type IssueError = FieldError & { params?: Record<string, unknown> }

/** A field's error, or the form's root error. */
type ErrorLike = { type?: string | number; message?: string; params?: Record<string, unknown> }

function errorAt(errors: Record<string, unknown>, path: string) {
  let current: unknown = errors
  for (const key of path.split(".")) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }
  return isRecord(current) ? current : undefined
}

/** `standardSchemaResolver`, plus each issue's code and params on its error, so messages translate from codes. */
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
  // Workaround: standardSchemaResolver takes its generics from declared types an untyped Standard Schema doesn't carry.
  const resolve = standardSchemaResolver(assumeType<StandardSchemaV1<FieldValues, FieldValues>>(watched))
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

function issueFromError(error: ErrorLike, field: string, label?: string): FormIssue {
  return {
    code: error.type ? String(error.type) : "invalid",
    field,
    label,
    params: error.params ?? {},
    message: error.message,
  }
}

function errorText(
  error: ErrorLike,
  field: string,
  label: string | undefined,
  ...layers: (FormMessages | undefined)[]
) {
  return resolveFormMessage(issueFromError(error, field, label), ...layers)
}

export {
  FormContext,
  clearSecrets,
  errorAt,
  errorText,
  forgetSecrets,
  issueResolver,
  loadSecrets,
  requiredProbe,
  toFieldError,
  useFormContext,
}
export type { ErrorLike, FormContextValue, IssueError, SubmitInterceptor }
