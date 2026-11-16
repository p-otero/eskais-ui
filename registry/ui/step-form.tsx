"use client"

import type { StandardSchemaV1 } from "@standard-schema/spec"
import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react"
import type { FieldValues, Path, UseFormReturn } from "react-hook-form"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormActions,
  FormRootError,
  toFormErrors,
  useFormInstance,
  type FormProps,
  type FormValuesOf,
} from "@/components/ui/form"
import { useFormContext } from "@/components/ui/form-context"
import { StepFormProgress } from "@/components/ui/step-form-progress"
import { cn } from "@/lib/utils"

type FormStep<Values extends FieldValues = FieldValues> = {
  /** Stable id, reported by `onStepChange` and accepted by `step` and `defaultStep`. */
  id: string
  title: ReactNode
  description?: ReactNode
  /** The step's fields, usually `FormField`s; the form instance is there for `watch`-free logic like `getValues`. */
  render: (form: UseFormReturn<Values>) => ReactNode
  /** The fields Next validates; the step's mounted `FormField`s by default. */
  fields?: readonly Path<Values>[]
  /**
   * Runs once the step's fields are valid, before moving on. Return nothing to continue, or an error in any shape
   * `onSubmit` may throw (`{ fieldErrors, message }`, a string, a `FormServerError`) to stay.
   */
  validate?: (values: Values) => unknown
}

type StepDirection = "next" | "back" | "error"

type StepChangeDetails = {
  index: number
  /** The step it leaves. */
  previous: string
  /** `error` when a failed submit returns to the step that holds the first invalid field. */
  direction: StepDirection
}

type StepFormLabels = {
  next?: ReactNode
  back?: ReactNode
  submit?: ReactNode
  /** Names the progress list for screen readers. */
  progress?: string
}

type StepFormProps<Schema extends StandardSchemaV1> = Omit<FormProps<Schema>, "children"> & {
  steps: readonly FormStep<FormValuesOf<Schema>>[]
  /** The current step's id, controlled. */
  step?: string
  defaultStep?: string
  onStepChange?: (step: string, details: StepChangeDetails) => void
  /** Button and progress labels in the page's language; English by default. */
  labels?: StepFormLabels
  /** What screen readers hear once a submit or a step's `validate` has been pending for a second. */
  pendingLabel?: string
  headingLevel?: 2 | 3 | 4
  rootErrorTitle?: ReactNode
}

type StepFormFrameProps<Schema extends StandardSchemaV1> = StepFormProps<Schema> & {
  cancel?: ReactNode
  onCancel?: () => void
  body?: ComponentType<{ children?: ReactNode }>
  actionsClassName?: string
}

/** A new object for every move, so moving to the same direction twice still runs the focus effect. */
type StepMove = { direction: StepDirection }

function errorPaths(errors: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(errors).flatMap(([key, value]) => {
    if (!value || typeof value !== "object") return []
    const path = prefix ? `${prefix}.${key}` : key
    return "type" in value || "message" in value ? [path] : errorPaths(value as Record<string, unknown>, path)
  })
}

const related = (a: string, b: string) => a === b || a.startsWith(`${b}.`) || b.startsWith(`${a}.`)

