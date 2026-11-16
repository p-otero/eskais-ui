"use client"

import { renderElement, type PartProps } from "@ui-sdk/react/primitive"
import { cva } from "class-variance-authority"
import { createContext, isValidElement, use, useId, useLayoutEffect, useState } from "react"

import { cn } from "@/lib/utils"

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

const CardTitleContext = createContext<((id: string | undefined) => void) | null>(null)

function part(slot: string, base: string) {
  return function CardPart({ className, render, ...props }: PartProps<"div">) {
    return renderElement("div", { "data-slot": slot, className: cn(base, className), ...props }, render)
  }
}

type CardSurface = "card" | "none" | "dashed"

const cardVariants = cva("flex flex-col gap-group text-card-foreground", {
  variants: {
    surface: {
      card: "rounded-surface border bg-card/(--glass-opacity) py-inset-surface shadow-surface backdrop-surface",
      dashed: "rounded-surface border border-dashed py-inset-surface",
      none: "[&>[data-slot^=card-]]:px-0",
    },
  },
  defaultVariants: { surface: "card" },
})

type CardProps = PartProps<"section"> & {
  /** `dashed` is an outlined, unfilled tile, like a "create" placeholder; `none` drops the box and its padding. */
  surface?: CardSurface
}

// A titled card is a named region; the title registers its id after mount, so the section is always the same element.
function Card({ className, render, children, surface = "card", ...props }: CardProps) {
  const [titleId, setTitleId] = useState<string>()
  return (
    <CardTitleContext value={setTitleId}>
      {renderElement(
        "section",
        {
          "data-slot": "card",
          "data-surface": surface,
          "aria-labelledby": titleId,
          className: cn(cardVariants({ surface }), className),
          children,
          ...props,
        },
        render,
      )}
    </CardTitleContext>
  )
}

const CardHeader = part(
  "card-header",
  "grid auto-rows-min items-start gap-x-group gap-y-inline px-inset-surface has-[>[data-slot=card-action]]:grid-cols-[minmax(0,1fr)_auto] [&>:not([data-slot=card-action])]:col-start-1",
)

const CardEyebrow = part("card-eyebrow", "text-meta tracking-meta text-muted-foreground uppercase")

const CardAction = part(
  "card-action",
  "col-start-2 row-span-2 row-start-1 flex items-center gap-items self-start justify-self-end",
)

type CardTitleProps = PartProps<"div"> & {
  /** Renders an `h1`–`h6`. Without it the title is a `div` that still names the card. */
  headingLevel?: HeadingLevel
}

function CardTitle({ className, render, headingLevel, id, ...props }: CardTitleProps) {
  const generatedId = useId()
  const renderedId = isValidElement<{ id?: string }>(render) ? render.props.id : undefined
  const titleId = renderedId ?? id ?? generatedId
  const register = use(CardTitleContext)
  useLayoutEffect(() => {
    register?.(titleId)
    return () => register?.(undefined)
  }, [register, titleId])
  return renderElement(
    headingLevel === undefined ? "div" : `h${headingLevel}`,
    {
      "data-slot": "card-title",
      id: titleId,
      className: cn("text-title-sm leading-none wrap-anywhere", className),
      ...props,
    },
    render,
  )
}

const CardDescription = part("card-description", "text-sm text-muted-foreground")
const CardContent = part("card-content", "px-inset-surface")
const CardFooter = part("card-footer", "flex items-center gap-items px-inset-surface")

export { Card, CardAction, CardContent, CardDescription, CardEyebrow, CardFooter, CardHeader, CardTitle, cardVariants }
export type { CardProps, CardSurface, CardTitleProps, HeadingLevel as CardHeadingLevel }
