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
import { assumeType } from "@/lib/narrow"

function useTypedForm<Values extends FieldValues>(part: string): UseFormReturn<Values> {
  // The Form keeps its instance as UseFormReturn<FieldValues>; react-hook-form's instance is invariant in its values,
  // so the caller's Values (the schema's input, which the Form was created with) can't be related to it by type.
  return assumeType<UseFormReturn<Values>>(useFormContext(part).form)
}

/**
 * The react-hook-form instance of the surrounding `Form`, typed by its input values: `trigger`, `setValue`,
 * `getValues`, `control`, `formState`. Its `watch` re-renders the Form, not the caller: read a live value with
 * `useFormWatch(name)` instead.
 */
function useFormInstance<Values extends FieldValues = FieldValues>(): UseFormReturn<Values> {
  return useTypedForm<Values>("useFormInstance")
}

/** react-hook-form's `useFieldArray` options without `name` and `control`; `keyName` names the rows' key property. */
type UseFormFieldArrayOptions<
  Values extends FieldValues,
  Name extends ArrayPath<Values>,
  KeyName extends string = "id",
> = Omit<UseFieldArrayProps<Values, Name, KeyName>, "name" | "control">

/** A field's live value, re-rendering only the caller: react-hook-form's `useWatch` bound to the surrounding `Form`. */
function useFormWatch<Values extends FieldValues = FieldValues, Name extends FieldPath<Values> = FieldPath<Values>>(
  name: Name,
): FieldPathValue<Values, Name> {
  const form = useTypedForm<Values>("useFormWatch")
  return useWatch<Values, Name>({ name, control: form.control })
}

/**
 * react-hook-form's `useFieldArray` bound to the surrounding `Form`. Key rows by `field.id`, never by index. When the
 * items carry their own `id`, pass `keyName: "fieldKey"` (any free name) and key rows by `field.fieldKey`:
 * react-hook-form writes its row key over the property `keyName` names.
 */
function useFormFieldArray<
  Values extends FieldValues = FieldValues,
  Name extends ArrayPath<Values> = ArrayPath<Values>,
  KeyName extends string = "id",
>(name: Name, options?: UseFormFieldArrayOptions<Values, Name, KeyName>): UseFieldArrayReturn<Values, Name, KeyName> {
  const form = useTypedForm<Values>("useFormFieldArray")
  return useFieldArray<Values, Name, KeyName>({
    ...options,
    name,
    control: form.control,
  })
}

export { useFormFieldArray, useFormInstance, useFormWatch }
export type { FieldArray, UseFormFieldArrayOptions }
