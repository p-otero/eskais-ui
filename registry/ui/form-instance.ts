"use client"

import {
  useFieldArray,
  useWatch,
  type ArrayPath,
  type FieldArray,
  type FieldPath,
  type FieldPathValue,
  type FieldValues,
  type UseFieldArrayProps,
  type UseFieldArrayReturn,
  type UseFormReturn,
} from "react-hook-form"

import { useFormContext } from "@/components/ui/form-context"

/**
 * The react-hook-form instance of the surrounding `Form`, typed by its input values: `trigger`, `setValue`,
 * `getValues`, `control`, `formState`. Its `watch` re-renders the Form, not the caller: read a live value with
 * `useFormWatch(name)` instead.
 */
function useFormInstance<Values extends FieldValues = FieldValues>(): UseFormReturn<Values> {
  return useFormContext("useFormInstance").form as unknown as UseFormReturn<Values>
}

type UseFormFieldArrayOptions<Values extends FieldValues, Name extends ArrayPath<Values>> = Omit<
  UseFieldArrayProps<Values, Name>,
  "name" | "control"
>

/** A field's live value, re-rendering only the caller: react-hook-form's `useWatch` bound to the surrounding `Form`. */
function useFormWatch<Values extends FieldValues = FieldValues, Name extends FieldPath<Values> = FieldPath<Values>>(
  name: Name,
): FieldPathValue<Values, Name> {
  const form = useFormContext("useFormWatch").form as unknown as UseFormReturn<Values>
  return useWatch<Values, Name>({ name, control: form.control })
}

/** react-hook-form's `useFieldArray` bound to the surrounding `Form`. Key rows by `field.id`, never by index. */
function useFormFieldArray<
  Values extends FieldValues = FieldValues,
  Name extends ArrayPath<Values> = ArrayPath<Values>,
>(name: Name, options?: UseFormFieldArrayOptions<Values, Name>): UseFieldArrayReturn<Values, Name> {
  const form = useFormContext("useFormFieldArray").form as unknown as UseFormReturn<Values>
  return useFieldArray<Values, Name>({ ...options, name, control: form.control })
}

export { useFormFieldArray, useFormInstance, useFormWatch }
export type { FieldArray, UseFormFieldArrayOptions }
