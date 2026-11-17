"use client"

import type { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"
import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "@/components/ui/scroll-area"
import {
  BoardColumn,
  BoardColumnGroup,
  boardColumnLabels,
  type BoardColumnLabels,
  type BoardColumnProps,
  type BoardColumnGroupProps,
} from "@/components/ui/board-column"

export { BoardColumn, BoardColumnGroup, boardColumnLabels }
export type { BoardColumnLabels, BoardColumnProps, BoardColumnGroupProps }

type BoardName =
  | { "aria-label": string; "aria-labelledby"?: never }
  | { "aria-labelledby": string; "aria-label"?: never }

type BoardProps = Omit<ComponentProps<typeof ScrollArea>, "aria-label" | "aria-labelledby" | "children"> &
  BoardName & { children?: ReactNode }

function Board({
  className,
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: BoardProps) {
  return (
    <ScrollArea type="auto" className={cn("w-full", className)} {...props}>
      <ScrollAreaViewport render={<section />} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}>
        {/* oxlint-disable-next-line p-otero/spacing-tokens -- room for the h-2 horizontal scrollbar so it never covers the columns */}
        <ScrollAreaContent render={<ul />} className="flex w-max min-w-full items-start gap-section pb-2">
          {children}
        </ScrollAreaContent>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar orientation="horizontal">
        <ScrollAreaThumb />
      </ScrollAreaScrollbar>
    </ScrollArea>
  )
}

export { Board }
export type { BoardProps }
