"use client"

import { useEffect, useEffectEvent, useLayoutEffect, type RefObject } from "react"

import type { SubmitInterceptor } from "@/components/ui/form-context"

/** After each render, records the fields the current step registered, to find the step an error belongs to. */
function useSeenFields(seenRef: RefObject<Map<string, string[]>>, stepId: string, fields: Map<string, unknown>) {
  useEffect(() => {
    seenRef.current.set(stepId, [...fields.keys()])
  })
}

/** Moves focus to the step's heading after a step forward or back, not after a jump to an error. */
function useHeadingFocus(move: { direction: string } | null, headingRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (move?.direction === "next" || move?.direction === "back") headingRef.current?.focus()
  }, [move, headingRef])
}

/** Hands the form this render's interceptor, so submit sees the current step, and takes it back on unmount. */
function useSubmitInterceptor(
  setInterceptor: (interceptor: SubmitInterceptor | null) => void,
  interceptor: SubmitInterceptor,
) {
  const release = useEffectEvent(() => setInterceptor(null))
  useLayoutEffect(() => {
    setInterceptor(interceptor)
  })
  useLayoutEffect(() => () => release(), [])
}

export { useHeadingFocus, useSeenFields, useSubmitInterceptor }
