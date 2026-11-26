"use client"

import {
  PasswordInput as PasswordInputPrimitive,
  PasswordInputControl as PasswordInputControlPrimitive,
  PasswordInputToggle as PasswordInputTogglePrimitive,
  createPasswordInputController,
} from "@ui-sdk/react/password-input"
import type { ComponentProps } from "react"
import { EyeIcon, EyeOffIcon } from "lucide-react"

import {
  fieldSurfaceClassName,
  floatingLabelControls,
  formControlAdapters,
  useFloatingPlaceholder,
} from "@/components/ui/field"
import { ControlTooltip, type ControlTooltipOption } from "@/components/ui/tooltip"
import { cnState } from "@/lib/utils"

/** The field's box. Without children it renders a `PasswordInputControl` and a `PasswordInputToggle`. */
function PasswordInput({ className, children, ...props }: ComponentProps<typeof PasswordInputPrimitive>) {
  return (
    <PasswordInputPrimitive
      className={cnState(
        `${fieldSurfaceClassName} flex h-field-control w-full min-w-0 items-center gap-inline rounded-control ps-control-x pe-inline text-entry has-aria-invalid:border-destructive has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring`,
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          <PasswordInputControl />
          <PasswordInputToggle />
        </>
      )}
    </PasswordInputPrimitive>
  )
}

function PasswordInputControl({
  className,
  placeholder,
  ...props
}: ComponentProps<typeof PasswordInputControlPrimitive>) {
  return (
    <PasswordInputControlPrimitive
      placeholder={useFloatingPlaceholder(placeholder)}
      className={cnState(
        "h-full w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground data-disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  )
}

// Spec: the name stays the same while the password shows; aria-pressed says whether it's shown.
function PasswordInputToggle({
  className,
  children,
  "aria-label": ariaLabel = "Show password",
  tooltip,
  ...props
}: ComponentProps<typeof PasswordInputTogglePrimitive> & { tooltip?: ControlTooltipOption }) {
  return (
    <ControlTooltip label={ariaLabel} tooltip={tooltip} iconOnly={children === undefined}>
      <PasswordInputTogglePrimitive
        aria-label={ariaLabel}
        className={cnState(
          "touch-target inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-control text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring data-disabled:cursor-not-allowed data-disabled:hover:bg-transparent [&_svg]:size-4",
          className,
        )}
        {...props}
      >
        {children ?? ((state) => (state.visible ? <EyeOffIcon /> : <EyeIcon />))}
      </PasswordInputTogglePrimitive>
    </ControlTooltip>
  )
}

floatingLabelControls.add(PasswordInput)
formControlAdapters.set(PasswordInput, {
  value: "value",
  change: "onValueChange",
  toControl: (value) => value ?? "",
  blur: true,
})

export { createPasswordInputController, PasswordInput, PasswordInputControl, PasswordInputToggle }
export type {
  PasswordInputController,
  PasswordInputState,
  PasswordInputVisibleChangeReason,
} from "@ui-sdk/react/password-input"
