"use client"

import type { StandardSchemaV1 } from "@standard-schema/spec"
import { createParts } from "@ui-sdk/react/primitive"
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react"
import type { PasswordInputController } from "@ui-sdk/react/password-input"
import { useForm, type DefaultValues, type FieldValues, type Path, type UseFormReturn } from "react-hook-form"

import { FieldLabelPlacementDefault, type FieldLabelPlacement } from "@/components/ui/field"
import {
  FormContext,
  clearSecrets,
  forgetSecrets,
  issueResolver,
  loadSecrets,
  requiredProbe,
  toFieldError,
  type FormContextValue,
  type SubmitInterceptor,
} from "@/components/ui/form-context"
import { toFormErrors, type FormErrorInput, type FormMessages } from "@/components/ui/form-messages"
import { formRoot } from "@/components/ui/form-primitive"
import { useFocusRequest, useReportChange, useRestoreFocusAfterPending } from "@/components/ui/use-form-sync"
import { assumeType } from "@/lib/narrow"
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
  /**
   * Words screen readers hear after a required field's label, like "required", in the page's language. Unset, the
   * marker is only visual and the control's own `required` state is announced; set, the words join the field's name.
   */
  requiredLabel?: string
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

function setFormError(form: UseFormReturn<FieldValues>, name: string, error: FormErrorInput) {
  form.setError(name === "root" ? "root.server" : name, toFieldError(error))
}

function applyFormError(form: UseFormReturn<FieldValues>, fields: Map<string, unknown>, error: unknown) {
  const parsed = toFormErrors(error)
  if (!parsed) {
    setFormError(form, "root", error instanceof Error ? error.message : String(error))
    return
  }
  const unmapped: string[] = []
  for (const [name, fieldError] of Object.entries(parsed.fieldErrors ?? {})) {
    if (fields.has(name) || form.getValues(name) !== undefined) setFormError(form, name, fieldError)
    else unmapped.push(typeof fieldError === "string" ? fieldError : (fieldError.message ?? fieldError.code))
  }
  if (parsed.message !== undefined) setFormError(form, "root", parsed.message)
  else if (unmapped.length) setFormError(form, "root", unmapped.join("\n"))
}

// Workaround: React Compiler 1.0 can't compile a component that holds a try/finally.
async function settle<T>(task: () => T | Promise<T>, cleanup: () => void): Promise<T> {
  try {
    return await task()
  } finally {
    cleanup()
  }
}

function Form<Schema extends StandardSchemaV1>({
  schema,
  defaultValues,
  onSubmit,
  messages,
  requiredLabel,
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
  const [initialValues] = useState(defaultValues)
  const requires = useMemo(() => requiredProbe(schema, initialValues), [schema, initialValues])
  const form = useForm<Values>({ resolver, defaultValues, shouldFocusError: false })
  const [pending, setPending] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [focusRequest, setFocusRequest] = useState(0)
  const element = useRef<HTMLFormElement>(null)
  const rootElement = useRef<HTMLElement | null>(null)
  const running = useRef(false)
  const blocked = useRef(false)
  const interceptor = useRef<SubmitInterceptor | null>(null)
  const restoreFocus = useRef<Element | null>(null)
  const [fields] = useState(() => new Map<string, string | undefined>())
  const [secrets] = useState(() => new Map<string, PasswordInputController>())
  const dirty = form.formState.isDirty

  useReportChange(pending, onPendingChange)
  useRestoreFocusAfterPending(pending, restoreFocus)
  useReportChange(dirty, onDirtyChange)
  useFocusRequest(focusRequest, () => {
    if (element.current) focusTarget(element.current, rootElement.current)?.focus()
  })

  // Workaround: react-hook-form's instance is invariant in its values, and the context takes UseFormReturn<FieldValues>.
  const untyped = assumeType<UseFormReturn<FieldValues>>(form)
  const setError: FormSubmitHelpers<Values>["setError"] = (name, error) => setFormError(untyped, name, error)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (running.current || blocked.current) return
    const intercept = interceptor.current
    const beforeSubmit = intercept?.beforeSubmit
    if (beforeSubmit) {
      running.current = true
      const proceed = await settle(beforeSubmit, () => {
        running.current = false
      })
      if (!proceed) return
    }
    running.current = true
    restoreFocus.current = document.activeElement
    let failed = false
    const fail = (error: unknown) => {
      failed = true
      intercept?.onError?.(error)
      applyFormError(untyped, fields, error)
    }
    form.clearErrors("root")
    loadSecrets(untyped, secrets)
    const submit = form.handleSubmit(
      async (values) => {
        setPending(true)
        await settle(
          async () => {
            try {
              await onSubmit(values as StandardSchemaV1.InferOutput<Schema>, { setError, form })
            } catch (error) {
              fail(error)
            }
          },
          () => setPending(false),
        )
      },
      (errors) => {
        failed = true
        intercept?.onInvalid?.(errors)
      },
    )
    await settle(
      () => submit(event),
      () => {
        running.current = false
        forgetSecrets(untyped, secrets)
        if (!failed) clearSecrets(secrets)
        if (failed) {
          restoreFocus.current = null
          setFocusRequest((count) => count + 1)
        }
      },
    )
  }

  const disabled = pending && disableWhilePending
  const context = useMemo<FormContextValue>(
    () => ({
      form: untyped,
      messages,
      labelPlacement,
      requiredLabel,
      requires,
      pending,
      disabled,
      fields,
      secrets,
      setRoot: (root) => {
        rootElement.current = root
      },
      setConfirm,
      setBlocked: (next) => {
        blocked.current = next
      },
      setInterceptor: (next) => {
        interceptor.current = next
      },
      applyError: (error) => applyFormError(untyped, fields, error),
      requestFocus: () => setFocusRequest((count) => count + 1),
    }),
    [untyped, messages, labelPlacement, requiredLabel, requires, pending, disabled, fields, secrets],
  )

  return (
    <FormContext.Provider value={context}>
      <FormRoot
        ref={element}
        id={id}
        noValidate
        named={Boolean(label || labelledBy)}
        confirm={confirm}
        onResetRequest={() => {
          form.reset()
          clearSecrets(secrets)
        }}
        aria-label={label}
        aria-labelledby={labelledBy}
        aria-busy={pending || undefined}
        data-pending={pending ? "" : undefined}
        onSubmit={handleSubmit}
        onReset={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          form.reset()
          clearSecrets(secrets)
        }}
        className={cn("flex min-w-0 flex-col gap-group", className)}
      >
        <FieldLabelPlacementDefault value={labelPlacement}>{children}</FieldLabelPlacementDefault>
      </FormRoot>
    </FormContext.Provider>
  )
}

export { Form, focusTarget }
export type { FormProps, FormSubmitHelpers }
