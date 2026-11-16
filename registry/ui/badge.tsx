import { renderElement, type PartProps } from "@ui-sdk/react/primitive"
import { cva } from "class-variance-authority"

import type { Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"

const toneClassNames = {
  neutral: "border-border bg-secondary text-secondary-foreground",
  info: "border-info/30 bg-info/10 text-info",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
} satisfies Record<Tone, string>

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-inline rounded-control border px-inset-chip py-inset-chip text-xs font-medium whitespace-nowrap [&>svg]:size-3 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        success: toneClassNames.success,
        warning: toneClassNames.warning,
        info: toneClassNames.info,
        destructive: toneClassNames.destructive,
      },
      tone: toneClassNames,
    },
    defaultVariants: { variant: "default" },
  },
)

type BadgeLook = "default" | "secondary" | "outline"
type DeprecatedBadgeTone = Exclude<Tone, "neutral">

type BadgeProps = PartProps<"span"> & {
  /** What the badge means; takes precedence over `variant`. */
  tone?: Tone
  /**
   * The look of a badge without a tone. `success`, `warning`, `info` and `destructive` still work but are
   * deprecated: use `tone`.
   */
  variant?: BadgeLook | DeprecatedBadgeTone
}

function isLook(variant: BadgeProps["variant"]): variant is BadgeLook {
  return variant === undefined || variant === "default" || variant === "secondary" || variant === "outline"
}

function Badge({ className, variant, tone, render, ...props }: BadgeProps) {
  const resolvedTone = tone ?? (isLook(variant) ? undefined : variant)
  return renderElement(
    "span",
    {
      "data-slot": "badge",
      "data-variant": variant ?? "default",
      "data-tone": resolvedTone,
      className: cn(badgeVariants(resolvedTone ? { variant: null, tone: resolvedTone } : { variant }), className),
      ...props,
    },
    render,
  )
}

export { Badge, badgeVariants }
export type { BadgeProps }
