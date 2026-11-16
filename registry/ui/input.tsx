"use client"

import {
  Input as InputPrimitive,
  InputClear as InputClearPrimitive,
  InputGroup as InputGroupPrimitive,
} from "@ui-sdk/react/input"
import type { ComponentProps } from "react"

import { floatingLabelControls } from "@/components/ui/field"
import { cnState } from "@/lib/utils"

const fieldSurfaceClassName =
  "border border-input bg-field/(--glass-opacity) shadow-xs transition-colors hover:border-input-strong/50 aria-invalid:border-destructive data-disabled:cursor-not-allowed data-disabled:opacity-50"

function Input({ className, ...props }: ComponentProps<typeof InputPrimitive>) {
  return (
    <InputPrimitive
      className={cnState(
        `${fieldSurfaceClassName} h-field-control w-full rounded-control min-w-0 px-control-x text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring in-data-[slot=input-group]:h-auto in-data-[slot=input-group]:border-0 in-data-[slot=input-group]:bg-transparent in-data-[slot=input-group]:px-0 in-data-[slot=input-group]:shadow-none in-data-[slot=input-group]:focus-visible:ring-0`,
        className,
      )}
      {...props}
    />
  )
}

function InputGroup({ className, ...props }: ComponentProps<typeof InputGroupPrimitive>) {
  return (
    <InputGroupPrimitive
      className={cnState(
        `${fieldSurfaceClassName} flex h-field-control rounded-control w-full items-center gap-inline px-control-x text-sm has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-aria-invalid:border-destructive [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground`,
        className,
      )}
      {...props}
    />
  )
}

function InputClear({ className, children, ...props }: ComponentProps<typeof InputClearPrimitive>) {
  return (
    <InputClearPrimitive
      aria-label="Clear"
      className={cnState(
        // oxlint-disable-next-line eskais/spacing-tokens -- pulls the icon button into the padding so its glyph lines up with the text inset
        "-me-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      {children ?? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className="size-4"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      )}
    </InputClearPrimitive>
  )
}

floatingLabelControls.add(Input).add(InputGroup)

export { fieldSurfaceClassName, Input, InputClear, InputGroup }
