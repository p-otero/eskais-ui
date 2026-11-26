"use client"

import { createPasswordInputController, type PasswordInputController } from "@ui-sdk/react/password-input"
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react"
import { useController, type ControllerRenderProps, type FieldValues, type Path } from "react-hook-form"

import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  floatingLabelControls,
  padsItself,
  formControlAdapters,
  type FieldLabelPlacement,
  type FormControlAdapter,
} from "@/components/ui/field"
import { errorText, useFormContext } from "@/components/ui/form-context"
import type { FormMessages } from "@/components/ui/form-messages"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useFieldRegistration, useSensitiveField } from "@/components/ui/use-form-sync"
import { cn } from "@/lib/utils"

const valueAdapter: FormControlAdapter = { value: "value", change: "onValueChange" }
const textAdapter: FormControlAdapter = { ...valueAdapter, toControl: (value) => value ?? "", blur: true }
const checkedAdapter: FormControlAdapter = {
  value: "checked",
  change: "onCheckedChange",
  toControl: (value) => value ?? false,
}

formControlAdapters
  .set(Input, textAdapter)
  .set(Textarea, textAdapter)
  .set(Checkbox, checkedAdapter)
  .set(Switch, checkedAdapter)

type FormFieldState = {
  name: string
  value: unknown
  onChange: (value: unknown) => void
  onBlur: () => void
  ref: ControllerRenderProps<FieldValues>["ref"]
  invalid: boolean
  /** The error's text, translated. */
  error?: string
  disabled: boolean
  pending: boolean
}

const FormFieldContext = createContext<FormFieldState | null>(null)

function useFormField() {
  const field = useContext(FormFieldContext)
  if (!field) throw new Error("useFormField must be inside a FormField.")
  return field
}

type FormFieldProps<Values extends FieldValues = FieldValues> = {
  /** A path into the form's values, like `email` or `tags.0.label`; typed by `createForm<typeof schema>()`. */
  name: Path<Values>
  label?: ReactNode
  description?: ReactNode
  /** `in` or `on` floats the label inside the control or on its border; the Form's `labelPlacement` by default. */
  labelPlacement?: FieldLabelPlacement
  /**
   * Draws a required marker and sets the control's `required`. Read from the schema by default (a field it rejects
   * when empty); `false` hides the marker.
   */
  required?: boolean
  /** Words screen readers hear after the label; the Form's `requiredLabel` by default. */
  requiredLabel?: string
  disabled?: boolean
  /** Messages for this field only; they win over the form's. */
  messages?: FormMessages
  /** `"checked"` binds `checked`/`onCheckedChange`; an adapter binds any other prop pair. Read from the child by default. */
  bind?: "value" | "checked" | FormControlAdapter
  /**
   * A secret, like an API key, in an `Input` (made `sensitive`) or a `PasswordInput`: the control stays uncontrolled,
   * so its value never reaches a DOM attribute, and the form reads it only to validate and submit, then forgets it.
   * A successful submit, a reset and unmounting empty it. On by default for an `Input sensitive` child. It doesn't
   * count toward the form's dirty state, and validates on submit only.
   */
  sensitive?: boolean
  /** For a control the adapters don't know: render it from the field's state, inside the Field. */
  render?: (field: FormFieldState) => ReactNode
  className?: string
  /** One control, bound by `name`. */
  children?: ReactElement
}

function adapterFor(child: ReactElement, bind: FormFieldProps["bind"]) {
  if (bind === "checked") return checkedAdapter
  if (bind === "value") return valueAdapter
  if (bind) return bind
  return formControlAdapters.get(child.type) ?? valueAdapter
}

function chain(own: unknown, bound: (...args: unknown[]) => void) {
  return (...args: unknown[]) => {
    if (typeof own === "function") own(...args)
    bound(...args)
  }
}

function bindSecretWithoutItsValue(
  child: ReactElement<Record<string, unknown>>,
  name: string,
  required: boolean,
  controller: PasswordInputController,
  onType: () => void,
) {
  if (child.type !== Input && child.type !== PasswordInput) {
    throw new Error("A sensitive FormField takes an Input or a PasswordInput.")
  }
  return cloneElement(child, {
    name: child.props.name ?? name,
    required: child.props.required ?? (required || undefined),
    ...(child.type === Input ? { sensitive: true, sensitiveController: controller } : { controller }),
    onValueChange: chain(child.props.onValueChange, onType),
  })
}

