"use client"

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import type { StandardSchemaV1 } from "@standard-schema/spec"
import { createContext, useContext } from "react"
import type { FieldError, FieldValues, Resolver, UseFormReturn } from "react-hook-form"

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

type FormContextValue = {
  form: UseFormReturn<FieldValues>
  messages?: FormMessages
  labelPlacement?: FieldLabelPlacement
  pending: boolean
  disabled: boolean
  fields: Map<string, string | undefined>
  setRoot: (root: HTMLElement | null) => void
  setConfirm: (confirm: boolean) => void
}

const FormContext = createContext<FormContextValue | null>(null)

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

export { FormContext, errorAt, errorText, issueResolver, toFieldError, useFormContext }
export type { FormContextValue, IssueError }
