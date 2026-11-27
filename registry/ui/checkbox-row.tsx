"use client"

import {
  Field as FieldPrimitive,
  FieldDescription as FieldDescriptionPrimitive,
  FieldLabel as FieldLabelPrimitive,
} from "@ui-sdk/react/field"
import type { ComponentProps, ReactNode } from "react"

import { Checkbox, CheckboxIndicator } from "@/components/ui/checkbox"
import { cnState } from "@/lib/utils"

/** `true` turns the row off; `{ reason }` also says why, under the label, and describes the checkbox with it. */
type CheckboxRowDisabled = boolean | { reason: ReactNode }

type CheckboxRowProps = Omit<ComponentProps<typeof Checkbox>, "children" | "disabled" | "className"> & {
  /** Names the checkbox; pressing it toggles the checkbox. */
  label: ReactNode
  /** Under the label, describing the checkbox. */
  description?: ReactNode
  /** At the end of the row, like a badge, a fingerprint or a menu. */
  trailing?: ReactNode
  disabled?: CheckboxRowDisabled
  /** On the row, or a function of the row's state; the checkbox's own props go to the checkbox. */
  className?: ComponentProps<typeof FieldPrimitive>["className"]
}

function hasContent(node: ReactNode) {
  return node !== undefined && node !== null && node !== false
}

function disabledReason(disabled: CheckboxRowDisabled | undefined): ReactNode {
  return typeof disabled === "object" ? disabled.reason : undefined
}

function CheckboxRow({ label, description, trailing, disabled, className, ...checkbox }: CheckboxRowProps) {
  const reason = disabledReason(disabled)
  const described = hasContent(description) || hasContent(reason)
  return (
    <FieldPrimitive
      disabled={disabled !== undefined && disabled !== false}
      render={(part) => <div {...part} data-slot="checkbox-row" />}
      className={cnState(
        "flex min-w-0 items-start gap-inline pointer-coarse:min-h-(--control-height-touch) pointer-coarse:items-center",
        className,
      )}
    >
      {/* oxlint-disable-next-line p-otero/spacing-tokens -- aligns the size-4 box with the label's first 20px line */}
      <Checkbox className="mt-0.5 pointer-coarse:mt-0" {...checkbox}>
        <CheckboxIndicator />
      </Checkbox>
      <div className="flex min-w-0 flex-1 flex-col">
        <FieldLabelPrimitive className="cursor-pointer text-body font-medium break-words select-none data-disabled:cursor-not-allowed data-disabled:opacity-50">
          {label}
        </FieldLabelPrimitive>
        {described ? (
          <FieldDescriptionPrimitive className="flex flex-col text-body-sm text-muted-foreground">
            {hasContent(description) ? <span data-slot="checkbox-row-description">{description}</span> : null}
            {hasContent(reason) ? <span data-slot="checkbox-row-reason">{reason}</span> : null}
          </FieldDescriptionPrimitive>
        ) : null}
      </div>
      {hasContent(trailing) ? (
        <div
          data-slot="checkbox-row-trailing"
          className="ms-auto flex shrink-0 items-center gap-inline self-center text-body-sm text-muted-foreground"
        >
          {trailing}
        </div>
      ) : null}
    </FieldPrimitive>
  )
}

export { CheckboxRow }
export type { CheckboxRowDisabled, CheckboxRowProps }
