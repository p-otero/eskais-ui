"use client"

import { useEffect, useEffectEvent, type RefObject } from "react"

/** Calls `onChange` with `value` once mounted and whenever it changes, never because `onChange` itself changed. */
function useReportChange<Value>(value: Value, onChange: ((value: Value) => void) | undefined) {
  const report = useEffectEvent((next: Value) => onChange?.(next))
  useEffect(() => report(value), [value])
}

/** Disabling the fields drops focus to the body; give it back to `restoreFocusRef` once they are enabled again. */
function useRestoreFocusAfterPending(pending: boolean, restoreFocusRef: RefObject<Element | null>) {
  useEffect(() => {
    const previous = restoreFocusRef.current
    if (pending || !(previous instanceof HTMLElement)) return
    restoreFocusRef.current = null
    if (document.activeElement === document.body || document.activeElement === null) previous.focus()
  }, [pending, restoreFocusRef])
}

/** Runs `focus` after the render that bumps `request` past zero, once the invalid fields are on screen. */
function useFocusRequest(request: number, focus: () => void) {
  const onRequest = useEffectEvent(focus)
  useEffect(() => {
    if (request !== 0) onRequest()
  }, [request])
}

/** Holds a form-wide flag at `value` while the caller is mounted, and resets it to `false` after. */
function useFormFlag(set: (value: boolean) => void, value: boolean) {
  const apply = useEffectEvent(set)
  useEffect(() => {
    apply(value)
    return () => apply(false)
  }, [value])
}

/** Records a rendered field and its text label, so errors for it land on the field rather than the root. */
function useFieldRegistration(fields: Map<string, string | undefined>, name: string, label: string | undefined) {
  useEffect(() => {
    fields.set(name, label)
    return () => {
      fields.delete(name)
    }
  }, [fields, name, label])
}

export { useFieldRegistration, useFocusRequest, useFormFlag, useReportChange, useRestoreFocusAfterPending }
