"use client"

import { createContext, use, useId, type ComponentProps, type ReactElement, type ReactNode } from "react"

import { Link, type LinkProps } from "@/components/ui/link"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const SidebarRailContext = createContext(false)

type SidebarGroupProps = Omit<ComponentProps<"div">, "children"> & {
  /** Shown above the items and names their list. Leave it out for items that need no heading, like the first ones. */
  label?: string
  /** `muted` quiets the group's items, like sections on their way out; the current page keeps its fill. */
  tone?: "default" | "muted"
  children: ReactNode
}

function SidebarGroup({ label, tone = "default", className, children, ...props }: SidebarGroupProps) {
  const labelId = useId()
  return (
    <div
      data-slot="sidebar-group"
      data-tone={tone === "muted" ? "muted" : undefined}
      className={cn("group/sidebar-group flex flex-col gap-inline", className)}
      {...props}
    >
      {label !== undefined && (
        <div
          id={labelId}
          data-slot="sidebar-group-label"
          className="truncate px-inset-item text-xs font-medium text-muted-foreground group-data-collapsed/sidebar:sr-only"
        >
          {label}
        </div>
      )}
      <ul aria-labelledby={label === undefined ? undefined : labelId} className="flex flex-col gap-px">
        {children}
      </ul>
    </div>
  )
}

type SidebarItemProps = Omit<LinkProps, "children" | "current" | "variant" | "render"> & {
  icon?: ReactNode
  current?: boolean
  badge?: ReactNode
  render?: ReactElement<Record<string, unknown>>
  children: string
}

const itemClassName =
  "flex h-control w-full min-w-0 pointer-coarse:h-(--control-height-touch) items-center gap-inline rounded-control px-inset-item text-sm font-normal text-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:nav-current group-data-[tone=muted]/sidebar-group:not-aria-[current=page]:text-muted-foreground group-data-collapsed/sidebar:justify-center group-data-collapsed/sidebar:px-0 [&_svg]:size-4 [&_svg]:shrink-0"

function SidebarItem({ icon, current = false, badge, render, className, children, ...props }: SidebarItemProps) {
  const rail = use(SidebarRailContext)
  const linkProps = {
    "data-slot": "sidebar-item",
    "data-current": current ? "" : undefined,
    current,
    variant: "plain" as const,
    className: cn(itemClassName, className),
    ...props,
  }
  const content = (
    <>
      {icon}
      <span className="min-w-0 flex-1 truncate group-data-collapsed/sidebar:sr-only">{children}</span>
      {badge !== undefined && <span className="ms-auto text-xs group-data-collapsed/sidebar:hidden">{badge}</span>}
    </>
  )
  return (
    <li data-slot="sidebar-item-container">
      {rail ? (
        <Tooltip type="label">
          <TooltipTrigger render={<Link {...linkProps} render={render} />}>{content}</TooltipTrigger>
          <TooltipContent side="right">{children}</TooltipContent>
        </Tooltip>
      ) : (
        <Link {...linkProps} render={render}>
          {content}
        </Link>
      )}
    </li>
  )
}

export { SidebarGroup, SidebarItem, SidebarRailContext }
export type { SidebarGroupProps, SidebarItemProps }
