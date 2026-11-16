"use client"

import { Button } from "@ui-sdk/react/button"
import { ListboxItem } from "@ui-sdk/react/listbox"
import { renderElement, type PartProps } from "@ui-sdk/react/primitive"
import { createElement, useEffect, useLayoutEffect, useState, type ReactElement, type ReactNode } from "react"

import { useListContext, type ListVariant } from "@/components/ui/list"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Tone } from "@/lib/tone"
import { cn } from "@/lib/utils"

const rowClassNames = {
  row: "rounded-control hover:bg-accent/60 data-selected:bg-accent data-selected:text-accent-foreground",
  card: "rounded-lg border bg-card/(--glass-opacity) text-card-foreground shadow-surface backdrop-surface hover:border-ring data-selected:border-primary data-selected:ring-1 data-selected:ring-primary",
} satisfies Record<ListVariant, string>

const stretchedClassNames = {
  row: "after:rounded-control",
  card: "after:rounded-lg",
} satisfies Record<ListVariant, string>

const toneClassNames = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
} satisfies Record<Tone, string>

/** An icon on a tinted square, for a row's `leading`. */
function IconTile({ tone = "neutral", className, render, ...props }: PartProps<"span"> & { tone?: Tone }) {
  return renderElement(
    "span",
    {
      "aria-hidden": true,
      "data-slot": "icon-tile",
      className: cn(
        "flex size-8 shrink-0 items-center justify-center rounded-control [&_svg]:size-4",
        toneClassNames[tone],
        className,
      ),
      ...props,
    },
    render,
  )
}

function useTruncated(node: HTMLElement | null) {
  const [truncated, setTruncated] = useState(false)
  useEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return
    const measure = () => setTruncated(node.scrollHeight - node.clientHeight > 1)
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    measure()
    return () => observer.disconnect()
  }, [node])
  return truncated
}

function ListItemTitle({ className, render, ...props }: PartProps<"span">) {
  return renderElement(
    "span",
    {
      "data-slot": "list-item-title",
      className: cn("line-clamp-2 min-w-0 text-body font-medium break-words", className),
      ...props,
    },
    render,
  )
}

function ListItemMeta({ className, render, ...props }: PartProps<"div">) {
  return renderElement(
    "div",
    {
      "data-slot": "list-item-meta",
      className: cn("flex flex-wrap items-center gap-inline text-caption text-muted-foreground", className),
      ...props,
    },
    render,
  )
}

// Above the stretched link or button, so each action stays its own target. On a narrow row, the trailing
// content and the actions wrap onto their own line instead of squeezing the title.
function ListItemActions({ className, render, ...props }: PartProps<"div">) {
  return renderElement(
    "div",
    {
      "data-slot": "list-item-actions",
      className: cn("relative z-10 flex shrink-0 items-center gap-inline self-center", className),
      ...props,
    },
    render,
  )
}

type ListItemProps = {
  id: string
  title: string
  leading?: ReactNode
  subtitle?: ReactNode
  /** A StatusPill; on a narrow row it wraps below the title instead of squeezing it. */
  status?: ReactNode
  /** Inline chips. */
  meta?: ReactNode
  /** An avatar or a time, at the end. */
  trailing?: ReactNode
  /** Buttons or a menu. Rows of a selectable List are options, which can't hold controls, so it ignores them. */
  actions?: ReactNode
  selected?: boolean
  href?: string
  onSelect?: () => void
  /** Overrides the List's variant. */
  variant?: ListVariant
  className?: string
}

