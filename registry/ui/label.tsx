"use client"

import { Label as LabelPrimitive } from "@ui-sdk/react/label"
import type { ComponentProps } from "react"

import { cnState } from "@/lib/utils"

function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive>) {
  return (
    <LabelPrimitive
      className={cnState(
        "inline-flex items-center gap-2 text-sm font-medium select-none has-data-disabled:cursor-not-allowed has-data-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Label }
