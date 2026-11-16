"use client"

import type { ChangeDetails } from "@ui-sdk/core"
import type { CollapsibleOpenChangeReason } from "@ui-sdk/react/collapsible"
import { CollapsiblePanel } from "@ui-sdk/react/collapsible"
import { Children, createContext, use, useId, useState, type ComponentProps, type ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleIcon, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Empty } from "@/components/ui/empty"
import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type HeadingLevel = 2 | 3 | 4 | 5 | 6

type BoardColumnLabels = {
  collapse: (title: string) => string
  expand: (title: string) => string
}

const boardColumnLabels: BoardColumnLabels = {
  collapse: (title) => `Collapse ${title}`,
  expand: (title) => `Expand ${title}`,
}

const HeadingLevelContext = createContext<HeadingLevel>(3)

function Count({ value, className }: { value: ReactNode; className?: string }) {
  if (value === undefined || value === null || value === false) return null
  return (
    <Badge variant="secondary" data-slot="board-column-count" className={className}>
      {value}
    </Badge>
  )
}

type BoardColumnProps = Omit<ComponentProps<"li">, "title" | "children"> & {
  title: string
  count?: number | ReactNode
  actions?: ReactNode
  empty?: ReactNode
  headingLevel?: HeadingLevel
  collapsible?: boolean
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean, details: ChangeDetails<CollapsibleOpenChangeReason>) => void
  labels?: Partial<BoardColumnLabels>
  children?: ReactNode
}

function BoardColumn({
  title,
  count,
  actions,
  empty,
  headingLevel = 3,
  collapsed: collapsedProp,
  defaultCollapsed,
  onCollapsedChange,
  collapsible = collapsedProp !== undefined || onCollapsedChange !== undefined || defaultCollapsed !== undefined,
  labels,
  className,
  children,
  ...props
}: BoardColumnProps) {
  const titleId = useId()
  const [uncontrolled, setUncontrolled] = useState(defaultCollapsed ?? false)
  const collapsed = collapsible && (collapsedProp ?? uncontrolled)
  const Heading = `h${headingLevel}` as const
  const groupHeadingLevel = Math.min(headingLevel + 1, 6) as HeadingLevel
  const { collapse, expand } = { ...boardColumnLabels, ...labels }

  const header = (
    <div
      data-slot="board-column-header"
      className="flex min-h-control-sm items-center gap-2 px-3 group-data-collapsed/board-column:flex-col group-data-collapsed/board-column:px-2"
    >
      {collapsible && (
        <CollapsibleTrigger
          aria-label={collapsed ? expand(title) : collapse(title)}
          className="size-control-sm justify-center px-0"
        >
          <CollapsibleIcon className="-rotate-90 group-data-open/collapsible-trigger:rotate-90 rtl:rotate-90 rtl:group-data-open/collapsible-trigger:-rotate-90" />
        </CollapsibleTrigger>
      )}
      <Heading
        id={titleId}
        data-slot="board-column-title"
        className="min-w-0 flex-1 truncate text-sm font-semibold group-data-collapsed/board-column:text-vertical group-data-collapsed/board-column:overflow-visible"
      >
        {title}
      </Heading>
      <Count value={count} />
      {actions !== undefined && (
        <div
          data-slot="board-column-actions"
          className="flex items-center gap-1 group-data-collapsed/board-column:hidden"
        >
          {actions}
        </div>
      )}
    </div>
  )

  const body = (
    <ScrollArea className="flex min-h-0 flex-col">
      <ScrollAreaViewport aria-labelledby={titleId} className="h-auto max-h-(--board-column-max-height)">
        <ScrollAreaContent className="flex flex-col gap-2 px-2 pb-2 content-auto">
          {Children.toArray(children).length === 0 && empty !== undefined ? (
            <Empty className="p-4">{empty}</Empty>
          ) : (
            children
          )}
        </ScrollAreaContent>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar>
        <ScrollAreaThumb />
      </ScrollAreaScrollbar>
    </ScrollArea>
  )

  const surface =
    "flex w-full flex-col gap-1 rounded-surface border bg-muted/(--glass-opacity) pt-1.5 backdrop-surface group-data-collapsed/board-column:pb-2"

  return (
    <li
      data-slot="board-column"
      data-collapsed={collapsed ? "" : undefined}
      className={cn(
        "group/board-column flex max-w-(--board-column-max-width) min-w-(--board-column-min-width) flex-1 data-collapsed:max-w-none data-collapsed:min-w-0 data-collapsed:flex-none",
        className,
      )}
      {...props}
    >
      <HeadingLevelContext value={groupHeadingLevel}>
        {collapsible ? (
          <Collapsible
            render={<section aria-labelledby={titleId} />}
            className={surface}
            open={!collapsed}
            onOpenChange={(open, details) => {
              onCollapsedChange?.(!open, details)
              if (!details.canceled) setUncontrolled(!open)
            }}
          >
            {header}
            <CollapsiblePanel>{body}</CollapsiblePanel>
          </Collapsible>
        ) : (
          <section aria-labelledby={titleId} className={surface}>
            {header}
            {body}
          </section>
        )}
      </HeadingLevelContext>
    </li>
  )
}

type BoardColumnGroupProps = Omit<ComponentProps<"section">, "title"> & {
  title: string
  count?: number | ReactNode
}

function BoardColumnGroup({ title, count, className, children, ...props }: BoardColumnGroupProps) {
  const titleId = useId()
  const Heading = `h${use(HeadingLevelContext)}` as const
  return (
    <section
      aria-labelledby={titleId}
      data-slot="board-column-group"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    >
      <div data-slot="board-column-group-header" className="flex items-center gap-2 px-1 pt-1">
        <Heading id={titleId} className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
          {title}
        </Heading>
        <Count value={count} />
      </div>
      {children}
    </section>
  )
}

export { BoardColumn, BoardColumnGroup, boardColumnLabels }
export type { BoardColumnGroupProps, BoardColumnLabels, BoardColumnProps }
