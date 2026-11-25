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
  return assumeType<UseFormReturn<Values>>(useFormContext(part).form)
}

/** Its `watch` re-renders the Form, not the caller: read a live value with `useFormWatch(name)` instead. */
function useFormInstance<Values extends FieldValues = FieldValues>(): UseFormReturn<Values> {
  return useTypedForm<Values>("useFormInstance")
}

type UseFormFieldArrayOptions<
  Values extends FieldValues,
  Name extends ArrayPath<Values>,
  KeyName extends string = "id",
> = Omit<UseFieldArrayProps<Values, Name, KeyName>, "name" | "control">

/** Re-renders only the caller. */
function useFormWatch<Values extends FieldValues = FieldValues, Name extends FieldPath<Values> = FieldPath<Values>>(
  name: Name,
): FieldPathValue<Values, Name> {
  const form = useTypedForm<Values>("useFormWatch")
  return useWatch<Values, Name>({ name, control: form.control })
}

/**
 * Key rows by `field.id`, never by index. Items with their own `id` need `keyName: "fieldKey"` (any free name), keyed
 * by `field.fieldKey`: react-hook-form writes its row key over the property `keyName` names.
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
