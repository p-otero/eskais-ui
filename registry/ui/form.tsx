"use client"

import type { StandardSchemaV1 } from "@standard-schema/spec"
import { createParts } from "@ui-sdk/react/primitive"
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react"
import { useForm, type DefaultValues, type FieldValues, type Path, type UseFormReturn } from "react-hook-form"

import type { FieldLabelPlacement } from "@/components/ui/field"
import { FormContext, issueResolver, toFieldError, type FormContextValue } from "@/components/ui/form-context"
import { toFormErrors, type FormErrorInput, type FormMessages } from "@/components/ui/form-messages"
import { formRoot } from "@/components/ui/form-primitive"
import { cn } from "@/lib/utils"

const { Root: FormRoot } = createParts(formRoot, { root: "form" })

type FormSubmitHelpers<Values extends FieldValues> = {
  /** Shows an error on a field, or on the form with `"root"`: text, or `{ code, params }` for `messages`. */
  setError: (name: Path<Values> | "root", error: FormErrorInput) => void
  form: UseFormReturn<Values>
}

type FormProps<Schema extends StandardSchemaV1> = {
  schema: Schema
  defaultValues?: DefaultValues<StandardSchemaV1.InferInput<Schema> & FieldValues>
  /**
   * Runs with the parsed values once they pass the schema. A returned Promise keeps the form pending. A thrown
   * `FormServerError`, `{ fieldErrors, message }` or issue list maps to the fields and the root error; any other
   * error shows its message in `FormRootError`.
   */
  onSubmit: (
    values: StandardSchemaV1.InferOutput<Schema>,
    helpers: FormSubmitHelpers<StandardSchemaV1.InferInput<Schema> & FieldValues>,
  ) => unknown
  /** A dictionary (`formMessagesEs`) or a function of the issue, for any i18n library; English by default. */
  messages?: FormMessages
  /** Where each FormField's label sits by default: `top`, or `in`/`on` for its text controls (see Field). */
  labelPlacement?: FieldLabelPlacement
  /** Fields are disabled while `onSubmit` runs; `false` keeps them editable. */
  disableWhilePending?: boolean
  /** The form's accessible name. Without it (or `aria-labelledby`), agents use its fields and buttons only. */
  label?: string
  "aria-labelledby"?: string
  onPendingChange?: (pending: boolean) => void
  onDirtyChange?: (dirty: boolean) => void
  id?: string
  className?: string
  children?: ReactNode
}

const tabbable =
  'input:not([type="hidden"]), textarea, select, button, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'

function focusTarget(form: HTMLFormElement, root: HTMLElement | null) {
  for (const field of form.querySelectorAll<HTMLElement>('[data-slot="field"][data-invalid]')) {
    for (const candidate of field.querySelectorAll<HTMLElement>(tabbable)) {
      if (candidate.tabIndex < 0 || candidate.matches(":disabled") || candidate.closest('[aria-hidden="true"]'))
        continue
      return candidate
    }
  }
  return root
}

