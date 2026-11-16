"use client"

import type { StandardSchemaV1 } from "@standard-schema/spec"
import type { ReactNode } from "react"
import type {
  ArrayPath,
  FieldPath,
  FieldPathValue,
  FieldValues,
  UseFieldArrayReturn,
  UseFormReturn,
} from "react-hook-form"

import {
  FormField,
  type FormFieldProps,
  formControlAdapters,
  useFormField,
  type FormControlAdapter,
  type FormFieldState,
} from "@/components/ui/form-field"
import {
  useFormFieldArray,
  useFormInstance,
  useFormWatch,
  type UseFormFieldArrayOptions,
} from "@/components/ui/form-instance"
import { Form, type FormProps, type FormSubmitHelpers } from "@/components/ui/form-root"
import { FieldSet, type FieldSetProps } from "@/components/ui/field"
import {
  FormActions,
  FormRootError,
  type FormActionsProps,
  type FormRootErrorProps,
} from "@/components/ui/form-actions"
import {
  FormServerError,
  createFormMessages,
  formIssueMessage,
  formMessagesEn,
  formMessagesEs,
  resolveFormMessage,
  toFormErrors,
  type FormErrorInput,
  type FormErrors,
  type FormIssue,
  type FormIssueCode,
  type FormMessage,
  type FormMessageDictionary,
  type FormMessages,
} from "@/components/ui/form-messages"

type FormValuesOf<Schema extends StandardSchemaV1> =
  StandardSchemaV1.InferInput<Schema> extends FieldValues ? StandardSchemaV1.InferInput<Schema> : FieldValues

type TypedForm<Schema extends StandardSchemaV1> = {
  Form: (props: FormProps<Schema>) => ReactNode
  /** `name` must be a path into the schema's input. */
  FormField: (props: FormFieldProps<FormValuesOf<Schema>>) => ReactNode
  useFormInstance: () => UseFormReturn<FormValuesOf<Schema>>
  useFormWatch: <Name extends FieldPath<FormValuesOf<Schema>>>(name: Name) => FieldPathValue<FormValuesOf<Schema>, Name>
  useFormFieldArray: <Name extends ArrayPath<FormValuesOf<Schema>>, KeyName extends string = "id">(
    name: Name,
    options?: UseFormFieldArrayOptions<FormValuesOf<Schema>, Name, KeyName>,
  ) => UseFieldArrayReturn<FormValuesOf<Schema>, Name, KeyName>
}

/**
 * The form parts typed by one schema, so a misspelt `name` fails to compile:
 * `const { Form, FormField } = createForm<typeof schema>()`. They are the same components, only typed.
 */
function createForm<Schema extends StandardSchemaV1>(): TypedForm<Schema> {
  return {
    Form,
    FormField,
    useFormInstance,
    useFormWatch,
    useFormFieldArray,
  } as unknown as TypedForm<Schema>
}

export { Form, createForm }
export type { FormProps, FormValuesOf, TypedForm }
export type { FormSubmitHelpers }
export { FieldSet }
export type { FieldSetProps }
export { FormActions, FormRootError }
export type { FormActionsProps, FormRootErrorProps }
export { FormField, formControlAdapters, useFormField }
export type { FormControlAdapter, FormFieldProps, FormFieldState }
export { useFormFieldArray, useFormInstance, useFormWatch }
export type { UseFormFieldArrayOptions }
export {
  FormServerError,
  createFormMessages,
  formIssueMessage,
  formMessagesEn,
  formMessagesEs,
  resolveFormMessage,
  toFormErrors,
}
export type { FormErrorInput, FormErrors, FormIssue, FormIssueCode, FormMessage, FormMessageDictionary, FormMessages }