function DefaultBody({ children }: { children?: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-group">{children}</div>
}

type ContentProps = {
  steps: readonly FormStep[]
  index: number
  move: StepMove | null
  go: (target: number, direction: StepDirection) => void
  labels?: StepFormLabels
  pendingLabel?: string
  headingLevel: 2 | 3 | 4
  rootErrorTitle?: ReactNode
  cancel?: ReactNode
  onCancel?: () => void
  Body: ComponentType<{ children?: ReactNode }>
  actionsClassName?: string
}

function StepFormContent({
  steps,
  index,
  move,
  go,
  labels,
  pendingLabel,
  headingLevel,
  rootErrorTitle,
  cancel,
  onCancel,
  Body,
  actionsClassName,
}: ContentProps) {
  const form = useFormInstance()
  const context = useFormContext("StepForm")
  const step = steps[index]!
  const last = index === steps.length - 1
  const headingId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const seen = useRef(new Map<string, string[]>())
  const [validating, setValidating] = useState(false)
  const Heading = `h${headingLevel}` as const

  useEffect(() => {
    seen.current.set(step.id, [...context.fields.keys()])
  })
  useEffect(() => {
    if (move?.direction === "next" || move?.direction === "back") heading.current?.focus()
  }, [move])

  const stepOf = (paths: string[]) => {
    const found = steps.findIndex((candidate) => {
      const names = candidate.fields ?? seen.current.get(candidate.id) ?? []
      return paths.some((path) => names.some((name) => related(path, name)))
    })
    if (found >= 0) return found
    // A step never shown (after `defaultStep`) and without `fields` is the only place the field can be.
    const unknown = steps.findIndex((candidate) => !candidate.fields && !seen.current.has(candidate.id))
    return unknown < 0 ? index : unknown
  }

  const next = async () => {
    form.clearErrors("root")
    const names = step.fields ?? [...context.fields.keys()]
    setValidating(true)
    try {
      if (names.length > 0 && !(await form.trigger(names))) return context.requestFocus()
      const problem = await step.validate?.(form.getValues())
      if (problem !== undefined && problem !== null) {
        context.applyError(problem)
        return context.requestFocus()
      }
      go(index + 1, "next")
    } finally {
      setValidating(false)
    }
  }

  const { setInterceptor } = context
  useLayoutEffect(() => {
    setInterceptor({
      beforeSubmit: async () => {
        if (last) return true
        await next()
        return false
      },
      onInvalid: (errors) => go(stepOf(errorPaths(errors)), "error"),
      onError: (error) => go(stepOf(Object.keys(toFormErrors(error)?.fieldErrors ?? {})), "error"),
    })
  })
  useLayoutEffect(() => () => setInterceptor(null), [setInterceptor])

  return (
    <>
      <StepFormProgress steps={steps} current={index} label={labels?.progress ?? "Progress"} />
      <Body>
        <section aria-labelledby={headingId} data-slot="step-form-step" className="flex min-w-0 flex-col gap-group">
          <div className="flex flex-col gap-inline">
            <Heading
              ref={heading}
              id={headingId}
              tabIndex={-1}
              data-slot="step-form-title"
              className="text-title-sm tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {step.title}
            </Heading>
            {step.description === undefined ? null : (
              <p className="text-body-sm text-muted-foreground">{step.description}</p>
            )}
          </div>
          {step.render(form)}
        </section>
        <FormRootError title={rootErrorTitle} />
      </Body>
      <FormActions
        submitLabel={last ? (labels?.submit ?? "Submit") : (labels?.next ?? "Next")}
        pendingLabel={pendingLabel}
        pending={validating}
        cancel={cancel}
        onCancel={onCancel}
        secondaryAction={
          index === 0 ? null : (
            <Button
              type="button"
              variant="ghost"
              disabled={context.pending || validating}
              onClick={() => go(index - 1, "back")}
            >
              {labels?.back ?? "Back"}
            </Button>
          )
        }
        className={actionsClassName}
      />
    </>
  )
}

function StepFormFrame<Schema extends StandardSchemaV1>({
  steps,
  step: stepProp,
  defaultStep,
  onStepChange,
  labels,
  pendingLabel,
  headingLevel = 2,
  rootErrorTitle,
  cancel,
  onCancel,
  body = DefaultBody,
  actionsClassName,
  className,
  ...form
}: StepFormFrameProps<Schema>) {
  const [ownStep, setOwnStep] = useState(() => defaultStep ?? steps[0]?.id)
  const [move, setMove] = useState<StepMove | null>(null)
  const current = stepProp ?? ownStep
  const index = Math.max(
    0,
    steps.findIndex((candidate) => candidate.id === current),
  )

  const go = (target: number, direction: StepDirection) => {
    const destination = steps[target]
    if (!destination || target === index) return
    setMove({ direction })
    if (stepProp === undefined) setOwnStep(destination.id)
    onStepChange?.(destination.id, { index: target, previous: steps[index]!.id, direction })
  }

  return (
    <Form {...form} className={cn("min-w-0", className)}>
      <StepFormContent
        steps={steps as readonly FormStep[]}
        index={index}
        move={move}
        go={go}
        labels={labels}
        pendingLabel={pendingLabel}
        headingLevel={headingLevel}
        rootErrorTitle={rootErrorTitle}
        cancel={cancel}
        onCancel={onCancel}
        Body={body}
        actionsClassName={actionsClassName}
      />
    </Form>
  )
}

/**
 * A multi-step form: one schema, one step's fields at a time. Next (or Enter) validates only that step, Back keeps
 * every value, and the last step submits everything through `onSubmit`, with the same error mapping as `Form`.
 */
function StepForm<Schema extends StandardSchemaV1>(props: StepFormProps<Schema>) {
  return <StepFormFrame {...props} />
}

export { StepForm, StepFormFrame }
export type { FormStep, StepChangeDetails, StepDirection, StepFormLabels, StepFormProps }