function Form<Schema extends StandardSchemaV1>({
  schema,
  defaultValues,
  onSubmit,
  messages,
  labelPlacement,
  disableWhilePending = true,
  label,
  "aria-labelledby": labelledBy,
  onPendingChange,
  onDirtyChange,
  id,
  className,
  children,
}: FormProps<Schema>) {
  type Values = StandardSchemaV1.InferInput<Schema> & FieldValues
  const resolver = useMemo(() => issueResolver(schema), [schema])
  const form = useForm<Values>({ resolver, defaultValues, shouldFocusError: false })
  const [pending, setPending] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [focusRequest, setFocusRequest] = useState(0)
  const element = useRef<HTMLFormElement>(null)
  const rootElement = useRef<HTMLElement | null>(null)
  const running = useRef(false)
  const restoreFocus = useRef<Element | null>(null)
  const [fields] = useState(() => new Map<string, string | undefined>())
  const dirty = form.formState.isDirty

  useEffect(() => onPendingChange?.(pending), [pending, onPendingChange])
  // Disabling the fields drops focus to the body; give it back once they are enabled again.
  useEffect(() => {
    const previous = restoreFocus.current
    if (pending || !(previous instanceof HTMLElement)) return
    restoreFocus.current = null
    if (document.activeElement === document.body || document.activeElement === null) previous.focus()
  }, [pending])
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])
  useEffect(() => {
    if (focusRequest === 0 || !element.current) return
    focusTarget(element.current, rootElement.current)?.focus()
  }, [focusRequest])

  const setError: FormSubmitHelpers<Values>["setError"] = (name, error) =>
    form.setError(name === "root" ? "root.server" : name, toFieldError(error))

  const applyError = (error: unknown) => {
    const parsed = toFormErrors(error)
    if (!parsed) {
      setError("root", error instanceof Error ? error.message : String(error))
      return
    }
    const unmapped: string[] = []
    for (const [name, fieldError] of Object.entries(parsed.fieldErrors ?? {})) {
      if (fields.has(name) || form.getValues(name as Path<Values>) !== undefined)
        setError(name as Path<Values>, fieldError)
      else unmapped.push(typeof fieldError === "string" ? fieldError : (fieldError.message ?? fieldError.code))
    }
    if (parsed.message !== undefined) setError("root", parsed.message)
    else if (unmapped.length) setError("root", unmapped.join("\n"))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (running.current) return
    running.current = true
    restoreFocus.current = document.activeElement
    let failed = false
    form.clearErrors("root")
    const submit = form.handleSubmit(
      async (values) => {
        setPending(true)
        try {
          await onSubmit(values as StandardSchemaV1.InferOutput<Schema>, { setError, form })
        } catch (error) {
          failed = true
          applyError(error)
        } finally {
          setPending(false)
        }
      },
      () => {
        failed = true
      },
    )
    try {
      await submit(event)
    } finally {
      running.current = false
      if (failed) {
        restoreFocus.current = null
        setFocusRequest((count) => count + 1)
      }
    }
  }

  const disabled = pending && disableWhilePending
  const context = useMemo<FormContextValue>(
    () => ({
      form: form as unknown as UseFormReturn<FieldValues>,
      messages,
      labelPlacement,
      pending,
      disabled,
      fields,
      setRoot: (root) => {
        rootElement.current = root
      },
      setConfirm,
    }),
    [form, messages, labelPlacement, pending, disabled, fields],
  )

  return (
    <FormContext.Provider value={context}>
      <FormRoot
        ref={element}
        id={id}
        noValidate
        named={Boolean(label || labelledBy)}
        confirm={confirm}
        onResetRequest={() => form.reset()}
        aria-label={label}
        aria-labelledby={labelledBy}
        aria-busy={pending || undefined}
        data-pending={pending ? "" : undefined}
        onSubmit={handleSubmit}
        onReset={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          form.reset()
        }}
        className={cn("flex min-w-0 flex-col gap-group", className)}
      >
        {children}
      </FormRoot>
    </FormContext.Provider>
  )
}

export { Form }
export { FieldSet } from "@/components/ui/field"
export type { FieldSetProps } from "@/components/ui/field"
export { FormActions, FormRootError } from "@/components/ui/form-actions"
export type { FormActionsProps, FormRootErrorProps } from "@/components/ui/form-actions"
export { FormField, formControlAdapters, useFormField } from "@/components/ui/form-field"
export type { FormControlAdapter, FormFieldProps, FormFieldState } from "@/components/ui/form-field"
export {
  FormServerError,
  createFormMessages,
  formMessagesEn,
  formMessagesEs,
  resolveFormMessage,
  toFormErrors,
} from "@/components/ui/form-messages"
export type {
  FormErrorInput,
  FormErrors,
  FormIssue,
  FormIssueCode,
  FormMessage,
  FormMessageDictionary,
  FormMessages,
} from "@/components/ui/form-messages"
export type { FormProps, FormSubmitHelpers }
