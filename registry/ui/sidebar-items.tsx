"use client"

import { createContext, use, useId, type ComponentProps, type ReactElement, type ReactNode } from "react"
import { ChevronRightIcon } from "lucide-react"

import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Link, type LinkProps } from "@/components/ui/link"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const SidebarRailContext = createContext(false)

type CollapsibleProps = ComponentProps<typeof Collapsible>

type SidebarGroupProps = Omit<ComponentProps<"div">, "children"> & {
  /** Shown above the items and names their list. Leave it out for items that need no heading, like the first ones. */
  label?: string
  /** `muted` quiets the group's items, like sections on their way out; the current page keeps its fill. */
  tone?: "default" | "muted"
  /**
   * Folds the items under the label, which becomes a button with a chevron, like a docs section. Needs a `label`. In
   * the icon rail the items always show, since the rail has no labels to press.
   */
  collapsible?: boolean
  /** Whether a collapsible group is open; pair it with `onOpenChange`. */
  open?: boolean
  /** Whether a collapsible group starts open. Open by default. */
  defaultOpen?: boolean
  onOpenChange?: CollapsibleProps["onOpenChange"]
  children: ReactNode
}

const groupClassName = "group/sidebar-group flex flex-col gap-inline"
const listClassName = "flex flex-col gap-px"

const groupTriggerClassName =
  "h-control min-h-0 w-full min-w-0 pointer-coarse:h-(--control-height-touch) justify-start px-inset-item text-xs text-muted-foreground font-medium focus-visible:ring-offset-0 [&_[data-slot=sidebar-group-chevron]]:size-3.5"

function SidebarGroup({
  label,
  tone = "default",
  collapsible = false,
  open,
  defaultOpen = true,
  onOpenChange,
  className,
  children,
  ...props
}: SidebarGroupProps) {
  const labelId = useId()
  const rail = use(SidebarRailContext)
  const tonal = tone === "muted" ? "muted" : undefined

  if (collapsible && label !== undefined && !rail) {
    return (
      <Collapsible
        open={open}
        defaultOpen={open === undefined ? defaultOpen : undefined}
        onOpenChange={onOpenChange}
        className={cn(groupClassName, className)}
        render={(part) => <div {...part} {...props} data-slot="sidebar-group" data-tone={tonal} data-collapsible="" />}
      >
        <CollapsibleTrigger
          className={groupTriggerClassName}
          render={(part) => <button {...part} data-slot="sidebar-group-trigger" />}
        >
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {/* Mirrored in right-to-left, so it turns the other way to point down when open. */}
          <ChevronRightIcon
            data-slot="sidebar-group-chevron"
            className="transition-transform duration-micro ease-standard group-data-open/collapsible-trigger:rotate-90 rtl:-scale-x-100 rtl:group-data-open/collapsible-trigger:-rotate-90 motion-reduce:transition-none"
          />
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <ul aria-label={label} className={cn(listClassName, "ms-(--item-padding-x) border-s ps-inline")}>
            {children}
          </ul>
        </CollapsiblePanel>
      </Collapsible>
    )
  }

  return (
    <div data-slot="sidebar-group" data-tone={tonal} className={cn(groupClassName, className)} {...props}>
      {label !== undefined && (
        <div
          id={labelId}
          data-slot="sidebar-group-label"
          className="truncate px-inset-item text-xs font-medium text-muted-foreground group-data-collapsed/sidebar:sr-only"
        >
          {label}
        </div>
      )}
      <ul aria-labelledby={label === undefined ? undefined : labelId} className={listClassName}>
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