function ListItem({
  id,
  title,
  leading,
  subtitle,
  status,
  meta,
  trailing,
  actions,
  selected = false,
  href,
  onSelect,
  variant: variantProp,
  className,
}: ListItemProps) {
  const context = useListContext()
  const variant = variantProp ?? context?.variant ?? "row"
  const option = context?.selectable ?? false
  const [titleNode, setTitleNode] = useState<HTMLElement | null>(null)
  const truncated = useTruncated(titleNode)
  const [primary, setPrimary] = useState<HTMLElement | null>(null)
  const register = context?.register

  useLayoutEffect(() => {
    if (!register || option) return
    return register(id, {
      label: title,
      activate: () => {
        if (href) {
          if (!primary) return false
          // Marks the click as already selected, so the link only follows itself.
          primary.dataset.selecting = ""
          primary.click()
          return true
        }
        if (!onSelect) return false
        onSelect()
        return true
      },
    })
  }, [register, option, id, title, href, onSelect, primary])

  useLayoutEffect(() => {
    if (!register || !option) return
    return register(id, { label: title, activate: () => false })
  }, [register, option, id, title])

  const titleText = (
    <ListItemTitle ref={setTitleNode} title={option && truncated ? title : undefined}>
      {title}
    </ListItemTitle>
  )
  const pressable = !option && (href !== undefined || onSelect !== undefined)
  const primaryProps = {
    ref: setPrimary,
    "data-slot": "list-item-primary",
    "aria-current": selected ? (href ? ("page" as const) : ("true" as const)) : undefined,
    className: cn(
      "min-w-0 cursor-pointer text-start outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-ring",
      stretchedClassNames[variant],
    ),
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      const target = event.currentTarget
      if (target.dataset.selecting !== undefined) {
        delete target.dataset.selecting
        return
      }
      if (context && !context.select(id, event.nativeEvent)) {
        event.preventDefault()
        return
      }
      if (!href) onSelect?.()
    },
    children: titleText,
  }
  const element: ReactElement<Record<string, unknown>> = href
    ? createElement("a", { href, ...primaryProps })
    : createElement(Button, primaryProps as Record<string, unknown>)
  let heading: ReactNode = titleText
  if (pressable) {
    // Always mounted, so the trigger keeps its element (and focus) when the title starts or stops fitting.
    heading = (
      <Tooltip type="label" disabled={!truncated}>
        <TooltipTrigger render={element} />
        <TooltipContent>{title}</TooltipContent>
      </Tooltip>
    )
  }

  const body = (
    <>
      <div className="flex min-w-0 grow basis-60 items-start gap-items">
        {leading && (
          <span
            data-slot="list-item-leading"
            className="flex min-h-lh shrink-0 items-center text-muted-foreground [&_svg]:size-4"
          >
            {leading}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-inline">
          <div className="flex flex-wrap items-start gap-x-items gap-y-inline">
            <div className="flex min-w-0 grow basis-48">{heading}</div>
            {status && <div className="relative z-10 flex shrink-0 items-center">{status}</div>}
          </div>
          {subtitle && <div className="line-clamp-1 text-body-sm text-muted-foreground">{subtitle}</div>}
          {meta && <ListItemMeta className="relative z-10 w-fit">{meta}</ListItemMeta>}
        </div>
      </div>
      {trailing && (
        <div className="relative z-10 ms-auto flex shrink-0 items-center gap-inline self-center text-caption text-muted-foreground">
          {trailing}
        </div>
      )}
      {actions && !option && <ListItemActions>{actions}</ListItemActions>}
    </>
  )

  const rowClassName = cn(
    "group/list-item relative flex min-w-0 flex-wrap items-start gap-items px-inset-item py-inset-item transition-colors duration-micro ease-standard",
    rowClassNames[variant],
    className,
  )

  if (option) {
    return (
      <ListboxItem
        value={id}
        data-slot="list-item"
        data-variant={variant}
        className={cn(rowClassName, "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring")}
      >
        {body}
      </ListboxItem>
    )
  }
  return (
    <li
      data-slot="list-item"
      data-variant={variant}
      data-selected={selected ? "" : undefined}
      data-pressable={pressable ? "" : undefined}
      className={rowClassName}
    >
      {body}
    </li>
  )
}

export { IconTile, ListItem, ListItemActions, ListItemMeta, ListItemTitle }
export { List, ListGroup } from "@/components/ui/list"
export type { ListItemProps }
export type { ListGroupProps, ListProps, ListVariant } from "@/components/ui/list"