function RequiredMarker({ label }: { label: string | undefined }) {
  return (
    <>
      {" "}
      <span data-slot="form-field-required" className="text-destructive">
        <span aria-hidden="true">*</span>
        {label === undefined ? null : <span className="sr-only">{` ${label}`}</span>}
      </span>
    </>
  )
}

function FormField<Values extends FieldValues = FieldValues>({
  name,
  label,
  description,
  labelPlacement,
  required: requiredProp,
  requiredLabel,
  disabled,
  messages,
  bind,
  sensitive: sensitiveProp,
  render,
  className,
  children,
}: FormFieldProps<Values>) {
  const context = useFormContext("FormField")
  const required = requiredProp ?? context.requires(name)
  const { field, fieldState } = useController({ name, control: context.form.control })
  const textLabel = typeof label === "string" ? label : undefined

  useFieldRegistration(context.fields, name, textLabel)
  const onlyChild = render ? undefined : Children.only(children)
  const sensitive =
    sensitiveProp ?? (isValidElement<{ sensitive?: unknown }>(onlyChild) && onlyChild.props.sensitive === true)
  const [ownController] = useState<PasswordInputController>(createPasswordInputController)
  const secretController = sensitive ? ownController : undefined
  useSensitiveField(context.form, context.secrets, name, secretController)

  const error = fieldState.error
  const message = error ? errorText(error, name, textLabel, messages, context.messages) : undefined
  const fieldDisabled = Boolean(disabled) || context.disabled
  const state = useMemo<FormFieldState>(
    () => ({
      name,
      value: field.value,
      onChange: field.onChange,
      onBlur: field.onBlur,
      ref: field.ref,
      invalid: Boolean(error),
      error: message,
      disabled: fieldDisabled,
      pending: context.pending,
    }),
    [name, field.value, field.onChange, field.onBlur, field.ref, error, message, fieldDisabled, context.pending],
  )

  let control: ReactNode = render?.(state)
  let checkedLayout = false
  let floats = false
  if (!render) {
    const child = Children.only(children)
    if (!isValidElement<Record<string, unknown>>(child)) throw new Error("FormField needs one control as its child.")
    const adapter = adapterFor(child, bind)
    checkedLayout = adapter === checkedAdapter
    floats = typeof child.type !== "string" && floatingLabelControls.has(child.type)
    control = secretController
      ? bindSecretWithoutItsValue(child, name, required, secretController, () => {
          if (context.form.getFieldState(name).error) context.form.clearErrors(name)
        })
      : cloneElement(child, {
          name: child.props.name ?? name,
          required: child.props.required ?? (required || undefined),
          [adapter.value]: adapter.toControl ? adapter.toControl(field.value) : field.value,
          [adapter.change]: chain(child.props[adapter.change], (value) =>
            field.onChange(adapter.fromControl ? adapter.fromControl(value) : value),
          ),
          ...(adapter.blur ? { onBlur: chain(child.props.onBlur, field.onBlur) } : {}),
        })
  }

  const takesFormPlacement = floats && !padsItself(className)
  const inherited = takesFormPlacement ? context.labelPlacement : undefined
  const placement = checkedLayout ? "top" : (labelPlacement ?? inherited ?? "top")
  const fieldLabel =
    label === undefined ? null : (
      <FieldLabel>
        {label}
        {required ? <RequiredMarker label={requiredLabel ?? context.requiredLabel} /> : null}
      </FieldLabel>
    )
  return (
    <FormFieldContext.Provider value={state}>
      <Field
        name={name}
        labelPlacement={placement}
        invalid={Boolean(error)}
        disabled={state.disabled}
        className={cn(checkedLayout && (description || message) ? "flex-wrap" : undefined, className)}
      >
        {checkedLayout ? (
          <>
            {control}
            {fieldLabel}
          </>
        ) : (
          <>
            {fieldLabel}
            {control}
          </>
        )}
        {description === undefined ? null : (
          <FieldDescription className={checkedLayout ? "basis-full" : undefined}>{description}</FieldDescription>
        )}
        {message === undefined ? null : (
          <FieldError match className={checkedLayout ? "basis-full" : undefined}>
            {message}
          </FieldError>
        )}
      </Field>
    </FormFieldContext.Provider>
  )
}

export { FormField, formControlAdapters, useFormField }
export type { FormControlAdapter, FormFieldProps, FormFieldState }
